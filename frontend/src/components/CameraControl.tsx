import { useEffect, useRef, useState } from 'react';

import { createMediaPipeTrackingProvider } from '../tracking/mediapipeProvider';
import type { TrackingProvider, TrackingProviderError } from '../tracking/types';
import {
  categorizeProviderError,
  recoveryMessageFor,
  type CameraFailureCategory,
} from './cameraFailure';

export type CameraControlProps = {
  /** Factory for the underlying `TrackingProvider`. Defaults to the real
   * MediaPipe-backed provider (`createMediaPipeTrackingProvider`); tests
   * inject a fake `TrackingProvider` so this component never opens a real
   * camera or loads real MediaPipe/Wasm. Called at most once per mounted
   * `CameraControl` — see `getProvider` below — so `Enable camera`, a
   * failure, and `Retry` all reuse the same provider instance and the
   * same `onFrame`/`onError` subscriptions rather than creating new ones
   * each time (acceptance criterion: retrying after a recoverable failure
   * must not duplicate streams, recognizers, or event listeners). */
  createProvider?: () => TrackingProvider;
  /** Test seam for `window.isSecureContext` — jsdom always reports `true`
   * for that read-only global, so a test that wants to exercise the
   * "insecure context" failure category overrides this instead. */
  isSecureContext?: () => boolean;
  /** Task 82: fires whenever `status` changes, so a caller (the
   * onboarding-hints surface, `OnboardingHints.tsx`) can observe the real
   * `'active'` transition to auto-clear a camera-enable hint, rather than
   * guessing with a timer. Optional and purely additive — no existing
   * caller passes it, so this is a non-breaking change to the component's
   * lifecycle. */
  onStatusChange?: (status: CameraStatus) => void;
};

export type CameraStatus = 'idle' | 'starting' | 'active' | 'error' | 'stopped';

const PRIVACY_NOTICE =
  'Video from your camera is processed locally in your browser for hand tracking. It is never recorded, stored, or uploaded.';

function statusMessage(status: CameraStatus): string | null {
  switch (status) {
    case 'starting':
      return 'Starting camera…';
    case 'active':
      return 'Camera is active. Hand tracking is running locally in your browser.';
    case 'stopped':
      return 'Camera stopped. No video is being captured.';
    default:
      return null;
  }
}

/**
 * Task 31 (issue #31): the camera permission and privacy control.
 *
 * `_docs/plan.md`'s "Public viewing" and "Camera/device handling" sections
 * both call for the same shape of control: an explicit `Enable camera`
 * action, a local-only privacy notice shown up front, and friendly
 * fallbacks for denied permission, missing camera, unsupported browser, or
 * failed tracking — always alongside a non-camera fallback (this app's
 * demo controls, `DemoControlsPanel.tsx`, rendered independently by
 * `EditorWorkspace.tsx` and never touched by this component).
 *
 * Lifecycle (acceptance criteria):
 * - Nothing here calls `createProvider`, `getUserMedia`, or `start()` on
 *   mount — the `TrackingProvider` is created lazily, only inside
 *   `handleEnable`, the click handler for the one "Enable camera"/"Retry"
 *   button that can ever call `start()`.
 * - `status` starts at `'idle'` (privacy notice + Enable camera button
 *   only) and moves to `'starting'` on click, `'active'` once the
 *   provider's `onFrame` channel proves tracking is actually producing
 *   frames (not just optimistically after calling `start()`), and
 *   `'error'` if the provider's `onError` channel fires first. Both the
 *   visible status paragraph and the error paragraph are `aria-live`
 *   regions (`role="status"`/`role="alert"`), so the same state change is
 *   exposed programmatically, not just visually.
 * - `Stop camera` calls the provider's `stop()`, which synchronously
 *   releases every acquired `MediaStreamTrack` and tears down the
 *   recognizer (see `mediapipeProvider.ts`'s `releaseResources`) — this
 *   component does not need to duplicate that cleanup, only trigger it and
 *   reflect the resulting `'stopped'` status.
 * - The provider instance and its two subscriptions are created at most
 *   once per mount (`getProvider`'s `providerRef` guard). A `Retry` click
 *   after an `'error'` status reuses that same instance/listeners and
 *   relies on the `TrackingProvider` contract's idempotency guarantee
 *   (`start()` after a failure — which leaves the provider in a
 *   `'stopped'` internal state — cleanly restarts from a clean slate; see
 *   `types.ts`'s `TrackingProvider` doc comment) rather than constructing
 *   a second provider or registering a second listener.
 */
function CameraControl({
  createProvider = createMediaPipeTrackingProvider,
  isSecureContext = () => window.isSecureContext,
  onStatusChange,
}: CameraControlProps) {
  const providerRef = useRef<TrackingProvider | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [failure, setFailure] = useState<CameraFailureCategory | null>(null);

  // Task 82: notify the caller on every status change (including the
  // initial 'idle' render) so it can derive its own state from the same
  // status this component already tracks, rather than duplicating the
  // provider lifecycle.
  useEffect(() => {
    onStatusChange?.(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function getProvider(): TrackingProvider {
    if (!providerRef.current) {
      const provider = createProvider();
      provider.onFrame(() => {
        // The first frame after a start is the signal that tracking is
        // genuinely live, not just that `start()` was called — a
        // permission prompt, model download, etc. can all still be
        // pending at that point. Once active, later frames are a no-op
        // here (status is already 'active').
        setStatus((current) => (current === 'starting' ? 'active' : current));
      });
      provider.onError((error: TrackingProviderError) => {
        setFailure(categorizeProviderError(error));
        setStatus('error');
      });
      providerRef.current = provider;
    }
    return providerRef.current;
  }

  // Releases camera/tracking resources if this control (or its owning
  // route) unmounts while starting or active, e.g. navigating away
  // mid-session. `stop()` is safe to call even if the camera was never
  // enabled (idle) or the provider was never created.
  useEffect(() => {
    return () => {
      providerRef.current?.stop();
    };
  }, []);

  function handleEnable() {
    if (!isSecureContext()) {
      // Checked here, before ever creating a provider or touching
      // getUserMedia — an insecure context can't be fixed by retrying the
      // same request, so there's nothing camera-related to attempt.
      setFailure('insecure-context');
      setStatus('error');
      return;
    }
    setFailure(null);
    setStatus('starting');
    getProvider().start();
  }

  function handleStop() {
    providerRef.current?.stop();
    setFailure(null);
    setStatus('stopped');
  }

  const message = statusMessage(status);
  const showEnableOrRetry = status === 'idle' || status === 'stopped' || status === 'error';
  const showStop = status === 'starting' || status === 'active';

  return (
    <div className="camera-control" role="group" aria-label="Live camera">
      <h4>Live camera</h4>
      <p className="camera-privacy-notice">{PRIVACY_NOTICE}</p>

      {message && (
        <p role="status" aria-live="polite" data-testid="camera-status">
          {message}
        </p>
      )}

      {status === 'error' && failure && (
        <p role="alert" aria-live="assertive" data-testid="camera-error">
          {recoveryMessageFor(failure)}
        </p>
      )}

      {showEnableOrRetry && (
        <button type="button" onClick={handleEnable}>
          {status === 'error' ? 'Retry' : 'Enable camera'}
        </button>
      )}

      {showStop && (
        <button type="button" onClick={handleStop}>
          Stop camera
        </button>
      )}
    </div>
  );
}

export default CameraControl;
