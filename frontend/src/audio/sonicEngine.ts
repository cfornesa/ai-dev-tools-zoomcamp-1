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

/** Below this speed, `reportMovement` is treated as "not really moving" and
 * never triggers a note -- otherwise idle jitter/damping settle-out from
 * `OrbitControls` would fire notes constantly at rest. */
const MOVEMENT_TRIGGER_THRESHOLD = 0.01;

/** Minimum time between movement-triggered notes, so a fast continuous
 * motion doesn't retrigger every single animation frame. */
const MOVEMENT_RETRIGGER_MS = 150;

const AMBIENT_SCALE = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4'];
const MOVEMENT_SCALE = ['C4', 'D4', 'E4', 'G4', 'A4'];

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
  /** Called every frame by the 3D preview's own render loop with the
   * camera's position delta since the previous frame. */
  reportMovement(delta: MovementDelta): void;
  /** Triggers a discrete note on the melodic voice (issue #307's keyboard
   * input calls this). */
  triggerMelodicNote(note: string): void;
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
  let ambientSynth: InstanceType<ToneModule['Synth']> | null = null;
  let movementSynth: InstanceType<ToneModule['Synth']> | null = null;
  let melodicSynth: InstanceType<ToneModule['Synth']> | null = null;
  let ambientLoop: InstanceType<ToneModule['Loop']> | null = null;
  let lastMovementTriggerAt = 0;

  async function enable(): Promise<void> {
    if (status === 'active') return;
    try {
      tone = await loadTone();
      await tone.start();

      filter = new tone.Filter(2000, 'lowpass').toDestination();
      bus = new tone.Volume(0).connect(filter);
      ambientSynth = new tone.Synth().connect(bus);
      movementSynth = new tone.Synth().connect(bus);
      melodicSynth = new tone.Synth().connect(bus);

      let ambientIndex = 0;
      ambientLoop = new tone.Loop((time) => {
        ambientSynth?.triggerAttackRelease(
          AMBIENT_SCALE[ambientIndex % AMBIENT_SCALE.length],
          '8n',
          time,
        );
        ambientIndex += 1;
      }, '2n').start(0);
      tone.Transport.start();

      status = 'active';
    } catch {
      status = 'error';
      disposeResources();
    }
  }

  function disposeResources() {
    ambientLoop?.dispose();
    ambientSynth?.dispose();
    movementSynth?.dispose();
    melodicSynth?.dispose();
    bus?.dispose();
    filter?.dispose();
    if (status === 'active') tone?.Transport.stop();
    ambientLoop = null;
    ambientSynth = null;
    movementSynth = null;
    melodicSynth = null;
    bus = null;
    filter = null;
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

  function reportMovement(delta: MovementDelta) {
    if (!movementSynth) return;
    const speed = Math.sqrt(delta.dx * delta.dx + delta.dy * delta.dy + delta.dz * delta.dz);
    if (speed < MOVEMENT_TRIGGER_THRESHOLD) return;
    const now = performance.now();
    if (now - lastMovementTriggerAt < MOVEMENT_RETRIGGER_MS) return;
    lastMovementTriggerAt = now;
    // Octave/note chosen from vertical movement magnitude, matching the
    // reference's own `movementStep`.
    const scaleIndex = Math.min(
      MOVEMENT_SCALE.length - 1,
      Math.floor(Math.abs(delta.dy) * MOVEMENT_SCALE.length),
    );
    movementSynth.triggerAttackRelease(MOVEMENT_SCALE[scaleIndex], '16n');
  }

  function triggerMelodicNote(note: string) {
    melodicSynth?.triggerAttackRelease(note, '8n');
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
    reportMovement,
    triggerMelodicNote,
    dispose,
  };
}
