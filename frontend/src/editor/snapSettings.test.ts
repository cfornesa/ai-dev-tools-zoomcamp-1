import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Issue #78: unit tests for the client-only snap-to-grid / alignment-guide
 * preference store, mirroring `../a11y/reducedMotion.test.ts`'s pattern —
 * `vi.resetModules()` + a dynamic `import()` per test to get a fresh
 * module-singleton instance, exactly like a real page reload re-reads
 * `localStorage` fresh.
 */
describe('snapSettings store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it('defaults both grid and guides to off with nothing stored', async () => {
    const { getSnapshot } = await import('./snapSettings');
    expect(getSnapshot()).toEqual({ gridEnabled: false, guidesEnabled: false });
  });

  it('setGridEnabled toggles grid independently of guides', async () => {
    const { setGridEnabled, getSnapshot } = await import('./snapSettings');
    setGridEnabled(true);
    expect(getSnapshot()).toEqual({ gridEnabled: true, guidesEnabled: false });
  });

  it('setGuidesEnabled toggles guides independently of grid', async () => {
    const { setGuidesEnabled, getSnapshot } = await import('./snapSettings');
    setGuidesEnabled(true);
    expect(getSnapshot()).toEqual({ gridEnabled: false, guidesEnabled: true });
  });

  it('persists both settings to localStorage and recovers them on the next load', async () => {
    const mod1 = await import('./snapSettings');
    mod1.setGridEnabled(true);
    mod1.setGuidesEnabled(true);
    expect(window.localStorage.getItem(mod1.SNAP_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ gridEnabled: true, guidesEnabled: true }),
    );

    // Simulate a reload: fresh module registry, localStorage untouched.
    vi.resetModules();
    const mod2 = await import('./snapSettings');
    expect(mod2.getSnapshot()).toEqual({ gridEnabled: true, guidesEnabled: true });
  });

  it('removes the stored key once both settings are turned back off', async () => {
    const mod = await import('./snapSettings');
    mod.setGridEnabled(true);
    mod.setGridEnabled(false);
    expect(window.localStorage.getItem(mod.SNAP_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('ignores an unparseable stored value and falls back to the all-off default', async () => {
    window.localStorage.setItem('gesture-studio:snap-settings', 'not json');
    const { getSnapshot } = await import('./snapSettings');
    expect(getSnapshot()).toEqual({ gridEnabled: false, guidesEnabled: false });
  });

  it('ignores a foreign-shaped stored value and falls back to the all-off default', async () => {
    window.localStorage.setItem('gesture-studio:snap-settings', JSON.stringify({ foo: 'bar' }));
    const { getSnapshot } = await import('./snapSettings');
    expect(getSnapshot()).toEqual({ gridEnabled: false, guidesEnabled: false });
  });

  it('useSnapSettings reflects toggles and two hook instances stay in sync', async () => {
    const { useSnapSettings } = await import('./snapSettings');
    const a = renderHook(() => useSnapSettings());
    const b = renderHook(() => useSnapSettings());

    act(() => a.result.current.setGridEnabled(true));

    expect(a.result.current.gridEnabled).toBe(true);
    expect(b.result.current.gridEnabled).toBe(true);

    act(() => b.result.current.setGuidesEnabled(true));
    expect(a.result.current.guidesEnabled).toBe(true);
  });
});
