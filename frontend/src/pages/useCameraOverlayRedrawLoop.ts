import { useEffect, useRef } from 'react';

/**
 * Issue #192 (production camera regression follow-up): both
 * `EditorWorkspace.tsx` (for a scene with no active behaviors/bindings —
 * `usePreviewRuntime.ts` already drives a continuous redraw loop for the
 * behaviors case) and `PublicProjectViewer.tsx` (which has no runtime loop
 * at all) previously redrew the p5 preview's camera overlay only reactively,
 * on a handful of discrete React state changes (camera activating,
 * opacity/mirror/geometry changing, the scene document changing). Once that
 * one redraw happened, the canvas never updated again for the rest of the
 * session, even though the underlying `<video>` element kept playing a real,
 * live camera feed — the overlay was a single frozen snapshot, not a live
 * feed, and if that one redraw happened to race ahead of the video's first
 * decoded frame (`video.readyState < 2`), `p5Adapter.ts`'s
 * `drawCameraOverlay` silently skipped drawing anything at all, leaving a
 * permanently empty/transparent overlay for the entire camera session. This
 * reproduced live against `animate.creatrweb.com`'s public viewer with a
 * real physical webcam: the `<video>` element was confirmed live (advancing
 * `currentTime`, real non-black frame content), but the rendered `<canvas>`
 * stayed byte-identical across five one-second samples until an unrelated
 * state change (nudging the opacity slider) forced one more redraw.
 *
 * This hook is the fix: while `active` is true, it drives a plain
 * `requestAnimationFrame` loop that calls `redraw()` every frame, so the
 * camera overlay keeps pulling fresh video frames continuously for as long
 * as the camera is active — independent of whether anything else about the
 * scene changed. `redraw` is read through a ref (the same "latest value"
 * pattern `usePreviewRuntime.ts` already uses) so the loop never needs to be
 * torn down and rebuilt just because the caller's closure identity changed
 * on an unrelated re-render; only `active` flipping starts/stops the loop.
 */
export function useCameraOverlayRedrawLoop(active: boolean, redraw: () => void): void {
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    let rafId = 0;

    function tick(): void {
      if (cancelled) return;
      // A defensive try/catch: `redraw` (the caller's render callback)
      // already routes real render failures to its own error state (see
      // `PublicProjectViewer.tsx`/`EditorWorkspace.tsx`'s `redrawPreview`)
      // -- this only guards against this loop itself dying from one bad
      // frame, the same way `usePreviewRuntime.ts`'s frame loop never lets
      // a single tick's failure stop future ticks.
      try {
        redrawRef.current();
      } catch {
        // Intentionally swallowed -- see comment above.
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [active]);
}
