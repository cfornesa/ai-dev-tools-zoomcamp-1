import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { LOCAL_TRANSFER_CONSENT_VERSION } from '../storage/localTransferConsent';

type LocalTransferConsentDialogProps = {
  pieceTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function LocalTransferConsentDialog({
  pieceTitle,
  onCancel,
  onConfirm,
}: LocalTransferConsentDialogProps) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="local-transfer-consent-title"
      aria-describedby="local-transfer-consent-summary"
      onKeyDown={onKeyDown}
      className="local-transfer-consent-dialog"
    >
      <h2 id="local-transfer-consent-title">Send this local piece to AI?</h2>
      <p id="local-transfer-consent-summary">
        “{pieceTitle}” stays in this browser. If you continue, the prompt and selected engine are
        sent to this app&apos;s AI endpoint, which forwards the request to the configured AI vendor.
        The current local source and media are not uploaded by this action, and no server piece is
        created.
      </p>
      <p>Consent record: {LOCAL_TRANSFER_CONSENT_VERSION}, for this piece version only.</p>
      <div className="local-transfer-consent-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm}>
          Continue to AI
        </button>
      </div>
    </div>
  );
}
