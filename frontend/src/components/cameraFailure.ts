/**
 * Task 31 (issue #31): maps camera/tracking failures onto a fixed set of
 * distinct categories, each with its own specific recovery message — see
 * the issue's acceptance criterion: "Denied permission, missing device,
 * insecure context, unsupported browser, model failure, and tracking
 * failure each show a specific recovery message."
 *
 * `mediapipeProvider.ts`'s `onError` channel (see that module's "Failure
 * routing" doc comment) delivers every non-insecure-context failure as one
 * `TrackingProviderError` per occurrence, with a fixed, first-party
 * message per failure site plus an opaque `cause` (the underlying
 * exception, if any — see `TrackingProviderError`'s own doc comment:
 * "Opaque to this contract"). `categorizeProviderError` is the one place
 * that (a) pattern-matches those fixed messages back into a category and
 * (b) looks inside `cause` for a `DOMException`-style `.name` to split
 * mediapipeProvider's single "Camera access was denied or no camera is
 * available." message into the "permission denied" vs. "missing device"
 * categories the UI must distinguish.
 *
 * "Insecure context" is not a mediapipeProvider failure at all —
 * `CameraControl.tsx` checks `window.isSecureContext` itself, before ever
 * creating a provider or calling `start()`, so it never reaches this
 * function as a `TrackingProviderError`.
 */
import type { TrackingProviderError } from '../tracking/types';

export type CameraFailureCategory =
  | 'insecure-context'
  | 'unsupported-browser'
  | 'permission-denied'
  | 'missing-device'
  | 'model-failure'
  | 'tracking-failure'
  | 'unknown-failure';

const RECOVERY_MESSAGES: Record<CameraFailureCategory, string> = {
  'insecure-context':
    'Camera access needs a secure connection (HTTPS). Reload this page over HTTPS, or use the demo controls below instead.',
  'unsupported-browser':
    "This browser doesn't support the camera hand-tracking features this app needs. Try an up-to-date version of Chrome, Edge, or Firefox, or use the demo controls below instead.",
  'permission-denied':
    "Camera access was denied. Allow camera access for this site from your browser's address bar or site settings, then try again — or use the demo controls below instead.",
  'missing-device':
    'No camera was found on this device. Connect a camera and try again, or use the demo controls below instead.',
  'model-failure':
    'The hand-tracking model could not be loaded, possibly due to a network issue. Check your connection and try again, or use the demo controls below instead.',
  'tracking-failure':
    'Hand tracking stopped unexpectedly. Try again, or use the demo controls below instead.',
  'unknown-failure':
    'Something went wrong starting the camera. Try again, or use the demo controls below instead.',
};

/** `DOMException.name` values a real `getUserMedia()` rejection carries
 * when the user (or a site-permission policy) denied access. */
const PERMISSION_DENIED_CAUSE_NAMES = new Set(['NotAllowedError', 'SecurityError']);

/** `DOMException.name` values a real `getUserMedia()` rejection carries
 * when no matching camera hardware exists (as opposed to being denied). */
const MISSING_DEVICE_CAUSE_NAMES = new Set([
  'NotFoundError',
  'DevicesNotFoundError',
  'OverconstrainedError',
]);

function causeName(cause: unknown): string | undefined {
  if (cause && typeof cause === 'object' && 'name' in cause) {
    const name = (cause as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

/**
 * Categorizes a `TrackingProviderError` emitted by a `TrackingProvider`'s
 * `onError` channel (in practice, `mediapipeProvider.ts`). Pure function —
 * no camera/DOM access — so it's directly unit-testable against fixture
 * errors that mirror mediapipeProvider.ts's real failure sites.
 */
export function categorizeProviderError(error: TrackingProviderError): CameraFailureCategory {
  const { message, cause } = error;

  if (/not supported/i.test(message)) return 'unsupported-browser';

  if (/camera access was denied|no camera is available/i.test(message)) {
    const name = causeName(cause);
    if (name && MISSING_DEVICE_CAUSE_NAMES.has(name)) return 'missing-device';
    if (name && PERMISSION_DENIED_CAUSE_NAMES.has(name)) return 'permission-denied';
    // An unrecognized or missing cause name still needs *some* specific
    // category — "permission denied" is the more common real-world cause
    // and the safer default recovery instructions (they also cover "try
    // again" for a transient hardware failure).
    return 'permission-denied';
  }

  if (/failed to load the .*module|failed to load the gesture recognizer model/i.test(message)) {
    return 'model-failure';
  }

  if (/inference failed|video playback/i.test(message)) return 'tracking-failure';

  return 'unknown-failure';
}

export function recoveryMessageFor(category: CameraFailureCategory): string {
  return RECOVERY_MESSAGES[category];
}
