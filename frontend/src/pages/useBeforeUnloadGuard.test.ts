import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';

/**
 * Task 44: the native `beforeunload` safeguard. Verifies the listener is
 * actually added/removed as `isDirty` toggles across renders — not just
 * fired once and forgotten — and that it triggers the browser's own
 * native prompt (via `preventDefault()`/`returnValue`) without ever
 * setting a custom message string (`_docs/plan.md`'s "Browser-controlled
 * wording is expected; custom dialog text is not reliable").
 */
describe('useBeforeUnloadGuard', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  function beforeUnloadCalls(spy: ReturnType<typeof vi.spyOn>) {
    return spy.mock.calls.filter(
      ([eventName]: [string, ...unknown[]]) => eventName === 'beforeunload',
    );
  }

  it('does not register a listener while there are no unsaved changes', () => {
    renderHook(({ isDirty }) => useBeforeUnloadGuard(isDirty), {
      initialProps: { isDirty: false },
    });
    expect(beforeUnloadCalls(addSpy)).toHaveLength(0);
  });

  it('registers exactly one listener once unsaved changes exist', () => {
    const { rerender } = renderHook(({ isDirty }) => useBeforeUnloadGuard(isDirty), {
      initialProps: { isDirty: false },
    });
    expect(beforeUnloadCalls(addSpy)).toHaveLength(0);

    rerender({ isDirty: true });
    expect(beforeUnloadCalls(addSpy)).toHaveLength(1);
    expect(beforeUnloadCalls(removeSpy)).toHaveLength(0);
  });

  it('removes the listener the instant isDirty goes back to false', () => {
    const { rerender } = renderHook(({ isDirty }) => useBeforeUnloadGuard(isDirty), {
      initialProps: { isDirty: true },
    });
    expect(beforeUnloadCalls(addSpy)).toHaveLength(1);

    rerender({ isDirty: false });
    expect(beforeUnloadCalls(removeSpy)).toHaveLength(1);

    // No new listener registered while it stays clean.
    rerender({ isDirty: false });
    expect(beforeUnloadCalls(addSpy)).toHaveLength(1);
  });

  it('toggling isDirty repeatedly adds/removes exactly one listener each time, never accumulating', () => {
    const { rerender } = renderHook(({ isDirty }) => useBeforeUnloadGuard(isDirty), {
      initialProps: { isDirty: false },
    });

    rerender({ isDirty: true });
    rerender({ isDirty: false });
    rerender({ isDirty: true });
    rerender({ isDirty: false });

    expect(beforeUnloadCalls(addSpy)).toHaveLength(2);
    expect(beforeUnloadCalls(removeSpy)).toHaveLength(2);
  });

  it('removes the listener on unmount while still dirty (e.g. a confirmed exit/save)', () => {
    const { unmount } = renderHook(({ isDirty }) => useBeforeUnloadGuard(isDirty), {
      initialProps: { isDirty: true },
    });
    expect(beforeUnloadCalls(addSpy)).toHaveLength(1);

    unmount();
    expect(beforeUnloadCalls(removeSpy)).toHaveLength(1);
  });

  it('calls preventDefault and sets returnValue without a custom message string', () => {
    renderHook(({ isDirty }) => useBeforeUnloadGuard(isDirty), {
      initialProps: { isDirty: true },
    });
    const [, handler] = beforeUnloadCalls(addSpy)[0] as [
      string,
      (event: BeforeUnloadEvent) => void,
    ];

    const preventDefault = vi.fn();
    const event = { preventDefault, returnValue: undefined } as unknown as BeforeUnloadEvent;
    handler(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });
});
