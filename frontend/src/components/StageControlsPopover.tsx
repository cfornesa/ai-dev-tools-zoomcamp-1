import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import PieceStageIcon from './PieceStageIcon';

/**
 * Stage-local disclosure for controls that are too detailed to live in the
 * compact icon row. Children stay mounted while the popover is closed so
 * camera/tracking providers retain their lifecycle and only the explicit
 * control button can request permission.
 */
export default function StageControlsPopover({
  children,
  label = 'Piece controls',
  resetKey,
  showVisibleLabel = true,
  panelClassName,
}: {
  children: ReactNode;
  label?: string;
  resetKey?: string | number;
  showVisibleLabel?: boolean;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

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
        <PieceStageIcon name="controls" />
        {showVisibleLabel && <span className="piece-stage-action-label">{label}</span>}
        <span className="piece-stage-tooltip" role="tooltip">
          {label}
        </span>
      </button>
      <div
        role="group"
        aria-label={label}
        aria-hidden={!open}
        className={`piece-stage-controls-panel${panelClassName ? ` ${panelClassName}` : ''}`}
        hidden={!open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="piece-stage-submenu-close"
          aria-label={`Close ${label.toLowerCase()}`}
          onClick={() => setOpen(false)}
        >
          × Close
        </button>
        {children}
      </div>
    </div>
  );
}
