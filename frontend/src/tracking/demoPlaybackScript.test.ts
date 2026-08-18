import { describe, expect, it } from 'vitest';

import { createDemoPlaybackScript } from './demoPlaybackScript';
import { createMockTrackingProvider } from './mockProvider';

function drain(provider: ReturnType<typeof createMockTrackingProvider>): void {
  while (provider.advance()) {
    // keep advancing until the script is exhausted
  }
}

describe('createDemoPlaybackScript', () => {
  it('is deterministic: two calls produce structurally identical scripts', () => {
    expect(createDemoPlaybackScript()).toEqual(createDemoPlaybackScript());
  });

  it('has strictly increasing timestamps across every entry', () => {
    const script = createDemoPlaybackScript();
    const timestamps = script.map((entry) => (entry.kind === 'frame' ? entry.frame.timestamp : -1));
    for (let i = 1; i < timestamps.length; i += 1) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it('starts with a handAppear and ends with a handDisappear for the same hand id', () => {
    const script = createDemoPlaybackScript();
    const first = script[0];
    const last = script[script.length - 1];
    if (first.kind !== 'frame' || last.kind !== 'frame') throw new Error('expected frame entries');
    expect(first.frame.events[0].type).toBe('handAppear');
    expect(last.frame.events[0].type).toBe('handDisappear');
    expect(first.frame.events[0].handId).toBe(last.frame.events[0].handId);
  });

  it('includes a pinchStart/pinchEnd pair and a gestureEnter/gestureExit pair', () => {
    const script = createDemoPlaybackScript();
    const events = script.flatMap((entry) => (entry.kind === 'frame' ? entry.frame.events : []));
    expect(events.map((event) => event.type)).toEqual([
      'handAppear',
      'pinchStart',
      'pinchEnd',
      'gestureEnter',
      'gestureExit',
      'handDisappear',
    ]);
  });

  it('plays back identically through two separate mock providers (repeatable)', () => {
    const providerA = createMockTrackingProvider(createDemoPlaybackScript());
    const providerB = createMockTrackingProvider(createDemoPlaybackScript());
    const framesA: unknown[] = [];
    const framesB: unknown[] = [];
    providerA.onFrame((frame) => framesA.push(frame));
    providerB.onFrame((frame) => framesB.push(frame));
    providerA.start();
    providerB.start();
    drain(providerA);
    drain(providerB);
    expect(framesA).toEqual(framesB);
    expect(framesA.length).toBe(createDemoPlaybackScript().length);
  });
});
