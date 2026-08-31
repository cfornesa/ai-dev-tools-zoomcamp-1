import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Issues #287 (2D)/#288 (3D): a shared "Expand piece to fullscreen"
 * toggle using the real browser Fullscreen API
 * (`Element.requestFullscreen()`/`document.exitFullscreen()`) -- this
 * codebase had zero fullscreen code before these issues (confirmed via
 * `grep -rl requestFullscreen frontend/src`).
 *
 * Listens to `fullscreenchange` so `isFullscreen` stays correct even when
 * fullscreen is exited via Escape or the browser's own chrome (not just
 * this hook's own `toggle()` call) -- the exact scenario #287's own
 * acceptance criteria calls out.
 */
export function useFullscreenToggle<T extends HTMLElement>(elementRef: RefObject<T | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const elementRefLive = useRef(elementRef);
  elementRefLive.current = elementRef;

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === elementRefLive.current.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await elementRef.current?.requestFullscreen();
  }

  return { isFullscreen, toggleFullscreen };
}
