import { describe, expect, it, vi } from 'vitest';
import {
  SHIPIT_SOUND_STORAGE_KEY,
  SHIPIT_SYNTHESIS,
  createShipItAudio,
  scheduleShipItSound,
} from './audio';

type PromiseWithResolvers = {
  withResolvers<T>(): { promise: Promise<T>; resolve(value: T | PromiseLike<T>): void };
};

// Node 24 provides this API; ES2022 lib declarations intentionally do not.
const promiseWithResolvers = Promise as unknown as PromiseWithResolvers;

type ParamCall = readonly [kind: 'set' | 'linear' | 'exponential', value: number, time: number];

class FakeParam {
  readonly calls: ParamCall[] = [];

  setValueAtTime(value: number, time: number): void {
    this.calls.push(['set', value, time]);
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.calls.push(['linear', value, time]);
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.calls.push(['exponential', value, time]);
  }
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam();
  readonly starts: number[] = [];
  readonly stops: Array<number | undefined> = [];
  disconnected = false;
  private readonly ended: Array<() => void> = [];

  connect(): FakeGain {
    return undefined as unknown as FakeGain;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'ended') return;
    this.ended.push(() => {
      if (typeof listener === 'function') listener(new Event('ended'));
      else listener.handleEvent(new Event('ended'));
    });
  }

  start(time: number): void {
    this.starts.push(time);
  }

  stop(time?: number): void {
    this.stops.push(time);
  }

  finish(): void {
    for (const listener of this.ended) listener();
  }
}

class FakeGain {
  readonly gain = new FakeParam();
  disconnected = false;

  connect(): void {}

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeContext {
  currentTime = 2;
  state: AudioContextState = 'suspended';
  readonly destination = {} as AudioDestinationNode;
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  resumeCalls = 0;
  closeCalls = 0;
  deferResume = false;
  private finishPendingResume: (() => void) | null = null;

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.deferResume) {
      this.state = 'running';
      return Promise.resolve();
    }
    const { promise, resolve } = promiseWithResolvers.withResolvers<void>();
    this.finishPendingResume = () => {
      if (this.state !== 'closed') this.state = 'running';
      resolve();
    };
    return promise;
  }

  finishResume(): void {
    this.finishPendingResume?.();
    this.finishPendingResume = null;
  }

  async close(): Promise<void> {
    this.closeCalls++;
    this.state = 'closed';
  }
}

class FakeStorage {
  readonly values = new Map<string, string>();
  getItemCalls = 0;
  setItemCalls: Array<readonly [string, string]> = [];

  getItem(key: string): string | null {
    this.getItemCalls++;
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.setItemCalls.push([key, value]);
  }
}

function schedule(
  fake: FakeContext,
  event: keyof typeof SHIPIT_SYNTHESIS,
  variant = 0,
  when?: number,
) {
  return scheduleShipItSound(
    fake as unknown as BaseAudioContext,
    fake.destination,
    event,
    variant,
    when,
  );
}

describe('shipit audio scheduler', () => {
  it('pins the waveform vocabulary: square and triangle only', () => {
    for (const voices of Object.values(SHIPIT_SYNTHESIS)) {
      for (const voice of voices) {
        expect(['square', 'triangle']).toContain(voice.waveform);
        expect(voice.duration).toBeLessThan(0.35);
      }
    }
  });

  it('covers every gameplay cue exactly once by name', () => {
    expect(Object.keys(SHIPIT_SYNTHESIS).sort()).toEqual(
      ['death', 'eat', 'energizer', 'lost', 'pellet', 'won'].sort(),
    );
  });

  it('schedules one voice per spec at the requested time', () => {
    const fake = new FakeContext();
    const voices = schedule(fake, 'eat');
    expect(voices).toHaveLength(SHIPIT_SYNTHESIS.eat!.length);
    expect(fake.oscillators[0]!.type).toBe('square');
    expect(fake.oscillators[0]!.starts[0]).toBe(2);
  });

  it('applies envelope ramps per voice spec', () => {
    const fake = new FakeContext();
    schedule(fake, 'energizer');
    const first = fake.gains[0]!;
    const kinds = first.gain.calls.map(([kind]) => kind);
    expect(kinds).toEqual(['set', 'linear', 'exponential']);
  });

  it('jitters only pellet pitch, deterministically per variant', () => {
    const fakeA = new FakeContext();
    const fakeB = new FakeContext();
    schedule(fakeA, 'pellet', 5);
    schedule(fakeB, 'pellet', 5);
    expect(fakeA.oscillators[0]!.frequency.calls[0]).toEqual(fakeB.oscillators[0]!.frequency.calls[0]);
    // Non-pellet events get zero jitter regardless of variant.
    const fakeC = new FakeContext();
    schedule(fakeC, 'eat', 9);
    expect(fakeC.oscillators[0]!.frequency.calls[0]![1]).toBe(SHIPIT_SYNTHESIS.eat![0]!.startFrequency);
  });
});

describe('shipit audio ownership', () => {
  it('defaults off without creating a context or scheduling audio', async () => {
    const storage = new FakeStorage();
    const context = new FakeContext();
    const createContext = vi.fn(() => context as unknown as AudioContext);
    const audio = createShipItAudio({ storage, createContext });

    expect(audio.isEnabled()).toBe(false);
    expect(audio.isUnlocked()).toBe(false);
    expect(audio.play('pellet')).toBe(false);
    await audio.unlock();
    expect(createContext).not.toHaveBeenCalled();
    expect(context.oscillators).toHaveLength(0);
  });

  it('remembers an enabled preference under the Ship It key', async () => {
    const storage = new FakeStorage();
    const context = new FakeContext();
    const audio = createShipItAudio({
      storage,
      createContext: () => context as unknown as AudioContext,
    });
    audio.setEnabled(true);
    await audio.unlock();

    expect(audio.isEnabled()).toBe(true);
    expect(storage.setItemCalls).toContainEqual([SHIPIT_SOUND_STORAGE_KEY, 'on']);
    expect(context.state).toBe('running');

    const fresh = createShipItAudio({ storage, createContext: () => new FakeContext() as unknown as AudioContext });
    expect(fresh.isEnabled()).toBe(true);
  });

  it('creates no context before unlock even when enabled', () => {
    const storage = new FakeStorage();
    storage.values.set(SHIPIT_SOUND_STORAGE_KEY, 'on');
    const createContext = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const audio = createShipItAudio({ storage, createContext });
    expect(audio.isEnabled()).toBe(true);
    expect(audio.play('won')).toBe(false);
    expect(createContext).not.toHaveBeenCalled();
  });

  it('plays through a running context after unlock', async () => {
    const context = new FakeContext();
    const audio = createShipItAudio({
      storage: new FakeStorage(),
      createContext: () => context as unknown as AudioContext,
    });
    audio.setEnabled(true);
    expect(await audio.unlock()).toBe(true);
    expect(audio.play('death')).toBe(true);
    expect(context.oscillators.length).toBeGreaterThan(0);
  });

  it('mute stops active voices and disconnects their nodes', async () => {
    const context = new FakeContext();
    const audio = createShipItAudio({
      storage: new FakeStorage(),
      createContext: () => context as unknown as AudioContext,
    });
    audio.setEnabled(true);
    await audio.unlock();
    audio.play('eat');
    audio.setEnabled(false);

    for (const oscillator of context.oscillators) {
      expect(oscillator.disconnected).toBe(true);
    }
    for (const gain of context.gains) {
      expect(gain.disconnected).toBe(true);
    }
  });

  it('dispose closes the owned context exactly once', async () => {
    const context = new FakeContext();
    context.deferResume = true;
    const audio = createShipItAudio({
      storage: new FakeStorage(),
      createContext: () => context as unknown as AudioContext,
    });
    audio.setEnabled(true);
    const unlocked = audio.unlock();
    context.finishResume();
    expect(await unlocked).toBe(true);

    audio.dispose();
    audio.dispose();
    expect(context.closeCalls).toBe(1);
    expect(audio.isEnabled()).toBe(false);
  });

  it('survives denied storage writes', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const audio = createShipItAudio({ storage: throwing });
    expect(audio.isEnabled()).toBe(false);
    expect(() => audio.setEnabled(true)).not.toThrow();
    expect(audio.isEnabled()).toBe(true);
  });
});
