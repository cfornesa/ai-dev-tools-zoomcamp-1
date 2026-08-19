import { useEffect, useRef } from 'react';

import type { SceneDocument } from '../api/projects';
import type { P5ScenePreview, RenderableTrail } from '../render/p5Adapter';
import {
  applyRuntimeOutputsToScene,
  createBehaviorRuntime,
  type BehaviorRuntime,
  type RuntimeInput,
} from '../runtime/behaviorRuntime';
import { createParticleSystem, deriveParticleTickInput } from '../runtime/particleSystem';
import { createTrailSystem, type TrailSample } from '../runtime/trailSystem';
import { createHandSignalExtractor, type HandSignals } from '../tracking/handSignals';
import type { GestureEvent, TrackingFrame } from '../tracking/types';

/**
 * Task 83 (issue #83): wires `behaviorRuntime.ts`/`particleSystem.ts`/
 * `trailSystem.ts` — the exact same modules `export/standaloneRuntimeSource.ts`
 * drives standalone — into the editor's own live p5 preview, so behavior-
 * card bindings and hand-authored graph nodes execute while editing, not
 * only after export.
 *
 * ## "When does the runtime run" decision
 *
 * `_docs/plan.md`/the editor UI have no existing Play/Pause "running"
 * concept (`BehaviorCardsPanel.tsx`/`GraphView.tsx` both just edit
 * `scene.bindings`/`scene.graph` directly, with no separate "start
 * simulating" action anywhere in this codebase). Per issue #83's own
 * acceptance criteria wording — "updates the live preview without
 * requiring a save/reload" (criterion 4) implies always-live, not gated
 * behind an explicit user action — this hook treats a scene as "running"
 * whenever it has any bindings or graph nodes at all
 * (`sceneHasActiveBehaviors`): the runtime loop starts the instant a
 * behavior card or graph node exists, no separate toggle required. A
 * scene with neither renders exactly as it did before this task (plain
 * `p5Adapter.render(scene)`, no runtime overhead, no rAF loop) — this is
 * what keeps criterion 5 (unbound scenes unaffected) true by construction
 * rather than by a second code path that has to be kept in sync.
 *
 * ## Runtime/particle/trail instance lifetime
 *
 * One `BehaviorRuntime` + `ParticleSystem` + `TrailSystem` + one
 * `HandSignalExtractor` are created per *structural* change to
 * `scene.bindings`/`scene.graph` (`structuralKey` below) — not per frame,
 * and not on every `scene` change (a shape drag, a color edit, or even the
 * runtime's own continuous output re-rendering the scene does not itself
 * change `bindings`/`graph`). This is what "editing a binding/graph node
 * while running updates the live preview immediately" (criterion 4) and
 * "persistent particle/trail state across frames" both come from: the
 * `useEffect` below re-runs (tearing down the previous rAF loop and
 * everything it owned, starting a fresh one) exactly when the structural
 * key changes, and never otherwise.
 *
 * ## Tracking input
 *
 * Reads whichever frame `previewTrackingSource.ts`'s shared mailbox
 * currently holds (demo controls or live camera — see that module's own
 * doc comment for why this is a shared mailbox rather than a second
 * competing `TrackingProvider`), through the exact same
 * `tracking/handSignals.ts` extractor `_docs/plan.md`'s tracking
 * abstraction already defines, so a Follow-hand binding reacts to demo/
 * camera input in the live preview exactly as it would in an export.
 *
 * ## Reduced motion / caps
 *
 * `reducedMotion` is threaded straight into `deriveParticleTickInput`/
 * `trailSystem.tick` exactly as `DemoControlsPanel.tsx` already threads it
 * into its own continuous effect — no second reduced-motion decision rule.
 * Particle/trail/physics caps are whatever `particleSystem.ts`/
 * `trailSystem.ts`/`physicsForces.ts` already enforce internally; this
 * hook adds no caps of its own, so the live preview and an export can
 * never drift apart on "how many particles is too many" or similar.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** True whenever a scene has any evaluatable bindings or graph nodes — see
 * the module doc comment's "When does the runtime run" section. Exported
 * so `EditorWorkspace.tsx` can gate its own plain-render fallback effect
 * on the same decision, rather than duplicating the check. */
export function sceneHasActiveBehaviors(scene: SceneDocument | null): boolean {
  if (!scene) return false;
  const record = scene as Record<string, unknown>;
  const bindings = Array.isArray(record.bindings) ? record.bindings : [];
  const graph = asRecord(record.graph);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  return bindings.length > 0 || nodes.length > 0;
}

/** A stable string identity for "the parts of a scene that determine
 * whether the behavior runtime needs to be rebuilt" — `bindings` and
 * `graph` only. Deliberately excludes everything else (`shapes`, `canvas`,
 * ...) so a shape drag, a fill-color edit, or the runtime's own continuous
 * output patched back onto the scene never itself triggers a runtime
 * rebuild. */
function structuralKey(scene: SceneDocument | null): string {
  if (!scene) return 'none';
  const record = scene as Record<string, unknown>;
  return JSON.stringify({ bindings: record.bindings ?? [], graph: record.graph ?? {} });
}

const GESTURE_NAMES = ['openPalm', 'closedFist', 'pointingUp', 'thumbsUp', 'victory'] as const;

/** Converts one tick's derived `HandSignals` into the
 * `RuntimeInput.signals` record `behaviorRuntime.ts` expects, matching
 * `schema/scene.schema.json`'s `$defs.signal` vocabulary exactly (see that
 * schema's enum) — the same signal names `bindingForCard` (`behaviorCards.ts`)
 * writes into a card's `binding.signal`. */
function toRuntimeSignals(signals: HandSignals): RuntimeInput['signals'] {
  const out: RuntimeInput['signals'] = {
    indexTipX: signals.indexTipX,
    indexTipY: signals.indexTipY,
    palmX: signals.palmX,
    palmY: signals.palmY,
    handDepth: signals.handDepth,
    handSpeed: signals.handSpeed,
    pinchStrength: signals.pinchStrength,
    pinchDistance: signals.pinchDistance,
    gestureConfidence: signals.gestureConfidence,
    handPresence: signals.handPresence,
  };
  for (const gesture of GESTURE_NAMES) {
    out[`gestureState:${gesture}`] = signals.gestureState === gesture;
  }
  out['gestureState:none'] = signals.gestureState === 'none';
  return out;
}

function toRuntimeEvents(events: readonly GestureEvent[]): string[] {
  return events.map((event) => `event:${event.type}`);
}

function resolveTrailColor(shape: Record<string, unknown>): string {
  const style = asRecord(shape.style);
  if (typeof style.stroke === 'string') return style.stroke;
  if (typeof style.fill === 'string') return style.fill;
  return '#000000';
}

/** Reduces the trail system's per-shape sample map into exactly what
 * `p5Adapter.ts`'s `render()` needs, resolving each trail's color from its
 * owning shape's current style — `p5Adapter.ts` deliberately "never
 * re-reads scene styling for a trail" itself (see that module's own doc
 * comment), so this caller-side resolution is the one place that happens. */
function buildRenderableTrails(
  scene: SceneDocument,
  trails: ReadonlyMap<string, TrailSample[]>,
): RenderableTrail[] {
  const shapes = (scene as Record<string, unknown>).shapes;
  const shapesById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(shapes)) {
    for (const raw of shapes) {
      const shape = asRecord(raw);
      if (typeof shape.id === 'string') shapesById.set(shape.id, shape);
    }
  }
  const out: RenderableTrail[] = [];
  for (const [shapeId, samples] of trails) {
    if (samples.length === 0) continue;
    const shape = shapesById.get(shapeId);
    if (!shape) continue;
    out.push({
      color: resolveTrailColor(shape),
      points: samples.map((sample) => ({ x: sample.x, y: sample.y })),
    });
  }
  return out;
}

export type UsePreviewRuntimeOptions = {
  previewRef: React.RefObject<P5ScenePreview | null>;
  scene: SceneDocument | null;
  getTrackingFrame: () => TrackingFrame;
  reducedMotion: boolean;
  onRenderError: (message: string | null) => void;
};

/**
 * Drives the editor's live preview runtime loop — see the module doc
 * comment. A no-op (renders nothing itself) whenever
 * `sceneHasActiveBehaviors(scene)` is false; `EditorWorkspace.tsx`'s own
 * plain `previewRef.current.render(workingCopy)` effect handles that case
 * unchanged (criterion 5: unbound scenes render identically to before this
 * task).
 */
export function usePreviewRuntime(options: UsePreviewRuntimeOptions): void {
  const { previewRef, scene, getTrackingFrame, reducedMotion, onRenderError } = options;

  // "Latest value" refs (the same pattern `EditorWorkspace.tsx`'s own drag
  // listeners already use for `sceneEditorRef`/`snapSettingsRef`) so the
  // long-lived rAF loop below always reads the current scene/reduced-
  // motion preference on its very next frame, without needing to be torn
  // down and rebuilt for every unrelated re-render.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const getTrackingFrameRef = useRef(getTrackingFrame);
  getTrackingFrameRef.current = getTrackingFrame;
  const onRenderErrorRef = useRef(onRenderError);
  onRenderErrorRef.current = onRenderError;

  const active = sceneHasActiveBehaviors(scene);
  const key = active ? structuralKey(scene) : 'inactive';

  useEffect(() => {
    if (!active || !scene) return;

    let runtime: BehaviorRuntime | null = null;
    try {
      runtime = createBehaviorRuntime(scene);
    } catch (err) {
      onRenderErrorRef.current(
        err instanceof Error ? err.message : 'Could not start the behavior runtime.',
      );
      return;
    }
    const activeRuntime = runtime;

    const randomness = asRecord((scene as Record<string, unknown>).randomness);
    const particleSystem = createParticleSystem(scene, undefined, {
      seed: typeof randomness.seed === 'number' ? randomness.seed : 0,
      enabled: randomness.enabled === true,
    });
    const trailSystem = createTrailSystem(scene);
    const extractor = createHandSignalExtractor();

    let cancelled = false;
    let rafId = 0;
    let startTime: number | null = null;

    function frameLoop(now: number): void {
      if (cancelled) return;
      if (startTime === null) startTime = now;
      const timestamp = now - startTime;

      const currentScene = sceneRef.current;
      if (currentScene) {
        try {
          const rawFrame = getTrackingFrameRef.current();
          const { signals, events } = extractor.processFrame({ ...rawFrame, timestamp });
          const input: RuntimeInput = {
            timestamp,
            signals: toRuntimeSignals(signals),
            events: toRuntimeEvents(events),
          };
          const tickResult = activeRuntime.tick(input);
          const evaluatedScene = applyRuntimeOutputsToScene(currentScene, tickResult.continuous);
          const particles = particleSystem.tick(
            deriveParticleTickInput(tickResult, reducedMotionRef.current),
          );
          const trails = trailSystem.tick(
            evaluatedScene,
            timestamp,
            tickResult.degraded,
            reducedMotionRef.current,
          );
          previewRef.current?.render(
            evaluatedScene,
            particles,
            buildRenderableTrails(evaluatedScene, trails),
          );
          onRenderErrorRef.current(null);
        } catch (err) {
          onRenderErrorRef.current(
            err instanceof Error ? err.message : 'Could not render this scene.',
          );
        }
      }
      rafId = requestAnimationFrame(frameLoop);
    }

    rafId = requestAnimationFrame(frameLoop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
    // `key` is the exhaustive structural dependency (see `structuralKey`'s
    // own doc comment) — `scene`/`reducedMotion`/`getTrackingFrame` are all
    // read through the "latest value" refs above instead, deliberately, so
    // this effect does not tear down and rebuild the runtime/particle/
    // trail state on every unrelated render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
}
