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
  /** Sets one voice's gain without changing the master bus. */
  setVoiceVolume(voice: SonicVoice, percent: number): void;
  /** Mutes one voice while preserving the other voice gains. */
  setVoiceMuted(voice: SonicVoice, muted: boolean): void;
  /** Updates the shared master filter without rebuilding the voice graph. */
  setFilter(settings: SonicFilterSettings): boolean;
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
  /** Issue #308: opens the microphone (`Tone.UserMedia` -- Tone.js's own
   * `getUserMedia({audio:true})` wrapper, reused rather than wiring a raw
   * `MediaStreamAudioSourceNode` by hand) and mixes it into the shared
   * bus, exactly like the reference implementation's own raw-mic-in
   * layer (not analyzed/used to modulate anything else -- that's the
   * separate camera-theremin feature, issue #309). Must be called after
   * `enable()` -- rejects otherwise. Rejects with the underlying
   * `getUserMedia` failure (a `DOMException` in a real browser) for the
   * caller to categorize via `micFailure.ts`. */
  connectMic(): Promise<void>;
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
  const voiceInstruments: Record<SonicVoice, SonicInstrument> = {
    ambient: 'synth',
    movement: 'synth',
    melodic: 'synth',
  };
  let ambientLoop: InstanceType<ToneModule['Loop']> | null = null;
  let userMedia: InstanceType<ToneModule['UserMedia']> | null = null;
  let thereminSounding = false;
  let lastMovementTriggerAt = 0;
  let tempo = DEFAULT_TEMPO;
  let scale: SonicScale = DEFAULT_SCALE;
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

      filter = new tone.Filter(filterSettings.cutoff, filterSettings.type).toDestination();
      filter.Q.value = filterSettings.resonance;
      bus = new tone.Volume(0).connect(filter);
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
        ambientSynth?.triggerAttackRelease(
          ambientScale[ambientIndex % ambientScale.length],
          '8n',
          time,
        );
        ambientIndex += 1;
      }, eighthNoteInterval(tempo)).start(0);
      tone.Transport.bpm.value = tempo;
      tone.Transport.start();

      status = 'active';
    } catch {
      status = 'error';
      disposeResources();
    }
  }

  function disposeResources() {
    disconnectMic();
    stopCameraTheremin();
    ambientLoop?.dispose();
    ambientSynth?.dispose();
    movementSynth?.dispose();
    melodicSynth?.dispose();
    bus?.dispose();
    filter?.dispose();
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
    return true;
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
    movementSynth.triggerAttackRelease(movementScale[scaleIndex], '16n');
  }

  function triggerMelodicNote(note: string) {
    melodicSynth?.triggerAttackRelease(
      shiftNoteOctave(note, melodicSynthSettings.octaveShift),
      '8n',
    );
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

  async function connectMic(): Promise<void> {
    if (!tone || !bus || status !== 'active') {
      throw new Error('Sound must be enabled before enabling the microphone.');
    }
    if (userMedia) return; // already connected -- idempotent, like enable()
    const mic = new tone.UserMedia();
    try {
      await mic.open();
    } catch (error) {
      mic.dispose();
      throw error;
    }
    mic.connect(bus);
    userMedia = mic;
  }

  function disconnectMic() {
    if (!userMedia) return;
    userMedia.close();
    userMedia.disconnect();
    userMedia.dispose();
    userMedia = null;
  }

  function startCameraTheremin() {
    if (!melodicSynth || thereminSounding) return;
    // An arbitrary starting pitch -- immediately overridden by the first
    // `updateCameraTheremin` call once a hand is tracked.
    melodicSynth.triggerAttack('C4');
    thereminSounding = true;
  }

  function updateCameraTheremin(pitchHz: number, volumeDb: number) {
    if (!melodicSynth || !thereminSounding) return;
    // A short ramp (not an instant jump) is what makes this read as a
    // continuous glide rather than a stutter of discrete pitch jumps,
    // matching the reference's own theremin feel.
    melodicSynth.frequency.rampTo(pitchHz, 0.05);
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
    setVoiceVolume,
    setVoiceMuted,
    setFilter,
    setMelodicSynth,
    setVoiceInstrument,
    reportMovement,
    triggerMelodicNote,
    connectMic,
    disconnectMic,
    startCameraTheremin,
    updateCameraTheremin,
    stopCameraTheremin,
    dispose,
  };
}
