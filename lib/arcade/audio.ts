export const ARCADE_SOUND_STORAGE_KEY = 'abhishek.portfolio.arcade.sound';
const STORAGE_ON = 'on';
const STORAGE_OFF = 'off';

export type ArcadeSoundEvent = 'reading' | 'collision' | 'won' | 'lost';

type VoiceSpec = Readonly<{
  waveform: OscillatorType;
  startOffset: number;
  duration: number;
  attack: number;
  peakGain: number;
  startFrequency: number;
  endFrequency: number;
}>;

export const ARCADE_SYNTHESIS: Readonly<Record<ArcadeSoundEvent, readonly VoiceSpec[]>> = {
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
};

function readingJitter(variant: number): number {
  const stable = ((Math.trunc(variant) * 37) % 29 + 29) % 29;
  return (stable - 14) * 0.7;
}

export type ArcadeVoice = Readonly<{
  oscillator: OscillatorNode;
  gain: GainNode;
}>;

function scheduleVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  spec: VoiceSpec,
  baseTime: number,
  frequencyJitter: number,
): ArcadeVoice {
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

export function scheduleArcadeSound(
  context: BaseAudioContext,
  destination: AudioNode,
  event: ArcadeSoundEvent,
  variant = 0,
  when = context.currentTime,
): ArcadeVoice[] {
  const specs = ARCADE_SYNTHESIS[event];
  const voices = new Array<ArcadeVoice>(specs.length);
  const jitter = event === 'reading' ? readingJitter(variant) : 0;
  for (let i = 0; i < specs.length; i++) {
    voices[i] = scheduleVoice(context, destination, specs[i]!, when, jitter);
  }
  return voices;
}

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

type ArcadeAudioOptions = Readonly<{
  storage?: StoragePort | null;
  createContext?: () => AudioContext;
}>;

export type ArcadeAudio = Readonly<{
  isEnabled(): boolean;
  isUnlocked(): boolean;
  setEnabled(enabled: boolean): void;
  unlock(): Promise<boolean>;
  play(event: ArcadeSoundEvent, variant?: number): boolean;
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
    return storage.getItem(ARCADE_SOUND_STORAGE_KEY) === STORAGE_ON;
  } catch {
    return false;
  }
}

export function createArcadeAudio(options: ArcadeAudioOptions = {}): ArcadeAudio {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const createContext = options.createContext ?? (() => new AudioContext());
  const active = new Set<ArcadeVoice>();
  let enabled = storedPreference(storage);
  let context: AudioContext | null = null;
  let resumePending = false;
  let disposed = false;

  function remember(next: boolean): void {
    if (!storage) return;
    try {
      storage.setItem(ARCADE_SOUND_STORAGE_KEY, next ? STORAGE_ON : STORAGE_OFF);
    } catch {
      // A denied storage write must not make the control unusable.
    }
  }

  function stopVoice(voice: ArcadeVoice): void {
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
    play(event: ArcadeSoundEvent, variant = 0): boolean {
      if (
        disposed ||
        !enabled ||
        !context ||
        (context.state !== 'running' && !resumePending)
      ) {
        return false;
      }
      const voices = scheduleArcadeSound(context, context.destination, event, variant);
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
