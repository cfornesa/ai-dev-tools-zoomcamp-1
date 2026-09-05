/**
 * Issue #199 (epic #196): typed fetch wrapper for
 * `POST /api/ai/art-pieces/generate/` (`scenes/art_piece_api.py`) -- the
 * Canvas2D first slice of the multi-library AI art generation flow.
 *
 * Deliberately separate from `./ai.ts` (the scene create/edit endpoints):
 * per issue #197's architecture decision, this is a different, simpler
 * flow with no project/scene attachment and no structured-output
 * contract -- `code` is a raw string, never validated or executed by this
 * module. See `../generative/artPieceSandbox.ts` for what makes it safe
 * to render.
 */
import { apiFetch } from './client';

/** The libraries this endpoint supports -- mirrors
 * `ai_provider/art_piece_provider.py`'s `SUPPORTED_LIBRARIES`. Kept as a
 * union of exactly the supported members (rather than a wider
 * aspirational union) so adding a library is a deliberate, visible
 * change at every call site that switches on it. Also imported by
 * `../generative/artPieceSandbox.ts`, which needs to know which
 * libraries require a pinned CDN script/relaxed CSP. */
export type ArtPieceLibrary = 'canvas2d' | 'svg' | 'threejs' | 'aframe';

export type ArtPieceUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
};

export type GenerateArtPieceResponse = {
  library: ArtPieceLibrary;
  /** Raw, unvalidated generated markup -- never executed by this module.
   * Only safe to render via `buildArtPieceSandboxDocument` inside a
   * sandboxed iframe; see that module's doc comment. */
  code: string;
  usage: ArtPieceUsage;
};

export type ArtPieceCapabilitySet = Partial<
  Record<
    | 'sound'
    | 'keyboard'
    | 'microphone'
    | 'camera_view'
    | 'hand_steering'
    | 'fullscreen'
    | 'screenshot'
    | 'download'
    | 'immersive',
    boolean
  >
>;

export type ArtPieceVersion = {
  id: number;
  sequence: number;
  source: string;
  capabilities: ArtPieceCapabilitySet;
  thumbnail_url: string;
  created_at: string;
  generation_metadata?: Record<string, unknown>;
};

export type ArtPiece = {
  public_id: string;
  title: string;
  description: string;
  prompt?: string;
  engine: ArtPieceLibrary;
  status: 'draft' | 'published' | 'archived';
  current_version: ArtPieceVersion | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

/** Every distinct `error` code this endpoint can return -- see
 * `scenes/art_piece_api.py`'s `ArtPieceGenerateView.post` for the mapping. */
export type ArtPieceErrorCode =
  | 'prompt_invalid'
  | 'model_invalid'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'provider_quota_exceeded'
  | 'timeout'
  | 'response_too_large'
  | 'provider_failure'
  | 'invalid_structured_output'
  | 'personal_key_required';

export type ArtPieceErrorBody = {
  error: ArtPieceErrorCode;
  detail: unknown;
};

/** `model` blank/omitted means "use the account default", matching
 * `createAIScene`/`editAIScene`'s identical `model?: string` contract
 * from issue #198. */
export function generateArtPiece(
  library: ArtPieceLibrary,
  prompt: string,
  signal?: AbortSignal,
  model?: string,
): Promise<GenerateArtPieceResponse> {
  return apiFetch<GenerateArtPieceResponse>('/api/ai/art-pieces/generate/', {
    method: 'POST',
    body: JSON.stringify(model ? { library, prompt, model } : { library, prompt }),
    signal,
  });
}

export function listArtPieces(): Promise<ArtPiece[]> {
  return apiFetch<ArtPiece[]>('/api/art-pieces/');
}

export function createArtPiece(input: {
  title: string;
  description: string;
  prompt: string;
  engine: ArtPieceLibrary;
  source: string;
  capabilities?: ArtPieceCapabilitySet;
}): Promise<ArtPiece> {
  return apiFetch<ArtPiece>('/api/art-pieces/', { method: 'POST', body: JSON.stringify(input) });
}

export function updateArtPiece(
  publicId: string,
  input: Partial<Pick<ArtPiece, 'title' | 'description' | 'status'>>,
): Promise<ArtPiece> {
  return apiFetch<ArtPiece>(`/api/art-pieces/${publicId}/`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listPublicArtPieces(): Promise<ArtPiece[]> {
  return apiFetch<ArtPiece[]>('/api/public/art-pieces/');
}

export function getPublicArtPiece(publicId: string): Promise<ArtPiece> {
  return apiFetch<ArtPiece>(`/api/public/art-pieces/${publicId}/`);
}

/** Issue #429: the owner-only counterpart of `getPublicArtPiece` --
 * `scenes/art_piece_persistence.py`'s `ArtPieceDetailView.get` 404s (no
 * existence-leaking 403) for anything the caller doesn't own, exactly
 * like `getPublicArtPiece` 404s for anything unpublished. Includes
 * `prompt`/`owner_id`/`published_at`, and each version's `source` and
 * `generation_metadata` -- fields the public shape omits. */
export function getArtPiece(publicId: string): Promise<ArtPiece> {
  return apiFetch<ArtPiece>(`/api/art-pieces/${publicId}/`);
}

export function deleteArtPiece(publicId: string): Promise<void> {
  return apiFetch<void>(`/api/art-pieces/${publicId}/`, { method: 'DELETE' });
}

export function listArtPieceVersions(publicId: string): Promise<ArtPieceVersion[]> {
  return apiFetch<ArtPieceVersion[]>(`/api/art-pieces/${publicId}/versions/`);
}

/** Saves a new, immutable version on an existing piece (a "revision") --
 * distinct from `createArtPiece`, which always creates a brand new piece.
 * The new version becomes the piece's `current_version`; every prior
 * version, and its `source`, is retained unchanged. */
export function createArtPieceVersion(
  publicId: string,
  input: { source: string; capabilities?: ArtPieceCapabilitySet },
): Promise<ArtPieceVersion> {
  return apiFetch<ArtPieceVersion>(`/api/art-pieces/${publicId}/versions/`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function regenerateArtPieceThumbnail(
  publicId: string,
): Promise<{ thumbnail_url: string; width: number; height: number }> {
  return apiFetch(`/api/art-pieces/${publicId}/thumbnail/regenerate/`, { method: 'POST' });
}
