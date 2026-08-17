import { useEffect, useState } from 'react';

// Matches this repo's existing responsive breakpoint (frontend/src/index.css).
export const NARROW_BREAKPOINT_PX = 1024;

function computeIsNarrow(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < NARROW_BREAKPOINT_PX;
}

/** Tracks whether the viewport is below the three-panel breakpoint, so
 * EditorWorkspace can switch from "all panels side by side" to "one panel
 * at a time via a switcher". Driven by window.innerWidth + a resize
 * listener rather than a CSS media query so it's directly unit-testable. */
export function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(computeIsNarrow);

  useEffect(() => {
    function handleResize() {
      setIsNarrow(computeIsNarrow());
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isNarrow;
}
