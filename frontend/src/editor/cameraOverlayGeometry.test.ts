import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CAMERA_OVERLAY_ASPECT_RATIO,
  DEFAULT_CAMERA_OVERLAY_GEOMETRY,
  captureCameraStill,
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
    const resized = resizeCameraOverlay(start, 500, 800, 600);
    expect(resized.x + resized.width).toBeLessThanOrEqual(1);
    expect((resized.width * 800) / (resized.height * 600)).toBeCloseTo(CAMERA_OVERLAY_ASPECT_RATIO);
    expect(resized.width).toBeCloseTo(0.3);
  });

  it('keeps the rendered pixel ratio at 16:9 on a non-square canvas', () => {
    const geometry = clampCameraOverlayGeometry(
      { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
      800,
      600,
    );
    expect((geometry.width * 800) / (geometry.height * 600)).toBeCloseTo(
      CAMERA_OVERLAY_ASPECT_RATIO,
    );
  });

  it('captures raw video pixels and leaves mirror application to the compositor', () => {
    const video = document.createElement('video');
    Object.defineProperties(video, {
      readyState: { configurable: true, value: 4 },
      videoWidth: { configurable: true, value: 2 },
      videoHeight: { configurable: true, value: 1 },
    });
    video.style.transform = 'scaleX(-1)';
    const canvas = document.createElement('canvas');
    const context = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') return canvas;
      return originalCreateElement(tagName);
    });
    vi.spyOn(canvas, 'getContext').mockReturnValue(context);
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');

    expect(captureCameraStill(video)).toBe('data:image/png;base64,AAAA');
    expect(context.drawImage).toHaveBeenCalledWith(video, 0, 0, 2, 1);
    expect((context as unknown as { translate?: unknown }).translate).toBeUndefined();
  });
});
