/**
 * Issue #206: the single entry point every call site (`EditorWorkspace.tsx`,
 * `PublicProjectViewer.tsx`, `captureSocialThumbnail.ts`) should use to
 * construct a scene preview instead of importing a specific adapter's
 * `create*ScenePreview` directly — picks the adapter matching a scene's
 * `renderer.preferred` (`schema/scene.schema.json`), defaulting to `"p5"`
 * for a scene document that predates this field's existence (there is
 * none today, since `renderer` has always been required, but this keeps
 * the same "missing means the pre-existing default" convention the schema
 * itself uses for other optional/legacy fields).
 */
import { createCanvas2DScenePreview } from './canvas2dAdapter';
import { createP5ScenePreview } from './p5Adapter';
import type { ScenePreview, SceneRendererId } from './scenePreview';

/** Reads `scene.renderer.preferred`, tolerating a scene that hasn't been
 * schema-validated yet (this runs before `render()`'s own validation) --
 * anything other than the recognized renderer ids falls back to `"p5"`
 * rather than throwing here; an actually-invalid value is still caught by
 * `buildScenePlan`'s schema validation inside `render()` itself. */
export function resolveSceneRendererId(scene: unknown): SceneRendererId {
  if (scene && typeof scene === 'object') {
    const renderer = (scene as Record<string, unknown>).renderer;
    if (renderer && typeof renderer === 'object') {
      const preferred = (renderer as Record<string, unknown>).preferred;
      if (preferred === 'canvas2d') return 'canvas2d';
    }
  }
  return 'p5';
}

export function createScenePreview(
  container: HTMLElement,
  rendererId: SceneRendererId,
): ScenePreview {
  switch (rendererId) {
    case 'canvas2d':
      return createCanvas2DScenePreview(container);
    case 'p5':
      return createP5ScenePreview(container);
  }
}
