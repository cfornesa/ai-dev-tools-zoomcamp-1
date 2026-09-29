import { useState } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { validateProjectMetadataForPublish, type FieldErrors } from '../validation/projectMetadata';

export default function LocalMakePublicDialog({
  initialTitle,
  initialDescription,
  busy,
  onConfirm,
  onCancel,
}: {
  initialTitle: string;
  initialDescription: string;
  busy: boolean;
  onConfirm: (title: string, description: string) => void;
  onCancel: () => void;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const errors: FieldErrors = validateProjectMetadataForPublish({ title, description });
  const canConfirm = Object.keys(errors).length === 0;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="local-make-public-title"
      aria-describedby="local-make-public-description"
      className="publish-confirm-dialog"
    >
      <h4 id="local-make-public-title">Make &quot;{title || 'this piece'}&quot; public?</h4>
      <p id="local-make-public-description">
        This piece and its media currently exist only in this browser. Publishing uploads them to
        the server and makes them visible to anyone with the link or in the public gallery. Copies,
        embeds, and caches of a published piece can&apos;t be recalled once shared. Uploads use TLS
        in transit but are not end-to-end encrypted — the server can read the content.
      </p>
      <label htmlFor="local-make-public-title-input">Title</label>
      <input
        id="local-make-public-title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={busy}
      />
      {errors.title && (
        <p role="alert" className="field-error">
          {errors.title.join(' ')}
        </p>
      )}
      <label htmlFor="local-make-public-description-input">Description</label>
      <textarea
        id="local-make-public-description-input"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={busy}
      />
      {errors.description && (
        <p role="alert" className="field-error">
          {errors.description.join(' ')}
        </p>
      )}
      <button
        type="button"
        onClick={() => onConfirm(title, description)}
        disabled={!canConfirm || busy}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
      <button type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  );
}
