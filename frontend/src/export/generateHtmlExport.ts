/**
 * Task 56 (issue #57): generates the standalone, CDN-linked p5.js
 * `index.html` export for a selected saved scene version, and the
 * generation-time gate that blocks export (no file, ever produced) for an
 * unsupported or invalid scene.
 *
 * ## Architecture: client-side generation
 *
 * `_docs/plan.md`'s "Default export artifact" section describes a
 * "standalone runnable page without Django," and issue #57's own prompt
 * calls out that the browser already has the scene loaded and validated
 * once it reaches `ExportConfigDialog.tsx` (Task 55) -- there is nothing
 * a Django endpoint would need to fetch or compute that the client
 * doesn't already have. Generating the file entirely in the browser (this
 * module builds a string; `triggerHtmlDownload` below turns it into a
 * `Blob` + object URL + synthetic `<a download>` click) avoids a new
 * backend endpoint, reuses this app's own real renderer/compatibility
 * logic (`../render/sceneDrawPlan.ts`, `./exportCompatibility.ts`) as the
 * pre-export validation gate, and matches "works independently of
 * Django" literally -- generation itself never touches the network.
 *
 * ## Safe serialization
 *
 * All embedding of user-controlled strings (project title/description,
 * every string field nested in the scene document) goes through
 * `./safeEmbed.ts` -- see that module's doc comment for the full
 * threat model and why `<script type="application/json">` +
 * `.textContent` plus `<` escaping is the safe pattern used here. This
 * module never concatenates a raw title/description/scene string directly
 * into an HTML tag.
 */
import { buildScenePlan, SceneRenderError } from '../render/sceneDrawPlan';
import type { SceneDocument } from '../api/projects';
import { checkRendererCompatibility, type InteractionMode } from './exportCompatibility';
import { embedJsonScript, escapeHtml } from './safeEmbed';
import { stripSceneForExport } from './sceneExportStripping';
import { buildStandaloneRuntimeScript } from './standaloneRuntimeSource';

/** Exact p5.js version pinned for the export's CDN `<script>` tag --
 * matches `frontend/package.json`'s own pinned `p5` dependency
 * (`^1.11.10`, resolved to exactly `1.11.10` in this repo's lockfile) so
 * the export's renderer behavior matches what this app's own preview
 * (`p5Adapter.ts`) was built and tested against. */
export const P5_VERSION = '1.11.10';
export const P5_CDN_URL = `https://cdn.jsdelivr.net/npm/p5@${P5_VERSION}/lib/p5.min.js`;

export type GenerateHtmlExportInput = {
  scene: SceneDocument;
  title: string;
  description: string;
  interactionMode: InteractionMode;
};

export type GenerateHtmlExportResult =
  { ok: true; html: string; filename: string } | { ok: false; reasons: string[] };

/** Thrown by `ExportConfigDialog.tsx`'s default `onExport` when
 * `generateHtmlExport` reports a blocked export (an unsupported/invalid
 * scene, or a not-yet-supported interaction mode) -- carries the exact
 * blocking reasons so the dialog can surface them instead of silently
 * doing nothing. */
export class ExportGenerationBlockedError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(' '));
    this.name = 'ExportGenerationBlockedError';
    this.reasons = reasons;
  }
}

/** Turns `title` into a filesystem-safe, lowercase, hyphenated basename.
 * Falls back to `export` if nothing alphanumeric survives (e.g. a title
 * that's entirely emoji/punctuation) -- `ExportConfigDialog` already
 * blocks export until title/description pass
 * `validateProjectMetadataForPublish`, so this is a defensive fallback,
 * not the expected path. */
function slugifyFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'export';
}

/** Runs every generation-time compatibility/validity check, in order,
 * before any HTML is built. Returns the exact list of blocking reasons
 * (empty when export may proceed) -- each one names the specific
 * offending feature, per issue #57's "identifies the exact blocking
 * feature" acceptance criterion, never a generic failure message.
 *
 * This deliberately re-runs `checkRendererCompatibility` (already the
 * gate `ExportConfigDialog` uses to disable its Export button) as a
 * defense-in-depth safety net at the point of actual generation, plus two
 * checks that dialog doesn't already make:
 *
 * 1. `interactionMode` must be `'demo'` -- camera-mode export is Task 57
 *    (issue #56), not yet built (see `standaloneRuntimeSource.ts`'s
 *    module doc comment). The dialog itself may offer `camera`/
 *    `demo-camera` for a scene with camera-driven bindings (Task 55's
 *    `getAvailableInteractionModes`), so this module must independently
 *    refuse to generate anything for those modes rather than silently
 *    producing a demo-only file the user didn't ask for.
 * 2. A final `buildScenePlan` pass -- the exact same structural/
 *    referential/schema validation `p5Adapter.ts`'s own preview renderer
 *    runs before it will draw a single shape. This is a backstop for
 *    anything `checkRendererCompatibility`'s allowlist doesn't catch
 *    (e.g. a structurally invalid scene that happens to use only
 *    allowlisted shape/node types).
 */
export function checkExportBlockingReasons(input: GenerateHtmlExportInput): string[] {
  const reasons: string[] = [];

  if (input.interactionMode !== 'demo') {
    reasons.push('Camera-mode export is not available yet -- choose "Demo only" for this export.');
  }

  reasons.push(...checkRendererCompatibility(input.scene, 'p5js'));

  try {
    buildScenePlan(input.scene);
  } catch (error) {
    const message = error instanceof SceneRenderError ? error.message : String(error);
    reasons.push(`Scene failed final validation: ${message}`);
  }

  return reasons;
}

function renderDemoControlsSection(): string {
  return `
    <section id="demo-controls-host" aria-labelledby="demo-controls-heading">
      <h2 id="demo-controls-heading">Demo signal controls</h2>
      <p>Exercise gesture signals without a camera.</p>
      <p id="demo-status" role="status" aria-live="polite"></p>
    </section>`;
}

function renderMotionControl(): string {
  return `
    <div id="motion-control">
      <label for="motion-toggle">Motion</label>
      <select id="motion-toggle">
        <option value="system" selected>Follow system setting</option>
        <option value="reduced">Reduced</option>
        <option value="full">Full</option>
      </select>
    </div>`;
}

const EXPORT_STYLE = `
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; max-width: 960px; }
    h1 { margin-top: 0; }
    #scene-canvas-host canvas { max-width: 100%; height: auto; display: block; border: 1px solid #ccc; }
    #demo-controls-host { margin-top: 1.5rem; }
    #demo-controls-host [role="radiogroup"] { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    #demo-controls-host div { margin-bottom: 0.5rem; }
    #demo-controls-host label { display: inline-block; min-width: 12rem; }
    #project-description { color: #333; }
  `;

/**
 * Builds the complete standalone HTML document for `input`, or returns
 * the blocking reasons if it can't be generated -- see
 * `checkExportBlockingReasons`. Never throws for a scene shape this
 * app's own validation could plausibly reject; a genuinely unexpected
 * internal error still propagates (there's no sensible export to return
 * for that).
 */
export function generateHtmlExport(input: GenerateHtmlExportInput): GenerateHtmlExportResult {
  const reasons = checkExportBlockingReasons(input);
  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const strippedScene = stripSceneForExport(input.scene);
  const safeTitle = escapeHtml(input.title);
  const safeDescription = escapeHtml(input.description);
  const hasDescription = input.description.trim().length > 0;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <style>${EXPORT_STYLE}</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${hasDescription ? `<p id="project-description">${safeDescription}</p>` : ''}
  <div id="scene-canvas-host"></div>
  ${renderMotionControl()}
  ${renderDemoControlsSection()}

  <script src="${P5_CDN_URL}"></script>
  ${embedJsonScript('scene-data', strippedScene)}
  ${embedJsonScript('export-config', { interactionMode: 'demo' })}
  <script>${buildStandaloneRuntimeScript()}</script>
</body>
</html>
`;

  return { ok: true, html, filename: `${slugifyFilename(input.title)}.html` };
}

/** Triggers a browser download of `html` as `filename` via a `Blob` +
 * object URL + synthetic `<a download>` click -- no network request, no
 * server round-trip, matching this module's client-side architecture. */
export function triggerHtmlDownload(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
