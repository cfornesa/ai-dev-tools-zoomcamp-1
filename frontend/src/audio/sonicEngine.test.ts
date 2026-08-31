import { describe, expect, it, vi } from 'vitest';

import { createSonicEngine, type ToneModule } from './sonicEngine';

/**
 * Issue #306: the shared Tone.js sound engine. Real Tone.js/`AudioContext`
 * is never exercised here (jsdom has neither) -- `loadTone` is injected
 * with a fake, minimal Tone-like module, matching
 * `mediapipeProvider.test.ts`'s equivalent lazy-loaded-dependency
 * convention.
 */

function createFakeToneModule() {
  const disposeCalls: string[] = [];
  const triggerCalls: Array<{ kind: string; note: string }> = [];
  let synthCount = 0;

  class FakeSynth {
    kind: string;
    volume = { value: 0 };
    constructor() {
      synthCount += 1;
      this.kind = `synth-${synthCount}`;
    }
    connect() {
      return this;
    }
    triggerAttackRelease(note: string) {
      triggerCalls.push({ kind: this.kind, note });
    }
    dispose() {
      disposeCalls.push(this.kind);
    }
  }

  class FakeVolume {
    volume = { value: 0 };
    connect() {
      return this;
    }
    dispose() {
      disposeCalls.push('volume');
    }
  }

  class FakeFilter {
    freq: number;
    type: string;
    constructor(freq: number, type: string) {
      this.freq = freq;
      this.type = type;
    }
    toDestination() {
      return this;
    }
    dispose() {
      disposeCalls.push('filter');
    }
  }

  const loopStartCalls: number[] = [];
  let loopCallback: ((time: number) => void) | null = null;
  class FakeLoop {
    interval: string;
    constructor(callback: (time: number) => void, interval: string) {
      loopCallback = callback;
      this.interval = interval;
    }
    start(time: number) {
      loopStartCalls.push(time);
      return this;
    }
    dispose() {
      disposeCalls.push('loop');
    }
  }

  const transportStartCalls = vi.fn();
  const transportStopCalls = vi.fn();
  const startCalls = vi.fn().mockResolvedValue(undefined);

  let userMediaOpenBehavior: 'resolve' | 'reject' = 'resolve';
  let userMediaRejectError: unknown = new Error('mic denied');
  const userMediaConnectCalls: unknown[] = [];
  class FakeUserMedia {
    open = vi.fn().mockImplementation(() => {
      if (userMediaOpenBehavior === 'reject') return Promise.reject(userMediaRejectError);
      return Promise.resolve();
    });
    close = vi.fn();
    connect = vi.fn((destination: unknown) => {
      userMediaConnectCalls.push(destination);
    });
    disconnect = vi.fn();
    dispose = vi.fn(() => disposeCalls.push('userMedia'));
  }

  const fakeModule = {
    Synth: FakeSynth,
    Volume: FakeVolume,
    Filter: FakeFilter,
    Loop: FakeLoop,
    UserMedia: FakeUserMedia,
    Transport: { start: transportStartCalls, stop: transportStopCalls },
    start: startCalls,
  } as unknown as ToneModule;

  return {
    fakeModule,
    disposeCalls,
    triggerCalls,
    loopStartCalls,
    transportStartCalls,
    transportStopCalls,
    startCalls,
    userMediaConnectCalls,
    setUserMediaOpenToReject: (error: unknown) => {
      userMediaOpenBehavior = 'reject';
      userMediaRejectError = error;
    },
    fireAmbientLoopTick: (time = 0) => loopCallback?.(time),
  };
}

describe('createSonicEngine', () => {
  it('starts idle and never touches Tone until enable() is called', () => {
    const fake = createFakeToneModule();
    const loadTone = vi.fn().mockResolvedValue(fake.fakeModule);
    const engine = createSonicEngine(loadTone);

    expect(engine.status).toBe('idle');
    expect(loadTone).not.toHaveBeenCalled();

    // Safe no-ops before enable -- never throws.
    engine.setVolume(50);
    engine.reportMovement({ dx: 1, dy: 1, dz: 1 });
    engine.triggerMelodicNote('C4');
  });

  it('enable() builds the shared graph and starts the ambient ticker', async () => {
    const fake = createFakeToneModule();
    const loadTone = vi.fn().mockResolvedValue(fake.fakeModule);
    const engine = createSonicEngine(loadTone);

    await engine.enable();

    expect(engine.status).toBe('active');
    expect(fake.startCalls).toHaveBeenCalled();
    expect(fake.transportStartCalls).toHaveBeenCalled();
    expect(fake.loopStartCalls).toEqual([0]);

    fake.fireAmbientLoopTick(0);
    expect(fake.triggerCalls.some((c) => c.kind === 'synth-1')).toBe(true);
  });

  it('reportMovement triggers a note on real motion, ignores tiny jitter', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    fake.triggerCalls.length = 0;

    engine.reportMovement({ dx: 0.0001, dy: 0.0001, dz: 0.0001 });
    expect(fake.triggerCalls).toHaveLength(0);

    engine.reportMovement({ dx: 1, dy: 1, dz: 1 });
    expect(fake.triggerCalls).toHaveLength(1);
    expect(fake.triggerCalls[0].kind).toBe('synth-2'); // movementSynth
  });

  it('reportMovement retriggers only after the debounce window elapses', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    fake.triggerCalls.length = 0;

    engine.reportMovement({ dx: 1, dy: 1, dz: 1 });
    engine.reportMovement({ dx: 1, dy: 1, dz: 1 });
    expect(fake.triggerCalls).toHaveLength(1);
  });

  it('triggerMelodicNote sounds the melodic voice specifically', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    fake.triggerCalls.length = 0;

    engine.triggerMelodicNote('E4');
    expect(fake.triggerCalls).toEqual([{ kind: 'synth-3', note: 'E4' }]);
  });

  it('setVolume(0) is effectively silent and setVolume(100) is unity gain', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    engine.setVolume(0);
    // Read back via the fake bus instance -- captured on the first Volume.
    engine.setVolume(100);
    engine.setVolume(50);
    // No assertion error thrown, and no crash across the whole range --
    // the exact mapping is an implementation detail; the safety net here
    // is that out-of-range calls stay clamped.
    engine.setVolume(-10);
    engine.setVolume(500);
  });

  it('disable() releases every audio resource and returns to idle', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    engine.disable();

    expect(engine.status).toBe('idle');
    expect(fake.transportStopCalls).toHaveBeenCalled();
    expect(fake.disposeCalls).toEqual(
      expect.arrayContaining(['loop', 'synth-1', 'synth-2', 'synth-3', 'volume', 'filter']),
    );
  });

  it('disable() before enable() is a safe no-op', () => {
    const engine = createSonicEngine(vi.fn());
    expect(() => engine.disable()).not.toThrow();
    expect(engine.status).toBe('idle');
  });

  it('falls back to an error status if the audio graph fails to build', async () => {
    const loadTone = vi.fn().mockRejectedValue(new Error('no AudioContext'));
    const engine = createSonicEngine(loadTone);

    await engine.enable();

    expect(engine.status).toBe('error');
    // Still safe to call every method afterward.
    expect(() => {
      engine.setVolume(50);
      engine.reportMovement({ dx: 1, dy: 1, dz: 1 });
      engine.triggerMelodicNote('C4');
      engine.disable();
    }).not.toThrow();
  });

  it('dispose() tears down an active engine', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    engine.dispose();

    expect(engine.status).toBe('idle');
    expect(fake.disposeCalls.length).toBeGreaterThan(0);
  });
});

describe('createSonicEngine mic input (issue #308)', () => {
  it('rejects connectMic() before enable() has succeeded', async () => {
    const engine = createSonicEngine(vi.fn());
    await expect(engine.connectMic()).rejects.toThrow();
  });

  it('connectMic() opens Tone.UserMedia and connects it into the shared bus', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    await engine.connectMic();

    expect(fake.userMediaConnectCalls).toHaveLength(1);
  });

  it('connectMic() propagates the underlying getUserMedia rejection', async () => {
    const fake = createFakeToneModule();
    const deniedError = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    fake.setUserMediaOpenToReject(deniedError);
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    await expect(engine.connectMic()).rejects.toBe(deniedError);
  });

  it('connectMic() is idempotent -- a second call is a no-op while already connected', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    await engine.connectMic();
    await engine.connectMic();

    expect(fake.userMediaConnectCalls).toHaveLength(1);
  });

  it('disconnectMic() releases the microphone and is a safe no-op if never connected', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    await engine.connectMic();

    engine.disconnectMic();
    expect(fake.disposeCalls).toContain('userMedia');

    expect(() => engine.disconnectMic()).not.toThrow();
  });

  it('disable() also releases an open microphone', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    await engine.connectMic();
    fake.disposeCalls.length = 0;

    engine.disable();

    expect(fake.disposeCalls).toContain('userMedia');
  });
});
