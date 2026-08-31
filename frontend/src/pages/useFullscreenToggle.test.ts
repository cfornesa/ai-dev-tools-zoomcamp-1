import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFullscreenToggle } from './useFullscreenToggle';

/** jsdom implements no real Fullscreen API -- these mocks drive
 * `document.fullscreenElement`/`fullscreenchange` exactly the way a real
 * browser would around a `requestFullscreen()`/`exitFullscreen()` call,
 * per this issue's own documented test approach. */
function mockFullscreenApi() {
  let current: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => current,
  });
  const requestFullscreen = vi.fn(function (this: Element) {
    current = this;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  const exitFullscreen = vi.fn(() => {
    current = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  Element.prototype.requestFullscreen =
    requestFullscreen as unknown as typeof Element.prototype.requestFullscreen;
  document.exitFullscreen = exitFullscreen as unknown as typeof document.exitFullscreen;
  return { requestFullscreen, exitFullscreen, simulateEscapeExit: () => exitFullscreen() };
}

describe('useFullscreenToggle', () => {
  let mocks: ReturnType<typeof mockFullscreenApi>;

  beforeEach(() => {
    mocks = mockFullscreenApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts not fullscreen', () => {
    const elementRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useFullscreenToggle(elementRef));
    expect(result.current.isFullscreen).toBe(false);
  });

  it('requests fullscreen on the given element and flips isFullscreen to true', async () => {
    const element = document.createElement('div');
    const elementRef = { current: element };
    const { result } = renderHook(() => useFullscreenToggle(elementRef));

    await act(async () => {
      await result.current.toggleFullscreen();
    });

    expect(mocks.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isFullscreen).toBe(true);
  });

  it('exits fullscreen (rather than re-requesting) when already fullscreen', async () => {
    const element = document.createElement('div');
    const elementRef = { current: element };
    const { result } = renderHook(() => useFullscreenToggle(elementRef));
    await act(async () => {
      await result.current.toggleFullscreen();
    });
    expect(result.current.isFullscreen).toBe(true);

    await act(async () => {
      await result.current.toggleFullscreen();
    });

    expect(mocks.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isFullscreen).toBe(false);
  });

  it('stays in sync when fullscreen is exited via Escape/browser chrome, not this hook', async () => {
    const element = document.createElement('div');
    const elementRef = { current: element };
    const { result } = renderHook(() => useFullscreenToggle(elementRef));
    await act(async () => {
      await result.current.toggleFullscreen();
    });
    expect(result.current.isFullscreen).toBe(true);

    // Simulates the browser itself exiting fullscreen (Escape key, chrome
    // UI) -- a fullscreenchange event fires with no call to this hook's
    // own toggleFullscreen().
    act(() => {
      mocks.simulateEscapeExit();
    });

    expect(result.current.isFullscreen).toBe(false);
  });
});
