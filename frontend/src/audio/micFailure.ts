/**
 * Issue #308: the microphone-input counterpart of
 * `../components/cameraFailure.ts` -- same fixed-category/specific-
 * recovery-message shape, scoped to `getUserMedia({audio:true})`'s own
 * failure modes rather than mediapipeProvider.ts's camera+tracking ones
 * (there is no tracking/model step for plain mic input).
 */
export type MicFailureCategory =
  | 'insecure-context'
  | 'unsupported-browser'
  | 'permission-denied'
  | 'missing-device'
  | 'unknown-failure';

const RECOVERY_MESSAGES: Record<MicFailureCategory, string> = {
  'insecure-context':
    'Microphone access needs a secure connection (HTTPS). Reload this page over HTTPS to use it.',
  'unsupported-browser':
    "This browser doesn't support microphone input. Try an up-to-date version of Chrome, Edge, or Firefox.",
  'permission-denied':
    "Microphone access was denied. Allow microphone access for this site from your browser's address bar or site settings, then try again.",
  'missing-device': 'No microphone was found on this device. Connect a microphone and try again.',
  'unknown-failure': 'Something went wrong starting the microphone. Try again.',
};

const PERMISSION_DENIED_NAMES = new Set(['NotAllowedError', 'SecurityError']);
const MISSING_DEVICE_NAMES = new Set([
  'NotFoundError',
  'DevicesNotFoundError',
  'OverconstrainedError',
]);

/** Categorizes a `getUserMedia({audio:true})` rejection by its
 * `DOMException.name`. Deliberately does *not* check browser-support or
 * secure-context here -- those are pre-flight conditions the caller
 * checks *before* ever attempting `getUserMedia` (mirroring
 * `CameraControl.tsx`'s own `isSecureContext` pre-check), not something
 * inferred from a caught error after the fact. */
export function categorizeMicError(error: unknown): MicFailureCategory {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (PERMISSION_DENIED_NAMES.has(name)) return 'permission-denied';
  if (MISSING_DEVICE_NAMES.has(name)) return 'missing-device';
  return 'unknown-failure';
}

/** Pre-flight check for whether this browser/context even supports
 * `getUserMedia({audio:true})` at all -- call this *before* attempting to
 * connect the mic, not as part of categorizing a caught error. */
export function isMicSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function micRecoveryMessageFor(category: MicFailureCategory): string {
  return RECOVERY_MESSAGES[category];
}
