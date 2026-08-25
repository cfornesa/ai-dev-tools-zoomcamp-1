import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRowFullyVisible } from './LayersPanel';

/**
 * Issue #165 (task 133): unit tests for `isRowFullyVisible`, the pure
 * helper gating `LayersPanel.tsx`'s selection-driven `scrollIntoView`
 * effect — see that file's "Issue #165" comment for the full decision
 * writeup (option (a): only scroll when the row is genuinely out of the
 * viewport, not unconditionally on every selection change).
 */

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function elementWithRect(r: DOMRect): Element {
  const el = document.createElement('li');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(r);
  return el;
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 800,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isRowFullyVisible', () => {
  it('treats an unlaid-out element (all-zero rect) as visible', () => {
    expect(isRowFullyVisible(elementWithRect(rect(0, 0)))).toBe(true);
  });

  it('is visible when fully within the viewport', () => {
    expect(isRowFullyVisible(elementWithRect(rect(100, 140)))).toBe(true);
  });

  it('is visible when exactly flush with the viewport edges', () => {
    expect(isRowFullyVisible(elementWithRect(rect(0, 800)))).toBe(true);
  });

  it('is not visible when above the viewport (negative top)', () => {
    expect(isRowFullyVisible(elementWithRect(rect(-50, 10)))).toBe(false);
  });

  it('is not visible when below the viewport (bottom past innerHeight)', () => {
    expect(isRowFullyVisible(elementWithRect(rect(790, 850)))).toBe(false);
  });
});
