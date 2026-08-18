import { describe, expect, it } from 'vitest';

import { createManualTrackingProvider, MANUAL_SIGNAL_RANGES } from './manualProvider';
import { HAND_LANDMARK_COUNT } from './types';
import type { TrackingFrame } from './types';

function collectFrames(provider: ReturnType<typeof createManualTrackingProvider>): TrackingFrame[] {
  const frames: TrackingFrame[] = [];
  provider.onFrame((frame) => frames.push(frame));
  return frames;
}

describe('manualProvider', () => {
  it('emits no frames before start()', () => {
    const provider = createManualTrackingProvider();
    const frames = collectFrames(provider);
    provider.setPresent(true);
    provider.setSignal('indexTipX', 0.7);
    expect(frames).toHaveLength(0);
  });

  it('emits a handAppear event and a hand with a full landmark set when a hand becomes present', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    const frames = collectFrames(provider);
    provider.setPresent(true);

    expect(frames).toHaveLength(1);
    const [frame] = frames;
    expect(frame.events).toEqual([
      { type: 'handAppear', handId: expect.any(String), timestamp: frame.timestamp },
    ]);
    expect(frame.hands).toHaveLength(1);
    expect(frame.hands[0].landmarks).toHaveLength(HAND_LANDMARK_COUNT);
    expect(frame.hands[0].confidence).toBe(0.9);
  });

  it('is a no-op to set presence to its current value', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    const frames = collectFrames(provider);
    provider.setPresent(false); // already absent
    expect(frames).toHaveLength(0);
  });

  it('moves the index fingertip landmark when indexTipX/Y are set while present', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    provider.setPresent(true);
    const frames = collectFrames(provider);
    provider.setSignal('indexTipX', 0.2);
    provider.setSignal('indexTipY', 0.8);

    expect(frames).toHaveLength(2);
    const last = frames[frames.length - 1];
    const indexTip = last.hands[0].landmarks[8];
    expect(indexTip.x).toBeCloseTo(0.2);
    expect(indexTip.y).toBeCloseTo(0.8);
  });

  it('clamps signals to their documented range', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    provider.setPresent(true);
    const frames = collectFrames(provider);
    provider.setSignal('indexTipX', 5);
    provider.setSignal('confidence', -1);

    const last = frames[frames.length - 1];
    expect(last.hands[0].landmarks[8].x).toBe(MANUAL_SIGNAL_RANGES.indexTipX.max);
    expect(last.hands[0].confidence).toBe(MANUAL_SIGNAL_RANGES.confidence.min);
  });

  it('does not emit a frame for a signal change while no hand is present, but keeps the value', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    const frames = collectFrames(provider);
    provider.setSignal('indexTipX', 0.3);
    expect(frames).toHaveLength(0);
    expect(provider.getState().indexTipX).toBeCloseTo(0.3);
  });

  it('emits gestureEnter then gestureExit around a gesture change, and ignores gesture changes while absent', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    provider.setGesture('openPalm'); // no hand yet: ignored
    provider.setPresent(true);
    const frames = collectFrames(provider);

    provider.setGesture('openPalm');
    expect(frames).toHaveLength(1);
    expect(frames[0].events).toEqual([
      {
        type: 'gestureEnter',
        handId: expect.any(String),
        gesture: 'openPalm',
        timestamp: frames[0].timestamp,
      },
    ]);

    provider.setGesture('closedFist');
    expect(frames).toHaveLength(2);
    expect(frames[1].events).toEqual([
      {
        type: 'gestureExit',
        handId: expect.any(String),
        gesture: 'openPalm',
        timestamp: frames[1].timestamp,
      },
      {
        type: 'gestureEnter',
        handId: expect.any(String),
        gesture: 'closedFist',
        timestamp: frames[1].timestamp,
      },
    ]);

    provider.setGesture(null);
    expect(frames).toHaveLength(3);
    expect(frames[2].events).toEqual([
      {
        type: 'gestureExit',
        handId: expect.any(String),
        gesture: 'closedFist',
        timestamp: frames[2].timestamp,
      },
    ]);
  });

  it('setting gesture to its current value is a no-op', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    provider.setPresent(true);
    provider.setGesture('victory');
    const frames = collectFrames(provider);
    provider.setGesture('victory');
    expect(frames).toHaveLength(0);
  });

  it('emits pinchStart/pinchEnd only while a hand is present', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    const frames = collectFrames(provider);
    provider.emitPinchStart();
    provider.emitPinchEnd();
    expect(frames).toHaveLength(0);

    provider.setPresent(true);
    frames.length = 0;
    provider.emitPinchStart();
    provider.emitPinchEnd();
    expect(frames).toHaveLength(2);
    expect(frames[0].events[0].type).toBe('pinchStart');
    expect(frames[1].events[0].type).toBe('pinchEnd');
  });

  it('exits an active gesture and disappears the hand in one frame when presence turns off', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    provider.setPresent(true);
    provider.setGesture('thumbsUp');
    const frames = collectFrames(provider);

    provider.setPresent(false);
    expect(frames).toHaveLength(1);
    expect(frames[0].events).toEqual([
      {
        type: 'gestureExit',
        handId: expect.any(String),
        gesture: 'thumbsUp',
        timestamp: frames[0].timestamp,
      },
      { type: 'handDisappear', handId: expect.any(String), timestamp: frames[0].timestamp },
    ]);
    expect(frames[0].hands).toEqual([]);
  });

  it('never reuses a retired hand id across a disappear/reappear cycle', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    const frames = collectFrames(provider);
    provider.setPresent(true);
    const firstId = frames[0].hands[0].id;
    provider.setPresent(false);
    provider.setPresent(true);
    const secondId = frames[frames.length - 1].hands[0].id;

    expect(secondId).not.toBe(firstId);
  });

  it('start() is idempotent and stop() is safe before start() and when already stopped', () => {
    const provider = createManualTrackingProvider();
    expect(() => provider.stop()).not.toThrow();
    provider.start();
    provider.start();
    provider.setPresent(true);
    const frames = collectFrames(provider);
    // no-op double start above happened before this listener was attached;
    // confirm a genuine double-start now truly does nothing new.
    provider.start();
    expect(frames).toHaveLength(0);
    provider.stop();
    expect(() => provider.stop()).not.toThrow();
  });

  it('stop() resets presence/gesture without emitting, and does not carry a hand into frames after the next start()', () => {
    const provider = createManualTrackingProvider();
    provider.start();
    provider.setPresent(true);
    provider.setGesture('pointingUp');
    provider.stop();

    const frames = collectFrames(provider);
    provider.start();
    expect(frames).toHaveLength(0); // start() itself never emits

    provider.setSignal('indexTipX', 0.4); // no hand present post-reset: no-op
    expect(frames).toHaveLength(0);
    expect(provider.getState().present).toBe(false);
    expect(provider.getState().gesture).toBeNull();
  });
});
