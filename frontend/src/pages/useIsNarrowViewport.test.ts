import { act, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { NARROW_BREAKPOINT_PX, useIsNarrowViewport } from './useIsNarrowViewport';

function setInnerWidth(width: number) {
  window.innerWidth = width;
}

const ORIGINAL_INNER_WIDTH = window.innerWidth;

afterEach(() => {
  setInnerWidth(ORIGINAL_INNER_WIDTH);
});

describe('useIsNarrowViewport', () => {
  it('treats the exact breakpoint width as wide (not narrow)', () => {
    setInnerWidth(NARROW_BREAKPOINT_PX);
    const { result } = renderHook(() => useIsNarrowViewport());
    expect(result.current).toBe(false);
  });

  it('treats one pixel below the breakpoint as narrow', () => {
    setInnerWidth(NARROW_BREAKPOINT_PX - 1);
    const { result } = renderHook(() => useIsNarrowViewport());
    expect(result.current).toBe(true);
  });

  it('updates on resize', () => {
    setInnerWidth(NARROW_BREAKPOINT_PX);
    const { result } = renderHook(() => useIsNarrowViewport());
    expect(result.current).toBe(false);

    act(() => {
      setInnerWidth(NARROW_BREAKPOINT_PX - 1);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
  });
});

describe('editor-workspace CSS/JS breakpoint consistency', () => {
  // Vitest/jsdom does not apply real CSS media queries, so nothing else in
  // the suite exercises actual side-by-side-vs-stacked layout at the
  // viewport boundary. This regression-tests the specific bug QA caught on
  // issue #21: the CSS media query that stacks .editor-workspace's panels
  // used `max-width: 1024px` (includes 1024px) while the JS hook above
  // treats "narrow" as strictly `< 1024`, so at exactly 1024px the panels
  // were rendered side by side per JS but stacked per CSS. Parsing the
  // stylesheet's own max-width value and comparing it against the hook's
  // breakpoint constant catches that class of mismatch even though jsdom
  // can't render the layout itself.
  it('stacks the editor-workspace panels only strictly below the JS narrow-viewport breakpoint', () => {
    const cssPath = join(__dirname, '..', 'index.css');
    const css = readFileSync(cssPath, 'utf-8');

    // Find the media query that immediately governs `.editor-workspace`'s
    // flex-direction (the stacking rule), not any other max-width query in
    // the file.
    const match = css.match(
      /@media \(max-width:\s*(\d+)px\)\s*\{\s*\.editor-workspace\s*\{\s*flex-direction:\s*column/,
    );

    expect(match).not.toBeNull();
    const cssMaxWidth = Number(match?.[1]);

    // The CSS query's max-width must be exactly one pixel below the JS
    // breakpoint: `max-width: (BREAKPOINT - 1)px` is the widest value that
    // still excludes BREAKPOINT itself, matching `innerWidth < BREAKPOINT`.
    expect(cssMaxWidth).toBe(NARROW_BREAKPOINT_PX - 1);
  });
});
