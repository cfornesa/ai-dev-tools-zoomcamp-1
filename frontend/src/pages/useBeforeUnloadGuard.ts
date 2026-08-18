import { useEffect } from 'react';

/**
 * Task 44: the native `beforeunload` safeguard from `_docs/plan.md`'s
 * "Leaving with unsaved work" section.
 *
 * "Browser-controlled wording is expected; custom dialog text is not
 * reliable" — so this never sets a custom message string. Calling
 * `event.preventDefault()` and setting the legacy `returnValue` property
 * is the documented cross-browser way to trigger the browser's own native
 * "leave site?" prompt; browsers ignore any custom string these days and
 * show their own fixed wording regardless of what's assigned.
 *
 * The listener is registered ONLY while `isDirty` is true and removed the
 * moment it goes false (a successful save, a discard, or a fresh load with
 * nothing unsaved) — never left attached "just in case." This is a plain
 * add/remove effect keyed on `isDirty` rather than one listener that reads
 * a ref internally, specifically so it's simple to assert against directly:
 * toggling `isDirty` across renders must add/remove exactly one listener
 * each time, not accumulate duplicates (see `useBeforeUnloadGuard.test.ts`).
 */
export function useBeforeUnloadGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Legacy property still required by some browsers to show the
      // native prompt at all; its value is otherwise ignored.
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
}

export default useBeforeUnloadGuard;
