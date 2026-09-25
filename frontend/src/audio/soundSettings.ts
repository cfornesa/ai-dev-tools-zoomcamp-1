import type { SonicDefaults } from './sonicContract';

export const SOUND_SETTINGS_VERSION = 1;

export const SOUND_SCALES = [
  'major',
  'minor',
  'pentatonic',
  'chromatic',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'wholetone',
] as const;

export const SOUND_OSCILLATORS = ['sine', 'square', 'sawtooth', 'triangle'] as const;
export const SOUND_FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'] as const;

export type SoundSettings = {
  version: typeof SOUND_SETTINGS_VERSION;
  soundVolume: number;
  ambientBpm: number;
  ambientVolume: number;
  ambientMuted: boolean;
  ambientScale: (typeof SOUND_SCALES)[number];
  keyboardRoot: SonicDefaults['root'];
  keyboardScale: (typeof SOUND_SCALES)[number];
  keyboardTranspose: number;
  followKey: boolean;
  keyboardEnabled: boolean;
  keyboardVolume: number;
  keyboardOscillator: (typeof SOUND_OSCILLATORS)[number];
  keyboardFilterType: (typeof SOUND_FILTER_TYPES)[number];
  keyboardFilterCutoff: number;
  keyboardFilterResonance: number;
  keyboardAttack: number;
  keyboardDecay: number;
  keyboardSustain: number;
  keyboardRelease: number;
  keyboardOctave: number;
  voiceInstruments: { ambient: string; movement: string; melodic: string };
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  version: SOUND_SETTINGS_VERSION,
  soundVolume: 0.2,
  ambientBpm: 90,
  ambientVolume: 50,
  ambientMuted: false,
  ambientScale: 'pentatonic',
  keyboardRoot: 'C',
  keyboardScale: 'major',
  keyboardTranspose: 0,
  followKey: false,
  keyboardEnabled: false,
  keyboardVolume: 50,
  keyboardOscillator: 'sine',
  keyboardFilterType: 'lowpass',
  keyboardFilterCutoff: 2000,
  keyboardFilterResonance: 1,
  keyboardAttack: 0.01,
  keyboardDecay: 0.1,
  keyboardSustain: 0.7,
  keyboardRelease: 0.3,
  keyboardOctave: 0,
  voiceInstruments: { ambient: 'synth', movement: 'synth', melodic: 'synth' },
};

export function soundSettingsKey(pieceId: string): string {
  return `creatr.sound.${pieceId}`;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return finite(value) && value >= min && value <= max;
}

function isSoundSettings(value: unknown): value is SoundSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SoundSettings>;
  const instruments = candidate.voiceInstruments;
  return (
    candidate.version === SOUND_SETTINGS_VERSION &&
    inRange(candidate.soundVolume, 0, 1) &&
    inRange(candidate.ambientBpm, 40, 220) &&
    inRange(candidate.ambientVolume, 0, 100) &&
    typeof candidate.ambientMuted === 'boolean' &&
    typeof candidate.ambientScale === 'string' &&
    SOUND_SCALES.includes(candidate.ambientScale as (typeof SOUND_SCALES)[number]) &&
    typeof candidate.keyboardEnabled === 'boolean' &&
    inRange(candidate.keyboardVolume, 0, 100) &&
    typeof candidate.keyboardOscillator === 'string' &&
    SOUND_OSCILLATORS.includes(
      candidate.keyboardOscillator as (typeof SOUND_OSCILLATORS)[number],
    ) &&
    typeof candidate.keyboardFilterType === 'string' &&
    SOUND_FILTER_TYPES.includes(
      candidate.keyboardFilterType as (typeof SOUND_FILTER_TYPES)[number],
    ) &&
    inRange(candidate.keyboardFilterCutoff, 20, 20000) &&
    inRange(candidate.keyboardFilterResonance, 0.1, 20) &&
    inRange(candidate.keyboardAttack, 0.001, 10) &&
    inRange(candidate.keyboardDecay, 0.001, 10) &&
    inRange(candidate.keyboardSustain, 0, 1) &&
    inRange(candidate.keyboardRelease, 0.001, 10) &&
    inRange(candidate.keyboardOctave, -2, 2) &&
    !!instruments &&
    typeof instruments.ambient === 'string' &&
    typeof instruments.movement === 'string' &&
    typeof instruments.melodic === 'string'
  );
}

export function soundSettingsFromSonic(sonic?: SonicDefaults): SoundSettings {
  const defaults = {
    ...DEFAULT_SOUND_SETTINGS,
    voiceInstruments: { ...DEFAULT_SOUND_SETTINGS.voiceInstruments },
  };
  if (!sonic) return defaults;
  const synth = sonic.extras.synth;
  return {
    ...defaults,
    soundVolume: sonic.extras.default_volume / 100,
    ambientBpm: sonic.tempo,
    ambientVolume: sonic.extras.ambient_volume ?? sonic.extras.default_volume,
    ambientScale: sonic.scale,
    keyboardRoot: sonic.root,
    keyboardScale: sonic.keyboard_scale,
    keyboardTranspose: sonic.transpose,
    followKey: sonic.follow_key ?? false,
    keyboardVolume: sonic.extras.keyboard_volume ?? sonic.extras.default_volume,
    keyboardOscillator: synth.oscillator,
    keyboardFilterType: synth.filter_type,
    keyboardFilterCutoff: synth.filter_cutoff,
    keyboardFilterResonance: synth.filter_resonance,
    keyboardAttack: synth.envelope.attack,
    keyboardDecay: synth.envelope.decay,
    keyboardSustain: synth.envelope.sustain,
    keyboardRelease: synth.envelope.release,
    keyboardOctave: Math.max(-2, Math.min(2, synth.octave_min)),
    voiceInstruments: { ...sonic.extras.voices },
  };
}

export function readSoundSettings(
  pieceId: string,
  storage?: Storage,
  fallback: SoundSettings = DEFAULT_SOUND_SETTINGS,
): SoundSettings {
  const target = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  if (!target) return { ...fallback, voiceInstruments: { ...fallback.voiceInstruments } };
  try {
    const raw = target.getItem(soundSettingsKey(pieceId));
    if (!raw) return { ...fallback, voiceInstruments: { ...fallback.voiceInstruments } };
    const parsed: unknown = JSON.parse(raw);
    if (!isSoundSettings(parsed))
      return { ...fallback, voiceInstruments: { ...fallback.voiceInstruments } };
    return { ...parsed, voiceInstruments: { ...parsed.voiceInstruments } };
  } catch {
    return { ...fallback, voiceInstruments: { ...fallback.voiceInstruments } };
  }
}

export function writeSoundSettings(
  pieceId: string,
  settings: SoundSettings,
  storage?: Storage,
): void {
  const target = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  if (!target) return;
  try {
    target.setItem(soundSettingsKey(pieceId), JSON.stringify(settings));
  } catch {
    // Privacy mode, quota exhaustion, and blocked storage must never block rendering.
  }
}

export function resetSoundSettings(
  pieceId: string,
  storage?: Storage,
  fallback: SoundSettings = DEFAULT_SOUND_SETTINGS,
): SoundSettings {
  const target = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  try {
    target?.removeItem(soundSettingsKey(pieceId));
  } catch {
    // A blocked remove is also non-fatal; the next read still validates safely.
  }
  return { ...fallback, voiceInstruments: { ...fallback.voiceInstruments } };
}
