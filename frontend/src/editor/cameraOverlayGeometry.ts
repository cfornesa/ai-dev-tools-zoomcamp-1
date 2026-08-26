import { useSyncExternalStore } from 'react';
import type { Point } from '../pages/sceneShapes';

export const CAMERA_OVERLAY_ASPECT_RATIO = 16 / 9;

export type CameraOverlayGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CameraOverlayExport = {
  frameDataUrl: string;
  geometry: CameraOverlayGeometry;
  opacity: number;
  mirrored: boolean;
  layerOrder: number;
};

export type CameraOverlayAction =
  { type: 'move'; delta: Point } | { type: 'resize'; deltaX: number };

export function captureCameraStill(video: HTMLVideoElement): string {
  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error('Camera frame is not ready. Keep the camera active and try exporting again.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Camera frame capture is unavailable in this browser.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error('Camera frame could not be encoded. Check browser permissions and try again.');
  }
}

export const DEFAULT_CAMERA_OVERLAY_GEOMETRY: CameraOverlayGeometry = {
  x: 0.04,
  y: 0.04,
  width: 0.32,
  height: (0.32 * 800) / (CAMERA_OVERLAY_ASPECT_RATIO * 600),
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isCameraOverlayGeometry(value: unknown): value is CameraOverlayGeometry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ['x', 'y', 'width', 'height'].every((key) => finite(candidate[key]));
}

export function clampCameraOverlayGeometry(
  geometry: CameraOverlayGeometry,
  canvasWidth = 1,
  canvasHeight = 1,
): CameraOverlayGeometry {
  const safeCanvasWidth = Math.max(Number.EPSILON, canvasWidth);
  const safeCanvasHeight = Math.max(Number.EPSILON, canvasHeight);
  const requestedWidth = Math.min(1, Math.max(Number.EPSILON, geometry.width));
  const requestedHeight = Math.min(1, Math.max(Number.EPSILON, geometry.height));
  const requestedPixelWidth = Math.min(
    requestedWidth * safeCanvasWidth,
    requestedHeight * safeCanvasHeight * CAMERA_OVERLAY_ASPECT_RATIO,
  );
  const maxPixelWidth = Math.min(safeCanvasWidth, safeCanvasHeight * CAMERA_OVERLAY_ASPECT_RATIO);
  const pixelWidth = Math.min(maxPixelWidth, Math.max(Number.EPSILON, requestedPixelWidth));
  const pixelHeight = pixelWidth / CAMERA_OVERLAY_ASPECT_RATIO;
  const nextWidth = pixelWidth / safeCanvasWidth;
  const nextHeight = pixelHeight / safeCanvasHeight;
  return {
    x: Math.min(1 - nextWidth, Math.max(0, geometry.x)),
    y: Math.min(1 - nextHeight, Math.max(0, geometry.y)),
    width: nextWidth,
    height: nextHeight,
  };
}

export const CAMERA_OVERLAY_GEOMETRY_STORAGE_KEY = 'gesture-studio:camera-overlay-geometry';
export const CAMERA_OVERLAY_LAYER_ORDER_STORAGE_KEY = 'gesture-studio:camera-overlay-layer-order';
let state: CameraOverlayGeometry = readStoredGeometry();
const listeners = new Set<() => void>();

function readStoredGeometry(): CameraOverlayGeometry {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(CAMERA_OVERLAY_GEOMETRY_STORAGE_KEY) ?? 'null',
    );
    return isCameraOverlayGeometry(parsed) ? parsed : DEFAULT_CAMERA_OVERLAY_GEOMETRY;
  } catch {
    return DEFAULT_CAMERA_OVERLAY_GEOMETRY;
  }
}

export function getCameraOverlayLayerOrder(defaultOrder = 0): number {
  try {
    const stored = window.localStorage.getItem(CAMERA_OVERLAY_LAYER_ORDER_STORAGE_KEY);
    if (stored === null) return defaultOrder;
    const value = Number(stored);
    return Number.isFinite(value) ? value : defaultOrder;
  } catch {
    return defaultOrder;
  }
}

export function setCameraOverlayLayerOrder(order: number): void {
  if (!Number.isFinite(order)) return;
  try {
    window.localStorage.setItem(CAMERA_OVERLAY_LAYER_ORDER_STORAGE_KEY, String(order));
  } catch {
    // The live value remains usable when storage is unavailable.
  }
}

function persistGeometry(next: CameraOverlayGeometry): void {
  state = next;
  try {
    window.localStorage.setItem(CAMERA_OVERLAY_GEOMETRY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory preference remains usable when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function getCameraOverlayGeometry(): CameraOverlayGeometry {
  return state;
}

export function setCameraOverlayGeometry(next: CameraOverlayGeometry): void {
  persistGeometry(next);
}

export function useCameraOverlayGeometry(): CameraOverlayGeometry & {
  setGeometry: (next: CameraOverlayGeometry) => void;
} {
  const geometry = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  return { ...geometry, setGeometry: setCameraOverlayGeometry };
}

export function moveCameraOverlay(
  geometry: CameraOverlayGeometry,
  delta: Point,
  canvasWidth: number,
  canvasHeight: number,
  gridEnabled = false,
): CameraOverlayGeometry {
  const gridX = gridEnabled ? 20 / canvasWidth : 0;
  const gridY = gridEnabled ? 20 / canvasHeight : 0;
  const x = geometry.x + delta.x / canvasWidth;
  const y = geometry.y + delta.y / canvasHeight;
  return clampCameraOverlayGeometry(
    {
      ...geometry,
      x: gridEnabled ? Math.round(x / gridX) * gridX : x,
      y: gridEnabled ? Math.round(y / gridY) * gridY : y,
    },
    canvasWidth,
    canvasHeight,
  );
}

export function resizeCameraOverlay(
  geometry: CameraOverlayGeometry,
  deltaX: number,
  canvasWidth: number,
  canvasHeight = 1,
): CameraOverlayGeometry {
  const width = Math.min(
    1 - geometry.x,
    Math.max(Number.EPSILON, geometry.width + deltaX / canvasWidth),
  );
  return clampCameraOverlayGeometry(
    {
      ...geometry,
      width,
      height: (width * canvasWidth) / (CAMERA_OVERLAY_ASPECT_RATIO * canvasHeight),
    },
    canvasWidth,
    canvasHeight,
  );
}

export function applyCameraOverlayAction(
  geometry: CameraOverlayGeometry,
  action: CameraOverlayAction,
  canvasWidth: number,
  canvasHeight: number,
  gridEnabled = false,
): CameraOverlayGeometry {
  if (action.type === 'move') {
    return moveCameraOverlay(geometry, action.delta, canvasWidth, canvasHeight, gridEnabled);
  }
  return resizeCameraOverlay(geometry, action.deltaX, canvasWidth, canvasHeight);
}
