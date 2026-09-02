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
import { resolveSceneRendererId } from '../render/createScenePreview';
import type { SceneDocument } from '../api/projects';
import {
  checkRendererCompatibility,
  type InteractionMode,
  type RendererId,
} from './exportCompatibility';
import type { CameraOverlayExport } from '../editor/cameraOverlayGeometry';
import { embedJsonScript, escapeHtml } from './safeEmbed';
import { stripSceneForExport } from './sceneExportStripping';
import { buildStandaloneCameraScript } from './standaloneCameraSource';
import { buildStandaloneRuntimeScript } from './standaloneRuntimeSource';
import { buildStandaloneCanvas2DRuntimeScript } from './standaloneCanvas2DRuntimeSource';
import { buildStandaloneSvgRuntimeScript } from './standaloneSvgRuntimeSource';

/** Exact p5.js version pinned for the export's CDN `<script>` tag --
 * matches `frontend/package.json`'s own pinned `p5` dependency
 * (`^1.11.10`, resolved to exactly `1.11.10` in this repo's lockfile) so
 * the export's renderer behavior matches what this app's own preview
 * (`p5Adapter.ts`) was built and tested against. */
export const P5_VERSION = '1.11.10';
export const P5_CDN_URL = `https://cdn.jsdelivr.net/npm/p5@${P5_VERSION}/lib/p5.min.js`;

/**
 * Task 60 (issue #60): optional product attribution content.
 *
 * `_docs/plan.md`'s "Optional attribution" section (line ~659) specifies
 * the visible footer wording exactly: `Created with [product name]`
 * linked to the app, plus "a matching HTML comment and export version
 * marker" -- but leaves the literal product name as a placeholder rather
 * than a fixed string, and doesn't specify a URL or the marker's exact
 * text. This module's own documented choices, filling in what the plan
 * left open (see the issue #60 comment for the full rationale):
 *
 * - Product name: "Creatrweb Animation Studio" -- the exact
 *   name already used as this app's own visible product name in
 *   `frontend/src/components/Layout.tsx`'s `<h1>` and in
 *   `_docs/plan.md`'s own title, so the export doesn't introduce a
 *   second, inconsistent name for the same product.
 * - Link target: this project's public GitHub repository -- the only
 *   stable, public URL this codebase defines for "the app" (V1 has no
 *   fixed production domain; per `AGENTS.md`, deployment is
 *   Replit-hosted with a separate URL per environment).
 * - Export version marker: names this attribution/export module's own
 *   version, independent of the scene schema version already embedded
 *   in `export-config`/`scene-data` -- see `EXPORT_TOOL_VERSION` below.
 *
 * None of this is user-controlled input, so none of it needs
 * `escapeHtml`/`safeEmbed.ts` treatment for XSS purposes -- it's
 * hardcoded here, not embedded from `input.title`/`input.description`/
 * the scene document. It's written as plain template literals (not run
 * through `escapeHtml`) exactly like every other static string this
 * module writes (`<h1>`, `<style>`, section headings).
 */
export const ATTRIBUTION_PRODUCT_NAME = 'Creatrweb Animation Studio';
export const ATTRIBUTION_PRODUCT_URL = 'https://github.com/cfornesa/ai-dev-tools-zoomcamp-1';
/** Bumped only when this attribution/export-generation module's own
 * output shape changes in a way worth distinguishing later -- not tied to
 * the canonical scene schema version (`schema/scene.schema.json`'s
 * `schemaVersion`, already embedded separately in `scene-data`). */
export const EXPORT_TOOL_VERSION = '1';

function renderAttributionFooter(): string {
  return `
  <footer id="export-attribution">
    <p>
      Created with
      <a href="${ATTRIBUTION_PRODUCT_URL}" target="_blank" rel="noopener noreferrer"
        >${ATTRIBUTION_PRODUCT_NAME}</a
      >
    </p>
  </footer>`;
}

function renderAttributionComment(): string {
  return `<!-- Created with ${ATTRIBUTION_PRODUCT_NAME} (${ATTRIBUTION_PRODUCT_URL}) -->`;
}

function renderExportVersionMarker(): string {
  return `<!-- export-tool-version: ${EXPORT_TOOL_VERSION} -->`;
}

/** CSS for the optional attribution footer -- placed in normal document
 * flow *after* every other section (canvas, demo controls, camera
 * controls), never absolutely/fixed-positioned, so it can never overlap
 * the artwork canvas or any control. Only included in
 * `EXPORT_STYLE`/the document when attribution is enabled, so it can
 * never leak style hooks into the disabled output either. */
const ATTRIBUTION_STYLE = `
    #export-attribution { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.875rem; color: #555; }
  `;

export type GenerateHtmlExportInput = {
  scene: SceneDocument;
  title: string;
  description: string;
  interactionMode: InteractionMode;
  /** Task 60 (issue #60): mirrors `ExportConfig.includeAttribution` from
   * `ExportConfigDialog.tsx` (Task 55) -- gates every piece of product
   * attribution content (visible footer, HTML comment, export version
   * marker) documented in `_docs/plan.md`'s "Optional attribution"
   * section. Defaults to `false` (attribution off) when omitted, matching
   * the dialog's own documented default. */
  includeAttribution?: boolean;
  cameraOverlay?: CameraOverlayExport | null;
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

/** Issue #206: maps a scene's `renderer.preferred`
 * (`schema/scene.schema.json`'s `"p5" | "canvas2d" | "svg"`) to
 * `exportCompatibility.ts`'s `RendererId` (`"p5js" | "canvas2d" | "svg"`) --
 * the two id spaces have always been distinct (the export module's ids are
 * its own export-target labels, not a mirror of the schema field), so
 * this is the one place that translates between them. */
export function exportRendererIdFor(scene: SceneDocument): RendererId {
  const resolved = resolveSceneRendererId(scene);
  return resolved === 'p5' ? 'p5js' : resolved;
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
 * defense-in-depth safety net at the point of actual generation, plus a
 * check that dialog doesn't already make:
 *
 * 1. A final `buildScenePlan` pass -- the exact same structural/
 *    referential/schema validation `p5Adapter.ts`'s own preview renderer
 *    runs before it will draw a single shape. This is a backstop for
 *    anything `checkRendererCompatibility`'s allowlist doesn't catch
 *    (e.g. a structurally invalid scene that happens to use only
 *    allowlisted shape/node types).
 *
 * `interactionMode` itself (`'demo'`/`'camera'`/`'demo-camera'`) is never a
 * blocking reason -- Task 57 (issue #56) built camera-mode generation (see
 * `standaloneCameraSource.ts`), so every mode `ExportConfigDialog` can
 * offer (Task 55's `getAvailableInteractionModes`) now produces a real
 * file.
 */
export function checkExportBlockingReasons(input: GenerateHtmlExportInput): string[] {
  const reasons: string[] = [];

  reasons.push(...checkRendererCompatibility(input.scene, exportRendererIdFor(input.scene)));

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

/** Container the camera module (`standaloneCameraSource.ts`) populates on
 * `DOMContentLoaded` -- only included when `interactionMode` is `'camera'`
 * or `'demo-camera'`. Rendered empty here (unlike
 * `renderDemoControlsSection`'s static heading/status paragraph) since the
 * camera module builds its own privacy notice, status, error, and
 * Enable/Stop controls entirely from script, matching `CameraControl.tsx`'s
 * structure -- see that module's doc comment. Demo controls
 * (`renderDemoControlsSection`) are always rendered regardless of
 * interaction mode, so every camera failure category still leaves a
 * usable non-camera fallback in the same document, per issue #56's
 * acceptance criterion. */
function renderCameraControlsSection(): string {
  return `
    <section id="camera-controls-host" role="group" aria-label="Live camera"></section>`;
}

function renderCameraOverlay(input: CameraOverlayExport | null | undefined): string {
  if (!input) return '';
  const { x, y, width, height } = input.geometry;
  const style = `position:absolute;left:${x * 100}%;top:${y * 100}%;width:${width * 100}%;height:${height * 100}%;z-index:${input.layerOrder};opacity:${input.opacity};object-fit:cover;${input.mirrored ? 'transform:scaleX(-1);' : ''}`;
  return `<img id="export-camera-overlay" src="${input.frameDataUrl}" alt="Camera overlay still frame" style="${style}display:none;" />`;
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

function renderStageToolbar(): string {
  return `
    <div id="piece-toolbar" role="toolbar" aria-label="Piece actions">
      <button id="piece-screenshot" type="button" aria-label="Take screenshot" title="Take screenshot">⌗</button>
      <button id="piece-fullscreen" type="button" aria-label="Enter fullscreen" title="Enter fullscreen">⛶</button>
    </div>`;
}

function renderStageToolbarScript(): string {
  return `<script id="piece-stage-runtime">
(() => {
  const host = document.getElementById('scene-canvas-host');
  const screenshot = document.getElementById('piece-screenshot');
  const fullscreen = document.getElementById('piece-fullscreen');
  const canvas = () => host && host.querySelector('canvas, svg');
  screenshot?.addEventListener('click', () => {
    const current = canvas();
    if (!current) return;
    if (current instanceof HTMLCanvasElement) {
      const link = document.createElement('a');
      link.download = 'piece-screenshot.png';
      link.href = current.toDataURL('image/png');
      link.click();
      return;
    }
    const source = new XMLSerializer().serializeToString(current);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = 'piece-screenshot.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  });
  fullscreen?.addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await (host?.requestFullscreen?.() ?? Promise.resolve());
    fullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreen.setAttribute('title', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
})();
</script>`;
}

const EXPORT_STYLE = `
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; max-width: 960px; }
    h1 { margin-top: 0; }
    #scene-canvas-host { position: relative; max-width: 100%; }
    #scene-canvas-host canvas { max-width: 100%; height: auto; display: block; border: 1px solid #ccc; }
    #scene-canvas-host svg { max-width: 100%; height: auto; display: block; border: 1px solid #ccc; }
    #piece-toolbar { position: absolute; right: 1rem; bottom: 1rem; z-index: 4; display: flex; gap: .5rem; }
    #piece-toolbar button { width: 2.75rem; height: 2.75rem; border: 1px solid rgba(255,255,255,.35); border-radius: 999px; background: rgba(10,12,20,.78); color: #fff; cursor: pointer; }
    #export-camera-overlay { pointer-events: none; }
    #demo-controls-host { margin-top: 1.5rem; }
    #demo-controls-host [role="radiogroup"] { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    #demo-controls-host div { margin-bottom: 0.5rem; }
    #demo-controls-host label { display: inline-block; min-width: 12rem; }
    #camera-controls-host { margin-top: 1.5rem; }
    #camera-controls-host .camera-privacy-notice { color: #333; max-width: 40rem; }
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
  const includesCamera =
    input.interactionMode === 'camera' || input.interactionMode === 'demo-camera';
  const includeAttribution = input.includeAttribution === true;
  // Issue #206/#207: native Canvas2D and SVG both need no external library
  // at all, unlike p5.js's pinned CDN dependency -- a real simplification
  // for these renderers specifically. See standaloneCanvas2DRuntimeSource.ts/
  // standaloneSvgRuntimeSource.ts's module doc comments.
  const sceneRendererId = resolveSceneRendererId(input.scene);
  const usesCdnFreeRenderer = sceneRendererId === 'canvas2d' || sceneRendererId === 'svg';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <style>${EXPORT_STYLE}${includeAttribution ? ATTRIBUTION_STYLE : ''}</style>
</head>
<body>
  ${includeAttribution ? renderAttributionComment() : ''}
  <h1>${safeTitle}</h1>
  ${hasDescription ? `<p id="project-description">${safeDescription}</p>` : ''}
  <div id="scene-canvas-host">${renderCameraOverlay(input.cameraOverlay)}${renderStageToolbar()}</div>
  ${renderMotionControl()}
  ${renderDemoControlsSection()}
  ${includesCamera ? renderCameraControlsSection() : ''}

  ${usesCdnFreeRenderer ? '' : `<script src="${P5_CDN_URL}"></script>`}
  ${embedJsonScript('scene-data', strippedScene)}
  ${embedJsonScript(
    'export-config',
    input.cameraOverlay
      ? { interactionMode: input.interactionMode, cameraOverlay: input.cameraOverlay }
      : { interactionMode: input.interactionMode },
  )}
  <script>${
    sceneRendererId === 'canvas2d'
      ? buildStandaloneCanvas2DRuntimeScript()
      : sceneRendererId === 'svg'
        ? buildStandaloneSvgRuntimeScript()
        : buildStandaloneRuntimeScript()
  }</script>
  ${includesCamera ? `<script>${buildStandaloneCameraScript()}</script>` : ''}
  ${renderStageToolbarScript()}
  ${includeAttribution ? renderAttributionFooter() : ''}
  ${includeAttribution ? renderExportVersionMarker() : ''}
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
