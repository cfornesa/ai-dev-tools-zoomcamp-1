import { describe, expect, it } from 'vitest';

import {
  createParticleSystem,
  createSeededRandom,
  deriveParticleTickInput,
  emittersFromScene,
  DEFAULT_BURST_PARTICLE_COUNT,
  MAX_LIVE_PARTICLES_PER_EMITTER,
  MAX_TOTAL_LIVE_PARTICLES,
  type EmitterConfig,
  type ParticleTickInput,
} from './particleSystem';
import type { TickResult } from './behaviorRuntime';
import { baseScene, particleEmitterShape, transform } from '../render/testSceneFixtures';

function emitter(overrides: Partial<EmitterConfig> = {}): EmitterConfig {
  return {
    id: 'emitter-1',
    rate: 10,
    size: 4,
    lifespan: 1,
    speed: 20,
    palette: ['#ff0000', '#00ff00'],
    x: 0,
    y: 0,
    ...overrides,
  };
}

function tick(t: number, overrides: Partial<ParticleTickInput> = {}): ParticleTickInput {
  return { timestamp: t, burstTriggered: false, degraded: false, ...overrides };
}

describe('emittersFromScene', () => {
  it('extracts particleEmitter shapes with their configured fields and position', () => {
    const scene = baseScene({
      shapes: [
        particleEmitterShape({
          id: 'e1',
          transform: transform({ x: 5, y: 7 }),
          rate: 12,
          size: 3,
          lifespan: 2,
          speed: 40,
          palette: ['#111111', '#222222'],
        }),
      ],
    });
    const emitters = emittersFromScene(scene);
    expect(emitters).toEqual([
      {
        id: 'e1',
        rate: 12,
        size: 3,
        lifespan: 2,
        speed: 40,
        palette: ['#111111', '#222222'],
        x: 5,
        y: 7,
      },
    ]);
  });

  it('ignores non-particleEmitter shapes and returns [] for a scene with none', () => {
    expect(emittersFromScene(baseScene({ shapes: [] }))).toEqual([]);
  });

  it('never throws on missing/malformed fields, falling back to permissive defaults', () => {
    const scene = baseScene({ shapes: [{ id: 'e1', type: 'particleEmitter' }] });
    expect(() => emittersFromScene(scene)).not.toThrow();
    expect(emittersFromScene(scene)).toEqual([
      { id: 'e1', rate: 0, size: 0, lifespan: 0, speed: 0, palette: [], x: 0, y: 0 },
    ]);
  });
});

describe('zero-value configs', () => {
  it('rate: 0 never emits continuously, even across many ticks', () => {
    const system = createParticleSystem([emitter({ rate: 0 })]);
    let t = 0;
    for (let i = 0; i < 50; i += 1) {
      t += 100;
      system.tick(tick(t));
    }
    expect(system.getParticles()).toEqual([]);
  });

  it('lifespan: 0 never adds a particle to the live collection (continuous or burst)', () => {
    const system = createParticleSystem([emitter({ lifespan: 0, rate: 100 })]);
    system.tick(tick(0));
    system.tick(tick(1000));
    expect(system.getParticles()).toEqual([]);

    const burstSystem = createParticleSystem([emitter({ lifespan: 0 })]);
    burstSystem.tick(tick(0, { burstTriggered: true }));
    expect(burstSystem.getParticles()).toEqual([]);
  });

  it('speed: 0 spawns particles that stay at the emitter position', () => {
    const system = createParticleSystem([emitter({ speed: 0, rate: 1000, lifespan: 5 })]);
    system.tick(tick(0));
    const particles = system.tick(tick(1000));
    expect(particles.length).toBeGreaterThan(0);
    for (const p of particles) {
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
    }
  });

  it('an empty palette does not crash and falls back to a defined color', () => {
    const system = createParticleSystem([emitter({ palette: [], rate: 100 })]);
    system.tick(tick(0));
    const particles = system.tick(tick(1000));
    expect(particles.length).toBeGreaterThan(0);
    for (const p of particles) expect(typeof p.color).toBe('string');
  });

  it('a scene with zero emitters never crashes and never produces particles', () => {
    const system = createParticleSystem([]);
    expect(system.tick(tick(0, { burstTriggered: true }))).toEqual([]);
  });
});

describe('exact-cap and over-cap emission', () => {
  it('continuous emission stops exactly at maxTotalLiveParticles, never one more', () => {
    const system = createParticleSystem([emitter({ rate: 100000, lifespan: 100 })], {
      maxTotalLiveParticles: 5,
      maxLiveParticlesPerEmitter: 5,
      maxSpawnPerTickPerEmitter: 1000,
    });
    system.tick(tick(0));
    const particles = system.tick(tick(60000)); // huge dt: would emit far more than 5 uncapped
    expect(particles.length).toBe(5);
    // Another tick with more elapsed time still does not exceed the cap.
    expect(system.tick(tick(120000)).length).toBe(5);
  });

  it('a per-emitter cap is enforced independently of the total cap', () => {
    const system = createParticleSystem(
      [
        emitter({ id: 'a', rate: 100000, lifespan: 100 }),
        emitter({ id: 'b', rate: 100000, lifespan: 100 }),
      ],
      {
        maxTotalLiveParticles: 100,
        maxLiveParticlesPerEmitter: 3,
        maxSpawnPerTickPerEmitter: 1000,
      },
    );
    system.tick(tick(0));
    const particles = system.tick(tick(60000));
    const perEmitter = new Map<string, number>();
    for (const p of particles) perEmitter.set(p.emitterId, (perEmitter.get(p.emitterId) ?? 0) + 1);
    expect(perEmitter.get('a')).toBe(3);
    expect(perEmitter.get('b')).toBe(3);
    expect(particles.length).toBe(6);
  });

  it('event-triggered bursts are clamped by the same caps as continuous emission', () => {
    const system = createParticleSystem([emitter({ rate: 0, lifespan: 100 })], {
      maxTotalLiveParticles: 10,
      maxLiveParticlesPerEmitter: 10,
      burstParticleCount: 1000,
    });
    const particles = system.tick(tick(0, { burstTriggered: true }));
    expect(particles.length).toBe(10);
  });

  it('repeated over-cap burst attempts never push the live count past the cap', () => {
    const system = createParticleSystem([emitter({ rate: 0, lifespan: 100 })], {
      maxTotalLiveParticles: 4,
      maxLiveParticlesPerEmitter: 4,
      burstParticleCount: 1000,
    });
    let t = 0;
    for (let i = 0; i < 5; i += 1) {
      t += 1000;
      const particles = system.tick(tick(t, { burstTriggered: true }));
      expect(particles.length).toBeLessThanOrEqual(4);
    }
    expect(system.getParticles().length).toBe(4);
  });

  it('the documented default caps are internally consistent (per-emitter split of the total)', () => {
    expect(MAX_TOTAL_LIVE_PARTICLES).toBe(800);
    expect(MAX_LIVE_PARTICLES_PER_EMITTER).toBe(200);
    expect(DEFAULT_BURST_PARTICLE_COUNT).toBeLessThan(MAX_LIVE_PARTICLES_PER_EMITTER);
  });
});

describe('cleanup (no unbounded growth)', () => {
  it('expires particles past their lifespan and removes them from the live collection', () => {
    const system = createParticleSystem([emitter({ rate: 1000, lifespan: 1 })], {
      maxTotalLiveParticles: 10000,
      maxLiveParticlesPerEmitter: 10000,
      maxSpawnPerTickPerEmitter: 10000,
    });
    system.tick(tick(0));
    const spawned = system.tick(tick(100));
    expect(spawned.length).toBeGreaterThan(0);
    // Advance well past the 1-second lifespan with no further emission
    // (rate 0 emitter would still hold state, so use a fresh input with
    // the same emitter but far enough forward that everything expires).
    const afterExpiry = system.tick(tick(100 + 5000));
    expect(afterExpiry.every((p) => p.spawnedAt >= 100 + 5000 - 1000)).toBe(true);
  });

  it('sustained continuous emission over many ticks never grows the live collection past the cap', () => {
    const system = createParticleSystem([emitter({ rate: 50, lifespan: 0.5 })], {
      maxTotalLiveParticles: 100,
      maxLiveParticlesPerEmitter: 100,
    });
    let t = 0;
    let maxSeen = 0;
    for (let i = 0; i < 500; i += 1) {
      t += 16;
      const particles = system.tick(tick(t));
      maxSeen = Math.max(maxSeen, particles.length);
      expect(particles.length).toBeLessThanOrEqual(100);
    }
    expect(maxSeen).toBeGreaterThan(0);
  });
});

describe('pause / resume', () => {
  it('freezes emission and expiry while paused, and resuming does not double-emit or catch up', () => {
    // A deliberately long lifespan (1000s) so this test can isolate the
    // emission/accumulator behavior from expiry — a resumed tick jumping
    // hundreds of seconds forward should still not fabricate a catch-up
    // burst, independent of whether particles from before the pause have
    // since expired.
    const system = createParticleSystem([emitter({ rate: 10, lifespan: 1000 })]);
    system.tick(tick(0));
    const beforePause = system.tick(tick(1000));
    expect(beforePause.length).toBeGreaterThan(0);

    system.pause();
    // Calling tick while paused must not change anything, however far the
    // timestamp jumps.
    expect(system.tick(tick(1000))).toEqual(beforePause);
    expect(system.tick(tick(999999))).toEqual(beforePause);

    system.resume();
    // The tick right after resume must not treat the large (simulated
    // real-world) gap since the last real tick as elapsed emission time —
    // no catch-up burst. Particles from before the pause are still alive
    // (lifespan far exceeds this jump), so the count is unchanged.
    const afterResume = system.tick(tick(500000));
    expect(afterResume.length).toBe(beforePause.length);

    // Normal continuous emission resumes correctly on the *next* tick,
    // once a real dt exists again — this isn't stuck forever.
    const nextTick = system.tick(tick(500100));
    expect(nextTick.length).toBeGreaterThan(afterResume.length);
  });

  it('reset clears particles and lets a system start over identically to a fresh one', () => {
    const system = createParticleSystem(
      [emitter({ rate: 20, lifespan: 5 })],
      {},
      {
        seed: 42,
        enabled: true,
      },
    );
    system.tick(tick(0));
    system.tick(tick(1000));
    expect(system.getParticles().length).toBeGreaterThan(0);

    system.reset();
    expect(system.getParticles()).toEqual([]);

    const fresh = createParticleSystem(
      [emitter({ rate: 20, lifespan: 5 })],
      {},
      {
        seed: 42,
        enabled: true,
      },
    );
    system.tick(tick(0));
    fresh.tick(tick(0));
    const a = system.tick(tick(1000));
    const b = fresh.tick(tick(1000));
    expect(a.map((p) => ({ ...p, id: undefined }))).toEqual(
      b.map((p) => ({ ...p, id: undefined })),
    );
  });
});

describe('reduced-quality degradation', () => {
  it('a degraded tick spawns no new particles but still expires existing ones', () => {
    const system = createParticleSystem([emitter({ rate: 1000, lifespan: 1 })], {
      maxTotalLiveParticles: 10000,
      maxLiveParticlesPerEmitter: 10000,
      maxSpawnPerTickPerEmitter: 10000,
    });
    system.tick(tick(0));
    const before = system.tick(tick(100));
    expect(before.length).toBeGreaterThan(0);

    // Degraded tick: no new emission even though plenty of elapsed time
    // and rate headroom exist.
    const duringDegraded = system.tick(tick(200, { degraded: true }));
    expect(duringDegraded.length).toBeLessThanOrEqual(before.length);

    // Long past lifespan while still degraded: existing particles still
    // expire (cleanup keeps happening).
    const stillDegraded = system.tick(tick(5000, { degraded: true }));
    expect(stillDegraded.length).toBe(0);
  });

  it('recovering from a degraded tick does not emit a catch-up burst for the skipped interval', () => {
    const system = createParticleSystem([emitter({ rate: 10, lifespan: 5 })], {
      maxTotalLiveParticles: 10000,
      maxLiveParticlesPerEmitter: 10000,
    });
    system.tick(tick(0));
    // A long degraded interval that, if banked, would produce a huge
    // continuous-emission catch-up once recovered.
    system.tick(tick(50000, { degraded: true }));
    const recovered = system.tick(tick(50100)); // 100ms after recovery, not 50100ms
    // At rate 10/s over 100ms we expect at most ~1-2 particles, never
    // hundreds from a banked backlog.
    expect(recovered.length).toBeLessThan(5);
  });

  it('a degraded tick also suppresses event-triggered bursts', () => {
    const system = createParticleSystem([emitter({ rate: 0, lifespan: 5 })]);
    const particles = system.tick(tick(0, { burstTriggered: true, degraded: true }));
    expect(particles).toEqual([]);
  });
});

describe('determinism', () => {
  it('the same seed and the same tick sequence produce an identical particle creation sequence', () => {
    const config = [emitter({ rate: 30, lifespan: 3, palette: ['#111111', '#222222', '#333333'] })];
    const options = { maxTotalLiveParticles: 500, maxLiveParticlesPerEmitter: 500 };
    const randomness = { seed: 12345, enabled: true };

    const systemA = createParticleSystem(config, options, randomness);
    const systemB = createParticleSystem(config, options, randomness);

    const timestamps = [0, 50, 100, 250, 400, 900, 1500];
    let lastA: ReturnType<typeof systemA.tick> = [];
    let lastB: ReturnType<typeof systemB.tick> = [];
    for (const t of timestamps) {
      lastA = systemA.tick(tick(t, { burstTriggered: t === 900 }));
      lastB = systemB.tick(tick(t, { burstTriggered: t === 900 }));
    }

    expect(lastA).toEqual(lastB);
  });

  it('different seeds produce a different particle creation sequence', () => {
    const config = [emitter({ rate: 30, lifespan: 3 })];
    const options = { maxTotalLiveParticles: 500, maxLiveParticlesPerEmitter: 500 };

    const systemA = createParticleSystem(config, options, { seed: 1, enabled: true });
    const systemB = createParticleSystem(config, options, { seed: 2, enabled: true });

    const a = [systemA.tick(tick(0)), systemA.tick(tick(200))].flat();
    const b = [systemB.tick(tick(0)), systemB.tick(tick(200))].flat();

    const anglesA = a.map((p) => Math.atan2(p.vy, p.vx));
    const anglesB = b.map((p) => Math.atan2(p.vy, p.vx));
    expect(anglesA).not.toEqual(anglesB);
  });

  it('createSeededRandom is itself deterministic for a given seed', () => {
    const rngA = createSeededRandom(7);
    const rngB = createSeededRandom(7);
    const seqA = [rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('deriveParticleTickInput', () => {
  function tickResult(overrides: Partial<TickResult> = {}): TickResult {
    return {
      timestamp: 100,
      continuous: [],
      events: [],
      degraded: false,
      droppedBindingCount: 0,
      evaluatedMs: 0,
      diagnostics: [],
      ...overrides,
    };
  }

  it('sets burstTriggered when an emitParticles event fired this tick', () => {
    const result = tickResult({
      events: [
        {
          bindingId: 'b1',
          targetScope: 'interaction',
          targetId: null,
          targetProperty: 'emitParticles',
          timestamp: 100,
        },
      ],
    });
    expect(deriveParticleTickInput(result)).toEqual({
      timestamp: 100,
      burstTriggered: true,
      degraded: false,
    });
  });

  it('leaves burstTriggered false when no emitParticles event fired, even with other events', () => {
    const result = tickResult({
      events: [
        {
          bindingId: 'b1',
          targetScope: 'interaction',
          targetId: null,
          targetProperty: 'triggerPreset',
          timestamp: 100,
        },
      ],
    });
    expect(deriveParticleTickInput(result).burstTriggered).toBe(false);
  });

  it('passes the degraded flag through unchanged', () => {
    expect(deriveParticleTickInput(tickResult({ degraded: true })).degraded).toBe(true);
  });
});
