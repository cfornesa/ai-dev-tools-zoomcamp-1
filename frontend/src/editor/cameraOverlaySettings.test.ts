import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 118 (issue #147): unit tests for the client-only camera overlay
 * opacity/mirror preference store, mirroring `./snapSettings.test.ts`'s
 * pattern — `vi.resetModules()` + a dynamic `import()` per test to get a
 * fresh module-singleton instance, exactly like a real page reload
 * re-reads `localStorage` fresh.
 */
describe('cameraOverlaySettings store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to 50% opacity and mirrored with nothing stored', async () => {
    const { getSnapshot } = await import('./cameraOverlaySettings');
    expect(getSnapshot()).toEqual({ opacity: 0.5, mirrored: true });
  });

  it('setCameraOverlayOpacity updates opacity independently of mirrored', async () => {
    const { setCameraOverlayOpacity, getSnapshot } = await import('./cameraOverlaySettings');
    setCameraOverlayOpacity(0.9);
    expect(getSnapshot()).toEqual({ opacity: 0.9, mirrored: true });
  });

  it('setCameraOverlayMirrored updates mirrored independently of opacity', async () => {
    const { setCameraOverlayMirrored, getSnapshot } = await import('./cameraOverlaySettings');
    setCameraOverlayMirrored(false);
    expect(getSnapshot()).toEqual({ opacity: 0.5, mirrored: false });
  });

  it('persists both settings to localStorage and recovers them on a simulated reload', async () => {
    const mod1 = await import('./cameraOverlaySettings');
    mod1.setCameraOverlayOpacity(0.25);
    mod1.setCameraOverlayMirrored(false);
    expect(window.localStorage.getItem(mod1.CAMERA_OVERLAY_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ opacity: 0.25, mirrored: false }),
    );

    // Simulate a reload: fresh module registry, localStorage untouched.
    vi.resetModules();
    const mod2 = await import('./cameraOverlaySettings');
    expect(mod2.getSnapshot()).toEqual({ opacity: 0.25, mirrored: false });
  });

  it('recovers a previously chosen opacity alone after a simulated reload', async () => {
    const mod1 = await import('./cameraOverlaySettings');
    mod1.setCameraOverlayOpacity(1);

    vi.resetModules();
    const mod2 = await import('./cameraOverlaySettings');
    expect(mod2.getSnapshot().opacity).toBe(1);
  });

  it('recovers a previously chosen mirror preference alone after a simulated reload', async () => {
    const mod1 = await import('./cameraOverlaySettings');
    mod1.setCameraOverlayMirrored(false);

    vi.resetModules();
    const mod2 = await import('./cameraOverlaySettings');
    expect(mod2.getSnapshot().mirrored).toBe(false);
  });

  it('ignores an unparseable stored value and falls back to the default', async () => {
    window.localStorage.setItem('gesture-studio:camera-overlay-settings', 'not json');
    const { getSnapshot } = await import('./cameraOverlaySettings');
    expect(getSnapshot()).toEqual({ opacity: 0.5, mirrored: true });
  });

  it('ignores a foreign-shaped stored value and falls back to the default', async () => {
    window.localStorage.setItem(
      'gesture-studio:camera-overlay-settings',
      JSON.stringify({ foo: 'bar' }),
    );
    const { getSnapshot } = await import('./cameraOverlaySettings');
    expect(getSnapshot()).toEqual({ opacity: 0.5, mirrored: true });
  });

  it('ignores an out-of-range opacity value and falls back to the default', async () => {
    window.localStorage.setItem(
      'gesture-studio:camera-overlay-settings',
      JSON.stringify({ opacity: 1.5, mirrored: true }),
    );
    const { getSnapshot } = await import('./cameraOverlaySettings');
    expect(getSnapshot()).toEqual({ opacity: 0.5, mirrored: true });
  });

  it('a storage read failure falls back to the default without throwing', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const { getSnapshot } = await import('./cameraOverlaySettings');
    expect(getSnapshot()).toEqual({ opacity: 0.5, mirrored: true });
  });

  it('a storage write failure does not throw and in-memory state still updates for the rest of the session', async () => {
    const { setCameraOverlayOpacity, getSnapshot } = await import('./cameraOverlaySettings');
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    expect(() => setCameraOverlayOpacity(0.8)).not.toThrow();
    expect(getSnapshot()).toEqual({ opacity: 0.8, mirrored: true });
  });

  it('useCameraOverlaySettings reflects updates and two hook instances stay in sync', async () => {
    const { useCameraOverlaySettings } = await import('./cameraOverlaySettings');
    const a = renderHook(() => useCameraOverlaySettings());
    const b = renderHook(() => useCameraOverlaySettings());

    act(() => a.result.current.setOpacity(0.6));

    expect(a.result.current.opacity).toBe(0.6);
    expect(b.result.current.opacity).toBe(0.6);

    act(() => b.result.current.setMirrored(false));
    expect(a.result.current.mirrored).toBe(false);
  });
});
