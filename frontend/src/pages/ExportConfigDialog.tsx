import { useEffect, useMemo, useRef, useState } from 'react';

import { getSceneVersion, type Project, type SceneDocument } from '../api/projects';
import {
  checkRendererCompatibility,
  getAvailableInteractionModes,
  INTERACTION_MODE_LABELS,
  RENDERER_LABELS,
  type InteractionMode,
} from '../export/exportCompatibility';
import {
  ExportGenerationBlockedError,
  generateHtmlExport,
  triggerHtmlDownload,
} from '../export/generateHtmlExport';
import { validateProjectMetadataForPublish } from '../validation/projectMetadata';
import { useVersionHistory } from './useVersionHistory';

/**
 * Task 55: the export configuration dialog.
 *
 * ## Scope (see the issue's "Out of scope" note)
 *
 * This dialog assembles and validates an export *configuration*, then
 * (Task 56, issue #57) hands it to `onExport`, which generates the
 * standalone HTML (`../export/generateHtmlExport.ts`) and triggers a
 * browser download — see `defaultOnExport` below. ZIP/thumbnail bundling
 * (Task 59, issue #59) is still not built; `includeSocialThumbnailZip` is
 * recorded but has no effect yet. Camera-mode export (Task 57, issue #56)
 * is now fully built — `interactionMode: 'camera'`/`'demo-camera'` both
 * generate a real file embedding a camera/tracking module
 * (`../export/standaloneCameraSource.ts`) alongside the always-present demo
 * controls, with no interaction-mode-specific blocking left in
 * `generateHtmlExport`.
 *
 * ## What's actually configurable today
 *
 * `_docs/plan.md`'s "Renderer selection" section and the canonical scene
 * schema (`schema/scene.schema.json`'s `renderer.preferred: "p5"`, a
 * `const`, not an enum) both say V1 ships exactly one renderer. So
 * "Renderer" and "Dependency mode" below are real, keyboard-operable
 * `<select>` controls (not hardcoded text) — future renderer/output-format
 * options (Task 56+) can be added as more `<option>`s with no structural
 * change here — but each currently has exactly one value, and is rendered
 * `disabled` with a note explaining why. The actually-configurable surface
 * in V1 is: which saved version, attribution, the (currently inert)
 * social-thumbnail-ZIP preference, and interaction mode.
 *
 * ## Version selection never touches the project
 *
 * Reuses Task 41's `useVersionHistory` hook purely for its read path
 * (`versions`, already filtered to non-soft-deleted by
 * `scenes/api.py`'s `SceneVersionListCreateView.get`) — this component
 * never calls `save`/`restore`/`remove`, and fetching a version's full
 * `scene_json` for compatibility checking uses the dedicated read-only
 * `getSceneVersion` endpoint. Nothing here can change
 * `project.current_version`.
 *
 * ## Title/description gating is independent of version selection
 *
 * Title and description live on `Project`, not `SceneVersion`
 * (`_docs/plan.md`'s data model sketch), so `validateProjectMetadataForPublish`
 * — the same client-side mirror of `scenes/publishing.py`'s
 * `validate_meaningful_metadata` policy Task 49's publish flow already
 * uses — is checked against the current `project` prop regardless of
 * which historical version is selected for export.
 */

export type ExportConfig = {
  projectId: string;
  versionId: number;
  versionSequence: number;
  renderer: 'p5js';
  dependencyMode: 'cdn-html';
  includeAttribution: boolean;
  includeSocialThumbnailZip: boolean;
  interactionMode: InteractionMode;
  title: string;
  description: string;
  /** The selected version's full scene document — needed by
   * `generateHtmlExport` to actually build the export. Not part of
   * Task 55's original config shape; added here rather than re-fetched
   * downstream since the dialog already holds it in `sceneDetail`. */
  scene: SceneDocument;
};

export type ExportConfigDialogProps = {
  projectId: string;
  project: Project | null;
  /** Task 56: generates the standalone HTML export and triggers a browser
   * download by default (`defaultOnExport` below). Tests pass their own
   * spy instead to observe the assembled config without touching the
   * DOM/Blob APIs. */
  onExport?: (config: ExportConfig) => void;
};

/** Default `onExport`: generates the standalone HTML export
 * (`../export/generateHtmlExport.ts`) and, if generation succeeds,
 * triggers a browser download. If generation is blocked (an unsupported
 * or invalid scene, or a not-yet-supported interaction mode slipping
 * through), this throws `ExportGenerationBlockedError` rather than
 * silently doing nothing — `handleExport` below catches it and surfaces
 * the exact blocking reasons in the dialog, and no download ever fires. */
function defaultOnExport(config: ExportConfig) {
  const result = generateHtmlExport({
    scene: config.scene,
    title: config.title,
    description: config.description,
    interactionMode: config.interactionMode,
  });
  if (!result.ok) {
    throw new ExportGenerationBlockedError(result.reasons);
  }
  triggerHtmlDownload(result.html, result.filename);
}

function ExportConfigDialog({
  projectId,
  project,
  onExport = defaultOnExport,
}: ExportConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { historyLoadState, historyError, versions, reloadHistory } = useVersionHistory(
    projectId,
    isOpen,
  );

  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [sceneDetail, setSceneDetail] = useState<SceneDocument | null>(null);
  const [sceneDetailState, setSceneDetailState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [includeAttribution, setIncludeAttribution] = useState(false);
  const [includeSocialThumbnailZip, setIncludeSocialThumbnailZip] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('demo');
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const versionSelectRef = useRef<HTMLSelectElement>(null);

  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.sequence - b.sequence),
    [versions],
  );
  const latestVersion =
    sortedVersions.length > 0 ? sortedVersions[sortedVersions.length - 1] : null;

  // Default to the latest saved version once history has loaded, and only
  // if nothing has been explicitly selected yet this time the dialog is
  // open (see handleOpen's reset below).
  useEffect(() => {
    if (isOpen && historyLoadState === 'ready' && selectedVersionId === null && latestVersion) {
      setSelectedVersionId(latestVersion.id);
    }
  }, [isOpen, historyLoadState, selectedVersionId, latestVersion]);

  // Fetch the selected version's full scene_json (the list endpoint omits
  // it) to drive compatibility checking and interaction-mode gating.
  useEffect(() => {
    if (!isOpen || selectedVersionId === null) return;
    let cancelled = false;
    setSceneDetailState('loading');
    setSceneDetail(null);
    getSceneVersion(projectId, selectedVersionId)
      .then((version) => {
        if (cancelled) return;
        setSceneDetail(version.scene_json);
        setSceneDetailState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setSceneDetailState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, selectedVersionId]);

  const availableInteractionModes = useMemo(
    () =>
      sceneDetail ? getAvailableInteractionModes(sceneDetail) : (['demo'] as InteractionMode[]),
    [sceneDetail],
  );

  // If the selected version's scene has no camera-driven bindings, fall
  // back to demo-only rather than leaving a now-unavailable mode selected.
  useEffect(() => {
    if (sceneDetailState === 'ready' && !availableInteractionModes.includes(interactionMode)) {
      setInteractionMode('demo');
    }
  }, [sceneDetailState, availableInteractionModes, interactionMode]);

  useEffect(() => {
    if (isOpen) {
      versionSelectRef.current?.focus();
    }
  }, [isOpen]);

  const compatibilityErrors = useMemo(
    () => (sceneDetail ? checkRendererCompatibility(sceneDetail, 'p5js') : []),
    [sceneDetail],
  );

  const metadataErrors = validateProjectMetadataForPublish({
    title: project?.title ?? '',
    description: project?.description ?? '',
  });
  const hasMetadataErrors = Boolean(metadataErrors.title || metadataErrors.description);

  const canExport =
    project !== null &&
    selectedVersionId !== null &&
    sceneDetailState === 'ready' &&
    compatibilityErrors.length === 0 &&
    !hasMetadataErrors;

  function handleOpen() {
    // Reset to the documented defaults every time the dialog is (re)opened
    // (issue #55: "defaults to latest saved version, p5.js, CDN-linked
    // HTML, attribution off, and social-thumbnail ZIP off").
    setSelectedVersionId(null);
    setSceneDetail(null);
    setSceneDetailState('idle');
    setIncludeAttribution(false);
    setIncludeSocialThumbnailZip(false);
    setInteractionMode('demo');
    setGenerationErrors([]);
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleExport() {
    if (!canExport || !project || selectedVersionId === null || !sceneDetail) return;
    const version = sortedVersions.find((candidate) => candidate.id === selectedVersionId);
    if (!version) return;

    const config: ExportConfig = {
      projectId,
      versionId: version.id,
      versionSequence: version.sequence,
      renderer: 'p5js',
      dependencyMode: 'cdn-html',
      includeAttribution,
      includeSocialThumbnailZip,
      interactionMode,
      title: project.title,
      description: project.description,
      scene: sceneDetail,
    };
    setGenerationErrors([]);
    try {
      onExport(config);
    } catch (error) {
      if (error instanceof ExportGenerationBlockedError) {
        setGenerationErrors(error.reasons);
        return;
      }
      throw error;
    }
  }

  return (
    <>
      <button type="button" ref={triggerRef} onClick={handleOpen}>
        Export…
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          className="export-config-dialog"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              handleClose();
            }
          }}
        >
          <h4 id="export-dialog-title">Export project</h4>

          <div className="behavior-card-field">
            <label htmlFor="export-version">Saved version</label>
            <select
              id="export-version"
              ref={versionSelectRef}
              value={selectedVersionId ?? ''}
              disabled={historyLoadState !== 'ready' || sortedVersions.length === 0}
              onChange={(event) => setSelectedVersionId(Number(event.target.value))}
            >
              {sortedVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  Version {version.sequence}
                  {version.id === latestVersion?.id ? ' (latest)' : ''}
                </option>
              ))}
            </select>
            <p id="export-version-note">
              Selecting a version here only configures the export — it never changes this project's
              current version.
            </p>
          </div>

          {historyLoadState === 'loading' && (
            <p role="status" aria-live="polite">
              Loading version history…
            </p>
          )}

          {historyLoadState === 'error' && (
            <div>
              <p role="alert" aria-live="assertive">
                {historyError?.message ?? 'Could not load version history.'}
              </p>
              <button type="button" onClick={() => reloadHistory()}>
                Retry
              </button>
            </div>
          )}

          {historyLoadState === 'ready' && sortedVersions.length === 0 && (
            <p role="alert" aria-live="assertive">
              No saved versions were found for this project, so there is nothing to export.
            </p>
          )}

          <div className="behavior-card-field">
            <label htmlFor="export-renderer">Renderer</label>
            <select
              id="export-renderer"
              value="p5js"
              disabled
              aria-describedby="export-renderer-note"
              onChange={() => {
                /* Fixed for now — see module doc comment. */
              }}
            >
              <option value="p5js">{RENDERER_LABELS.p5js}</option>
            </select>
            <p id="export-renderer-note">
              p5.js is the only renderer built so far. More options may be added here later without
              changing this control.
            </p>
          </div>

          <div className="behavior-card-field">
            <label htmlFor="export-dependency-mode">Output format</label>
            <select
              id="export-dependency-mode"
              value="cdn-html"
              disabled
              aria-describedby="export-dependency-mode-note"
              onChange={() => {
                /* Fixed for now — see module doc comment. */
              }}
            >
              <option value="cdn-html">CDN-linked HTML</option>
            </select>
            <p id="export-dependency-mode-note">
              A small standalone `index.html` linking its dependencies from a CDN — the only export
              format built so far.
            </p>
          </div>

          <div>
            <label htmlFor="export-attribution">
              <input
                id="export-attribution"
                type="checkbox"
                checked={includeAttribution}
                onChange={(event) => setIncludeAttribution(event.target.checked)}
              />
              Include "Created with" attribution
            </label>
          </div>

          <div>
            <label htmlFor="export-thumbnail-zip">
              <input
                id="export-thumbnail-zip"
                type="checkbox"
                checked={includeSocialThumbnailZip}
                onChange={(event) => setIncludeSocialThumbnailZip(event.target.checked)}
                aria-describedby="export-thumbnail-zip-note"
              />
              Include social-thumbnail ZIP
            </label>
            <p id="export-thumbnail-zip-note">
              Thumbnail generation is not implemented yet — this only records your preference for
              when it is.
            </p>
          </div>

          <fieldset>
            <legend>Interaction mode</legend>
            {(Object.keys(INTERACTION_MODE_LABELS) as InteractionMode[]).map((mode) => (
              <label htmlFor={`export-mode-${mode}`} key={mode}>
                <input
                  id={`export-mode-${mode}`}
                  type="radio"
                  name="export-interaction-mode"
                  value={mode}
                  checked={interactionMode === mode}
                  disabled={
                    sceneDetailState !== 'ready' || !availableInteractionModes.includes(mode)
                  }
                  onChange={() => setInteractionMode(mode)}
                />
                {INTERACTION_MODE_LABELS[mode]}
              </label>
            ))}
            {sceneDetailState === 'ready' && availableInteractionModes.length === 1 && (
              <p id="export-camera-unavailable-note" role="status" aria-live="polite">
                This scene has no camera-driven bindings, so camera modes are not offered.
              </p>
            )}
          </fieldset>

          {compatibilityErrors.length > 0 && (
            <div role="alert" aria-live="assertive" data-testid="export-compatibility-errors">
              <p>This version can't be exported with the {RENDERER_LABELS.p5js} renderer:</p>
              <ul>
                {compatibilityErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {generationErrors.length > 0 && (
            <div role="alert" aria-live="assertive" data-testid="export-generation-errors">
              <p>Export could not be generated:</p>
              <ul>
                {generationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {hasMetadataErrors && (
            <div role="alert" aria-live="assertive" data-testid="export-metadata-errors">
              <p>Export is blocked until the project's title and description are meaningful:</p>
              {metadataErrors.title && (
                <p id="export-title-error">{metadataErrors.title.join(' ')}</p>
              )}
              {metadataErrors.description && (
                <p id="export-description-error">{metadataErrors.description.join(' ')}</p>
              )}
              <p>Edit the project's title and description, then reopen this dialog.</p>
            </div>
          )}

          <button type="button" onClick={handleExport} disabled={!canExport}>
            Export
          </button>
          <button type="button" onClick={handleClose}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}

export default ExportConfigDialog;
