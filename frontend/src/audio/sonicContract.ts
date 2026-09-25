export const SONIC_ROOTS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;
export const SONIC_SCALES = [
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
export const SONIC_INSTRUMENTS = [
  'synth',
  'amsynth',
  'fmsynth',
  'membranesynth',
  'metalsynth',
  'plucksynth',
  'duosynth',
] as const;

export type SonicDefaults = {
  tempo: number;
  root: (typeof SONIC_ROOTS)[number];
  scale: (typeof SONIC_SCALES)[number];
  keyboard_scale: (typeof SONIC_SCALES)[number];
  transpose: number;
  follow_key?: boolean;
  instrument: (typeof SONIC_INSTRUMENTS)[number];
  feel: string;
  extras: {
    default_volume: number;
    ambient_volume?: number;
    keyboard_volume?: number;
    voices: Record<'ambient' | 'movement' | 'melodic', string>;
    synth: {
      oscillator: 'sine' | 'square' | 'sawtooth' | 'triangle';
      filter_type: 'lowpass' | 'highpass' | 'bandpass';
      filter_cutoff: number;
      filter_resonance: number;
      octave_min: number;
      octave_max: number;
      envelope: { attack: number; decay: number; sustain: number; release: number };
      effects: {
        distortion: number;
        chorus: number;
        tremolo: number;
        flanger: number;
        pitch_shift: number;
        bitcrusher: number;
      };
    };
    ambient_sample?: string;
  };
};

const clamp = (value: unknown, fallback: number, min: number, max: number, integer = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value)))
    return fallback;
  return Math.max(min, Math.min(max, integer ? Math.trunc(value) : value));
};

export function normalizeSonic(value: unknown): SonicDefaults | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, any>;
  const root = raw.root ?? 'C';
  const scale = raw.scale ?? 'major';
  const keyboardScale = raw.keyboard_scale ?? scale;
  const instrument = raw.instrument ?? 'synth';
  if (
    !(SONIC_ROOTS as readonly string[]).includes(root) ||
    !(SONIC_SCALES as readonly string[]).includes(scale) ||
    !(SONIC_SCALES as readonly string[]).includes(keyboardScale) ||
    !(SONIC_INSTRUMENTS as readonly string[]).includes(instrument) ||
    typeof (raw.feel ?? '') !== 'string' ||
    (raw.feel ?? '').length > 400
  )
    return undefined;
  const extras =
    raw.extras && typeof raw.extras === 'object' && !Array.isArray(raw.extras) ? raw.extras : {};
  const voices =
    extras.voices && typeof extras.voices === 'object' && !Array.isArray(extras.voices)
      ? extras.voices
      : {};
  const synth =
    extras.synth && typeof extras.synth === 'object' && !Array.isArray(extras.synth)
      ? extras.synth
      : {};
  const envelope = synth.envelope && typeof synth.envelope === 'object' ? synth.envelope : {};
  const effects = synth.effects && typeof synth.effects === 'object' ? synth.effects : {};
  const oscillator = ['sine', 'square', 'sawtooth', 'triangle'].includes(synth.oscillator)
    ? synth.oscillator
    : 'sine';
  const filterType = ['lowpass', 'highpass', 'bandpass'].includes(synth.filter_type)
    ? synth.filter_type
    : 'lowpass';
  if (
    ['ambient', 'movement', 'melodic'].some(
      (voice) =>
        voices[voice] !== undefined &&
        !(SONIC_INSTRUMENTS as readonly string[]).includes(voices[voice]),
    )
  )
    return undefined;
  let octaveMin = clamp(synth.octave_min, 3, -1, 7, true);
  let octaveMax = clamp(synth.octave_max, 5, -1, 7, true);
  if (octaveMin > octaveMax) [octaveMin, octaveMax] = [octaveMax, octaveMin];
  const result: SonicDefaults = {
    tempo: clamp(raw.tempo, 90, 40, 220, true),
    root,
    scale,
    keyboard_scale: keyboardScale,
    transpose: clamp(raw.transpose, 0, -12, 12, true),
    follow_key: raw.follow_key === true,
    instrument,
    feel: raw.feel ?? '',
    extras: {
      default_volume: clamp(extras.default_volume, 100, 0, 100),
      ambient_volume: clamp(
        extras.ambient_volume,
        clamp(extras.default_volume, 100, 0, 100),
        0,
        100,
      ),
      keyboard_volume: clamp(
        extras.keyboard_volume,
        clamp(extras.default_volume, 100, 0, 100),
        0,
        100,
      ),
      voices: {
        ambient: voices.ambient ?? 'synth',
        movement: voices.movement ?? 'synth',
        melodic: voices.melodic ?? instrument,
      },
      synth: {
        oscillator,
        filter_type: filterType,
        filter_cutoff: clamp(synth.filter_cutoff, 2000, 20, 20000),
        filter_resonance: clamp(synth.filter_resonance, 1, 0.1, 20),
        octave_min: octaveMin,
        octave_max: octaveMax,
        envelope: {
          attack: clamp(envelope.attack, 0.01, 0, 10),
          decay: clamp(envelope.decay, 0.1, 0, 10),
          sustain: clamp(envelope.sustain, 0.7, 0, 1),
          release: clamp(envelope.release, 0.3, 0, 10),
        },
        effects: {
          distortion: clamp(effects.distortion, 0, 0, 1),
          chorus: clamp(effects.chorus, 0, 0, 1),
          tremolo: clamp(effects.tremolo, 0, 0, 1),
          flanger: clamp(effects.flanger, 0, 0, 1),
          pitch_shift: clamp(effects.pitch_shift, 0, -24, 24, true),
          bitcrusher: clamp(effects.bitcrusher, 0, 0, 16, true),
        },
      },
    },
  };
  const sample = extras.ambient_sample;
  if (
    typeof sample === 'string' &&
    sample.trim() &&
    sample.length <= 255 &&
    !/^(https?:)?\/\//.test(sample)
  )
    result.extras.ambient_sample = sample;
  return result;
}

export function normalizeSceneSonic<T>(scene: T): T {
  if (!scene || typeof scene !== 'object' || !('sonic' in (scene as object)))
    return structuredClone(scene);
  const copy = structuredClone(scene) as Record<string, unknown>;
  const sonic = normalizeSonic(copy.sonic);
  if (sonic) copy.sonic = sonic;
  else delete copy.sonic;
  return copy as T;
}
