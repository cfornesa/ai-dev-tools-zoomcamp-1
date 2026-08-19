/**
 * Issue #78: the editor's snap-to-grid / alignment-guide preference.
 *
 * A tiny framework-agnostic external store (read via React's
 * `useSyncExternalStore`), following the exact same pattern as
 * `../a11y/reducedMotion.ts` (Task 29) rather than a React context/
 * provider: module-singleton state, `localStorage` persistence under a
 * namespaced key, safe fallback on storage failure (never throws).
 *
 * Per the issue's grooming ("Storage decision: client-only, not schema"):
 * this is a purely client-side, per-browser, session-scoped editor
 * setting, exactly like reduced-motion — it describes how one editor
 * session likes to edit a scene, not what the scene *is*. It is never
 * read from or written into `schema/scene.schema.json`, never part of the
 * scene document, never sent to the backend, and never included in an
 * export/save/fork payload. Unlike reduced motion (which has a "system"
 * default it can fall back to), there is no OS-level "prefers snapping"
 * signal to follow, so this store is simpler: just two independent
 * booleans, defaulting to off until the user turns them on.
 */
import { useSyncExternalStore } from 'react';

export type SnapSettings = {
  gridEnabled: boolean;
  guidesEnabled: boolean;
};

/** Namespaced so a future unrelated feature can't collide with this key. */
export const SNAP_SETTINGS_STORAGE_KEY = 'gesture-studio:snap-settings';

const DEFAULT_SETTINGS: SnapSettings = { gridEnabled: false, guidesEnabled: false };

function isSnapSettings(value: unknown): value is SnapSettings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.gridEnabled === 'boolean' && typeof v.guidesEnabled === 'boolean';
}

/** Falls back to the all-off default for a missing key, an unparseable/
 * foreign value (e.g. written by a future version), or a storage access
 * failure (private browsing, disabled storage, no `window` at all) —
 * never throws. */
function readStoredSettings(): SnapSettings {
  try {
    const raw = window.localStorage.getItem(SNAP_SETTINGS_STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    return isSnapSettings(parsed) ? parsed : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeStoredSettings(value: SnapSettings): void {
  try {
    if (!value.gridEnabled && !value.guidesEnabled) {
      // Both off is the default — storing nothing (rather than the
      // literal object) keeps a stale key from ever winning over a future
      // change in what "default" means, matching reducedMotion.ts's
      // 'system' convention.
      window.localStorage.removeItem(SNAP_SETTINGS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SNAP_SETTINGS_STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    // Storage unavailable: the in-memory setting still works for the rest
    // of this session, it just won't survive a reload.
  }
}

// Module-singleton state: initialized once per page load, exactly like a
// real reload re-reads localStorage fresh. Tests that need a fresh
// instance use `vi.resetModules()` + dynamic `import()` to get one (see
// snapSettings.test.ts), matching reducedMotion.test.ts's convention.
let state: SnapSettings = readStoredSettings();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function applyPatch(patch: Partial<SnapSettings>): void {
  state = { ...state, ...patch };
  writeStoredSettings(state);
  notify();
}

/** `useSyncExternalStore` subscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): SnapSettings {
  return state;
}

/** Sets grid-snap on/off. Persists immediately so a reload recovers it,
 * and notifies every subscribed component synchronously so the canvas
 * grid overlay and any in-progress gesture react on this same tick. */
export function setGridEnabled(next: boolean): void {
  applyPatch({ gridEnabled: next });
}

/** Sets alignment-guide-snap on/off — see `setGridEnabled`'s own comment. */
export function setGuidesEnabled(next: boolean): void {
  applyPatch({ guidesEnabled: next });
}

export type UseSnapSettingsResult = SnapSettings & {
  setGridEnabled: (next: boolean) => void;
  setGuidesEnabled: (next: boolean) => void;
};

/** The hook every component should use. Returns the current snapshot plus
 * stable setters for the toggle control. */
export function useSnapSettings(): UseSnapSettingsResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { ...snapshot, setGridEnabled, setGuidesEnabled };
}
