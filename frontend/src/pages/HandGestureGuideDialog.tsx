import { useRef, useState } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';

/**
 * Issue #295: a "Show hand gesture guide" button opening an accessible
 * modal dialog explaining the gesture-to-camera-action mapping "Steer the
 * piece" (issue #294) actually ships, alongside `Scene3DPreview.tsx`'s
 * gesture-control toggle.
 *
 * ## Content matches what #294 actually implements -- no aspirational steps
 *
 * The reference site (augmenthumankind.com) documents five steps (Look /
 * Move / Orbit / Zoom / Stop safely). This app's #294 implementation only
 * has two independent gesture inputs -- open-hand move (`palmX`/`palmY`)
 * drives combined look/orbit, and pinch strength drives zoom -- with no
 * separate pan/move axis (`Scene3DPreview.tsx`'s own doc comment documents
 * this as a deliberate scope boundary, not a gap). Listing a "Move" step
 * here would document a gesture this build doesn't have, so this guide's
 * three steps are: orbit, zoom, and how to stop safely -- reused as-is if a
 * future issue ever adds a real pan/move gesture.
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
const STEPS = [
  {
    title: 'Look and orbit',
    body: 'With "Steer the piece" on, move your open hand around in front of the camera. The camera orbits to follow your hand\'s left/right and up/down movement.',
  },
  {
    title: 'Zoom',
    body: 'Pinch your fingers together to zoom in; open your hand back up to zoom out.',
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
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onClose);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hand-gesture-guide-title"
      className="hand-gesture-guide-dialog"
    >
      <h4 id="hand-gesture-guide-title">Hand gesture guide</h4>
      <ol>
        {STEPS.map((step) => (
          <li key={step.title}>
            <h5>{step.title}</h5>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
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
      <button type="button" ref={triggerRef} onClick={() => setIsOpen(true)}>
        Show hand gesture guide
      </button>

      {isOpen && <HandGestureGuideDialogContent onClose={() => setIsOpen(false)} />}
    </>
  );
}

export default HandGestureGuideDialog;
