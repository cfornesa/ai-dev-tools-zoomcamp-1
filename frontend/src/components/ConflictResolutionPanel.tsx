import { useState } from 'react';

import type { ConflictResolutionChoice } from '../storage/conflictMerge';
import type { StoredSyncConflict } from '../storage/mutationOutbox';

type Props = {
  conflict: StoredSyncConflict;
  onResolve: (choice: ConflictResolutionChoice, resolvedPayload: unknown) => void;
};

export function ConflictResolutionPanel({ conflict, onResolve }: Props) {
  const [composeText, setComposeText] = useState(() =>
    JSON.stringify(conflict.mergedSnapshot ?? {}, null, 2),
  );
  const [composeError, setComposeError] = useState<string | null>(null);

  function compose() {
    try {
      onResolve('compose', JSON.parse(composeText) as unknown);
      setComposeError(null);
    } catch {
      setComposeError('Enter valid JSON before composing the selected result.');
    }
  }

  return (
    <section
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="sync-conflict-title"
      className="sync-conflict-panel"
    >
      <h3 id="sync-conflict-title">Sync conflict needs a decision</h3>
      <p>
        This mutation was paused because the local and server edits overlap. Nothing was discarded.
        Base version: <code>{conflict.context.baseVersion}</code>.
      </p>
      <ul aria-label="Conflicting fields">
        {conflict.conflicts.map((item) => (
          <li key={item.path}>
            <code>{item.path}</code>
          </li>
        ))}
      </ul>
      <div className="sync-conflict-actions">
        <button
          type="button"
          onClick={() =>
            onResolve('keep-local', conflict.localSnapshot ?? conflict.conflicts[0]?.local)
          }
        >
          Keep local
        </button>
        <button
          type="button"
          onClick={() =>
            onResolve('keep-remote', conflict.remoteSnapshot ?? conflict.conflicts[0]?.remote)
          }
        >
          Keep remote
        </button>
      </div>
      <label htmlFor="sync-conflict-compose">Compose selected result</label>
      <textarea
        id="sync-conflict-compose"
        value={composeText}
        onChange={(event) => setComposeText(event.target.value)}
        rows={6}
      />
      <button type="button" onClick={compose}>
        Rebase / compose result
      </button>
      {composeError && <p role="alert">{composeError}</p>}
    </section>
  );
}
