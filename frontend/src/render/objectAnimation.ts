/**
 * Issue #783: declarative per-object animation for structured 3D scenes.
 *
 * A scene object may carry `animation: { kind, axis?, speed, amplitude?, center? }` (schema
 * `objectAnimation`). This module is the single definition of what each kind means, as a pure function
 * of the object's authored (base) transform and elapsed time, so Three.js applies it per frame and the
 * A-Frame markup builder emits the equivalent motion from the same numbers:
 *
 * - `rotate`: spins about `axis` at `speed` degrees per second.
 * - `orbit`: circles the object about `center` (default the origin) around `axis` at `speed` degrees per
 *   second, turning the object with it (a rigid orbit).
 * - `oscillate`: slides along `axis` by `amplitude` world units at `speed` cycles per second.
 * - `pulse`: scales uniformly by `1 +/- amplitude` at `speed` cycles per second.
 *
 * Nothing here runs author code: the vocabulary is closed and every number is clamped by the schema.
 */
import type { ObjectAnimation, Transform3D, Vec3 } from '../pages/scene3dTypes';

const DEG = Math.PI / 180;
const DEFAULT_OSCILLATE_AMPLITUDE = 1;
const DEFAULT_PULSE_AMPLITUDE = 0.1;

export type AnimatedTransform = { position: Vec3; rotation: Vec3; scale: Vec3 };

function withAxis(vec: Vec3, axis: 'x' | 'y' | 'z', value: number): Vec3 {
  return { ...vec, [axis]: value };
}

/** Rotates `point` about `axis` through the origin by `degrees` (right-handed). */
function rotateAbout(point: Vec3, axis: 'x' | 'y' | 'z', degrees: number): Vec3 {
  const c = Math.cos(degrees * DEG);
  const s = Math.sin(degrees * DEG);
  if (axis === 'x')
    return { x: point.x, y: point.y * c - point.z * s, z: point.y * s + point.z * c };
  if (axis === 'y')
    return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c };
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c, z: point.z };
}

export function computeAnimatedTransform(
  base: Pick<Transform3D, 'position' | 'rotation' | 'scale'>,
  animation: ObjectAnimation,
  seconds: number,
): AnimatedTransform {
  const axis = animation.axis ?? 'y';
  const speed = animation.speed;
  switch (animation.kind) {
    case 'rotate':
      return {
        position: base.position,
        rotation: withAxis(base.rotation, axis, base.rotation[axis] + speed * seconds),
        scale: base.scale,
      };
    case 'orbit': {
      const center = animation.center ?? { x: 0, y: 0, z: 0 };
      const angle = speed * seconds;
      const offset = {
        x: base.position.x - center.x,
        y: base.position.y - center.y,
        z: base.position.z - center.z,
      };
      const turned = rotateAbout(offset, axis, angle);
      return {
        position: { x: center.x + turned.x, y: center.y + turned.y, z: center.z + turned.z },
        rotation: withAxis(base.rotation, axis, base.rotation[axis] + angle),
        scale: base.scale,
      };
    }
    case 'oscillate': {
      const amplitude = animation.amplitude ?? DEFAULT_OSCILLATE_AMPLITUDE;
      return {
        position: withAxis(
          base.position,
          axis,
          base.position[axis] + amplitude * Math.sin(2 * Math.PI * speed * seconds),
        ),
        rotation: base.rotation,
        scale: base.scale,
      };
    }
    case 'pulse': {
      const amplitude = animation.amplitude ?? DEFAULT_PULSE_AMPLITUDE;
      const factor = 1 + amplitude * Math.sin(2 * Math.PI * speed * seconds);
      return {
        position: base.position,
        rotation: base.rotation,
        scale: { x: base.scale.x * factor, y: base.scale.y * factor, z: base.scale.z * factor },
      };
    }
  }
}

/** True when the visitor asked the OS for reduced motion; animations then stay at their authored pose. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * #787: the same animation maths as `computeAnimatedTransform`, as plain JS source for the standalone
 * (ZIP/HTML) Three.js runtime, which cannot import this module. Defines
 * `scene3dAnimatedTransform(base, animation, seconds)` returning `{ position, rotation, scale }` (rotation
 * in degrees). A unit test evaluates this source against `computeAnimatedTransform` so they cannot drift.
 */
export const ANIMATION_MATH_SOURCE = `
function scene3dRotateAbout(p, axis, deg) {
  var c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  if (axis === 'x') return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  if (axis === 'y') return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}
function scene3dWithAxis(v, axis, value) {
  return { x: axis === 'x' ? value : v.x, y: axis === 'y' ? value : v.y, z: axis === 'z' ? value : v.z };
}
function scene3dAnimatedTransform(base, animation, seconds) {
  var axis = animation.axis || 'y';
  var speed = animation.speed;
  if (animation.kind === 'rotate') {
    return { position: base.position, rotation: scene3dWithAxis(base.rotation, axis, base.rotation[axis] + speed * seconds), scale: base.scale };
  }
  if (animation.kind === 'orbit') {
    var center = animation.center || { x: 0, y: 0, z: 0 };
    var angle = speed * seconds;
    var offset = { x: base.position.x - center.x, y: base.position.y - center.y, z: base.position.z - center.z };
    var turned = scene3dRotateAbout(offset, axis, angle);
    return {
      position: { x: center.x + turned.x, y: center.y + turned.y, z: center.z + turned.z },
      rotation: scene3dWithAxis(base.rotation, axis, base.rotation[axis] + angle),
      scale: base.scale
    };
  }
  if (animation.kind === 'oscillate') {
    var oscillation = animation.amplitude == null ? ${DEFAULT_OSCILLATE_AMPLITUDE} : animation.amplitude;
    return {
      position: scene3dWithAxis(base.position, axis, base.position[axis] + oscillation * Math.sin(2 * Math.PI * speed * seconds)),
      rotation: base.rotation, scale: base.scale
    };
  }
  if (animation.kind === 'pulse') {
    var pulse = animation.amplitude == null ? ${DEFAULT_PULSE_AMPLITUDE} : animation.amplitude;
    var factor = 1 + pulse * Math.sin(2 * Math.PI * speed * seconds);
    return { position: base.position, rotation: base.rotation, scale: { x: base.scale.x * factor, y: base.scale.y * factor, z: base.scale.z * factor } };
  }
  return { position: base.position, rotation: base.rotation, scale: base.scale };
}
`;
