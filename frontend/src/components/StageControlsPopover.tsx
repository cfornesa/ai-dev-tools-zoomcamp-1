import type { ReactNode } from 'react';
import { useState } from 'react';

/**
 * Stage-local disclosure for controls that are too detailed to live in the
 * compact icon row. Children stay mounted while the popover is closed so
 * camera/tracking providers retain their lifecycle and only the explicit
 * control button can request permission.
 */
export default function StageControlsPopover({
  children,
  label = 'Piece controls',
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="piece-stage-controls">
      <button
        type="button"
        className="piece-stage-icon-button"
        aria-label={open ? `Hide ${label.toLowerCase()}` : label}
        title={open ? `Hide ${label.toLowerCase()}` : label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div role="group" aria-label={label} className="piece-stage-controls-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
