import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CAMERA_OVERLAY_ASPECT_RATIO,
  DEFAULT_CAMERA_OVERLAY_GEOMETRY,
  clampCameraOverlayGeometry,
  moveCameraOverlay,
  resizeCameraOverlay,
} from './cameraOverlayGeometry';

describe('camera overlay geometry (issue #151)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('keeps the default geometry normalized, fixed-ratio, and inside the canvas', () => {
    const geometry = clampCameraOverlayGeometry(DEFAULT_CAMERA_OVERLAY_GEOMETRY);
    expect(geometry.x).toBeGreaterThanOrEqual(0);
    expect(geometry.y).toBeGreaterThanOrEqual(0);
    expect(geometry.x + geometry.width).toBeLessThanOrEqual(1);
    expect(geometry.y + geometry.height).toBeLessThanOrEqual(1);
    expect(geometry.width / geometry.height).toBeCloseTo(CAMERA_OVERLAY_ASPECT_RATIO);
  });

  it('clamps out-of-bounds geometry without imposing a pixel minimum', () => {
    const geometry = clampCameraOverlayGeometry({ x: 2, y: -1, width: 0.0001, height: 0.5 });
    expect(geometry.x).toBe(1 - geometry.width);
    expect(geometry.y).toBe(0);
    expect(geometry.width).toBeGreaterThan(0);
    expect(geometry.height).toBeGreaterThan(0);
    expect(geometry.width / geometry.height).toBeCloseTo(CAMERA_OVERLAY_ASPECT_RATIO);
  });

  it('moves freely by default and snaps only when grid mode is enabled', () => {
    const start = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 / CAMERA_OVERLAY_ASPECT_RATIO };
    const free = moveCameraOverlay(start, { x: 7, y: 11 }, 800, 600);
    expect(free.x).toBeCloseTo(0.10875);
    expect(free.y).toBeCloseTo(0.118333);

    const snapped = moveCameraOverlay(start, { x: 7, y: 11 }, 800, 600, true);
    expect(snapped.x * 800).toBe(80);
    expect(snapped.y * 600).toBe(80);
  });

  it('resizes from the corner while preserving the camera ratio and bounds', () => {
    const start = { x: 0.7, y: 0.1, width: 0.2, height: 0.2 / CAMERA_OVERLAY_ASPECT_RATIO };
    const resized = resizeCameraOverlay(start, 500, 800);
    expect(resized.x + resized.width).toBeLessThanOrEqual(1);
    expect(resized.width / resized.height).toBeCloseTo(CAMERA_OVERLAY_ASPECT_RATIO);
    expect(resized.width).toBeCloseTo(0.3);
  });
});
