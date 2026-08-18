import { describe, expect, it, vi } from 'vitest';

import { createMockTrackingProvider, type MockScriptEntry } from './mockProvider';
import type { TrackingFrame, TrackingProviderError } from './types';
import { hand } from './testFixtures';

function frameEntry(frame: TrackingFrame): MockScriptEntry {
  return { kind: 'frame', frame };
}

function errorEntry(error: TrackingProviderError): MockScriptEntry {
  return { kind: 'error', error };
}

describe('createMockTrackingProvider lifecycle', () => {
  it('does not emit anything before start() is called', () => {
    const provider = createMockTrackingProvider([
      frameEntry({ timestamp: 1, hands: [], events: [] }),
    ]);
    const onFrame = vi.fn();
    provider.onFrame(onFrame);
    expect(provider.advance()).toBe(false);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('calling start() twice does not register a second subscription or double-emit frames', () => {
    const provider = createMockTrackingProvider([
      frameEntry({ timestamp: 1, hands: [], events: [] }),
      frameEntry({ timestamp: 2, hands: [], events: [] }),
    ]);
    const onFrame = vi.fn();
    provider.onFrame(onFrame);

    provider.start();
    provider.start(); // second start(): must be a no-op

    provider.advance();
    provider.advance();

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame.mock.calls[0][0].timestamp).toBe(1);
    expect(onFrame.mock.calls[1][0].timestamp).toBe(2);
  });

  it('stop() on a never-started provider does not throw', () => {
    const provider = createMockTrackingProvider([]);
    expect(() => provider.stop()).not.toThrow();
  });

  it('stop() on an already-stopped provider does not throw', () => {
    const provider = createMockTrackingProvider([]);
    provider.start();
    provider.stop();
    expect(() => provider.stop()).not.toThrow();
  });

  it('stop() then start() resumes emission with no hands/events carried over from before the stop', () => {
    const script: MockScriptEntry[] = [
      frameEntry({ timestamp: 1, hands: [hand({ id: 'hand-1' })], events: [] }),
      frameEntry({ timestamp: 2, hands: [], events: [] }),
    ];
    const provider = createMockTrackingProvider(script);
    const onFrame = vi.fn();
    provider.onFrame(onFrame);

    provider.start();
    provider.advance(); // emits the hand-1 frame
    provider.stop();

    provider.start();
    provider.advance(); // should replay script[0] again, from a clean slate

    const lastFrame: TrackingFrame = onFrame.mock.calls[onFrame.mock.calls.length - 1][0];
    expect(lastFrame.timestamp).toBe(1);
    expect(lastFrame.hands.map((h) => h.id)).toEqual(['hand-1']);
    // Confirms the cursor actually reset rather than continuing on: there
    // are still entries left after replaying script[0].
    expect(provider.remaining()).toBe(1);
  });

  it('advance() is a no-op once the script is exhausted', () => {
    const provider = createMockTrackingProvider([
      frameEntry({ timestamp: 1, hands: [], events: [] }),
    ]);
    provider.start();
    expect(provider.advance()).toBe(true);
    expect(provider.advance()).toBe(false);
    expect(provider.remaining()).toBe(0);
  });

  it('advance() is a no-op after stop()', () => {
    const provider = createMockTrackingProvider([
      frameEntry({ timestamp: 1, hands: [], events: [] }),
    ]);
    provider.start();
    provider.stop();
    const onFrame = vi.fn();
    provider.onFrame(onFrame);
    expect(provider.advance()).toBe(false);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('unsubscribing a frame listener stops further delivery', () => {
    const provider = createMockTrackingProvider([
      frameEntry({ timestamp: 1, hands: [], events: [] }),
      frameEntry({ timestamp: 2, hands: [], events: [] }),
    ]);
    const onFrame = vi.fn();
    const unsubscribe = provider.onFrame(onFrame);
    provider.start();
    provider.advance();
    unsubscribe();
    provider.advance();
    expect(onFrame).toHaveBeenCalledTimes(1);
  });
});

describe('createMockTrackingProvider errors', () => {
  it('delivers a scripted error on the error channel, not as a frame', () => {
    const error: TrackingProviderError = { message: 'camera lost', timestamp: 5 };
    const provider = createMockTrackingProvider([errorEntry(error)]);
    const onFrame = vi.fn();
    const onError = vi.fn();
    provider.onFrame(onFrame);
    provider.onError(onError);

    provider.start();
    provider.advance();

    expect(onFrame).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('plays a mixed script of frames and an error deterministically, in order', () => {
    const script: MockScriptEntry[] = [
      frameEntry({ timestamp: 1, hands: [hand()], events: [] }),
      errorEntry({ message: 'decode failure', timestamp: 2 }),
      frameEntry({ timestamp: 3, hands: [], events: [] }),
    ];
    const provider = createMockTrackingProvider(script);
    const onFrame = vi.fn();
    const onError = vi.fn();
    provider.onFrame(onFrame);
    provider.onError(onError);

    provider.start();
    provider.advance();
    provider.advance();
    provider.advance();

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls[0][0].timestamp).toBe(1);
    expect(onError.mock.calls[0][0].timestamp).toBe(2);
    expect(onFrame.mock.calls[1][0].timestamp).toBe(3);
  });
});

describe('hand presence across frames', () => {
  it('never repeats a lost hand’s last-known landmarks in the next frame', () => {
    const present = hand({ id: 'hand-1' });
    const script: MockScriptEntry[] = [
      frameEntry({ timestamp: 1, hands: [present], events: [] }),
      frameEntry({
        timestamp: 2,
        hands: [],
        events: [{ type: 'handDisappear', handId: 'hand-1', timestamp: 2 }],
      }),
    ];
    const provider = createMockTrackingProvider(script);
    const onFrame = vi.fn();
    provider.onFrame(onFrame);
    provider.start();

    provider.advance();
    const firstFrame: TrackingFrame = onFrame.mock.calls[0][0];
    expect(firstFrame.hands.map((h) => h.id)).toEqual(['hand-1']);

    provider.advance();
    const secondFrame: TrackingFrame = onFrame.mock.calls[1][0];
    // The hand is gone entirely rather than reappearing with its old
    // (now stale) landmarks.
    expect(secondFrame.hands.find((h) => h.id === 'hand-1')).toBeUndefined();
    expect(secondFrame.events).toEqual([{ type: 'handDisappear', handId: 'hand-1', timestamp: 2 }]);
  });

  it('keeps the same id across consecutive frames while a hand continues to be tracked', () => {
    const script: MockScriptEntry[] = [
      frameEntry({ timestamp: 1, hands: [hand({ id: 'hand-1' })], events: [] }),
      frameEntry({ timestamp: 2, hands: [hand({ id: 'hand-1' })], events: [] }),
    ];
    const provider = createMockTrackingProvider(script);
    const onFrame = vi.fn();
    provider.onFrame(onFrame);
    provider.start();
    provider.advance();
    provider.advance();

    expect(onFrame.mock.calls[0][0].hands[0].id).toBe('hand-1');
    expect(onFrame.mock.calls[1][0].hands[0].id).toBe('hand-1');
  });

  it('documents (via a scripted reacquire) that a lost-then-reacquired hand gets a new id, never a reused one', () => {
    const script: MockScriptEntry[] = [
      frameEntry({ timestamp: 1, hands: [hand({ id: 'hand-1' })], events: [] }),
      frameEntry({
        timestamp: 2,
        hands: [],
        events: [{ type: 'handDisappear', handId: 'hand-1', timestamp: 2 }],
      }),
      frameEntry({
        timestamp: 3,
        hands: [hand({ id: 'hand-2' })],
        events: [{ type: 'handAppear', handId: 'hand-2', timestamp: 3 }],
      }),
    ];
    const provider = createMockTrackingProvider(script);
    const onFrame = vi.fn();
    provider.onFrame(onFrame);
    provider.start();
    provider.advance();
    provider.advance();
    provider.advance();

    const ids = onFrame.mock.calls.map((call) => call[0].hands.map((h: { id: string }) => h.id));
    expect(ids).toEqual([['hand-1'], [], ['hand-2']]);
    expect(ids[2][0]).not.toBe('hand-1');
  });
});
