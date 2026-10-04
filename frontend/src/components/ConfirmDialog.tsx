import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';

import './ConfirmDialog.css';

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * Shared destructive-action confirmation built on Radix's unstyled
 * AlertDialog primitive. The trigger remains in the dialog's focus scope so
 * Radix can restore focus after cancel, Escape, or confirmation.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirm-dialog-overlay" />
        <AlertDialog.Content
          className="confirm-dialog-content"
          aria-describedby="confirm-dialog-description"
        >
          <AlertDialog.Title className="confirm-dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description
            id="confirm-dialog-description"
            className="confirm-dialog-description"
          >
            {description}
          </AlertDialog.Description>
          <div className="confirm-dialog-actions">
            <AlertDialog.Cancel asChild>
              <button type="button" className="shell-action confirm-dialog-cancel">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className="shell-action confirm-dialog-confirm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
