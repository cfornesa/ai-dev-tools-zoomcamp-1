/**
 * Task 56 (issue #57): strips anything from a scene document that isn't
 * meant to leave this app in an export.
 *
 * `SceneDocument` (`../api/projects.ts`) is deliberately narrow already —
 * it is exactly `schema/scene.schema.json`'s shape (`schemaVersion`, `id`,
 * `canvas`, `renderer`, `layers`, `shapes`, `groups`, `bindings`, `graph`,
 * `accessibility`, `demoSignals`, `randomness`) and carries no project/
 * version bookkeeping at all — no owner, no created-by, no AI prompt, no
 * fork provenance, no version sequence/timestamp. Every one of those
 * lives on `Project`/`SceneVersion` instead (see `../api/projects.ts`),
 * and this module's caller (`generateHtmlExport.ts`) only ever reads the
 * current project's `title`/`description` plus the selected version's
 * `scene_json` — never the wrapping `SceneVersion` object itself (`id`,
 * `sequence`, `origin`, `change_label`, `created_by`, `parent`,
 * `fork_source_version`, `created_at`), so none of that can leak into an
 * export by construction.
 *
 * The one thing scene JSON itself carries that still reads as an
 * "internal id" per issue #57's acceptance criteria is the scene
 * document's own top-level `id` (`$defs.id` in the schema) — an
 * editor-internal identifier with no meaning to a standalone playback
 * page and no purpose once exported (unlike shape/layer/group `id`s,
 * which are structural references the renderer/bindings still need to
 * resolve `targetId`, `layerId`, `groupId`, and `childIds` correctly, and
 * must be kept). This module removes just that one field.
 *
 * This mirrors, for the export path, the same "strip what's not public"
 * discipline `scenes/serializers.py`'s `PublicSceneVersionSerializer` and
 * `PublicProjectSerializer` already apply to the public-viewer/gallery
 * response shape (Task 49/50) — a different surface with the same
 * privacy goal.
 */
import type { SceneDocument } from '../api/projects';

/** Returns a shallow-cloned copy of `scene` with its own top-level `id`
 * removed. Never mutates `scene`. Every other field (including nested
 * `id`s on shapes/layers/groups/graph nodes, which are structural
 * references the renderer and bindings runtime require) passes through
 * unchanged. */
export function stripSceneForExport(scene: SceneDocument): SceneDocument {
  const { id: _id, ...rest } = scene as SceneDocument & { id?: unknown };
  return rest;
}
