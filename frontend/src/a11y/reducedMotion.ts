/**
 * Task 29 (issue #28): the editor's reduced-motion preference.
 *
 * A tiny framework-agnostic external store (read via React's
 * `useSyncExternalStore`) rather than a React context/provider, so any
 * component that needs the effective value — the global
 * `ReducedMotionControl` (rendered once in `Layout.tsx`) and
 * `DemoControlsPanel.tsx` today, plus whatever the renderer/preview layer
 * grows next — reads and writes the exact same shared state with no
 * Provider wrapping required anywhere in the tree.
 *
 * Per `_docs/plan.md`'s "Reduced motion" section:
 * - "Default behavior follows the system `prefers-reduced-motion`
 *   preference" — see `systemPrefersReduced` below, kept live via a
 *   `matchMedia` change listener.
 * - "Include a global Reduce motion control with manual override" — see
 *   `override`/`setMotionOverride`, persisted across reloads in
 *   localStorage.
 * - "Reduced mode replaces or reduces non-essential motion: continuous
 *   movement can become static state, slow fade, or stepped updates
 *   while preserving the interaction's meaning" — consumers read
 *   `effective` and degrade their own continuous effects accordingly
 *   (see `DemoControlsPanel.tsx`'s auto-advancing playback timer, plus
 *   `runtime/trailSystem.ts` and `runtime/physicsForces.ts` (Task 61),
 *   which take this module's `effective`/`reducedMotion` value as a plain
 *   boolean parameter — rather than importing this module directly — so
 *   those runtime modules stay framework-agnostic and independently
 *   testable without a DOM/React environment).
 */
import { useSyncExternalStore } from 'react';

export type MotionOverride = 'system' | 'reduced' | 'full';

/** Namespaced so a future unrelated feature can't collide with this key. */
export const MOTION_OVERRIDE_STORAGE_KEY = 'gesture-studio:reduced-motion-override';

const VALID_OVERRIDES: readonly MotionOverride[] = ['system', 'reduced', 'full'];

function isMotionOverride(value: unknown): value is MotionOverride {
  return typeof value === 'string' && (VALID_OVERRIDES as readonly string[]).includes(value);
}

/** Falls back to 'system' for a missing key, an unparseable/foreign value
 * (e.g. written by a future version), or a storage access failure (private
 * browsing, disabled storage, no `window` at all) — never throws. */
function readStoredOverride(): MotionOverride {
  try {
    const raw = window.localStorage.getItem(MOTION_OVERRIDE_STORAGE_KEY);
    return isMotionOverride(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function writeStoredOverride(value: MotionOverride): void {
  try {
    if (value === 'system') {
      // 'system' is the default — storing nothing (rather than the string
      // 'system') keeps a stale key from ever winning over a future
      // change in what "default" means.
      window.localStorage.removeItem(MOTION_OVERRIDE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(MOTION_OVERRIDE_STORAGE_KEY, value);
    }
  } catch {
    // Storage unavailable: the in-memory override still works for the
    // rest of this session, it just won't survive a reload.
  }
}

function getMotionMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function readSystemPrefersReduced(): boolean {
  return getMotionMediaQuery()?.matches ?? false;
}

/** Pure decision rule, exported so its three cases can be tested directly
 * without touching localStorage or matchMedia. */
export function computeEffectiveReducedMotion(
  override: MotionOverride,
  systemPrefersReduced: boolean,
): boolean {
  if (override === 'reduced') return true;
  if (override === 'full') return false;
  return systemPrefersReduced;
}

export type ReducedMotionSnapshot = {
  override: MotionOverride;
  systemPrefersReduced: boolean;
  effective: boolean;
};

function buildInitialState(): ReducedMotionSnapshot {
  const override = readStoredOverride();
  const systemPrefersReduced = readSystemPrefersReduced();
  return {
    override,
    systemPrefersReduced,
    effective: computeEffectiveReducedMotion(override, systemPrefersReduced),
  };
}

// Module-singleton state: initialized once per page load, exactly like a
// real reload re-reads localStorage and the current system preference
// fresh. Tests that need a fresh instance use `vi.resetModules()` +
// dynamic `import()` to get one (see reducedMotion.test.ts).
let state: ReducedMotionSnapshot = buildInitialState();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function applyPatch(
  patch: Partial<Pick<ReducedMotionSnapshot, 'override' | 'systemPrefersReduced'>>,
): void {
  const override = patch.override ?? state.override;
  const systemPrefersReduced = patch.systemPrefersReduced ?? state.systemPrefersReduced;
  state = {
    override,
    systemPrefersReduced,
    effective: computeEffectiveReducedMotion(override, systemPrefersReduced),
  };
  notify();
}

let mediaListenerAttached = false;
function ensureMediaListener(): void {
  if (mediaListenerAttached) return;
  const mql = getMotionMediaQuery();
  if (!mql) return;
  mediaListenerAttached = true;
  const onChange = () => applyPatch({ systemPrefersReduced: mql.matches });
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
  } else {
    // Safari < 14 fallback API.
    (mql as unknown as { addListener?: (cb: () => void) => void }).addListener?.(onChange);
  }
}

/** `useSyncExternalStore` subscribe function. Also lazily attaches the
 * `matchMedia` change listener on first subscription, rather than at
 * module load, so importing this module in a non-browser test context
 * never touches `matchMedia` unless something actually renders. */
export function subscribe(listener: () => void): () => void {
  ensureMediaListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ReducedMotionSnapshot {
  return state;
}

/** Sets (or clears, via 'system') the manual override. Persists
 * immediately so a reload recovers it (acceptance criterion: "stored-
 * preference recovery"), and notifies every subscribed component
 * synchronously so a preview running mid-playback reacts on this same
 * tick — see `DemoControlsPanel.tsx`. */
export function setMotionOverride(next: MotionOverride): void {
  writeStoredOverride(next);
  applyPatch({ override: next });
}

export type UseReducedMotionResult = ReducedMotionSnapshot & {
  setOverride: (next: MotionOverride) => void;
};

/** The hook every component should use. Returns the current snapshot plus
 * a stable `setOverride` for the manual control. */
export function useReducedMotion(): UseReducedMotionResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { ...snapshot, setOverride: setMotionOverride };
}
