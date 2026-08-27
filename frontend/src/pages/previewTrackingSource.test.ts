import { describe, expect, it } from 'vitest';

import { createPreviewTrackingSource } from './previewTrackingSource';
import type { TrackingFrame } from '../tracking/types';

function frame(timestamp: number, events: TrackingFrame['events'] = []): TrackingFrame {
  return { timestamp, hands: [], events };
}

describe('preview tracking latest-frame backpressure (issue #192)', () => {
  it('keeps one pending frame and drops stale frames before runtime delivery', () => {
    const source = createPreviewTrackingSource();

    source.setCameraActive(true);
    source.reportCameraFrame(frame(1));
    source.reportCameraFrame(frame(2));
    source.reportCameraFrame(frame(3));

    expect(source.consumeFrame().timestamp).toBe(3);
    expect(source.getDiagnostics()).toEqual({
      receivedFrames: 3,
      droppedFrames: 2,
      deliveredFrames: 1,
    });
  });

  it('does not redeliver unchanged state or queue stale events', () => {
    const source = createPreviewTrackingSource();
    const event = { type: 'handAppear' as const, handId: 'hand-1', timestamp: 1 };

    source.setCameraActive(true);
    source.reportCameraFrame(frame(1, [event]));
    source.reportCameraFrame(frame(2));

    expect(source.consumeFrame()).toEqual(frame(2));
    expect(source.consumeFrame()).toEqual(frame(2));
    expect(source.getDiagnostics().deliveredFrames).toBe(1);
  });

  it('keeps demo and camera mailboxes independent while camera is active', () => {
    const source = createPreviewTrackingSource();
    source.reportDemoFrame(frame(10));
    source.reportCameraFrame(frame(20));
    source.setCameraActive(true);

    expect(source.consumeFrame().timestamp).toBe(20);
    source.setCameraActive(false);
    expect(source.consumeFrame().timestamp).toBe(10);
  });
});
