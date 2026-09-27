import { apiFetch } from './client';

export type PieceIntakeResponse = {
  kind: '2d' | '3d' | 'generated';
  public_id: string;
  version: number;
  visibility: 'private';
  media_count: number;
};

export function intakePiecePackage(bytes: Uint8Array, idempotencyKey: string) {
  const form = new FormData();
  form.append('package', new Blob([bytes.slice()], { type: 'application/zip' }), 'piece.zip');
  form.append('idempotency_key', idempotencyKey);
  return apiFetch<PieceIntakeResponse>('/api/pieces/intake/', { method: 'POST', body: form });
}
