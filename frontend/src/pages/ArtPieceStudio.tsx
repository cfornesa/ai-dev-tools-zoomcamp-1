import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';
import { generateArtPiece, type ArtPieceErrorBody, type ArtPieceLibrary } from '../api/artPieces';
import { useAuth } from '../auth/useAuth';
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
 * Issue #199 (epic #196): the first-slice creation flow for multi-library
 * AI art generation -- Canvas2D only for now (see this issue's grooming
 * comment for the Three.js/A-Frame/SVG follow-up path). Deliberately a
 * new, separate, and much simpler flow than `EditorWorkspace.tsx`: no
 * Layers panel, no undo/redo, no direct manipulation, no AI edit-patch --
 * per issue #197's decision, a generated piece here has no structured
 * scene-JSON backing for any of that to operate on. Prompt in, sandboxed
 * preview out, download when ready.
 */
function ArtPieceStudio() {
  const auth = useAuth();
  const [library] = useState<ArtPieceLibrary>('canvas2d');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(readStoredModel);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
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
  const sandboxDoc = code ? buildArtPieceSandboxDocument(code) : null;

  function handleDownload() {
    if (!sandboxDoc) return;
    const blob = new Blob([sandboxDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'art-piece.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <select id="art-piece-library" value={library} disabled>
            <option value="canvas2d">Canvas2D</option>
          </select>
          <p>Three.js, A-Frame, and SVG are coming soon.</p>
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
            <button type="button" onClick={handleDownload} data-testid="art-piece-download">
              Download
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default ArtPieceStudio;
