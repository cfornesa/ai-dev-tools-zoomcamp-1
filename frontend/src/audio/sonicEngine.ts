/**
 * Issue #306: the shared Tone.js sound engine for the 3D piece viewer --
 * one audio graph (a master `Tone.Volume` bus + `Tone.Filter`) feeding
 * three synth "voices" (ambient/movement/melodic), matching the reference
 * implementation's own architecture (investigated directly in the
 * repository owner's `augment-humankind` sibling repo's
 * `sonic-controller.js`, not guessed): ambient is a tempo-paced ticker
 * that runs continuously once enabled; movement triggers notes from real
 * scene motion (`reportMovement`, called every frame by `Scene3DPreview.tsx`
 * with the camera's own position delta); melodic has no built-in trigger
 * of its own -- it only sounds when something else calls
 * `triggerMelodicNote`/`rampMelodicPitch` (issue #307's keyboard input,
 * issue #309's camera theremin).
 *
 * ## Lazy-loaded, test-injectable, matching `mediapipeProvider.ts`'s convention
 *
 * `tone` is loaded via a dynamic `import()` only inside `enable()` (never
 * at module load), for the same reason `mediapipeProvider.ts` lazy-loads
 * `@mediapipe/tasks-vision`: jsdom (this repo's test environment) has no
 * real Web Audio API, so constructing a real `Tone.Synth` there would
 * throw. `createSonicEngine`'s optional `loadTone` parameter lets tests
 * inject a fake Tone-like module instead, matching `CameraControl.tsx`'s
 * own `createProvider` test-seam convention -- this module is never
 * exercised against real Tone.js/`AudioContext` in this repo's test suite.
 *
 * ## Browser autoplay policy
 *
 * `enable()` must be called from a real user gesture (a click handler) --
 * browsers refuse to start an `AudioContext` otherwise. This module
 * doesn't special-case that; the caller's own "master on/off toggle"
 * button click already satisfies it, the same way `CameraControl.tsx`'s
 * "Enable camera" button click is what's allowed to call `getUserMedia`.
 */

import { PIANO_KEY_MAP } from './pianoKeyMap';
import {
  PITCH_CLASSES,
  scaleNotes as theoryScaleNotes,
  type PitchClass,
  type ScaleName,
} from './scaleTheory';

export type ToneModule = typeof import('tone');

export type SonicEngineStatus = 'idle' | 'active' | 'error';

export type MovementDelta = { dx: number; dy: number; dz: number };

export type SonicVoice = 'ambient' | 'movement' | 'melodic';
export type SonicInstrument =
  'synth' | 'amsynth' | 'fmsynth' | 'membranesynth' | 'metalsynth' | 'plucksynth' | 'duosynth';
export type SonicFilterType = 'lowpass' | 'highpass' | 'bandpass';
export type SonicFilterSettings = {
  type: SonicFilterType;
  cutoff: number;
  resonance: number;
};
export type SonicEnvelopeSettings = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};
export type MelodicSynthSettings = {
  oscillator: 'sine' | 'square' | 'sawtooth' | 'triangle';
  envelope: SonicEnvelopeSettings;
  filter: SonicFilterSettings;
  octaveShift: number;
};
export type MelodicSynthUpdate = { applied: string[]; unsupported: string[] };
export type SonicEffectName =
  'distortion' | 'chorus' | 'tremolo' | 'pitch_shift' | 'bitcrusher' | 'flanger';
export type SonicEffectSettings = {
  enabled: boolean;
  amount?: number;
  rate?: number;
  depth?: number;
  semitones?: number;
  bits?: number;
  frequency?: number;
  feedback?: number;
};
export type MicEffectName =
  'distortion' | 'chorus' | 'tremolo' | 'pitch_shift' | 'bitcrusher' | 'flanger' | 'ring_mod';

export const SONIC_INSTRUMENT_OPTIONS: ReadonlyArray<{
  value: SonicInstrument;
  label: string;
}> = [
  { value: 'synth', label: 'Synth' },
  { value: 'amsynth', label: 'AM Synth' },
  { value: 'fmsynth', label: 'FM Synth' },
  { value: 'membranesynth', label: 'Membrane' },
  { value: 'metalsynth', label: 'Metal' },
  { value: 'plucksynth', label: 'Plucked String' },
  { value: 'duosynth', label: 'Duo Synth' },
];

/** Below this speed, `reportMovement` is treated as "not really moving" and
 * never triggers a note -- otherwise idle jitter/damping settle-out from
 * `OrbitControls` would fire notes constantly at rest. */
const MOVEMENT_TRIGGER_THRESHOLD = 0.01;

/** Minimum time between movement-triggered notes, so a fast continuous
 * motion doesn't retrigger every single animation frame. */
const MOVEMENT_RETRIGGER_MS = 150;

export type SonicScale =
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'chromatic'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'wholetone';

export type SonicKey = { root: PitchClass; scale: SonicScale };

export type SonicNoteEvent = {
  kind: 'ambient' | 'movement' | 'melodic';
  note: string;
  frequency: number;
  tempo: number;
  scale: SonicScale;
  key: SonicKey;
  transpose: number;
};

export const SONIC_SCALE_OPTIONS: ReadonlyArray<SonicScale> = [
  'major',
  'minor',
  'pentatonic',
  'chromatic',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'wholetone',
];

const DEFAULT_TEMPO = 90;
const DEFAULT_SCALE: SonicScale = 'pentatonic';
const MIN_TEMPO = 40;
const MAX_TEMPO = 220;

const SCALE_INTERVALS: Record<SonicScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: Array.from({ length: 12 }, (_, index) => index),
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
};

const pitchClassNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function scaleNotes(scale: SonicScale, octave: number): string[] {
  const notes = SCALE_INTERVALS[scale].map((interval) => {
    const pitch = interval % 12;
    const noteOctave = octave + Math.floor(interval / 12);
    return `${pitchClassNames[pitch]}${noteOctave}`;
  });
  return [...notes, `${pitchClassNames[0]}${octave + 1}`];
}

function eighthNoteInterval(bpm: number): number {
  return 30 / bpm;
}

export interface SonicEngine {
  readonly status: SonicEngineStatus;
  /** Starts the audio graph. Must be called from a real user gesture. */
  enable(): Promise<void>;
  /** Stops and releases every audio resource; safe to call even if never
   * enabled. */
  disable(): void;
  /** 0-100, applied to the shared master bus (ambient + movement +
   * melodic together -- the reference has no per-voice mute, only this
   * one shared control). */
  setVolume(percent: number): void;
  /** Sets the ambient ticker tempo, clamped to the authored 40-220 BPM range. */
  setTempo(bpm: number): void;
  /** Selects one of the nine authored scales; returns false for unknown names. */
  setScale(name: string): boolean;
  /** Sets the melodic keyboard root and scale without changing ambient scale. */
  setKey(key: { root: string; scale: string }): boolean;
  /** Applies a global pitch transpose to all voices, clamped to ±12 semitones. */
  setTranspose(semitones: number): void;
  /** Links the ambient scale to the melodic keyboard scale when enabled. */
  setFollowKey(follow: boolean): void;
  /** Sets one voice's gain without changing the master bus. */
  setVoiceVolume(voice: SonicVoice, percent: number): void;
  /** Mutes one voice while preserving the other voice gains. */
  setVoiceMuted(voice: SonicVoice, muted: boolean): void;
  /** Issue #847: replaces the synthesized ambient ticker with a looping
   * playback of an owner-uploaded audio sample, through the same ambient
   * voice bus (gain/mute controls keep working unchanged). `null` returns
   * to the synthesized ambient walk. Safe to call before `enable()` --
   * the sample is remembered and applied once the engine starts. */
  setAmbientSample(blob: Blob | null): void;
  /** Updates the shared master filter without rebuilding the voice graph. */
  setFilter(settings: SonicFilterSettings): boolean;
  /** Enables one optional shared-bus effect without rebuilding voices. */
  setEffect(name: SonicEffectName, settings: SonicEffectSettings): boolean;
  /** Applies live keyboard-voice synth settings and reports unsupported fields. */
  setMelodicSynth(settings: MelodicSynthSettings): MelodicSynthUpdate;
  /** Replaces one voice's instrument without changing the other voices. */
  setVoiceInstrument(voice: SonicVoice, instrument: SonicInstrument): boolean;
  /** Called every frame by the 3D preview's own render loop with the
   * camera's position delta since the previous frame. */
  reportMovement(delta: MovementDelta): void;
  /** Triggers a discrete note on the melodic voice (issue #307's keyboard
   * input calls this). */
  triggerMelodicNote(note: string): void;
  /** Connects a trusted parent-frame microphone stream to the shared bus.
   * A supplied stream is used directly; without one, getUserMedia is
   * acquired before any lazy Tone work. Must be called after enable(). */
  connectMic(stream?: MediaStream): Promise<void>;
  /** Enables one reference-faithful effect in the microphone chain. */
  setMicEffect(
    name: MicEffectName,
    enabled: boolean,
    params?: Partial<SonicEffectSettings>,
  ): boolean;
  /** Reports whether a microphone effect is enabled; false before mic connect. */
  isMicEffectEnabled(name: MicEffectName): boolean;
  /** Closes and releases the microphone stream. Safe to call even if
   * never connected. */
  disconnectMic(): void;
  /** Issue #309: starts a continuous, sustained tone on the melodic voice
   * for the camera theremin -- matches the reference's own continuous
   * pitch-glide behavior (a real theremin feel), not discrete note
   * triggers like `triggerMelodicNote`. Idempotent -- calling this while
   * already sounding is a no-op. */
  startCameraTheremin(): void;
  /** Ramps the theremin's sustained tone to a new pitch/volume -- called
   * every tracked-hand frame while the camera theremin is on. Safe to
   * call even if `startCameraTheremin` was never called (a no-op). */
  updateCameraTheremin(pitchHz: number, volumeDb: number): void;
  /** Releases the sustained tone. Safe to call even if never started. */
  stopCameraTheremin(): void;
  /** Releases every resource. Safe to call multiple times. */
  dispose(): void;
}

export function createSonicEngine(
  loadTone: () => Promise<ToneModule> = () => import('tone'),
  onNote?: (event: SonicNoteEvent) => void,
): SonicEngine {
  let status: SonicEngineStatus = 'idle';
  let tone: ToneModule | null = null;
  let bus: InstanceType<ToneModule['Volume']> | null = null;
  let filter: InstanceType<ToneModule['Filter']> | null = null;
  let melodicFilter: InstanceType<ToneModule['Filter']> | null = null;
  type VoiceBus = InstanceType<ToneModule['Volume']>;
  const voiceBuses: Record<SonicVoice, VoiceBus | null> = {
    ambient: null,
    movement: null,
    melodic: null,
  };
  type VoiceSynth = {
    connect(destination: unknown): unknown;
    triggerAttackRelease(note: string, duration: string, time?: number): void;
    triggerAttack(note: string): void;
    triggerRelease(): void;
    set?(values: unknown): void;
    dispose(): void;
    volume: { value: number };
    frequency: { rampTo(value: number, duration?: number): void };
  };
  let ambientSynth: VoiceSynth | null = null;
  let movementSynth: VoiceSynth | null = null;
  let melodicSynth: VoiceSynth | null = null;
  type EffectNode = {
    connect(destination: unknown): unknown;
    dispose(): void;
    wet?: { value: number };
    feedback?: { value: number };
    depth?: { value: number };
    frequency?: { value: number };
    delayTime?: { value: number };
    bits?: { value: number };
  };
  const effectOrder: SonicEffectName[] = [
    'distortion',
    'chorus',
    'tremolo',
    'pitch_shift',
    'bitcrusher',
    'flanger',
  ];
  const effectSettings: Record<SonicEffectName, SonicEffectSettings> = {
    distortion: { enabled: false, amount: 0 },
    chorus: { enabled: false, amount: 0, rate: 4, depth: 0.5 },
    tremolo: { enabled: false, amount: 0, rate: 4 },
    pitch_shift: { enabled: false, semitones: 0 },
    bitcrusher: { enabled: false, bits: 16 },
    flanger: { enabled: false, amount: 0, rate: 0.25, depth: 0.5 },
  };
  let effectNodes: EffectNode[] = [];
  const micEffectOrder: MicEffectName[] = [
    'distortion',
    'chorus',
    'tremolo',
    'pitch_shift',
    'bitcrusher',
    'flanger',
    'ring_mod',
  ];
  const micEffectSettings: Record<MicEffectName, SonicEffectSettings> = {
    distortion: { enabled: false, amount: 0.4 },
    chorus: { enabled: false, amount: 0.5, rate: 1.5, depth: 0.5 },
    tremolo: { enabled: false, amount: 0.5, rate: 5, depth: 0.5 },
    pitch_shift: { enabled: false, semitones: 0 },
    bitcrusher: { enabled: false, bits: 4 },
    flanger: { enabled: false, amount: 0.5, rate: 0.25, depth: 0.006, feedback: 0.5 },
    ring_mod: { enabled: false, frequency: 440 },
  };
  let micEffectNodes: EffectNode[] = [];
  const voiceInstruments: Record<SonicVoice, SonicInstrument> = {
    ambient: 'synth',
    movement: 'synth',
    melodic: 'synth',
  };
  let ambientLoop: InstanceType<ToneModule['Loop']> | null = null;
  let ambientPlayer: InstanceType<ToneModule['Player']> | null = null;
  let ambientSampleBlob: Blob | null = null;
  let ambientSampleObjectUrl: string | null = null;
  type NativeMicSource = {
    connect(destination: unknown): unknown;
    disconnect(): void;
  };
  let micSource: NativeMicSource | null = null;
  let micStream: MediaStream | null = null;
  let legacyUserMedia: InstanceType<ToneModule['UserMedia']> | null = null;
  let audioSessionContext: {
    rawContext?: {
      removeEventListener(type: string, listener: () => void): void;
    };
    resume?: () => Promise<void>;
  } | null = null;
  let audioSessionListener: (() => void) | null = null;
  let thereminSounding = false;
  let lastMovementTriggerAt = 0;
  let tempo = DEFAULT_TEMPO;
  let scale: SonicScale = DEFAULT_SCALE;
  let key: SonicKey = { root: 'C', scale: 'chromatic' };
  let transpose = 0;
  let followKey = false;
  let filterSettings: SonicFilterSettings = { type: 'lowpass', cutoff: 2000, resonance: 1 };
  let melodicSynthSettings: MelodicSynthSettings = {
    oscillator: 'sine',
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
    filter: { type: 'lowpass', cutoff: 2000, resonance: 1 },
    octaveShift: 0,
  };
  const voiceVolumes: Record<SonicVoice, number> = { ambient: 100, movement: 100, melodic: 100 };
  const voiceMuted: Record<SonicVoice, boolean> = {
    ambient: false,
    movement: false,
    melodic: false,
  };

  async function enable(): Promise<void> {
    if (status === 'active') return;
    try {
      tone = await loadTone();
      await tone.start();

      filter = new tone.Filter(filterSettings.cutoff, filterSettings.type);
      filter.Q.value = filterSettings.resonance;
      bus = new tone.Volume(0).connect(filter);
      rebuildEffects();
      voiceBuses.ambient = new tone.Volume(0).connect(bus);
      voiceBuses.movement = new tone.Volume(0).connect(bus);
      voiceBuses.melodic = new tone.Volume(0).connect(bus);
      melodicFilter = new tone.Filter(
        melodicSynthSettings.filter.cutoff,
        melodicSynthSettings.filter.type,
      ).connect(voiceBuses.melodic);
      melodicFilter.Q.value = melodicSynthSettings.filter.resonance;
      setVoiceVolume('ambient', voiceVolumes.ambient);
      setVoiceVolume('movement', voiceVolumes.movement);
      setVoiceVolume('melodic', voiceVolumes.melodic);
      ambientSynth = createVoiceSynth('ambient');
      movementSynth = createVoiceSynth('movement');
      melodicSynth = createVoiceSynth('melodic');

      let ambientIndex = 0;
      ambientLoop = new tone.Loop((time) => {
        const ambientScale = scaleNotes(scale, 3);
        const note = transposeNote(ambientScale[ambientIndex % ambientScale.length], transpose);
        ambientSynth?.triggerAttackRelease(note, '8n', time);
        onNote?.({
          kind: 'ambient',
          note,
          frequency: noteFrequency(note),
          tempo,
          scale,
          key: { ...key },
          transpose,
        });
        ambientIndex += 1;
      }, eighthNoteInterval(tempo)).start(0);
      tone.Transport.bpm.value = tempo;
      tone.Transport.start();

      status = 'active';
      if (ambientSampleBlob) applyAmbientSample(ambientSampleBlob);
    } catch {
      status = 'error';
      disposeResources();
    }
  }

  /** Starts (or restarts) the ambient sample player against the current
   * ambient bus, stopping the synthesized ambient loop while it plays.
   * Assumes the engine is already `active`. */
  function applyAmbientSample(blob: Blob): void {
    if (!tone || !voiceBuses.ambient) return;
    ambientLoop?.stop();
    ambientPlayer?.dispose();
    if (ambientSampleObjectUrl) URL.revokeObjectURL(ambientSampleObjectUrl);
    ambientSampleObjectUrl = URL.createObjectURL(blob);
    ambientPlayer = new tone.Player({
      url: ambientSampleObjectUrl,
      loop: true,
      autostart: true,
    }).connect(voiceBuses.ambient);
  }

  function setAmbientSample(blob: Blob | null): void {
    ambientSampleBlob = blob;
    if (status !== 'active') return; // applied on the next enable()
    if (blob) {
      applyAmbientSample(blob);
      return;
    }
    ambientPlayer?.dispose();
    ambientPlayer = null;
    if (ambientSampleObjectUrl) {
      URL.revokeObjectURL(ambientSampleObjectUrl);
      ambientSampleObjectUrl = null;
    }
    // `.start()` with no time (= "now") rather than `.start(0)`: the
    // transport is already well past time 0 by the time a sample is
    // cleared, and re-scheduling at an already-elapsed transport time
    // throws.
    ambientLoop?.start();
  }

  function disposeResources() {
    disconnectMic();
    stopCameraTheremin();
    ambientLoop?.dispose();
    ambientPlayer?.dispose();
    ambientPlayer = null;
    if (ambientSampleObjectUrl) {
      URL.revokeObjectURL(ambientSampleObjectUrl);
      ambientSampleObjectUrl = null;
    }
    ambientSynth?.dispose();
    movementSynth?.dispose();
    melodicSynth?.dispose();
    bus?.dispose();
    filter?.dispose();
    effectNodes.forEach((effect) => effect.dispose());
    effectNodes = [];
    melodicFilter?.dispose();
    voiceBuses.ambient?.dispose();
    voiceBuses.movement?.dispose();
    voiceBuses.melodic?.dispose();
    if (status === 'active') tone?.Transport.stop();
    ambientLoop = null;
    ambientSynth = null;
    movementSynth = null;
    melodicSynth = null;
    bus = null;
    filter = null;
    melodicFilter = null;
    voiceBuses.ambient = null;
    voiceBuses.movement = null;
    voiceBuses.melodic = null;
  }

  function disable() {
    if (status === 'idle') return;
    disposeResources();
    status = 'idle';
  }

  function setVolume(percent: number) {
    if (!bus) return;
    const clamped = Math.min(100, Math.max(0, percent));
    // 0% -> effectively silent (-60dB), 100% -> unity gain (0dB) -- a
    // simple linear-to-dB mapping, matching the reference's own single
    // shared volume slider governing all three voices together.
    bus.volume.value = clamped === 0 ? -60 : (clamped / 100) * 24 - 24;
  }

  function setTempo(bpm: number) {
    tempo = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, bpm));
    if (!tone || !ambientLoop || status !== 'active') return;
    tone.Transport.bpm.value = tempo;
    ambientLoop.interval = eighthNoteInterval(tempo);
  }

  function setScale(name: string): boolean {
    if (!SONIC_SCALE_OPTIONS.includes(name as SonicScale)) return false;
    scale = name as SonicScale;
    if (followKey) key = { ...key, scale };
    return true;
  }

  function setKey(next: { root: string; scale: string }): boolean {
    if (!PITCH_CLASSES.includes(next.root as PitchClass)) return false;
    if (!SONIC_SCALE_OPTIONS.includes(next.scale as SonicScale)) return false;
    key = { root: next.root as PitchClass, scale: next.scale as SonicScale };
    if (followKey) scale = key.scale;
    return true;
  }

  function setTranspose(semitones: number): void {
    if (!Number.isFinite(semitones)) return;
    transpose = Math.min(12, Math.max(-12, Math.round(semitones)));
  }

  function setFollowKey(follow: boolean): void {
    followKey = follow;
    if (followKey) scale = key.scale;
  }

  function setVoiceVolume(voice: SonicVoice, percent: number) {
    voiceVolumes[voice] = Math.min(100, Math.max(0, percent));
    const voiceBus = voiceBuses[voice];
    if (voiceBus) voiceBus.volume.value = voiceMuted[voice] ? -60 : volumeToDb(voiceVolumes[voice]);
  }

  function setVoiceMuted(voice: SonicVoice, muted: boolean) {
    voiceMuted[voice] = muted;
    const voiceBus = voiceBuses[voice];
    if (voiceBus) voiceBus.volume.value = muted ? -60 : volumeToDb(voiceVolumes[voice]);
  }

  function setFilter(settings: SonicFilterSettings): boolean {
    if (!['lowpass', 'highpass', 'bandpass'].includes(settings.type)) return false;
    filterSettings = {
      type: settings.type,
      cutoff: Math.min(20000, Math.max(20, settings.cutoff)),
      resonance: Math.min(20, Math.max(0.1, settings.resonance)),
    };
    if (filter && status === 'active') {
      filter.type = filterSettings.type;
      filter.frequency.value = filterSettings.cutoff;
      filter.Q.value = filterSettings.resonance;
    }
    return true;
  }

  function rebuildEffects() {
    if (!tone || !filter || status === 'error') return;
    const filterNode = filter as unknown as EffectNode & {
      disconnect?: () => void;
      toDestination?: () => unknown;
    };
    filterNode.disconnect?.();
    effectNodes.forEach((effect) => effect.dispose());
    effectNodes = [];
    const toneAny = tone as unknown as Record<string, new (...args: any[]) => EffectNode>;
    for (const name of effectOrder) {
      const settings = effectSettings[name];
      if (!settings.enabled) continue;
      let node: EffectNode;
      if (name === 'distortion') node = new toneAny.Distortion(settings.amount ?? 0);
      else if (name === 'chorus')
        node = new toneAny.Chorus(settings.rate ?? 4, 2.5, settings.depth ?? 0.5);
      else if (name === 'tremolo')
        node = new toneAny.Tremolo(settings.rate ?? 4, settings.amount ?? 0);
      else if (name === 'pitch_shift') node = new toneAny.PitchShift(settings.semitones ?? 0);
      else if (name === 'bitcrusher') node = new toneAny.BitCrusher(settings.bits ?? 16);
      else node = new toneAny.Chorus(settings.rate ?? 0.25, 0.1, settings.depth ?? 0.5);
      if (node.wet) node.wet.value = name === 'pitch_shift' ? 1 : (settings.amount ?? 1);
      effectNodes.push(node);
    }
    if (effectNodes.length === 0) {
      filterNode.toDestination?.();
      return;
    }
    (filter as unknown as { connect(destination: unknown): unknown }).connect(effectNodes[0]);
    for (let index = 0; index < effectNodes.length - 1; index += 1) {
      effectNodes[index].connect(effectNodes[index + 1]);
    }
    const last = effectNodes[effectNodes.length - 1] as EffectNode & {
      toDestination?: () => unknown;
    };
    last.toDestination?.();
  }

  function createMicEffect(name: MicEffectName, settings: SonicEffectSettings): EffectNode {
    if (!tone) throw new Error('Sound must be enabled before creating microphone effects.');
    const toneAny = tone as unknown as Record<string, new (...args: any[]) => EffectNode>;
    if (name === 'distortion') return new toneAny.Distortion(settings.amount ?? 0.4);
    if (name === 'chorus')
      return new toneAny.Chorus(settings.rate ?? 1.5, 2.5, settings.depth ?? 0.5);
    if (name === 'tremolo') return new toneAny.Tremolo(settings.rate ?? 5, settings.depth ?? 0.5);
    if (name === 'pitch_shift') return new toneAny.PitchShift(settings.semitones ?? 0);
    if (name === 'bitcrusher') return new toneAny.BitCrusher(settings.bits ?? 4);
    if (name === 'flanger') {
      const node = new toneAny.Flanger(settings.rate ?? 0.25, settings.depth ?? 0.006);
      if (node.feedback) node.feedback.value = settings.feedback ?? 0.5;
      return node;
    }
    const node = new toneAny.FrequencyShifter(settings.frequency ?? 440);
    return node;
  }

  function rebuildMicEffects() {
    if (!micSource || !bus || !tone) return;
    micSource.disconnect();
    micEffectNodes.forEach((effect) => effect.dispose());
    micEffectNodes = [];
    for (const name of micEffectOrder) {
      const settings = micEffectSettings[name];
      if (settings.enabled) micEffectNodes.push(createMicEffect(name, settings));
    }
    const destination = micEffectNodes[0] ?? bus;
    micSource.connect(destination);
    for (let index = 0; index < micEffectNodes.length - 1; index += 1) {
      micEffectNodes[index].connect(micEffectNodes[index + 1]);
    }
    micEffectNodes.at(-1)?.connect(bus);
  }

  function setMicEffect(
    name: MicEffectName,
    enabled: boolean,
    params: Partial<SonicEffectSettings> = {},
  ): boolean {
    if (!micSource || !micEffectOrder.includes(name)) return false;
    micEffectSettings[name] = { ...micEffectSettings[name], ...params, enabled };
    rebuildMicEffects();
    return true;
  }

  function isMicEffectEnabled(name: MicEffectName): boolean {
    return Boolean(micSource && micEffectSettings[name]?.enabled);
  }

  function setEffect(name: SonicEffectName, settings: SonicEffectSettings): boolean {
    if (!effectOrder.includes(name)) return false;
    const current = effectSettings[name];
    const next = { ...current, ...settings, enabled: Boolean(settings.enabled) };
    if (name === 'distortion' || name === 'chorus' || name === 'tremolo' || name === 'flanger') {
      next.amount = Math.min(1, Math.max(0, Number(next.amount ?? 0)));
    }
    if (name === 'pitch_shift')
      next.semitones = Math.min(24, Math.max(-24, Math.round(next.semitones ?? 0)));
    if (name === 'bitcrusher') next.bits = Math.min(16, Math.max(1, Math.round(next.bits ?? 16)));
    if (name === 'chorus' || name === 'tremolo' || name === 'flanger') {
      next.rate = Math.min(20, Math.max(0.1, Number(next.rate ?? 4)));
      next.depth = Math.min(1, Math.max(0, Number(next.depth ?? 0.5)));
    }
    effectSettings[name] = next;
    if (status === 'active') rebuildEffects();
    return true;
  }

  function volumeToDb(percent: number): number {
    return percent === 0 ? -60 : (percent / 100) * 24 - 24;
  }

  function createVoiceSynth(voice: SonicVoice): VoiceSynth {
    const voiceBus = voiceBuses[voice];
    if (!tone || !voiceBus)
      throw new Error('Sound must be enabled before selecting an instrument.');
    const instrument = voiceInstruments[voice];
    const synth =
      instrument === 'amsynth'
        ? new tone.AMSynth()
        : instrument === 'fmsynth'
          ? new tone.FMSynth()
          : instrument === 'membranesynth'
            ? new tone.MembraneSynth()
            : instrument === 'metalsynth'
              ? new tone.MetalSynth()
              : instrument === 'plucksynth'
                ? new tone.PluckSynth()
                : instrument === 'duosynth'
                  ? new tone.DuoSynth()
                  : new tone.Synth();
    const destination = voice === 'melodic' && melodicFilter ? melodicFilter : voiceBus;
    return synth.connect(destination) as unknown as VoiceSynth;
  }

  function setVoiceInstrument(voice: SonicVoice, instrument: SonicInstrument): boolean {
    if (!tone || !bus || status !== 'active') return false;
    const previous =
      voice === 'ambient' ? ambientSynth : voice === 'movement' ? movementSynth : melodicSynth;
    previous?.dispose();
    if (voice === 'melodic') {
      thereminSounding = false;
    }
    voiceInstruments[voice] = instrument;
    const next = createVoiceSynth(voice);
    if (voice === 'ambient') ambientSynth = next;
    else if (voice === 'movement') movementSynth = next;
    else melodicSynth = next;
    return true;
  }

  function reportMovement(delta: MovementDelta) {
    if (!movementSynth) return;
    const speed = Math.sqrt(delta.dx * delta.dx + delta.dy * delta.dy + delta.dz * delta.dz);
    if (speed < MOVEMENT_TRIGGER_THRESHOLD) return;
    const now = performance.now();
    if (now - lastMovementTriggerAt < MOVEMENT_RETRIGGER_MS) return;
    lastMovementTriggerAt = now;
    // Octave/note chosen from vertical movement magnitude, matching the
    // reference's own `movementStep`.
    const movementScale = scaleNotes(scale, 4);
    const scaleIndex = Math.min(
      movementScale.length - 1,
      Math.floor(Math.abs(delta.dy) * movementScale.length),
    );
    movementSynth.triggerAttackRelease(transposeNote(movementScale[scaleIndex], transpose), '16n');
  }

  function triggerMelodicNote(note: string) {
    melodicSynth?.triggerAttackRelease(
      transposeNote(
        shiftNoteOctave(keyboardNote(note), melodicSynthSettings.octaveShift),
        transpose,
      ),
      '8n',
    );
  }

  function keyboardNote(note: string): string {
    if (key.scale === 'chromatic') return note;
    const index = Object.values(PIANO_KEY_MAP).indexOf(note);
    if (index < 0) return note;
    return theoryScaleNotes(key.root, key.scale as ScaleName, [4, 6])[index] ?? note;
  }

  function transposeNote(note: string, semitones: number): string {
    const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
    if (!match) return note;
    const pitchIndex = PITCH_CLASSES.indexOf(match[1] as PitchClass);
    if (pitchIndex < 0) return note;
    const midi = (Number(match[2]) + 1) * 12 + pitchIndex + semitones;
    const rounded = Math.round(midi);
    const octave = Math.floor(rounded / 12) - 1;
    return `${PITCH_CLASSES[((rounded % 12) + 12) % 12]}${octave}`;
  }

  function noteFrequency(note: string): number {
    const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
    if (!match) return 0;
    const pitchIndex = PITCH_CLASSES.indexOf(match[1] as PitchClass);
    if (pitchIndex < 0) return 0;
    const midi = (Number(match[2]) + 1) * 12 + pitchIndex;
    return 440 * 2 ** ((midi - 69) / 12);
  }

  function shiftNoteOctave(note: string, shift: number): string {
    return note.replace(/^([A-G](?:#|b)?)(-?\d+)$/, (_, pitch: string, octave: string) => {
      return `${pitch}${Number(octave) + shift}`;
    });
  }

  function setMelodicSynth(settings: MelodicSynthSettings): MelodicSynthUpdate {
    const clampedEnvelope = {
      attack: Math.min(10, Math.max(0.001, settings.envelope.attack)),
      decay: Math.min(10, Math.max(0.001, settings.envelope.decay)),
      sustain: Math.min(1, Math.max(0, settings.envelope.sustain)),
      release: Math.min(10, Math.max(0.001, settings.envelope.release)),
    };
    melodicSynthSettings = {
      ...settings,
      envelope: clampedEnvelope,
      filter: {
        type: settings.filter.type,
        cutoff: Math.min(20000, Math.max(20, settings.filter.cutoff)),
        resonance: Math.min(20, Math.max(0.1, settings.filter.resonance)),
      },
      octaveShift: Math.min(2, Math.max(-2, Math.round(settings.octaveShift))),
    };
    const unsupported: string[] = [];
    const applied: string[] = [];
    const percussion = ['membranesynth', 'metalsynth', 'plucksynth'].includes(
      voiceInstruments.melodic,
    );
    if (percussion) {
      unsupported.push('oscillator', 'envelope');
    } else if (melodicSynth && 'set' in melodicSynth) {
      (melodicSynth as VoiceSynth & { set: (values: unknown) => void }).set({
        oscillator: { type: melodicSynthSettings.oscillator },
        envelope: melodicSynthSettings.envelope,
      });
      applied.push('oscillator', 'envelope');
    }
    if (melodicFilter) {
      melodicFilter.type = melodicSynthSettings.filter.type;
      melodicFilter.frequency.value = melodicSynthSettings.filter.cutoff;
      melodicFilter.Q.value = melodicSynthSettings.filter.resonance;
      applied.push('filter');
    } else {
      unsupported.push('filter');
    }
    applied.push('octaveShift');
    return { applied, unsupported };
  }

  async function connectMic(stream?: MediaStream): Promise<void> {
    if (legacyUserMedia) return;
    if (!stream && tone && bus && status === 'active' && typeof tone.getContext !== 'function') {
      const mic = new tone.UserMedia();
      try {
        await mic.open();
        mic.connect(bus);
        legacyUserMedia = mic;
      } catch (error) {
        mic.dispose();
        throw error;
      }
      return;
    }
    const activeStream = stream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
    if (!tone || !bus || status !== 'active') {
      activeStream.getTracks().forEach((track) => track.stop());
      throw new Error('Sound must be enabled before enabling the microphone.');
    }
    if (
      (micSource && micStream?.getTracks().some((track) => track.readyState === 'live')) ||
      legacyUserMedia
    ) {
      activeStream.getTracks().forEach((track) => track.stop());
      return;
    }
    try {
      const context = tone.getContext();
      const rawContext = context.rawContext as AudioContext;
      const mic = new tone.UserMedia();
      const hasToneUserMediaInternals = 'context' in (mic as object) && 'output' in (mic as object);
      let source: NativeMicSource;
      if (hasToneUserMediaInternals) {
        // Tone.UserMedia owns the standardized-audio-context registry and its
        // internal connect helper. Feed it the stream already authorized by
        // the parent-frame gesture so the browser is not prompted twice.
        const mediaDevices = navigator.mediaDevices;
        const originalGetUserMedia = mediaDevices.getUserMedia;
        Object.defineProperty(mediaDevices, 'getUserMedia', {
          configurable: true,
          writable: true,
          value: () => Promise.resolve(activeStream),
        });
        try {
          mic.connect(bus);
          await mic.open();
        } finally {
          Object.defineProperty(mediaDevices, 'getUserMedia', {
            configurable: true,
            writable: true,
            value: originalGetUserMedia,
          });
        }
        source = mic as unknown as NativeMicSource;
        legacyUserMedia = mic;
      } else {
        // Keep the injectable unit-test seam for minimal Tone-like modules.
        source = rawContext.createMediaStreamSource(activeStream) as unknown as NativeMicSource;
        source.connect((bus as unknown as { input: unknown }).input);
        mic.dispose();
      }
      micSource = source;
      micStream = activeStream;
      audioSessionContext = context;
      audioSessionListener = () => {
        if (rawContext.state === 'suspended' || rawContext.state === 'interrupted') {
          void context.resume?.();
          if (tone?.Transport) tone.Transport.start();
        }
      };
      rawContext.addEventListener('statechange', audioSessionListener);
      rebuildMicEffects();
    } catch (error) {
      activeStream.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  function disconnectMic() {
    if (legacyUserMedia) {
      const connectedUserMedia = legacyUserMedia;
      legacyUserMedia.close();
      legacyUserMedia.disconnect();
      legacyUserMedia.dispose();
      legacyUserMedia = null;
      if (micSource === (connectedUserMedia as unknown as NativeMicSource)) {
        micSource = null;
      }
    }
    if (audioSessionContext?.rawContext && audioSessionListener) {
      audioSessionContext.rawContext.removeEventListener('statechange', audioSessionListener);
    }
    audioSessionListener = null;
    audioSessionContext = null;
    micSource?.disconnect();
    micStream?.getTracks().forEach((track) => track.stop());
    micEffectNodes.forEach((effect) => effect.dispose());
    micEffectNodes = [];
    micSource = null;
    micStream = null;
  }

  function startCameraTheremin() {
    if (!melodicSynth || thereminSounding) return;
    // An arbitrary starting pitch -- immediately overridden by the first
    // `updateCameraTheremin` call once a hand is tracked.
    melodicSynth.triggerAttack(transposeNote('C4', transpose));
    thereminSounding = true;
  }

  function updateCameraTheremin(pitchHz: number, volumeDb: number) {
    if (!melodicSynth || !thereminSounding) return;
    // A short ramp (not an instant jump) is what makes this read as a
    // continuous glide rather than a stutter of discrete pitch jumps,
    // matching the reference's own theremin feel.
    melodicSynth.frequency.rampTo(pitchHz * 2 ** (transpose / 12), 0.05);
    melodicSynth.volume.value = volumeDb;
  }

  function stopCameraTheremin() {
    if (!melodicSynth || !thereminSounding) return;
    melodicSynth.triggerRelease();
    thereminSounding = false;
  }

  function dispose() {
    disable();
  }

  return {
    get status() {
      return status;
    },
    enable,
    disable,
    setVolume,
    setTempo,
    setScale,
    setKey,
    setTranspose,
    setFollowKey,
    setVoiceVolume,
    setVoiceMuted,
    setAmbientSample,
    setFilter,
    setEffect,
    setMelodicSynth,
    setVoiceInstrument,
    reportMovement,
    triggerMelodicNote,
    connectMic,
    setMicEffect,
    isMicEffectEnabled,
    disconnectMic,
    startCameraTheremin,
    updateCameraTheremin,
    stopCameraTheremin,
    dispose,
  };
}
