import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';

import {
  createArtPieceVersion,
  ART_PIECE_ENGINE_CAPABILITIES,
  deleteArtPiece,
  getArtPiece,
  listArtPieceVersions,
  regenerateArtPieceThumbnail,
  refineArtPiece,
  updateArtPiece,
  type ArtPiece,
  type ArtPieceCapabilitySet,
  type ArtPieceVersion,
  type ArtPieceMention,
  type CameraPlacement,
} from '../api/artPieces';
import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { useAuth } from '../auth/useAuth';
import {
  CAPABILITY_OPTIONS,
  SPATIAL_LIBRARIES,
  sanitizeCapabilities,
} from '../generative/artPieceCapabilities';
import {
  buildArtPieceSandboxDocument,
  parseArtPieceSandboxMessage,
  ART_PIECE_IFRAME_SANDBOX,
} from '../generative/artPieceSandbox';
import { captureAndUploadArtPieceThumbnail } from '../generative/artPieceThumbnailCapture';
import MentionPromptField from './MentionPromptField';
import { buildArtPieceTargetOptionsForPiece } from './artPieceTargets';
import ArtPieceEditorToolAvailability from '../components/ArtPieceEditorToolAvailability';
import PieceSlugField from '../components/PieceSlugField';
import GeneratedInkPanel, { type InkRequest } from '../components/GeneratedInkPanel';
import type { InkTool } from '../ink/inkModel';
import Generated3DManualTools from '../components/Generated3DManualTools';
import {
  appendGenerated3DPrimitive,
  applyGenerated3DTransform,
  type Generated3DPrimitive,
  type Generated3DTransform,
} from './generated3dManualTools';

const INK_TOOL_FOR: Partial<Record<string, InkTool>> = {
  'add-shape': 'rect',
  'add-ellipse': 'ellipse',
  'add-line': 'line',
  'freehand-draw': 'pen',
  erase: 'eraser',
};

type RevisionPhase = 'idle' | 'pending' | 'previewing' | 'ready' | 'crashed' | 'error';

const LIVE_PREVIEW_DEBOUNCE_MS = 350;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/** Its own component, mounted only while `confirmingDelete` is true, so
 * `useAlertDialogFocus`'s mount-time focus effect runs exactly when the
 * dialog opens -- matching `VersionHistoryPanel.tsx`'s
 * `VersionDeleteConfirm` convention. Mounting this inline inside
 * `ArtPieceEditor` (which is already mounted long before the dialog
 * opens) would run that effect once at page load instead. */
function ArtPieceDeleteConfirm({
  title,
  deleting,
  onConfirm,
  onCancel,
}: {
  title: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="art-piece-editor-delete-confirm-title"
    >
      <h4 id="art-piece-editor-delete-confirm-title">Delete {title}?</h4>
      <p>This removes it from your gallery. This cannot be undone from here.</p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={deleting}
        data-testid="art-piece-editor-confirm-delete"
      >
        {deleting ? 'Deleting…' : 'Delete piece'}
      </button>
      <button type="button" onClick={onCancel} disabled={deleting}>
        Cancel
      </button>
    </div>
  );
}

/**
 * Issue #429: the owner-only counterpart of `ArtPieceStudio.tsx` for a
 * piece that already exists -- edit title/description, save a new
 * (immutable) version by re-running the same generate step against the
 * piece's own locked-in `engine`, inspect the version history, regenerate
 * the thumbnail, or soft-delete. Deliberately a separate route/component
 * from the Studio rather than a "studio in edit mode" -- the Studio's
 * whole flow (pick a library, generate, save as brand-new piece) doesn't
 * apply once a piece and its engine already exist.
 */
function ArtPieceEditor({ initialPiece }: { initialPiece?: ArtPiece } = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = initialPiece?.public_id ?? routeId;
  const navigate = useNavigate();
  const auth = useAuth();

  const [piece, setPiece] = useState<ArtPiece | null>(null);
  const [inkRequest, setInkRequest] = useState<InkRequest | null>(null);
  const [versions, setVersions] = useState<ArtPieceVersion[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [revisePhase, setRevisePhase] = useState<RevisionPhase>('idle');
  const [reviseCode, setReviseCode] = useState<string | null>(null);
  const [previewCode, setPreviewCodeState] = useState<string | null>(null);
  const [manualHistory, setManualHistory] = useState<string[]>([]);
  const [manualHistoryIndex, setManualHistoryIndex] = useState(-1);
  const [selected3DId, setSelected3DId] = useState<string | null>(null);
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [refineRun, setRefineRun] = useState<import('../api/artPieces').ArtPieceRefineRun | null>(
    null,
  );
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<ArtPieceCapabilitySet>({});
  const [cameraPlacement, setCameraPlacement] = useState<CameraPlacement>('overlay');
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionSaveError, setVersionSaveError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewCodeRef = useRef<string | null>(null);
  const lastGoodPreviewRef = useRef<string | null>(null);

  const [thumbnailBust, setThumbnailBust] = useState(0);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [regeneratingThumbnail, setRegeneratingThumbnail] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || auth.status !== 'signed-in') return;
    if (initialPiece) {
      listArtPieceVersions(id)
        .then((loadedVersions) => setVersions(loadedVersions))
        .catch(() => setLoadError(true));
      setPiece(initialPiece);
      setTitle(initialPiece.title);
      setDescription(initialPiece.description);
      setCapabilities(initialPiece.current_version?.capabilities ?? {});
      setCameraPlacement(initialPiece.current_version?.camera_placement ?? 'overlay');
      return;
    }
    Promise.all([getArtPiece(id), listArtPieceVersions(id)])
      .then(([loadedPiece, loadedVersions]) => {
        setPiece(loadedPiece);
        setVersions(loadedVersions);
        setTitle(loadedPiece.title);
        setDescription(loadedPiece.description);
        setCapabilities(loadedPiece.current_version?.capabilities ?? {});
        setCameraPlacement(loadedPiece.current_version?.camera_placement ?? 'overlay');
      })
      .catch(() => setLoadError(true));
  }, [id, auth.status, initialPiece]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    };
  }, []);

  function setPreviewCode(next: string | null) {
    previewCodeRef.current = next;
    setPreviewCodeState(next);
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const parsed = parseArtPieceSandboxMessage(event.data);
      if (!parsed) return;
      if (parsed.status === 'ready') {
        lastGoodPreviewRef.current = previewCodeRef.current;
        setRevisePhase('ready');
      } else {
        setRevisePhase('crashed');
        setPreviewError(parsed.message);
        if (lastGoodPreviewRef.current && lastGoodPreviewRef.current !== previewCodeRef.current) {
          setPreviewCode(lastGoodPreviewRef.current);
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') {
    return (
      <section aria-label="Art piece editor">
        <p>Sign in to edit your art pieces.</p>
      </section>
    );
  }
  // Deliberately the same generic message whether the piece doesn't
  // exist, was soft-deleted, or belongs to someone else -- never leaking
  // which case applies (`ArtPieceDetailView.get` 404s identically for
  // all three).
  if (loadError) {
    return (
      <div role="alert">
        <p>This art piece isn't available.</p>
        <Link to="/art-pieces/manage">Back to your art pieces</Link>
      </div>
    );
  }
  if (!piece) return <p role="status">Loading art piece…</p>;

  async function handleSaveMetadata() {
    if (!id) return;
    setMetadataSaving(true);
    setMetadataError(null);
    try {
      const updated = await updateArtPiece(id, { title: title.trim(), description });
      setPiece(updated);
      setTitle(updated.title);
      setDescription(updated.description);
    } catch {
      setMetadataError('Could not save these changes. Please try again.');
    } finally {
      setMetadataSaving(false);
    }
  }

  async function handleRegenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!piece) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setRevisePhase('pending');
    setReviseError(null);
    setPreviewError(null);
    setReviseCode(null);
    setPreviewCode(null);
    lastGoodPreviewRef.current = null;

    try {
      const result = await refineArtPiece(
        piece.public_id,
        trimmed,
        selectedTargetIds,
        controller.signal,
        selectedTargetIds.flatMap((id) => {
          const option = targetOptions.find((candidate) => candidate.id === id);
          return option?.mentionKind ? [{ kind: option.mentionKind, id }] : [];
        }) as ArtPieceMention[],
      );
      if (abortControllerRef.current !== controller) return;
      setRefineRun(result);
      if (result.status !== 'accepted' || !result.candidate_source) {
        setRevisePhase('error');
        setReviseError(
          result.validation_summary ||
            'The refinement did not produce a valid revision; the stored source is unchanged.',
        );
        return;
      }
      setReviseCode(result.candidate_source);
      setPreviewCode(result.candidate_source);
      setRevisePhase('previewing');
      setManualHistory([]);
      setManualHistoryIndex(-1);
      setSelected3DId(null);
      const [updatedPiece, updatedVersions] = await Promise.all([
        getArtPiece(piece.public_id),
        listArtPieceVersions(piece.public_id),
      ]);
      setPiece(updatedPiece);
      setVersions(updatedVersions);
    } catch {
      if (abortControllerRef.current !== controller) return;
      setRevisePhase('error');
      setReviseError('Something went wrong generating this revision. Please try again.');
    }
  }

  function toggleCapability(key: keyof ArtPieceCapabilitySet) {
    setCapabilities((current) => ({ ...current, [key]: !current[key] }));
  }

  /** Opens the editable-source panel (with its live sandbox preview) on the current version's source. */
  function openSourceEditor() {
    if (!piece?.current_version) return;
    const source = piece.current_version.source;
    setReviseCode(source);
    setPreviewCode(source);
    setPreviewError(null);
    setRevisePhase('previewing');
    setRefineRun(null);
  }

  function openInk(tool: InkTool) {
    setInkRequest((current) => ({ tool, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function applyManualCode(next: string) {
    const current = reviseCode ?? piece?.current_version?.source ?? '';
    setManualHistory((history) => {
      const base = history.length === 0 ? [current] : history.slice(0, manualHistoryIndex + 1);
      return [...base, next];
    });
    setManualHistoryIndex((index) => (manualHistory.length === 0 ? 1 : index + 1));
    setReviseCode(next);
    setPreviewCode(next);
    setPreviewError(null);
    setRevisePhase('ready');
    setRefineRun(null);
  }

  function handleSourceChange(next: string) {
    setReviseCode(next);
    setPreviewError(null);
    setRevisePhase('previewing');
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null;
      setPreviewCode(next);
    }, LIVE_PREVIEW_DEBOUNCE_MS);
  }

  function addManual3DPrimitive(primitive: Generated3DPrimitive) {
    if (!piece || (piece.engine !== 'threejs' && piece.engine !== 'aframe')) return;
    const result = appendGenerated3DPrimitive(
      reviseCode ?? piece.current_version?.source ?? '',
      piece.engine,
      primitive,
    );
    setSelected3DId(result.id);
    applyManualCode(result.source);
  }

  function transformManual3DObject(transform: Generated3DTransform) {
    if (!piece || !selected3DId || (piece.engine !== 'threejs' && piece.engine !== 'aframe'))
      return;
    applyManualCode(
      applyGenerated3DTransform(
        reviseCode ?? piece.current_version?.source ?? '',
        piece.engine,
        selected3DId,
        transform,
      ),
    );
  }

  function undoManualEdit() {
    if (manualHistoryIndex <= 0) return;
    const nextIndex = manualHistoryIndex - 1;
    setManualHistoryIndex(nextIndex);
    setReviseCode(manualHistory[nextIndex]);
  }

  function redoManualEdit() {
    if (manualHistoryIndex >= manualHistory.length - 1) return;
    const nextIndex = manualHistoryIndex + 1;
    setManualHistoryIndex(nextIndex);
    setReviseCode(manualHistory[nextIndex]);
  }

  async function handleSaveVersion() {
    if (!id || !piece || !reviseCode || previewError) return;
    setVersionSaving(true);
    setVersionSaveError(null);
    try {
      const version = await createArtPieceVersion(id, {
        source: reviseCode,
        capabilities: sanitizeCapabilities(capabilities, piece.engine),
        camera_placement: cameraPlacement,
      });
      setVersions((current) => [...current, version]);
      setPiece((current) => (current ? { ...current, current_version: version } : current));
      // Issue #438: the revision preview iframe is still rendered right
      // now (handleSaveVersion is only reachable from revisePhase ===
      // 'ready') -- capture a real thumbnail from it before clearing it.
      if (iframeRef.current) {
        void captureAndUploadArtPieceThumbnail(iframeRef.current, id, version.id);
      }
      setReviseCode(null);
      setRevisePhase('idle');
      setPrompt('');
    } catch {
      setVersionSaveError('Could not save this version. Please try again.');
    } finally {
      setVersionSaving(false);
    }
  }

  async function handleRegenerateThumbnail() {
    if (!id || !piece || !piece.current_version) return;
    setRegeneratingThumbnail(true);
    setThumbnailError(null);
    const versionId = piece.current_version.id;
    // Issue #438: unlike Studio's save flow (whose preview iframe is
    // already on screen), the editor has no standing preview of the
    // *current* version to capture from -- render one off-screen just
    // long enough to capture it, then discard it. Visually hidden
    // (opacity/position, not `display: none`) so the sandboxed document
    // still actually loads and renders in every browser.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', ART_PIECE_IFRAME_SANDBOX);
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '320px';
    iframe.style.height = '240px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.srcdoc = buildArtPieceSandboxDocument(
      piece.current_version.source,
      piece.engine,
      'regular',
      { ink: piece.current_version.ink },
    );
    document.body.appendChild(iframe);
    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          window.removeEventListener('message', onReady);
          reject(new Error('Timed out waiting for the piece to render.'));
        }, 8000);
        function onReady(event: MessageEvent) {
          if (event.source !== iframe.contentWindow) return;
          const parsed = parseArtPieceSandboxMessage(event.data);
          if (!parsed) return;
          window.clearTimeout(timeoutId);
          window.removeEventListener('message', onReady);
          if (parsed.status === 'ready') resolve();
          else reject(new Error(parsed.message));
        }
        window.addEventListener('message', onReady);
      });
      const captured = await captureAndUploadArtPieceThumbnail(iframe, id, versionId);
      if (!captured) {
        await regenerateArtPieceThumbnail(id);
      }
      setThumbnailBust(Date.now());
    } catch {
      await regenerateArtPieceThumbnail(id).catch(() => undefined);
      setThumbnailError('Could not regenerate the thumbnail. Please try again.');
    } finally {
      document.body.removeChild(iframe);
      setRegeneratingThumbnail(false);
    }
  }

  async function handleConfirmDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteArtPiece(id);
      navigate('/art-pieces/manage');
    } catch {
      setDeleteError('Could not delete this art piece. Please try again.');
      setDeleting(false);
    }
  }

  const sandboxDoc = previewCode ? buildArtPieceSandboxDocument(previewCode, piece.engine) : null;
  const currentVersion = piece.current_version;
  const targetOptions = buildArtPieceTargetOptionsForPiece(
    currentVersion?.source ?? '',
    piece.engine,
    Boolean(currentVersion?.ink),
  );
  const engineCapability = ART_PIECE_ENGINE_CAPABILITIES[piece.engine];
  const editorModeLabel = engineCapability.family === '3d' ? '3D AI editor' : '2D AI editor';

  const isSourceOnlyEditor = engineCapability.family === '2d';

  return (
    <section
      aria-labelledby="art-piece-editor-heading"
      data-editor-family={engineCapability.family}
      data-editor-engine={piece.engine}
    >
      <h2 id="art-piece-editor-heading">Edit {piece.title}</h2>
      <p data-testid="art-piece-editor-mode">
        {editorModeLabel} · {engineCapability.label}
      </p>
      {isSourceOnlyEditor && (
        <p data-testid="art-piece-editor-source-only">
          Source-only preview for {engineCapability.label}; this engine does not expose structured
          scene layers in the AI editor.
        </p>
      )}
      <ArtPieceEditorToolAvailability
        engine={piece.engine}
        onActivate={(tool) => {
          if (engineCapability.family === '2d') {
            // #776: every 2D drawing tool opens the ink layer (a separate validated document composited
            // over the piece) instead of appending fixed snippets to the generated source.
            const inkTool = INK_TOOL_FOR[tool];
            if (inkTool) openInk(inkTool);
          } else if (
            tool === 'add-shape' &&
            (piece.engine === 'threejs' || piece.engine === 'aframe')
          ) {
            addManual3DPrimitive('add-box');
          }
        }}
      />
      {engineCapability.family === '2d' && !reviseCode && (
        <p>
          <button
            type="button"
            data-testid="art-piece-editor-edit-source"
            onClick={openSourceEditor}
          >
            Edit source
          </button>
        </p>
      )}
      {engineCapability.family === '2d' && (
        <GeneratedInkPanel
          piece={piece}
          request={inkRequest}
          onSaved={(created) => {
            setVersions((current) => [...current, created]);
            setPiece((current) => (current ? { ...current, current_version: created } : current));
          }}
        />
      )}
      {(piece.engine === 'threejs' || piece.engine === 'aframe') && (
        <Generated3DManualTools
          engine={piece.engine}
          source={reviseCode ?? piece.current_version?.source ?? ''}
          selectedId={selected3DId}
          onSelect={setSelected3DId}
          onAdd={addManual3DPrimitive}
          onTransform={transformManual3DObject}
        />
      )}
      {(piece.engine === 'canvas2d' ||
        piece.engine === 'svg' ||
        piece.engine === 'threejs' ||
        piece.engine === 'aframe') &&
        reviseCode && (
          <div className="behavior-card-field" data-testid="art-piece-editor-code-panel">
            <label htmlFor="art-piece-editor-code">Editable source preview</label>
            <textarea
              id="art-piece-editor-code"
              value={reviseCode}
              onChange={(event) => handleSourceChange(event.target.value)}
              rows={8}
            />
            <div>
              <button type="button" onClick={undoManualEdit} disabled={manualHistoryIndex <= 0}>
                Undo
              </button>
              <button
                type="button"
                onClick={redoManualEdit}
                disabled={manualHistoryIndex >= manualHistory.length - 1}
              >
                Redo
              </button>
            </div>
          </div>
        )}
      <p>
        <Link to="/art-pieces/manage">Back to your art pieces</Link>
      </p>

      <PieceSlugField
        current={piece.public_slug}
        save={(slug) => updateArtPiece(piece.public_id, { public_slug: slug })}
        onSaved={(updated) => {
          setPiece((current) => (current ? { ...current, ...updated } : current));
          const path = window.location.pathname;
          if (updated.public_slug && /^\/users\/@[^/]+\/edit\/[^/]+$/.test(path)) {
            navigate(path.replace(/[^/]+$/, encodeURIComponent(updated.public_slug)), {
              replace: true,
            });
          }
        }}
      />

      <div className="behavior-card-field">
        <label htmlFor="art-piece-editor-title">Piece title</label>
        <input
          id="art-piece-editor-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor="art-piece-editor-description">Piece description</label>
        <textarea
          id="art-piece-editor-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button
          type="button"
          onClick={handleSaveMetadata}
          disabled={metadataSaving}
          data-testid="art-piece-editor-save-metadata"
        >
          {metadataSaving ? 'Saving…' : 'Save changes'}
        </button>
        {metadataError && <p role="alert">{metadataError}</p>}
      </div>

      {currentVersion && (
        <div>
          <h3>Current version</h3>
          <img
            src={
              thumbnailBust
                ? `${currentVersion.thumbnail_url}?t=${thumbnailBust}`
                : currentVersion.thumbnail_url
            }
            alt=""
            width="160"
            height="120"
          />
          <button
            type="button"
            onClick={handleRegenerateThumbnail}
            disabled={regeneratingThumbnail}
            data-testid="art-piece-editor-regenerate-thumbnail"
          >
            {regeneratingThumbnail ? 'Regenerating…' : 'Regenerate thumbnail'}
          </button>
          {thumbnailError && <p role="alert">{thumbnailError}</p>}
        </div>
      )}

      <div>
        <h3>Version history</h3>
        <ul data-testid="art-piece-editor-version-list">
          {versions
            .slice()
            .sort((a, b) => b.sequence - a.sequence)
            .map((version) => (
              <li key={version.id}>
                Version {version.sequence} &middot; {formatTimestamp(version.created_at)}
                {currentVersion && version.id === currentVersion.id && ' (current)'}
              </li>
            ))}
        </ul>
      </div>

      <form onSubmit={handleRegenerate}>
        <h3>Revise this piece</h3>
        <p>
          The refinement plan runs with bounded retries before a new version is stored. Select
          declared parts or assets to scope the change.
        </p>
        <div className="behavior-card-field">
          <MentionPromptField
            id="art-piece-editor-prompt"
            label="Describe the revision you want to generate"
            value={prompt}
            onChange={setPrompt}
            options={targetOptions}
            selectedIds={selectedTargetIds}
            onSelectedIdsChange={setSelectedTargetIds}
            disabled={revisePhase === 'pending'}
          />
          {!targetOptions.some((option) => option.type === 'part') && (
            <p className="ai-target-empty-hint">
              No declared parts yet; marked media assets remain available as targets.
            </p>
          )}
        </div>
        <button type="submit" disabled={revisePhase === 'pending' || prompt.trim().length === 0}>
          {revisePhase === 'pending' ? 'Refining…' : 'Refine piece'}
        </button>
      </form>

      {refineRun && (
        <section aria-label="Refinement plan" data-testid="art-piece-refine-plan">
          <h3>Refinement plan</h3>
          <p>
            Attempt {refineRun.attempts} of {refineRun.max_retries + 1};{' '}
            {refineRun.target_references.length} target(s) selected.
          </p>
          <ul>
            {refineRun.plan.success_criteria.map((criterion, index) => (
              <li key={index}>{JSON.stringify(criterion)}</li>
            ))}
          </ul>
        </section>
      )}

      {revisePhase === 'error' && reviseError && (
        <div role="alert" aria-live="assertive" data-testid="art-piece-editor-revise-error">
          <p>{reviseError}</p>
        </div>
      )}
      {revisePhase === 'crashed' && reviseError && (
        <div role="alert" aria-live="assertive" data-testid="art-piece-editor-revise-crashed">
          <p>The generated revision could not render: {reviseError}</p>
        </div>
      )}
      {previewError && (
        <div role="alert" aria-live="polite" data-testid="art-piece-editor-preview-error">
          <p>The unsaved preview could not render: {previewError}</p>
        </div>
      )}

      {sandboxDoc &&
        (revisePhase === 'previewing' || revisePhase === 'ready' || revisePhase === 'crashed') && (
          <div>
            <iframe
              ref={iframeRef}
              title="Art piece revision preview"
              data-testid="art-piece-editor-preview"
              sandbox={ART_PIECE_IFRAME_SANDBOX}
              srcDoc={sandboxDoc}
              style={{ width: '100%', height: 480, border: '1px solid #ccc' }}
            />
            {revisePhase === 'ready' && (
              <>
                <fieldset data-testid="art-piece-editor-capabilities">
                  <legend>Capabilities</legend>
                  {CAPABILITY_OPTIONS.map(({ key, label, spatialOnly }) => {
                    const unsupported = spatialOnly && !SPATIAL_LIBRARIES.has(piece.engine);
                    return (
                      <label key={key} data-testid={`art-piece-editor-capability-${key}`}>
                        <input
                          type="checkbox"
                          checked={!unsupported && Boolean(capabilities[key])}
                          disabled={unsupported}
                          onChange={() => toggleCapability(key)}
                        />
                        {label}
                        {unsupported && ' (Three.js/A-Frame only)'}
                      </label>
                    );
                  })}
                </fieldset>
                {capabilities.camera_view === true && (
                  <fieldset data-testid="art-piece-editor-camera-placement">
                    <legend>Camera composition</legend>
                    <label htmlFor="art-piece-editor-camera-placement-select">
                      Camera feed placement
                    </label>
                    <select
                      id="art-piece-editor-camera-placement-select"
                      value={cameraPlacement}
                      onChange={(event) =>
                        setCameraPlacement(event.target.value as CameraPlacement)
                      }
                    >
                      <option value="overlay">Overlay artwork</option>
                      <option value="background">Behind artwork</option>
                    </select>
                  </fieldset>
                )}
                {refineRun?.status === 'accepted' ? (
                  <p role="status" data-testid="art-piece-refine-accepted">
                    Refinement saved as version {refineRun.accepted_version_id}.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveVersion}
                    disabled={versionSaving || Boolean(previewError)}
                    data-testid="art-piece-editor-save-version"
                  >
                    {versionSaving ? 'Saving…' : 'Save as new version'}
                  </button>
                )}
                {versionSaveError && <p role="alert">{versionSaveError}</p>}
              </>
            )}
          </div>
        )}

      <div>
        <h3>Delete this piece</h3>
        {!confirmingDelete && (
          <button type="button" onClick={() => setConfirmingDelete(true)}>
            Delete piece
          </button>
        )}
        {confirmingDelete && (
          <ArtPieceDeleteConfirm
            title={piece.title}
            deleting={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
        {deleteError && <p role="alert">{deleteError}</p>}
      </div>
    </section>
  );
}

export default ArtPieceEditor;
