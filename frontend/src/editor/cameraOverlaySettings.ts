/**
 * Task 118 (issue #147): the editor's live camera overlay opacity + mirror
 * preference.
 *
 * A tiny framework-agnostic external store (read via React's
 * `useSyncExternalStore`), following the exact same pattern as
 * `./snapSettings.ts` (Task 78) / `../a11y/reducedMotion.ts` (Task 29)
 * rather than a React context/provider: module-singleton state,
 * `localStorage` persistence under a namespaced key, safe fallback on
 * storage failure (never throws).
 *
 * Task 110/#141 shipped the camera overlay with opacity explicitly
 * session-only (reset to a hardcoded default every time the camera became
 * active) and mirroring explicitly non-toggleable, both flagged as
 * deliberate scope cuts. This store persists both preferences purely
 * client-side, per-browser: it is never read from or written into
 * `schema/scene.schema.json`, never part of the scene document, never sent
 * to the backend, and never included in an export/save/fork payload —
 * exactly like snap settings and reduced motion.
 */
import { useSyncExternalStore } from 'react';

export type CameraOverlaySettings = {
  opacity: number;
  mirrored: boolean;
};

/** Namespaced so a future unrelated feature can't collide with this key. */
export const CAMERA_OVERLAY_SETTINGS_STORAGE_KEY = 'gesture-studio:camera-overlay-settings';

/** Matches today's shipped behavior (Task 110/#141): 50% opacity,
 * selfie-mirrored. */
export const DEFAULT_CAMERA_OVERLAY_SETTINGS: CameraOverlaySettings = {
  opacity: 0.5,
  mirrored: true,
};

function isCameraOverlaySettings(value: unknown): value is CameraOverlaySettings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.opacity === 'number' &&
    Number.isFinite(v.opacity) &&
    v.opacity >= 0 &&
    v.opacity <= 1 &&
    typeof v.mirrored === 'boolean'
  );
}

/** Falls back to the shipped default for a missing key, an
 * unparseable/foreign value (e.g. written by a future version), or a
 * storage access failure (private browsing, disabled storage, no `window`
 * at all) — never throws. */
function readStoredSettings(): CameraOverlaySettings {
  try {
    const raw = window.localStorage.getItem(CAMERA_OVERLAY_SETTINGS_STORAGE_KEY);
    if (raw === null) return DEFAULT_CAMERA_OVERLAY_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    return isCameraOverlaySettings(parsed) ? parsed : DEFAULT_CAMERA_OVERLAY_SETTINGS;
  } catch {
    return DEFAULT_CAMERA_OVERLAY_SETTINGS;
  }
}

function writeStoredSettings(value: CameraOverlaySettings): void {
  try {
    window.localStorage.setItem(CAMERA_OVERLAY_SETTINGS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: the in-memory setting still works for the rest
    // of this session, it just won't survive a reload.
  }
}

// Module-singleton state: initialized once per page load, exactly like a
// real reload re-reads localStorage fresh. Tests that need a fresh
// instance use `vi.resetModules()` + dynamic `import()` to get one (see
// cameraOverlaySettings.test.ts), matching snapSettings.test.ts's
// convention.
let state: CameraOverlaySettings = readStoredSettings();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function applyPatch(patch: Partial<CameraOverlaySettings>): void {
  state = { ...state, ...patch };
  writeStoredSettings(state);
  notify();
}

/** `useSyncExternalStore` subscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CameraOverlaySettings {
  return state;
}

/** Sets the overlay opacity (0-1). Persists immediately so a reload
 * recovers it, and notifies every subscribed component synchronously so
 * the overlay `<video>` reacts on this same tick. */
export function setCameraOverlayOpacity(next: number): void {
  applyPatch({ opacity: next });
}

/** Sets whether the overlay is selfie-mirrored — see
 * `setCameraOverlayOpacity`'s own comment. */
export function setCameraOverlayMirrored(next: boolean): void {
  applyPatch({ mirrored: next });
}

export type UseCameraOverlaySettingsResult = CameraOverlaySettings & {
  setOpacity: (next: number) => void;
  setMirrored: (next: boolean) => void;
};

/** The hook every component should use. Returns the current snapshot plus
 * stable setters for the opacity slider and mirror toggle. */
export function useCameraOverlaySettings(): UseCameraOverlaySettingsResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return {
    ...snapshot,
    setOpacity: setCameraOverlayOpacity,
    setMirrored: setCameraOverlayMirrored,
  };
}
