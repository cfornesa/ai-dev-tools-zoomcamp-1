import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MOBILE_HEADER_BREAKPOINT_PX, useIsMobileHeader } from './useIsMobileHeader';

function setInnerWidth(width: number) {
  window.innerWidth = width;
}

const ORIGINAL_INNER_WIDTH = window.innerWidth;

afterEach(() => {
  setInnerWidth(ORIGINAL_INNER_WIDTH);
});

describe('useIsMobileHeader', () => {
  it('treats the exact breakpoint width as desktop (not mobile)', () => {
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX);
    const { result } = renderHook(() => useIsMobileHeader());
    expect(result.current).toBe(false);
  });

  it('treats one pixel below the breakpoint as mobile', () => {
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX - 1);
    const { result } = renderHook(() => useIsMobileHeader());
    expect(result.current).toBe(true);
  });

  it('updates on resize', () => {
    setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX);
    const { result } = renderHook(() => useIsMobileHeader());
    expect(result.current).toBe(false);

    act(() => {
      setInnerWidth(MOBILE_HEADER_BREAKPOINT_PX - 1);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
  });
});
