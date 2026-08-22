import { useEffect, useState } from 'react';

// Issue #90: the header needs to collapse into a hamburger menu earlier than
// the rest of the app's panels/margins do (`index.css`'s existing
// `@media (max-width: 600px)` convention) because the header alone packs a
// heading, primary nav, auth actions, and the reduced-motion control into one
// row — that combination gets cramped well above 600px. 768px is the
// standard mobile/tablet boundary and is kept distinct from the 600px
// breakpoint used elsewhere in `index.css`, which still governs unrelated
// panel spacing.
export const MOBILE_HEADER_BREAKPOINT_PX = 768;

function computeIsMobileHeader(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_HEADER_BREAKPOINT_PX;
}

/** Tracks whether the header should show its collapsed hamburger menu
 * instead of the inline nav/auth actions. Driven by window.innerWidth + a
 * resize listener (matching `pages/useIsNarrowViewport.ts`'s pattern) rather
 * than a CSS media query so it's directly unit-testable. */
export function useIsMobileHeader(): boolean {
  const [isMobileHeader, setIsMobileHeader] = useState(computeIsMobileHeader);

  useEffect(() => {
    function handleResize() {
      setIsMobileHeader(computeIsMobileHeader());
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobileHeader;
}
