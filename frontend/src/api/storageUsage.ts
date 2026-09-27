import { apiFetch } from './client';

export type StorageEstimate = {
  remaining_after: {
    private: { bytes: number; files: number };
    public: { bytes: number; files: number };
  };
  fits: {
    private: boolean;
    public: boolean;
  };
};

export function fetchStorageEstimate(input: {
  pieceBytes: number;
  mediaBytes: number;
  pieceFiles: number;
  mediaFiles: number;
}): Promise<StorageEstimate> {
  const params = new URLSearchParams({
    piece_bytes: String(input.pieceBytes),
    media_bytes: String(input.mediaBytes),
    piece_files: String(input.pieceFiles),
    media_files: String(input.mediaFiles),
  });
  return apiFetch<StorageEstimate>(`/api/account/storage/estimate/?${params}`);
}
