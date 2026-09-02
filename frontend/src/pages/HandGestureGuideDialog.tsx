import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import PieceStageIcon from '../components/PieceStageIcon';

/**
 * Issue #295: a "Show hand gesture guide" button opening an accessible
 * modal dialog explaining the gesture-to-camera-action mapping "Steer the
 * piece" (issue #294) actually ships, alongside `Scene3DPreview.tsx`'s
 * gesture-control toggle.
 *
 * ## Content matches the reference's finite five-step contract
 *
 * The guide deliberately renders one slide at a time: Look, Move, Orbit,
 * Zoom, and Stop safely. The Move slide describes the immersive pinch-held
 * forward/back/strafe mapping shipped by issue #344.
 *
 * ## Reuses `ExportConfigDialog.tsx`'s `role="dialog"` conventions
 *
 * Per the issue's own scope note, this is a genuinely new UI pattern
 * besides that dialog (this app's only other `role="dialog"`) -- rather
 * than inventing a second convention, this reuses the same WAI-ARIA dialog
 * pattern (`role="dialog"`, `aria-modal`, `aria-labelledby`) and the shared
 * `useAlertDialogFocus` hook (focus-on-open, Escape-to-close,
 * focus-returns-to-trigger) that this codebase's alertdialogs already use --
 * the hook's own behavior (moving focus into the dialog and back out again)
 * is identical for a plain informational dialog, so no fork was needed.
 */
export const STEPS = [
  {
    title: 'Look',
    body: 'With "Steer the piece" on, move your open hand around in front of the camera. The view follows your hand\'s left/right and up/down movement.',
  },
  {
    title: 'Move',
    body: 'In an immersive view, pinch and hold, then move your hand left or right to strafe. Move your pinched hand closer to or farther from the camera to travel forward or back. Release the pinch, lose the hand, or stop steering to stop safely.',
  },
  {
    title: 'Orbit',
    body: 'With an open hand, move left, right, up, or down to orbit around the piece. Keep "Steer the piece" enabled while you look around.',
  },
  {
    title: 'Zoom',
    body: 'Pinch your fingers together to zoom in or move your pinched hand to adjust the view. Release the pinch to stop zooming.',
  },
  {
    title: 'Stop safely',
    body: 'Click "Stop steering with gestures" at any time to turn off camera control and stop the camera -- your regular mouse/touch/keyboard controls keep working the whole time.',
  },
] as const;

/**
 * Its own component, mounted only while `isOpen` -- `useAlertDialogFocus`'s
 * mount-time effect (capture the previously-focused element, focus the
 * dialog) must run when the dialog itself opens, not once when
 * `HandGestureGuideDialog` first renders (which would be before there was
 * ever a dialog element for the ref to point at). Matches
 * `PublishControl3D.tsx`'s `PublishConfirmDialog3D` split for the same
 * reason.
 */
function HandGestureGuideDialogContent({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onClose);
  const step = STEPS[stepIndex];

  // A click on the last Next button disables that button during the update,
  // which can otherwise leave browser focus on the page body. Keep keyboard
  // navigation inside the dialog after every slide transition.
  useEffect(() => {
    if (stepIndex > 0) dialogRef.current?.focus();
  }, [dialogRef, stepIndex]);

  function moveStep(delta: number) {
    setStepIndex((current) => Math.max(0, Math.min(STEPS.length - 1, current + delta)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown(event);
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveStep(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveStep(1);
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hand-gesture-guide-title"
      className="hand-gesture-guide-dialog"
    >
      <h4 id="hand-gesture-guide-title">Hand gesture guide</h4>
      <p role="status" aria-live="polite">
        Step {stepIndex + 1} of {STEPS.length}
      </p>
      <div aria-live="polite">
        <h5>{step.title}</h5>
        <p>{step.body}</p>
      </div>
      <nav aria-label="Hand gesture guide navigation">
        <button type="button" onClick={() => moveStep(-1)} disabled={stepIndex === 0}>
          Previous
        </button>
        <button type="button" onClick={() => moveStep(1)} disabled={stepIndex === STEPS.length - 1}>
          Next
        </button>
      </nav>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function HandGestureGuideDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="piece-stage-icon-button"
        aria-label="Show hand gesture guide"
        title="Show hand gesture guide"
        onClick={() => setIsOpen(true)}
      >
        <PieceStageIcon name="guide" />
        <span className="piece-stage-tooltip" role="tooltip">
          Show hand gesture guide
        </span>
      </button>

      {isOpen && <HandGestureGuideDialogContent onClose={() => setIsOpen(false)} />}
    </>
  );
}

export default HandGestureGuideDialog;
