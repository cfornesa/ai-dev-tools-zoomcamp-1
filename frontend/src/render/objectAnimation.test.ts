import { describe, expect, it } from 'vitest';

import type { ObjectAnimation, Scene3DDocument } from '../pages/scene3dTypes';
import { AFRAME_ANIMATION_COMPONENT_SCRIPT, buildAFrameSceneMarkup } from './aframeSceneMarkup';
import { computeAnimatedTransform } from './objectAnimation';

const base = {
  position: { x: 2, y: 1, z: -1 },
  rotation: { x: 10, y: 20, z: 30 },
  scale: { x: 1, y: 2, z: 1 },
};

describe('computeAnimatedTransform (#783)', () => {
  it('rotate spins about the axis in degrees per second', () => {
    const next = computeAnimatedTransform(base, { kind: 'rotate', axis: 'y', speed: 45 }, 2);
    expect(next.rotation).toEqual({ x: 10, y: 110, z: 30 });
    expect(next.position).toEqual(base.position);
  });

  it('orbit circles the object about the centre and turns it rigidly', () => {
    const next = computeAnimatedTransform(
      { ...base, position: { x: 3, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { kind: 'orbit', axis: 'y', speed: 90 },
      1,
    );
    expect(next.position.x).toBeCloseTo(0, 6);
    expect(next.position.z).toBeCloseTo(-3, 6);
    expect(next.rotation.y).toBe(90);
  });

  it('oscillate slides along the axis and pulse scales uniformly', () => {
    const slide = computeAnimatedTransform(
      base,
      { kind: 'oscillate', axis: 'x', speed: 1, amplitude: 2 },
      0.25,
    );
    expect(slide.position.x).toBeCloseTo(4, 6); // sin(pi/2) = 1
    const beat = computeAnimatedTransform(base, { kind: 'pulse', speed: 1, amplitude: 0.5 }, 0.25);
    expect(beat.scale.x).toBeCloseTo(1.5, 6);
    expect(beat.scale.y).toBeCloseTo(3, 6);
  });

  it('is at the authored pose at time zero for oscillate and pulse', () => {
    for (const animation of [
      { kind: 'oscillate', speed: 2 },
      { kind: 'pulse', speed: 2 },
    ] as ObjectAnimation[]) {
      const next = computeAnimatedTransform(base, animation, 0);
      expect(next.position).toEqual(base.position);
      expect(next.scale).toEqual(base.scale);
    }
  });
});

/** Runs the shipped A-Frame component against a stub A-Frame and reads back its transform. */
function runAFrameComponent(animation: ObjectAnimation, seconds: number) {
  type Definition = { init: () => void; tick: (time: number, delta: number) => void };
  const holder: { definition?: Definition } = {};
  const object3D = {
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        Object.assign(this, { x, y, z });
      },
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
      order: 'YXZ',
      set(x: number, y: number, z: number) {
        Object.assign(this, { x, y, z });
      },
    },
    scale: {
      x: 1,
      y: 1,
      z: 1,
      set(x: number, y: number, z: number) {
        Object.assign(this, { x, y, z });
      },
    },
  };
  const fakeWindow = { addEventListener: () => undefined, matchMedia: () => ({ matches: false }) };
  const source = AFRAME_ANIMATION_COMPONENT_SCRIPT.replace(/^<script>/, '').replace(
    /<\/script>$/,
    '',
  );
  new Function('AFRAME', 'window', source)(
    {
      components: {},
      registerComponent: (_name: string, def: Definition) => {
        holder.definition = def;
      },
    },
    fakeWindow,
  );
  const center = animation.center ?? { x: 0, y: 0, z: 0 };
  const instance = Object.create(holder.definition!) as Definition & {
    data: unknown;
    el: { object3D: typeof object3D };
  };
  instance.el = { object3D };
  instance.data = {
    kind: animation.kind,
    axis: animation.axis ?? 'y',
    speed: animation.speed,
    amplitude: animation.amplitude ?? -1,
    center,
    basePosition: base.position,
    baseRotation: base.rotation,
    baseScale: base.scale,
  };
  instance.init();
  // Advance in 50ms steps like a running scene.
  const steps = Math.round(seconds / 0.05);
  for (let i = 0; i < steps; i += 1) instance.tick(i * 50, 50);
  return object3D;
}

describe('A-Frame animation component matches the Three.js formulas (#783)', () => {
  const cases: ObjectAnimation[] = [
    { kind: 'rotate', axis: 'y', speed: 45 },
    { kind: 'rotate', axis: 'x', speed: -30 },
    { kind: 'orbit', axis: 'y', speed: 30, center: { x: 0, y: 0, z: 0 } },
    { kind: 'oscillate', axis: 'y', speed: 0.5, amplitude: 1.5 },
    { kind: 'pulse', speed: 1, amplitude: 0.2 },
  ];
  for (const animation of cases) {
    it(`${animation.kind} (${animation.axis ?? 'y'}) agrees at t = 1.5s`, () => {
      const expected = computeAnimatedTransform(base, animation, 1.5);
      const actual = runAFrameComponent(animation, 1.5);
      expect(actual.rotation.order).toBe('XYZ');
      expect(actual.position.x).toBeCloseTo(expected.position.x, 5);
      expect(actual.position.y).toBeCloseTo(expected.position.y, 5);
      expect(actual.position.z).toBeCloseTo(expected.position.z, 5);
      expect(actual.rotation.x).toBeCloseTo((expected.rotation.x * Math.PI) / 180, 5);
      expect(actual.rotation.y).toBeCloseTo((expected.rotation.y * Math.PI) / 180, 5);
      expect(actual.rotation.z).toBeCloseTo((expected.rotation.z * Math.PI) / 180, 5);
      expect(actual.scale.x).toBeCloseTo(expected.scale.x, 5);
      expect(actual.scale.y).toBeCloseTo(expected.scale.y, 5);
    });
  }
});

describe('animated A-Frame markup (#783)', () => {
  it('emits the component attribute and script only for animated scenes', () => {
    const doc = {
      schemaVersion: 1,
      documentType: 'scene3d',
      id: 's',
      scene: { backgroundColor: '#000000' },
      camera: {
        position: { x: 0, y: 0, z: 5 },
        target: { x: 0, y: 0, z: 0 },
        fov: 50,
        near: 0.1,
        far: 100,
      },
      lights: [],
      groups: [],
      objects: [
        {
          id: 'spin',
          type: 'box',
          groupId: null,
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            opacity: 1,
          },
          material: { color: '#ff0000' },
          visible: true,
          width: 1,
          height: 1,
          depth: 1,
          animation: { kind: 'rotate', axis: 'y', speed: 45 },
        },
      ],
      randomness: { seed: 0, enabled: false },
    } as unknown as Scene3DDocument;
    const html = buildAFrameSceneMarkup(doc);
    expect(html).toContain('scene3d-animate="kind: rotate; axis: y; speed: 45');
    expect(html).toContain("registerComponent('scene3d-animate'");
    doc.objects[0]!.animation = undefined;
    const still = buildAFrameSceneMarkup(doc);
    expect(still).not.toContain('scene3d-animate');
    expect(still).not.toContain('<script');
  });
});
