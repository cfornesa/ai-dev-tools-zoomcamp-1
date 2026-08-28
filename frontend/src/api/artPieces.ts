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

/** The libraries this slice supports -- mirrors
 * `ai_provider/art_piece_provider.py`'s `SUPPORTED_LIBRARIES`. Kept as a
 * union of exactly the supported members (rather than a wider
 * aspirational union) so adding a library is a deliberate, visible
 * change at every call site that switches on it. */
export type ArtPieceLibrary = 'canvas2d' | 'svg';

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
