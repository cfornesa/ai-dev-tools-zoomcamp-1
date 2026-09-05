import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';

import {
  createArtPieceVersion,
  deleteArtPiece,
  generateArtPiece,
  getArtPiece,
  listArtPieceVersions,
  regenerateArtPieceThumbnail,
  updateArtPiece,
  type ArtPiece,
  type ArtPieceCapabilitySet,
  type ArtPieceVersion,
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

type RevisionPhase = 'idle' | 'pending' | 'previewing' | 'ready' | 'crashed' | 'error';

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
function ArtPieceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

  const [piece, setPiece] = useState<ArtPiece | null>(null);
  const [versions, setVersions] = useState<ArtPieceVersion[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [revisePhase, setRevisePhase] = useState<RevisionPhase>('idle');
  const [reviseCode, setReviseCode] = useState<string | null>(null);
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<ArtPieceCapabilitySet>({});
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionSaveError, setVersionSaveError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [thumbnailBust, setThumbnailBust] = useState(0);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [regeneratingThumbnail, setRegeneratingThumbnail] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || auth.status !== 'signed-in') return;
    Promise.all([getArtPiece(id), listArtPieceVersions(id)])
      .then(([loadedPiece, loadedVersions]) => {
        setPiece(loadedPiece);
        setVersions(loadedVersions);
        setTitle(loadedPiece.title);
        setDescription(loadedPiece.description);
        setCapabilities(loadedPiece.current_version?.capabilities ?? {});
      })
      .catch(() => setLoadError(true));
  }, [id, auth.status]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (revisePhase !== 'previewing') return;
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const parsed = parseArtPieceSandboxMessage(event.data);
      if (!parsed) return;
      if (parsed.status === 'ready') setRevisePhase('ready');
      else {
        setRevisePhase('crashed');
        setReviseError(parsed.message);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [revisePhase]);

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
    setReviseCode(null);

    try {
      const result = await generateArtPiece(piece.engine, trimmed, controller.signal);
      if (abortControllerRef.current !== controller) return;
      setReviseCode(result.code);
      setRevisePhase('previewing');
    } catch {
      if (abortControllerRef.current !== controller) return;
      setRevisePhase('error');
      setReviseError('Something went wrong generating this revision. Please try again.');
    }
  }

  function toggleCapability(key: keyof ArtPieceCapabilitySet) {
    setCapabilities((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSaveVersion() {
    if (!id || !piece || !reviseCode) return;
    setVersionSaving(true);
    setVersionSaveError(null);
    try {
      const version = await createArtPieceVersion(id, {
        source: reviseCode,
        capabilities: sanitizeCapabilities(capabilities, piece.engine),
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
    iframe.srcdoc = buildArtPieceSandboxDocument(piece.current_version.source, piece.engine);
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

  const sandboxDoc = reviseCode ? buildArtPieceSandboxDocument(reviseCode, piece.engine) : null;
  const currentVersion = piece.current_version;

  return (
    <section aria-labelledby="art-piece-editor-heading">
      <h2 id="art-piece-editor-heading">Edit {piece.title}</h2>
      <p>
        <Link to="/art-pieces/manage">Back to your art pieces</Link>
      </p>

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
        <div className="behavior-card-field">
          <label htmlFor="art-piece-editor-prompt">
            Describe the revision you want to generate
          </label>
          <textarea
            id="art-piece-editor-prompt"
            value={prompt}
            disabled={revisePhase === 'pending'}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <button type="submit" disabled={revisePhase === 'pending' || prompt.trim().length === 0}>
          {revisePhase === 'pending' ? 'Generating…' : 'Generate revision'}
        </button>
      </form>

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
                <button
                  type="button"
                  onClick={handleSaveVersion}
                  disabled={versionSaving}
                  data-testid="art-piece-editor-save-version"
                >
                  {versionSaving ? 'Saving…' : 'Save as new version'}
                </button>
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
