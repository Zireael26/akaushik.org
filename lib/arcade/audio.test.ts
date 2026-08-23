import { describe, expect, it, vi } from 'vitest';
import {
  ARCADE_SOUND_STORAGE_KEY,
  ARCADE_SYNTHESIS,
  createArcadeAudio,
  scheduleArcadeSound,
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
  event: 'reading' | 'collision' | 'won' | 'lost',
  variant = 0,
  when?: number,
) {
  return scheduleArcadeSound(
    fake as unknown as BaseAudioContext,
    fake.destination,
    event,
    variant,
    when,
  );
}

describe('arcade audio scheduler', () => {
  it('pins the original waveform, envelope and frequency vocabulary', () => {
    expect(ARCADE_SYNTHESIS).toEqual({
      reading: [
        {
          waveform: 'triangle',
          startOffset: 0,
          duration: 0.055,
          attack: 0.004,
          peakGain: 0.055,
          startFrequency: 612,
          endFrequency: 576,
        },
      ],
      collision: [
        {
          waveform: 'square',
          startOffset: 0,
          duration: 0.18,
          attack: 0.003,
          peakGain: 0.072,
          startFrequency: 168,
          endFrequency: 92,
        },
        {
          waveform: 'triangle',
          startOffset: 0.038,
          duration: 0.09,
          attack: 0.004,
          peakGain: 0.035,
          startFrequency: 286,
          endFrequency: 238,
        },
      ],
      won: [
        {
          waveform: 'triangle',
          startOffset: 0,
          duration: 0.065,
          attack: 0.004,
          peakGain: 0.052,
          startFrequency: 287,
          endFrequency: 273,
        },
        {
          waveform: 'square',
          startOffset: 0.085,
          duration: 0.05,
          attack: 0.003,
          peakGain: 0.038,
          startFrequency: 419,
          endFrequency: 391,
        },
        {
          waveform: 'triangle',
          startOffset: 0.215,
          duration: 0.085,
          attack: 0.004,
          peakGain: 0.058,
          startFrequency: 343,
          endFrequency: 319,
        },
      ],
      lost: [
        {
          waveform: 'square',
          startOffset: 0,
          duration: 0.26,
          attack: 0.004,
          peakGain: 0.078,
          startFrequency: 132,
          endFrequency: 61,
        },
        {
          waveform: 'triangle',
          startOffset: 0.06,
          duration: 0.19,
          attack: 0.006,
          peakGain: 0.034,
          startFrequency: 207,
          endFrequency: 118,
        },
      ],
    });
  });

  it('schedules a dry triangle reading tick with bounded continuous jitter', () => {
    const context = new FakeContext();
    const voices = schedule(context, 'reading', 8);
    expect(voices).toHaveLength(1);
    expect(context.oscillators[0]!.type).toBe('triangle');
    expect(context.oscillators[0]!.starts).toEqual([2]);
    expect(context.oscillators[0]!.stops[0]).toBeCloseTo(2.06);
    const startFrequency = context.oscillators[0]!.frequency.calls[0]![1];
    expect(startFrequency).toBeGreaterThanOrEqual(602.2);
    expect(startFrequency).toBeLessThanOrEqual(621.8);
    expect(context.gains[0]!.gain.calls).toEqual([
      ['set', 0.0001, 2],
      ['linear', 0.055, 2.004],
      ['exponential', 0.0001, 2.055],
    ]);
  });

  it.each([
    ['collision', 2, ['square', 'triangle']],
    ['won', 3, ['triangle', 'square', 'triangle']],
    ['lost', 2, ['square', 'triangle']],
  ] as const)('schedules the %s gesture without a buffer or asset', (event, count, waveforms) => {
    const context = new FakeContext();
    expect(schedule(context, event)).toHaveLength(count);
    expect(context.oscillators.map((oscillator) => oscillator.type)).toEqual(waveforms);
    expect(context.gains.every((gain) => gain.gain.calls.at(-1)?.[1] === 0.0001)).toBe(true);
  });

  it('accepts an explicit schedule time for a sequential offline render', () => {
    const context = new FakeContext();
    schedule(context, 'won', 0, 5);
    expect(context.oscillators.map((oscillator) => oscillator.starts[0])).toEqual([
      5,
      5.085,
      5.215,
    ]);
  });
});

describe('arcade audio ownership', () => {
  it('defaults off without creating a context or scheduling audio', async () => {
    const storage = new FakeStorage();
    const context = new FakeContext();
    const createContext = vi.fn(() => context as unknown as AudioContext);
    const audio = createArcadeAudio({ storage, createContext });

    expect(audio.isEnabled()).toBe(false);
    expect(audio.isUnlocked()).toBe(false);
    expect(await audio.unlock()).toBe(false);
    expect(audio.play('reading')).toBe(false);
    expect(createContext).not.toHaveBeenCalled();
    expect(context.oscillators).toHaveLength(0);
  });

  it('restores intent but waits for a fresh gesture to create and resume context', async () => {
    const storage = new FakeStorage();
    storage.values.set(ARCADE_SOUND_STORAGE_KEY, 'on');
    const context = new FakeContext();
    const createContext = vi.fn(() => context as unknown as AudioContext);
    const audio = createArcadeAudio({ storage, createContext });

    expect(audio.isEnabled()).toBe(true);
    expect(audio.isUnlocked()).toBe(false);
    expect(createContext).not.toHaveBeenCalled();
    expect(audio.play('reading')).toBe(false);
    expect(await audio.unlock()).toBe(true);
    expect(createContext).toHaveBeenCalledOnce();
    expect(context.resumeCalls).toBe(1);
    expect(audio.play('reading', 5)).toBe(true);
    expect(context.oscillators).toHaveLength(1);
  });

  it('can schedule a same-gesture cue while resume is pending', async () => {
    const storage = new FakeStorage();
    storage.values.set(ARCADE_SOUND_STORAGE_KEY, 'on');
    const context = new FakeContext();
    context.deferResume = true;
    const audio = createArcadeAudio({
      storage,
      createContext: () => context as unknown as AudioContext,
    });
    const unlocking = audio.unlock();
    expect(audio.play('reading')).toBe(true);
    expect(context.oscillators).toHaveLength(1);
    context.finishResume();
    expect(await unlocking).toBe(true);
  });

  it('recreates a context that the browser closed', async () => {
    const storage = new FakeStorage();
    storage.values.set(ARCADE_SOUND_STORAGE_KEY, 'on');
    const first = new FakeContext();
    const second = new FakeContext();
    const contexts = [first, second];
    const audio = createArcadeAudio({
      storage,
      createContext: () => contexts.shift()! as unknown as AudioContext,
    });
    await audio.unlock();
    await first.close();
    expect(await audio.unlock()).toBe(true);
    expect(second.resumeCalls).toBe(1);
  });

  it('persists opt-in without treating the toggle write as audio creation', () => {
    const storage = new FakeStorage();
    const createContext = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const audio = createArcadeAudio({ storage, createContext });
    audio.setEnabled(true);
    expect(audio.isEnabled()).toBe(true);
    expect(storage.setItemCalls).toEqual([[ARCADE_SOUND_STORAGE_KEY, 'on']]);
    expect(createContext).not.toHaveBeenCalled();
  });

  it('stops active voices on mute and prevents later scheduling', async () => {
    const storage = new FakeStorage();
    storage.values.set(ARCADE_SOUND_STORAGE_KEY, 'on');
    const context = new FakeContext();
    const audio = createArcadeAudio({
      storage,
      createContext: () => context as unknown as AudioContext,
    });
    await audio.unlock();
    audio.play('collision');
    audio.setEnabled(false);
    expect(context.oscillators.every((oscillator) => oscillator.stops.length === 2)).toBe(true);
    expect(context.oscillators.every((oscillator) => oscillator.disconnected)).toBe(true);
    expect(audio.play('lost')).toBe(false);
    expect(storage.values.get(ARCADE_SOUND_STORAGE_KEY)).toBe('off');
  });

  it('disconnects gains after natural end and flushes without changing preference', async () => {
    const storage = new FakeStorage();
    storage.values.set(ARCADE_SOUND_STORAGE_KEY, 'on');
    const context = new FakeContext();
    const audio = createArcadeAudio({
      storage,
      createContext: () => context as unknown as AudioContext,
    });
    await audio.unlock();
    audio.play('reading');
    context.oscillators[0]!.finish();
    expect(context.oscillators[0]!.disconnected).toBe(true);
    expect(context.gains[0]!.disconnected).toBe(true);
    audio.stop();
    expect(context.oscillators[0]!.stops).toHaveLength(1);
    expect(storage.values.get(ARCADE_SOUND_STORAGE_KEY)).toBe('on');
  });

  it('closes the owned context once and stays inert after disposal', async () => {
    const storage = new FakeStorage();
    storage.values.set(ARCADE_SOUND_STORAGE_KEY, 'on');
    const context = new FakeContext();
    const audio = createArcadeAudio({
      storage,
      createContext: () => context as unknown as AudioContext,
    });
    await audio.unlock();
    audio.dispose();
    audio.dispose();
    expect(context.closeCalls).toBe(1);
    expect(audio.isEnabled()).toBe(false);
    expect(audio.play('won')).toBe(false);
  });

  it('survives denied storage reads and writes', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('denied');
      }),
      setItem: vi.fn(() => {
        throw new Error('denied');
      }),
    };
    const audio = createArcadeAudio({ storage });
    expect(audio.isEnabled()).toBe(false);
    expect(() => audio.setEnabled(true)).not.toThrow();
    expect(audio.isEnabled()).toBe(true);
  });
});
