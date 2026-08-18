import { describe, expect, it } from 'vitest';

import { createDemoTrackingController } from './demoController';
import type { TrackingFrame } from './types';

function collectFrames(
  controller: ReturnType<typeof createDemoTrackingController>,
): TrackingFrame[] {
  const frames: TrackingFrame[] = [];
  controller.onFrame((frame) => frames.push(frame));
  return frames;
}

describe('demoController', () => {
  it('defaults to manual mode and emits nothing until start()', () => {
    const controller = createDemoTrackingController();
    expect(controller.getMode()).toBe('manual');
    const frames = collectFrames(controller);
    controller.setPresent(true);
    expect(frames).toHaveLength(0);
  });

  it('routes manual control calls through to frames once started, in manual mode', () => {
    const controller = createDemoTrackingController();
    controller.start();
    const frames = collectFrames(controller);
    controller.setPresent(true);
    controller.setSignal('indexTipX', 0.3);
    controller.emitPinchStart();

    expect(frames).toHaveLength(3);
    expect(frames[0].events[0].type).toBe('handAppear');
    expect(frames[2].events[0].type).toBe('pinchStart');
  });

  it('does not emit any frame merely from starting, stopping, or switching modes', () => {
    const controller = createDemoTrackingController();
    const frames = collectFrames(controller);
    controller.start();
    controller.setMode('playback');
    controller.setMode('manual');
    controller.stop();
    controller.start();
    expect(frames).toHaveLength(0);
  });

  it('manual controls have no effect while in playback mode', () => {
    const controller = createDemoTrackingController();
    controller.start();
    controller.setMode('playback');
    const frames = collectFrames(controller);
    controller.setPresent(true);
    controller.setSignal('indexTipX', 0.9);
    controller.emitPinchStart();
    expect(frames).toHaveLength(0);
  });

  it('advancePlayback emits the scripted frames in order only while in playback mode', () => {
    const controller = createDemoTrackingController();
    controller.start();
    const frames = collectFrames(controller);

    // Not in playback mode yet: advancing does nothing.
    expect(controller.advancePlayback()).toBe(false);
    expect(frames).toHaveLength(0);

    controller.setMode('playback');
    expect(controller.advancePlayback()).toBe(true);
    expect(frames).toHaveLength(1);
    expect(frames[0].events[0].type).toBe('handAppear');
    expect(controller.remainingPlayback()).toBe(controller.totalPlaybackEntries() - 1);
  });

  it("switching from playback back to manual does not emit the manual provider's stale state", () => {
    const controller = createDemoTrackingController();
    controller.start();
    controller.setPresent(true); // manual: hand present
    controller.setMode('playback'); // deactivates manual (resets its present flag)
    const frames = collectFrames(controller);

    controller.setMode('manual'); // switching back: no frame expected
    expect(frames).toHaveLength(0);

    // Manual state was reset by being stopped while inactive, so a signal
    // change now has nothing to attach to until presence is re-enabled.
    controller.setSignal('indexTipX', 0.6);
    expect(frames).toHaveLength(0);
  });

  it('resetPlayback rewinds the script without emitting, then advancePlayback starts over', () => {
    const controller = createDemoTrackingController();
    controller.start();
    controller.setMode('playback');
    controller.advancePlayback();
    controller.advancePlayback();
    expect(controller.remainingPlayback()).toBe(controller.totalPlaybackEntries() - 2);

    const frames = collectFrames(controller);
    controller.resetPlayback();
    expect(frames).toHaveLength(0);
    expect(controller.remainingPlayback()).toBe(controller.totalPlaybackEntries());

    controller.advancePlayback();
    expect(frames).toHaveLength(1);
    expect(frames[0].events[0].type).toBe('handAppear');
  });

  it('playing back the full script twice in a row (via resetPlayback) is repeatable', () => {
    const controller = createDemoTrackingController();
    controller.start();
    controller.setMode('playback');
    const firstRun: TrackingFrame[] = [];
    const unsubscribeFirst = controller.onFrame((frame) => firstRun.push(frame));
    for (let i = 0; i < controller.totalPlaybackEntries(); i += 1) controller.advancePlayback();
    unsubscribeFirst();

    controller.resetPlayback();
    const secondRun: TrackingFrame[] = [];
    controller.onFrame((frame) => secondRun.push(frame));
    for (let i = 0; i < controller.totalPlaybackEntries(); i += 1) controller.advancePlayback();

    expect(secondRun).toEqual(firstRun);
  });
});
