import type { GestureEvent, Hand, TrackingFrame } from '../tracking/types';

/**
 * Task 83 (issue #83): a tiny, framework-agnostic "current tracking frame"
 * mailbox shared between whichever tracking UI is actually producing
 * frames right now (`DemoControlsPanel.tsx`'s demo controller, or
 * `CameraControl.tsx`'s live MediaPipe provider) and the editor's live
 * preview runtime loop (`usePreviewRuntime.ts`).
 *
 * Both `DemoControlsPanel` and `CameraControl` already own their own
 * `TrackingProvider` instance and lifecycle (Task 28/31) — this module
 * deliberately does not create a second, competing provider instance for
 * the preview to read from. Instead, `EditorWorkspace.tsx` passes each
 * component's already-existing frame stream through a small `onFrame`
 * forwarding prop (additive, optional, matching `onPinchStart`'s existing
 * pattern in `DemoControlsPanel`) into one shared instance of this module,
 * and the preview runtime loop reads the *same* frames the demo/camera UI
 * itself is already displaying.
 *
 * ## Which source wins
 *
 * The live camera wins over demo input whenever it is active
 * (`setCameraActive(true)`, driven by `CameraControl`'s own `onStatusChange`
 * — 'active' means the provider has already proven it's producing real
 * frames, not just that `start()` was called) — matching this app's
 * existing convention that the camera and demo controls are independent,
 * always-available alternatives (`CameraControl.tsx`'s own doc comment:
 * "never in place of" the demo fallback) rather than something the user
 * explicitly picks between for the preview.
 *
 * ## Event delivery (exactly once)
 *
 * A `TrackingFrame`'s `events` are one-shot occurrences (`event:pinchStart`,
 * etc. — see `behaviorRuntime.ts`'s "Clock model"), not a level to keep
 * re-reading. `consumeFrame()` therefore *drains* the pending-events queue
 * for whichever source is currently active on every call — exactly the
 * pattern `export/standaloneRuntimeSource.ts`'s own `pendingEvents`
 * draining already uses for the same reason (a per-frame-tick poller must
 * never redeliver the same event twice, nor drop one that arrived between
 * ticks). Hand/presence state (`hands`), by contrast, is a level — reading
 * it repeatedly without "consuming" it is correct, since it always
 * reflects the most recently observed frame.
 */
export type PreviewTrackingSource = {
  /** Forwards one frame from `DemoControlsPanel`'s tracking controller. */
  reportDemoFrame(frame: TrackingFrame): void;
  /** Forwards one frame from `CameraControl`'s live tracking provider. */
  reportCameraFrame(frame: TrackingFrame): void;
  /** Mirrors `CameraControl`'s own status: true only once the camera has
   * proven it's actively producing frames ('active'), matching
   * `CameraControl.tsx`'s own `CameraStatus` semantics. */
  setCameraActive(active: boolean): void;
  /** Returns the frame currently in effect (camera when active, else demo)
   * and drains that source's pending event queue so each event reaches the
   * runtime loop exactly once. Safe to call from any per-frame loop. */
  consumeFrame(): TrackingFrame;
};

type SourceState = {
  hands: Hand[];
  timestamp: number;
  pendingEvents: GestureEvent[];
};

function emptySourceState(): SourceState {
  return { hands: [], timestamp: 0, pendingEvents: [] };
}

export function createPreviewTrackingSource(): PreviewTrackingSource {
  let cameraActive = false;
  const demo = emptySourceState();
  const camera = emptySourceState();

  function report(target: SourceState, frame: TrackingFrame): void {
    target.hands = frame.hands;
    target.timestamp = frame.timestamp;
    if (frame.events.length > 0) target.pendingEvents = target.pendingEvents.concat(frame.events);
  }

  function drain(target: SourceState): TrackingFrame {
    const events = target.pendingEvents;
    target.pendingEvents = [];
    return { timestamp: target.timestamp, hands: target.hands, events };
  }

  return {
    reportDemoFrame(frame) {
      report(demo, frame);
    },
    reportCameraFrame(frame) {
      report(camera, frame);
    },
    setCameraActive(active) {
      cameraActive = active;
    },
    consumeFrame() {
      return drain(cameraActive ? camera : demo);
    },
  };
}
