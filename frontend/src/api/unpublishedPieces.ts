import { apiFetch } from './client';

export type UnpublishedPieceKind = 'project' | 'project3d' | 'art_piece';

export type UnpublishedPiece = {
  kind: UnpublishedPieceKind;
  public_id: string;
  title: string;
  unpublished_at: string;
  purge_eligible_at: string | null;
  editor_url: string | null;
};

export type UnpublishedPiecesResponse = {
  pieces: UnpublishedPiece[];
  unpublished_grace_days: number;
};

/** Issue #944: the owner-facing "Retained unpublished pieces" list. */
export function fetchMyUnpublishedPieces(): Promise<UnpublishedPiecesResponse> {
  return apiFetch<UnpublishedPiecesResponse>('/api/account/unpublished-pieces/');
}
