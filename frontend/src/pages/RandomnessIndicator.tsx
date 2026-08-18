/**
 * Task 40: a read-only "Randomness enabled" indicator, per `_docs/plan.md`'s
 * "Visual randomness" section ("Show a 'Randomness enabled' badge in the
 * inspector"). Purely presentational — it reads `scene.randomness`/
 * `scene.graph` through `behaviorRuntime.ts`'s `sceneUsesRandomness` and
 * renders nothing but text; there is no control here to toggle, generate,
 * or reroll a seed (the "no V1 control silently rerolls or replaces a
 * seed" acceptance criterion — this component has no interactive elements
 * at all, so it structurally cannot violate that).
 *
 * `role="status"`/`aria-live="polite"` matches this codebase's existing
 * convention for a read-only state indicator (see
 * `ReducedMotionControl.tsx`'s status line, `DemoControlsPanel.tsx`'s last
 * event line) rather than inventing a new pattern.
 */
import { sceneUsesRandomness } from '../runtime/behaviorRuntime';
import type { SceneDocument } from '../api/projects';

export default function RandomnessIndicator({ scene }: { scene: SceneDocument | null }) {
  if (!scene || !sceneUsesRandomness(scene)) return null;

  const randomness = (scene as { randomness?: { seed?: unknown } }).randomness;
  const seed = typeof randomness?.seed === 'number' ? randomness.seed : null;

  return (
    <p role="status" aria-live="polite" className="randomness-indicator">
      Randomness enabled{seed !== null ? ` — seed ${seed}` : ''}
    </p>
  );
}
