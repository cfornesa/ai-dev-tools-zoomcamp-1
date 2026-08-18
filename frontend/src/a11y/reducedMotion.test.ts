import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockMediaQueryList = {
  readonly matches: boolean;
  media: string;
  addEventListener: (type: string, cb: () => void) => void;
  removeEventListener: (type: string, cb: () => void) => void;
  dispatchChange: (matches: boolean) => void;
};

/** Installs a `window.matchMedia` mock for `(prefers-reduced-motion:
 * reduce)`. jsdom (this project's test environment) doesn't implement
 * `matchMedia` at all — `typeof window.matchMedia` is `undefined` by
 * default — so every test that needs a system-preference value must
 * install this first. */
function installMatchMediaMock(initialMatches: boolean): MockMediaQueryList {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const mql: MockMediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
    dispatchChange: (next) => {
      matches = next;
      listeners.forEach((cb) => cb());
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return mql;
}

const originalMatchMedia = window.matchMedia;

describe('reducedMotion store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      // jsdom has no matchMedia by default in this project — restore that.
      // @ts-expect-error test cleanup of a property that may not exist
      delete window.matchMedia;
    }
    window.localStorage.clear();
  });

  it('computeEffectiveReducedMotion: reduced/full always win; system follows the system value', async () => {
    const { computeEffectiveReducedMotion } = await import('./reducedMotion');
    expect(computeEffectiveReducedMotion('reduced', false)).toBe(true);
    expect(computeEffectiveReducedMotion('reduced', true)).toBe(true);
    expect(computeEffectiveReducedMotion('full', true)).toBe(false);
    expect(computeEffectiveReducedMotion('full', false)).toBe(false);
    expect(computeEffectiveReducedMotion('system', true)).toBe(true);
    expect(computeEffectiveReducedMotion('system', false)).toBe(false);
  });

  it('with no override, the effective setting follows prefers-reduced-motion (reduced)', async () => {
    installMatchMediaMock(true);
    const { getSnapshot } = await import('./reducedMotion');
    expect(getSnapshot()).toEqual({
      override: 'system',
      systemPrefersReduced: true,
      effective: true,
    });
  });

  it('with no override, the effective setting follows prefers-reduced-motion (full)', async () => {
    installMatchMediaMock(false);
    const { getSnapshot } = await import('./reducedMotion');
    expect(getSnapshot()).toEqual({
      override: 'system',
      systemPrefersReduced: false,
      effective: false,
    });
  });

  it('falls back to full motion when matchMedia is unavailable and there is no override', async () => {
    // @ts-expect-error simulate an environment without matchMedia at all
    delete window.matchMedia;
    const { getSnapshot } = await import('./reducedMotion');
    expect(getSnapshot()).toMatchObject({ systemPrefersReduced: false, effective: false });
  });

  it('a manual override can force reduced motion even though the system prefers full motion', async () => {
    installMatchMediaMock(false);
    const { setMotionOverride, getSnapshot } = await import('./reducedMotion');
    setMotionOverride('reduced');
    expect(getSnapshot()).toMatchObject({ override: 'reduced', effective: true });
  });

  it('a manual override can force full motion even though the system prefers reduced motion', async () => {
    installMatchMediaMock(true);
    const { setMotionOverride, getSnapshot } = await import('./reducedMotion');
    setMotionOverride('full');
    expect(getSnapshot()).toMatchObject({ override: 'full', effective: false });
  });

  it('persists a manual override to localStorage and recovers it on the next load', async () => {
    installMatchMediaMock(false);
    const mod1 = await import('./reducedMotion');
    mod1.setMotionOverride('reduced');
    expect(window.localStorage.getItem(mod1.MOTION_OVERRIDE_STORAGE_KEY)).toBe('reduced');

    // Simulate a reload: fresh module registry, matchMedia re-mocked (a
    // real reload would re-run the browser's own matchMedia), localStorage
    // untouched — exactly what the acceptance criterion means by "stored-
    // preference recovery".
    vi.resetModules();
    installMatchMediaMock(false);
    const mod2 = await import('./reducedMotion');
    expect(mod2.getSnapshot()).toMatchObject({ override: 'reduced', effective: true });
  });

  it('setting the override back to system removes the stored value', async () => {
    installMatchMediaMock(false);
    const mod = await import('./reducedMotion');
    mod.setMotionOverride('reduced');
    mod.setMotionOverride('system');
    expect(window.localStorage.getItem(mod.MOTION_OVERRIDE_STORAGE_KEY)).toBeNull();
  });

  it('ignores an unparseable stored value and falls back to system', async () => {
    window.localStorage.setItem('gesture-studio:reduced-motion-override', 'nonsense');
    installMatchMediaMock(false);
    const { getSnapshot } = await import('./reducedMotion');
    expect(getSnapshot().override).toBe('system');
  });

  it('a live system-preference change notifies subscribers and updates the effective value', async () => {
    const mql = installMatchMediaMock(false);
    const { subscribe, getSnapshot } = await import('./reducedMotion');
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    expect(getSnapshot().effective).toBe(false);

    mql.dispatchChange(true);

    expect(listener).toHaveBeenCalled();
    expect(getSnapshot().effective).toBe(true);
    unsubscribe();
  });

  it('a system change is ignored once a manual override is in force', async () => {
    const mql = installMatchMediaMock(false);
    const { subscribe, setMotionOverride, getSnapshot } = await import('./reducedMotion');
    subscribe(vi.fn());
    setMotionOverride('full');

    mql.dispatchChange(true); // system now prefers reduced, but override wins

    expect(getSnapshot()).toMatchObject({ override: 'full', effective: false });
  });

  it('useReducedMotion reflects a live system change while override is system', async () => {
    const mql = installMatchMediaMock(false);
    const { useReducedMotion } = await import('./reducedMotion');
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current.effective).toBe(false);

    act(() => mql.dispatchChange(true));

    expect(result.current.effective).toBe(true);
  });

  it('useReducedMotion.setOverride forces reduced, forces full, and can be released back to system', async () => {
    installMatchMediaMock(false);
    const { useReducedMotion } = await import('./reducedMotion');
    const { result } = renderHook(() => useReducedMotion());

    act(() => result.current.setOverride('reduced'));
    expect(result.current).toMatchObject({ override: 'reduced', effective: true });

    act(() => result.current.setOverride('full'));
    expect(result.current).toMatchObject({ override: 'full', effective: false });

    act(() => result.current.setOverride('system'));
    expect(result.current).toMatchObject({ override: 'system', effective: false });
  });

  it('two hook instances stay in sync: a change from one is visible in the other immediately', async () => {
    installMatchMediaMock(false);
    const { useReducedMotion } = await import('./reducedMotion');
    const a = renderHook(() => useReducedMotion());
    const b = renderHook(() => useReducedMotion());

    act(() => a.result.current.setOverride('reduced'));

    expect(a.result.current.effective).toBe(true);
    expect(b.result.current.effective).toBe(true);
  });
});
