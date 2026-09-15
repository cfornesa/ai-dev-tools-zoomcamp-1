import type { MutationOutboxRecord } from '../storage/mutationOutbox';

type Props = {
  operation: MutationOutboxRecord;
  onResume: () => void;
  onDiscard: () => void;
};

const labels: Record<string, string> = {
  'authentication-required': 'Your sign-in expired before this private mutation could sync.',
  'permission-denied': 'The server rejected access to this private mutation.',
  'invalid-operation': 'The server rejected this mutation as invalid.',
};

export function MutationRecoveryPanel({ operation, onResume, onDiscard }: Props) {
  return (
    <section className="sync-recovery-panel" aria-labelledby="sync-recovery-title">
      <h3 id="sync-recovery-title">Private sync paused</h3>
      <p>{labels[operation.lastErrorCode ?? ''] ?? 'This private mutation needs your decision.'}</p>
      <p>
        Your local workspace is unchanged. Choose Resume after restoring access, or Discard to
        remove only this queued server mutation.
      </p>
      <div className="sync-conflict-actions">
        <button type="button" onClick={onResume}>
          Resume sync
        </button>
        <button type="button" onClick={onDiscard}>
          Discard queued mutation
        </button>
      </div>
    </section>
  );
}
