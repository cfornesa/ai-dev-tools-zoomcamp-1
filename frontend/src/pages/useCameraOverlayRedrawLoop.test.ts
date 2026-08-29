import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCameraOverlayRedrawLoop } from './useCameraOverlayRedrawLoop';

/**
 * Deterministic, manually-driven stand-in for `window.requestAnimationFrame`/
 * `cancelAnimationFrame`, mirroring the pattern
 * `generateHtmlExportCameraRuntime.test.ts` already uses for the same
 * purpose: `flush()` invokes every currently-pending callback (clearing them
 * first, matching a real browser draining one frame's worth of callbacks).
 */
function stubAnimationFrame(): {
  flush: () => void;
  pendingCount: () => number;
  restore: () => void;
} {
  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  }) as unknown as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    pending.delete(id);
  }) as unknown as typeof window.cancelAnimationFrame;
  return {
    flush: () => {
      const callbacks = Array.from(pending.values());
      pending.clear();
      for (const cb of callbacks) cb(performance.now());
    },
    pendingCount: () => pending.size,
    restore: () => {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
    },
  };
}

describe('useCameraOverlayRedrawLoop (issue #192 follow-up)', () => {
  it('does nothing when inactive', () => {
    const raf = stubAnimationFrame();
    try {
      const redraw = vi.fn();
      renderHook(() => useCameraOverlayRedrawLoop(false, redraw));
      expect(raf.pendingCount()).toBe(0);
      expect(redraw).not.toHaveBeenCalled();
    } finally {
      raf.restore();
    }
  });

  it('calls redraw on every animation frame while active, not just once', () => {
    const raf = stubAnimationFrame();
    try {
      const redraw = vi.fn();
      renderHook(() => useCameraOverlayRedrawLoop(true, redraw));

      expect(redraw).not.toHaveBeenCalled();
      raf.flush();
      expect(redraw).toHaveBeenCalledTimes(1);
      raf.flush();
      expect(redraw).toHaveBeenCalledTimes(2);
      raf.flush();
      expect(redraw).toHaveBeenCalledTimes(3);
    } finally {
      raf.restore();
    }
  });

  it('keeps ticking on subsequent frames even if redraw throws', () => {
    const raf = stubAnimationFrame();
    try {
      const redraw = vi.fn(() => {
        throw new Error('render failed');
      });
      renderHook(() => useCameraOverlayRedrawLoop(true, redraw));

      expect(() => raf.flush()).not.toThrow();
      expect(redraw).toHaveBeenCalledTimes(1);
      expect(raf.pendingCount()).toBe(1);

      expect(() => raf.flush()).not.toThrow();
      expect(redraw).toHaveBeenCalledTimes(2);
    } finally {
      raf.restore();
    }
  });

  it('reads the latest redraw callback without restarting the loop when it changes identity', () => {
    const raf = stubAnimationFrame();
    try {
      const first = vi.fn();
      const second = vi.fn();
      const { rerender } = renderHook(({ redraw }) => useCameraOverlayRedrawLoop(true, redraw), {
        initialProps: { redraw: first },
      });

      raf.flush();
      expect(first).toHaveBeenCalledTimes(1);

      rerender({ redraw: second });
      // A changed callback identity alone must not cancel/reschedule the
      // loop -- exactly one frame is still pending, and the *next* tick
      // reads the new callback via the "latest value" ref.
      expect(raf.pendingCount()).toBe(1);

      raf.flush();
      expect(second).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledTimes(1);
    } finally {
      raf.restore();
    }
  });

  it('cancels the pending frame and stops calling redraw once active becomes false', () => {
    const raf = stubAnimationFrame();
    try {
      const redraw = vi.fn();
      const { rerender } = renderHook(({ active }) => useCameraOverlayRedrawLoop(active, redraw), {
        initialProps: { active: true },
      });

      raf.flush();
      expect(redraw).toHaveBeenCalledTimes(1);
      expect(raf.pendingCount()).toBe(1);

      rerender({ active: false });
      expect(raf.pendingCount()).toBe(0);

      raf.flush();
      expect(redraw).toHaveBeenCalledTimes(1);
    } finally {
      raf.restore();
    }
  });

  it('cancels the pending frame on unmount', () => {
    const raf = stubAnimationFrame();
    try {
      const redraw = vi.fn();
      const { unmount } = renderHook(() => useCameraOverlayRedrawLoop(true, redraw));

      raf.flush();
      expect(raf.pendingCount()).toBe(1);

      unmount();
      expect(raf.pendingCount()).toBe(0);

      raf.flush();
      expect(redraw).toHaveBeenCalledTimes(1);
    } finally {
      raf.restore();
    }
  });
});
