/**
 * Ship It audio — the #160 oscillator kit, re-cued for the maze-chase.
 *
 * Square and triangle voices only, scheduled at runtime from specs; there is
 * no sample, buffer or fetch. Sound defaults off, remembers intent under the
 * Ship It storage key, and never constructs an AudioContext before a user
 * gesture unlocks it.
 */
export const SHIPIT_SOUND_STORAGE_KEY = 'abhishek.portfolio.shipit.sound';
const STORAGE_ON = 'on';
const STORAGE_OFF = 'off';

export type ShipItSoundEvent = 'pellet' | 'energizer' | 'eat' | 'death' | 'won' | 'lost';

type VoiceSpec = Readonly<{
  waveform: OscillatorType;
  startOffset: number;
  duration: number;
  attack: number;
  peakGain: number;
  startFrequency: number;
  endFrequency: number;
}>;

/** Original cue vocabulary — short envelopes, no siren loop (spec R29). */
export const SHIPIT_SYNTHESIS: Readonly<Record<ShipItSoundEvent, readonly VoiceSpec[]>> = {
  pellet: [
    {
      waveform: 'triangle',
      startOffset: 0,
      duration: 0.05,
      attack: 0.004,
      peakGain: 0.05,
      startFrequency: 588,
      endFrequency: 554,
    },
  ],
  energizer: [
    {
      waveform: 'square',
      startOffset: 0,
      duration: 0.14,
      attack: 0.004,
      peakGain: 0.062,
      startFrequency: 233,
      endFrequency: 349,
    },
    {
      waveform: 'triangle',
      startOffset: 0.06,
      duration: 0.11,
      attack: 0.005,
      peakGain: 0.04,
      startFrequency: 466,
      endFrequency: 587,
    },
  ],
  eat: [
    {
      waveform: 'square',
      startOffset: 0,
      duration: 0.09,
      attack: 0.003,
      peakGain: 0.068,
      startFrequency: 392,
      endFrequency: 523,
    },
  ],
  death: [
    {
      waveform: 'square',
      startOffset: 0,
      duration: 0.24,
      attack: 0.004,
      peakGain: 0.076,
      startFrequency: 208,
      endFrequency: 72,
    },
    {
      waveform: 'triangle',
      startOffset: 0.07,
      duration: 0.18,
      attack: 0.006,
      peakGain: 0.034,
      startFrequency: 262,
      endFrequency: 110,
    },
  ],
  won: [
    {
      waveform: 'triangle',
      startOffset: 0,
      duration: 0.07,
      attack: 0.004,
      peakGain: 0.054,
      startFrequency: 294,
      endFrequency: 277,
    },
    {
      waveform: 'square',
      startOffset: 0.09,
      duration: 0.05,
      attack: 0.003,
      peakGain: 0.038,
      startFrequency: 440,
      endFrequency: 415,
    },
    {
      waveform: 'triangle',
      startOffset: 0.2,
      duration: 0.09,
      attack: 0.004,
      peakGain: 0.058,
      startFrequency: 349,
      endFrequency: 330,
    },
  ],
  lost: [
    {
      waveform: 'square',
      startOffset: 0,
      duration: 0.28,
      attack: 0.004,
      peakGain: 0.078,
      startFrequency: 123,
      endFrequency: 55,
    },
    {
      waveform: 'triangle',
      startOffset: 0.06,
      duration: 0.2,
      attack: 0.006,
      peakGain: 0.034,
      startFrequency: 196,
      endFrequency: 98,
    },
  ],
};

function pelletJitter(variant: number): number {
  const stable = ((Math.trunc(variant) * 31) % 23 + 23) % 23;
  return (stable - 11) * 0.9;
}

export type ShipItVoice = Readonly<{
  oscillator: OscillatorNode;
  gain: GainNode;
}>;

function scheduleVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  spec: VoiceSpec,
  baseTime: number,
  frequencyJitter: number,
): ShipItVoice {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = baseTime + spec.startOffset;
  const end = start + spec.duration;

  oscillator.type = spec.waveform;
  oscillator.frequency.setValueAtTime(spec.startFrequency + frequencyJitter, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    spec.endFrequency + frequencyJitter * 0.5,
    end,
  );
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(spec.peakGain, start + spec.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.addEventListener(
    'ended',
    () => {
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true },
  );
  oscillator.start(start);
  oscillator.stop(end + 0.005);
  return { oscillator, gain };
}

export function scheduleShipItSound(
  context: BaseAudioContext,
  destination: AudioNode,
  event: ShipItSoundEvent,
  variant = 0,
  when = context.currentTime,
): ShipItVoice[] {
  const specs = SHIPIT_SYNTHESIS[event];
  const voices = new Array<ShipItVoice>(specs.length);
  const jitter = event === 'pellet' ? pelletJitter(variant) : 0;
  for (let i = 0; i < specs.length; i++) {
    voices[i] = scheduleVoice(context, destination, specs[i]!, when, jitter);
  }
  return voices;
}

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

type ShipItAudioOptions = Readonly<{
  storage?: StoragePort | null;
  createContext?: () => AudioContext;
}>;

export type ShipItAudio = Readonly<{
  isEnabled(): boolean;
  isUnlocked(): boolean;
  setEnabled(enabled: boolean): void;
  unlock(): Promise<boolean>;
  play(event: ShipItSoundEvent, variant?: number): boolean;
  stop(): void;
  dispose(): void;
}>;

function browserStorage(): StoragePort | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storedPreference(storage: StoragePort | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(SHIPIT_SOUND_STORAGE_KEY) === STORAGE_ON;
  } catch {
    return false;
  }
}

export function createShipItAudio(options: ShipItAudioOptions = {}): ShipItAudio {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const createContext = options.createContext ?? (() => new AudioContext());
  const active = new Set<ShipItVoice>();
  let enabled = storedPreference(storage);
  let context: AudioContext | null = null;
  let resumePending = false;
  let disposed = false;

  function remember(next: boolean): void {
    if (!storage) return;
    try {
      storage.setItem(SHIPIT_SOUND_STORAGE_KEY, next ? STORAGE_ON : STORAGE_OFF);
    } catch {
      // A denied storage write must not make the control unusable.
    }
  }

  function stopVoice(voice: ShipItVoice): void {
    try {
      voice.oscillator.stop();
    } catch {
      // An already-ended oscillator is harmless.
    }
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    active.delete(voice);
  }

  function stopActive(): void {
    for (const voice of active) stopVoice(voice);
    active.clear();
  }

  return {
    isEnabled(): boolean {
      return enabled;
    },
    isUnlocked(): boolean {
      return context?.state === 'running';
    },
    setEnabled(next: boolean): void {
      if (disposed || enabled === next) return;
      enabled = next;
      remember(next);
      if (!next) stopActive();
    },
    async unlock(): Promise<boolean> {
      if (disposed || !enabled) return false;
      if (!context || context.state === 'closed') context = createContext();
      const pending = context;
      resumePending = pending.state !== 'running';
      try {
        if (resumePending) await pending.resume();
      } catch {
        if (context === pending && pending.state === 'closed') context = null;
        return false;
      } finally {
        resumePending = false;
      }
      return !disposed && context === pending && pending.state === 'running';
    },
    play(event: ShipItSoundEvent, variant = 0): boolean {
      if (
        disposed ||
        !enabled ||
        !context ||
        (context.state !== 'running' && !resumePending)
      ) {
        return false;
      }
      const voices = scheduleShipItSound(context, context.destination, event, variant);
      for (const voice of voices) {
        active.add(voice);
        voice.oscillator.addEventListener('ended', () => active.delete(voice), { once: true });
      }
      return true;
    },
    stop(): void {
      stopActive();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      enabled = false;
      resumePending = false;
      stopActive();
      if (context && context.state !== 'closed') void context.close();
      context = null;
    },
  };
}
