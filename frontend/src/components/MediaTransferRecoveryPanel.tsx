import type { MediaTransferRecord } from '../storage/mediaTransfer';

type Props = {
  transfers: MediaTransferRecord[];
  onResume: (transferId: string) => void;
  onDiscard: (transferId: string) => void;
};

const labels: Record<string, string> = {
  'checksum-mismatch': 'The remote copy did not match the local checksum.',
  'quota-exceeded': 'The destination storage quota was exceeded.',
  'permission-denied': 'The destination rejected access to this transfer.',
  offline: 'The transfer was interrupted while offline.',
};

export function MediaTransferRecoveryPanel({ transfers, onResume, onDiscard }: Props) {
  if (transfers.length === 0) return null;
  return (
    <section className="sync-recovery-panel" aria-labelledby="media-recovery-title">
      <h3 id="media-recovery-title">Media transfers need recovery</h3>
      <p>
        The local media remains preserved. Retry after restoring access or space, or discard only
        the transfer record.
      </p>
      <ul>
        {transfers.map((transfer) => (
          <li key={transfer.transferId}>
            <span>
              {transfer.assetId}: {labels[transfer.lastErrorCode ?? ''] ?? 'The transfer paused.'}
            </span>{' '}
            <button type="button" onClick={() => onResume(transfer.transferId)}>
              Retry transfer
            </button>{' '}
            <button type="button" onClick={() => onDiscard(transfer.transferId)}>
              Discard transfer
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
