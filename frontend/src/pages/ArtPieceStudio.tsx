import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import { generateArtPiece, type ArtPieceErrorBody, type ArtPieceLibrary } from '../api/artPieces';
import { useAuth } from '../auth/useAuth';
import {
  generateArtPieceBundle,
  triggerArtPieceBundleDownload,
} from '../generative/artPieceBundle';
import {
  buildArtPieceSandboxDocument,
  parseArtPieceSandboxMessage,
  ART_PIECE_IFRAME_SANDBOX,
} from '../generative/artPieceSandbox';

type GenerationPhase = 'idle' | 'pending' | 'previewing' | 'ready' | 'crashed' | 'error';

const AI_MODEL_STORAGE_KEY = 'gesture-studio:ai-model-preference';

function readStoredModel(): string {
  try {
    return window.localStorage.getItem(AI_MODEL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistModel(value: string): void {
  try {
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, value);
  } catch {
    // Best-effort only.
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as Partial<ArtPieceErrorBody> | null;
    if (body?.error === 'personal_key_required') {
      return 'Configure your personal Mistral key in Account settings before generating an art piece.';
    }
    if (typeof body?.detail === 'string') return body.detail;
    if (body?.detail != null) {
      try {
        return JSON.stringify(body.detail);
      } catch {
        // fall through to the generic message below
      }
    }
  }
  return 'Something went wrong generating this piece. Please try again.';
}

/**
 * Issue #199 (epic #196): the creation flow for multi-library AI art
 * generation -- Canvas2D, SVG, Three.js, and A-Frame. Deliberately a new,
 * separate, and much simpler flow than `EditorWorkspace.tsx`: no Layers
 * panel, no undo/redo, no direct manipulation, no AI edit-patch -- per
 * issue #197's decision, a generated piece here has no structured
 * scene-JSON backing for any of that to operate on. Pick a library,
 * prompt in, sandboxed preview out, download when ready.
 *
 * `../generative/artPieceSandbox.ts` handles each library's different
 * document shape (self-contained markup for Canvas2D/SVG/A-Frame, plain
 * JavaScript wrapped in a provided `<script>`+container for Three.js) --
 * this component only needs to track which library a given `code` result
 * was actually generated for (`resultLibrary`, kept separate from the
 * live `library` dropdown selection, which isn't locked once a result
 * arrives).
 */
function ArtPieceStudio() {
  const auth = useAuth();
  const [library, setLibrary] = useState<ArtPieceLibrary>('canvas2d');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(readStoredModel);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  // The library `code` was actually generated for -- tracked separately
  // from `library` (the live dropdown value) because the dropdown isn't
  // disabled once a result arrives, so a user could change it while
  // still viewing a previous result. Using `library` directly here would
  // then build the sandbox for the *new* selection against the *old*
  // code (e.g. wrapping Three.js JS in a Canvas2D-shaped document).
  const [resultLibrary, setResultLibrary] = useState<ArtPieceLibrary>('canvas2d');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (phase !== 'previewing') return;
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const parsed = parseArtPieceSandboxMessage(event.data);
      if (!parsed) return;
      if (parsed.status === 'ready') setPhase('ready');
      else {
        setPhase('crashed');
        setError(parsed.message);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [phase]);

  function updateModel(next: string) {
    setModel(next);
    persistModel(next);
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setPhase('pending');
    setError(null);
    setCode(null);

    try {
      const result = await generateArtPiece(
        library,
        trimmed,
        controller.signal,
        model.trim() || undefined,
      );
      if (abortControllerRef.current !== controller) return;
      setCode(result.code);
      setResultLibrary(library);
      setPhase('previewing');
    } catch (err) {
      if (abortControllerRef.current !== controller) return;
      setPhase('error');
      setError(errorMessage(err));
    }
  }

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') {
    return (
      <section aria-label="Art piece studio">
        <h2>Art piece studio</h2>
        <p>Sign in to generate an AI art piece.</p>
      </section>
    );
  }

  const pending = phase === 'pending';
  const sandboxDoc = code ? buildArtPieceSandboxDocument(code, resultLibrary) : null;

  // Issue #200: a portable multi-file bundle (index.html + styles/ +
  // scripts/ for Three.js + runtime/ vendoring the CDN library so a
  // Three.js/A-Frame piece works completely offline after downloading) --
  // not the live-preview sandbox document, which still carries the
  // postMessage listener and (for Three.js/A-Frame) a live CDN reference
  // that only make sense while this page is showing the preview.
  async function handleDownload() {
    if (!code) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await generateArtPieceBundle(resultLibrary, code);
      triggerArtPieceBundleDownload(blob, 'art-piece.zip');
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not build the download.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-label="Art piece studio">
      <h2>Art piece studio</h2>
      <p>
        Generate a standalone art piece from a text prompt. This is a separate, simpler flow from
        the main editor: there is no layers panel or undo history here — just a prompt, a sandboxed
        preview, and a download.
      </p>

      <form onSubmit={handleGenerate}>
        <div className="behavior-card-field">
          <label htmlFor="art-piece-library">Library</label>
          <select
            id="art-piece-library"
            value={library}
            disabled={pending}
            onChange={(event) => setLibrary(event.target.value as ArtPieceLibrary)}
          >
            <option value="canvas2d">Canvas2D</option>
            <option value="svg">SVG</option>
            <option value="threejs">Three.js</option>
            <option value="aframe">A-Frame</option>
          </select>
        </div>

        <div className="behavior-card-field">
          <label htmlFor="art-piece-prompt">Describe the art piece you want to generate</label>
          <textarea
            id="art-piece-prompt"
            value={prompt}
            disabled={pending}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="behavior-card-field">
          <label htmlFor="art-piece-model">Mistral model (optional)</label>
          <input
            id="art-piece-model"
            type="text"
            value={model}
            disabled={pending}
            placeholder="Uses the account default when blank"
            onChange={(event) => updateModel(event.target.value)}
          />
        </div>

        <button type="submit" disabled={pending || prompt.trim().length === 0}>
          {pending ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {pending && (
        <p role="status" aria-live="polite" data-testid="art-piece-pending-status">
          Contacting the AI assistant…
        </p>
      )}

      {phase === 'error' && error && (
        <div role="alert" aria-live="assertive" data-testid="art-piece-error">
          <p>{error}</p>
        </div>
      )}

      {phase === 'crashed' && error && (
        <div role="alert" aria-live="assertive" data-testid="art-piece-crashed">
          <p>The generated piece could not render: {error}</p>
          <p>Try adjusting the prompt and generating again.</p>
        </div>
      )}

      {sandboxDoc && (phase === 'previewing' || phase === 'ready' || phase === 'crashed') && (
        <div>
          <iframe
            ref={iframeRef}
            title="Art piece preview"
            data-testid="art-piece-preview"
            sandbox={ART_PIECE_IFRAME_SANDBOX}
            srcDoc={sandboxDoc}
            style={{ width: '100%', height: 480, border: '1px solid #ccc' }}
          />
          {phase === 'ready' && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              data-testid="art-piece-download"
            >
              {downloading ? 'Preparing download…' : 'Download'}
            </button>
          )}
          {downloadError && (
            <p role="alert" aria-live="assertive" data-testid="art-piece-download-error">
              {downloadError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default ArtPieceStudio;
