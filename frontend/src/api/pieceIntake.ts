import { apiFetch } from './client';

export type PieceIntakeResponse = {
  kind: '2d' | '3d' | 'generated';
  public_id: string;
  version: number;
  visibility: 'private';
  media_count: number;
};

export function intakePiecePackage(
  bytes: Uint8Array,
  idempotencyKey: string,
  options: { pieceId?: string; expectedRevision?: number } = {},
) {
  const form = new FormData();
  form.append('package', new Blob([bytes.slice()], { type: 'application/zip' }), 'piece.zip');
  form.append('idempotency_key', idempotencyKey);
  if (options.pieceId) form.append('piece_id', options.pieceId);
  if (options.expectedRevision !== undefined) {
    form.append('expected_revision', String(options.expectedRevision));
  }
  return apiFetch<PieceIntakeResponse>('/api/pieces/intake/', { method: 'POST', body: form });
}
