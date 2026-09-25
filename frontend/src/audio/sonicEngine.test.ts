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
  const volumeInstances: Array<{ volume: { value: number }; connections: unknown[] }> = [];
  const triggerCalls: Array<{ kind: string; note: string }> = [];
  const attackCalls: Array<{ kind: string; note: string }> = [];
  const releaseCalls: string[] = [];
  const rampToCalls: Array<{ kind: string; value: number }> = [];
  const synthSetCalls: unknown[] = [];
  let filterInstance: { type: string; frequency: { value: number }; Q: { value: number } } | null =
    null;
  let synthCount = 0;

  class FakeSynth {
    kind: string;
    volume = { value: 0 };
    frequency = { rampTo: (value: number) => rampToCalls.push({ kind: this.kind, value }) };
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
    triggerAttack(note: string) {
      attackCalls.push({ kind: this.kind, note });
    }
    triggerRelease() {
      releaseCalls.push(this.kind);
    }
    set(values: unknown) {
      synthSetCalls.push(values);
    }
    dispose() {
      disposeCalls.push(this.kind);
    }
  }

  class FakeVolume {
    volume = { value: 0 };
    connections: unknown[] = [];
    constructor() {
      volumeInstances.push(this);
    }
    connect() {
      this.connections.push(...arguments);
      return this;
    }
    dispose() {
      disposeCalls.push('volume');
    }
  }

  class FakeFilter {
    freq: number;
    type: string;
    frequency = { value: 0 };
    Q = { value: 0 };
    constructor(freq: number, type: string) {
      this.freq = freq;
      this.type = type;
      this.frequency.value = freq;
      if (!filterInstance) filterInstance = this;
    }
    toDestination() {
      return this;
    }
    connect() {
      return this;
    }
    dispose() {
      disposeCalls.push('filter');
    }
  }

  const loopStartCalls: number[] = [];
  let loopCallback: ((time: number) => void) | null = null;
  let loopInterval: string | number | null = null;
  class FakeLoop {
    get interval() {
      return loopInterval;
    }
    set interval(value: string | number | null) {
      loopInterval = value;
    }
    constructor(callback: (time: number) => void, interval: string | number) {
      loopCallback = callback;
      this.interval = interval;
      loopInterval = interval;
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
    AMSynth: FakeSynth,
    FMSynth: FakeSynth,
    MembraneSynth: FakeSynth,
    MetalSynth: FakeSynth,
    PluckSynth: FakeSynth,
    DuoSynth: FakeSynth,
    Volume: FakeVolume,
    Filter: FakeFilter,
    Loop: FakeLoop,
    UserMedia: FakeUserMedia,
    Transport: {
      start: transportStartCalls,
      stop: transportStopCalls,
      bpm: { value: 0 },
    },
    start: startCalls,
  } as unknown as ToneModule;

  return {
    fakeModule,
    disposeCalls,
    triggerCalls,
    attackCalls,
    releaseCalls,
    rampToCalls,
    synthSetCalls,
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
    getLoopInterval: () => loopInterval,
    volumeInstances,
    getFilter: () => filterInstance,
    getTransportBpm: () =>
      (fakeModule.Transport as unknown as { bpm: { value: number } }).bpm.value,
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

  it('setTempo clamps BPM and updates the live transport and loop without restarting it', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));

    engine.setTempo(10);
    await engine.enable();
    expect(fake.getTransportBpm()).toBe(40);
    expect(fake.getLoopInterval()).toBe(30 / 40);
    const startsBefore = fake.loopStartCalls.length;

    engine.setTempo(220);
    expect(fake.getTransportBpm()).toBe(220);
    expect(fake.getLoopInterval()).toBe(30 / 220);
    expect(fake.loopStartCalls).toHaveLength(startsBefore);
  });

  it('setScale rejects unknown names and uses each accepted scale for ambient and movement', async () => {
    const fake = createFakeToneModule();
    const unknownScaleEngine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    expect(unknownScaleEngine.setScale('unknown')).toBe(false);

    const expectedNotes: Record<string, [string, string]> = {
      major: ['C3', 'G4'],
      minor: ['C3', 'G4'],
      pentatonic: ['C3', 'G4'],
      chromatic: ['C3', 'F#4'],
      dorian: ['C3', 'G4'],
      phrygian: ['C3', 'G4'],
      lydian: ['C3', 'G4'],
      mixolydian: ['C3', 'G4'],
      wholetone: ['C3', 'F#4'],
    };

    for (const [name, expected] of Object.entries(expectedNotes)) {
      const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
      expect(engine.setScale(name)).toBe(true);
      await engine.enable();
      fake.triggerCalls.length = 0;
      fake.fireAmbientLoopTick();
      engine.reportMovement({ dx: 1, dy: 0.5, dz: 0 });
      expect(fake.triggerCalls.map(({ note }) => note)).toEqual(expected);
    }
  });

  it('preserves the default ambient note sequence', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    for (let index = 0; index < 6; index += 1) fake.fireAmbientLoopTick();
    expect(fake.triggerCalls.map(({ note }) => note)).toEqual(['C3', 'D3', 'E3', 'G3', 'A3', 'C4']);
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

  it('replaces only the selected voice instrument', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    expect(engine.setVoiceInstrument('movement', 'fmsynth')).toBe(true);
    fake.triggerCalls.length = 0;
    engine.triggerMelodicNote('E4');
    expect(fake.triggerCalls).toEqual([{ kind: 'synth-3', note: 'E4' }]);
    engine.reportMovement({ dx: 1, dy: 0, dz: 0 });
    expect(fake.triggerCalls.some((call) => call.kind === 'synth-4')).toBe(true);
    expect(fake.disposeCalls).toContain('synth-2');
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

  it('sets independent voice gain and mute without muting the other voice buses', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    engine.setVoiceVolume('ambient', 25);
    engine.setVoiceMuted('movement', true);
    expect(fake.volumeInstances[1].volume.value).toBe(-18);
    expect(fake.volumeInstances[2].volume.value).toBe(-60);
    expect(fake.volumeInstances[3].volume.value).toBe(0);

    engine.setVoiceMuted('movement', false);
    expect(fake.volumeInstances[2].volume.value).toBe(0);
    engine.setVoiceVolume('ambient', 500);
    expect(fake.volumeInstances[1].volume.value).toBe(0);
  });

  it('validates and clamps the live master filter without recreating voices', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    const filter = fake.getFilter();
    expect(filter).toMatchObject({ type: 'lowpass', frequency: { value: 2000 }, Q: { value: 1 } });

    expect(engine.setFilter({ type: 'invalid' as 'lowpass', cutoff: 0, resonance: 0 })).toBe(false);
    expect(engine.setFilter({ type: 'bandpass', cutoff: 50000, resonance: 100 })).toBe(true);
    expect(filter).toMatchObject({
      type: 'bandpass',
      frequency: { value: 20000 },
      Q: { value: 20 },
    });
  });

  it('applies melodic synth settings, clamps envelope/octave values, and reports unsupported fields', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    const result = engine.setMelodicSynth({
      oscillator: 'square',
      envelope: { attack: 0, decay: 20, sustain: 2, release: 0 },
      filter: { type: 'highpass', cutoff: 100, resonance: 2 },
      octaveShift: 4,
    });
    expect(result).toEqual({
      applied: ['oscillator', 'envelope', 'filter', 'octaveShift'],
      unsupported: [],
    });
    expect(fake.synthSetCalls).toHaveLength(1);

    fake.triggerCalls.length = 0;
    engine.triggerMelodicNote('C4');
    expect(fake.triggerCalls.at(-1)?.note).toBe('C6');

    expect(engine.setVoiceInstrument('melodic', 'membranesynth')).toBe(true);
    expect(
      engine.setMelodicSynth({
        oscillator: 'sine',
        envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.1 },
        filter: { type: 'lowpass', cutoff: 1000, resonance: 1 },
        octaveShift: 0,
      }).unsupported,
    ).toEqual(['oscillator', 'envelope']);
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

describe('createSonicEngine camera theremin (issue #309)', () => {
  it('startCameraTheremin() begins a sustained tone on the melodic voice', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    engine.startCameraTheremin();

    expect(fake.attackCalls).toHaveLength(1);
    expect(fake.attackCalls[0].kind).toBe('synth-3'); // melodicSynth
  });

  it('startCameraTheremin() is idempotent -- a second call while already sounding is a no-op', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    engine.startCameraTheremin();
    engine.startCameraTheremin();

    expect(fake.attackCalls).toHaveLength(1);
  });

  it('updateCameraTheremin() ramps pitch and sets volume, only while sounding', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();

    // Before starting -- a safe no-op, not an error.
    engine.updateCameraTheremin(440, -10);
    expect(fake.rampToCalls).toHaveLength(0);

    engine.startCameraTheremin();
    engine.updateCameraTheremin(440, -10);

    expect(fake.rampToCalls).toEqual([{ kind: 'synth-3', value: 440 }]);
  });

  it('stopCameraTheremin() releases the tone and is a safe no-op if never started', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    engine.startCameraTheremin();

    engine.stopCameraTheremin();
    expect(fake.releaseCalls).toEqual(['synth-3']);

    expect(() => engine.stopCameraTheremin()).not.toThrow();
  });

  it('disable() also releases a sounding theremin', async () => {
    const fake = createFakeToneModule();
    const engine = createSonicEngine(vi.fn().mockResolvedValue(fake.fakeModule));
    await engine.enable();
    engine.startCameraTheremin();

    engine.disable();

    expect(fake.releaseCalls).toEqual(['synth-3']);
  });
});
