import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  fetchCloudSyncPreference,
  updateCloudSyncPreference,
  type CloudSyncPreference,
} from '../api/cloudSyncPreference';
import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';

function CloudSyncSettings() {
  const [preference, setPreference] = useState<CloudSyncPreference | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchCloudSyncPreference()
      .then(setPreference)
      .catch(() => setMessage('Could not load cloud-sync eligibility.'));
  }, []);

  async function disable() {
    if (!preference) return;
    setBusy(true);
    try {
      setPreference(await updateCloudSyncPreference(false, preference));
      setMessage('Account-level sync is off. Existing local pieces remain local.');
    } catch (error) {
      setMessage(
        error instanceof ApiError ? 'Cloud sync could not be updated.' : 'Request failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!preference) return <p role="status">Loading cloud-sync settings…</p>;
  return (
    <section aria-label="Account cloud sync">
      <p>Sync future eligible pieces to your account cloud storage.</p>
      {!preference.eligible && <p role="alert">Unavailable: {preference.reason}.</p>}
      {preference.signup_preselected && !preference.enabled && (
        <p>Your signup choice is ready to review; it has not enabled uploads.</p>
      )}
      <label>
        <input
          type="checkbox"
          checked={preference.enabled}
          disabled={!preference.eligible || busy}
          onChange={(event) => (event.target.checked ? setDialogOpen(true) : void disable())}
        />
        Sync future pieces to the cloud
      </label>
      {dialogOpen && (
        <CloudSyncConsentDialog
          preference={preference}
          busy={busy}
          onCancel={() => setDialogOpen(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              setPreference(await updateCloudSyncPreference(true, preference));
              setDialogOpen(false);
              setMessage(
                'Cloud sync enabled for future pieces. Existing local pieces are not uploaded automatically.',
              );
            } catch {
              setMessage('Cloud sync could not be enabled.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

function CloudSyncConsentDialog({
  preference,
  busy,
  onCancel,
  onConfirm,
}: {
  preference: CloudSyncPreference;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cloud-sync-consent-title"
      aria-describedby="cloud-sync-consent-copy"
      onKeyDown={onKeyDown}
      className="cloud-sync-consent-dialog"
    >
      <h3 id="cloud-sync-consent-title">Enable account cloud sync?</h3>
      <p id="cloud-sync-consent-copy">{preference.consent_text}</p>
      <p>
        Existing local pieces are offered for upload through{' '}
        {preference.existing_local_pieces_offered_by}; nothing uploads automatically.
      </p>
      <button type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>{' '}
      <button type="button" onClick={() => void onConfirm()} disabled={busy}>
        I understand — enable sync
      </button>
    </div>
  );
}

export default CloudSyncSettings;
