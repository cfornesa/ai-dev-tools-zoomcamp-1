import { screen, within } from '@testing-library/react';

/**
 * Issue #131: the Tools panel's separate "Shape list" `<ul>` (a duplicate
 * of `LayersPanel.tsx`'s own outline) was removed — the outline's
 * `<ul aria-label="Scene outline">` is now the single place shapes are
 * listed and selected. These helpers give every `EditorWorkspace*.test.tsx`
 * suite that used to query "Shape list" a like-for-like replacement: the
 * outline's rows filtered down to just shape kind, and — since a shape row
 * now carries several buttons (select, color swatch, delete, and, behind
 * its `<details>` disclosure, move up/down) — the one that's actually the
 * *select* button, distinguished by being the only one with `aria-pressed`
 * (the same selection affordance every other outline row's select button
 * carries).
 */
export function shapeOutlineRows(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Scene outline' }))
    .getAllByRole('listitem')
    .filter((row) => row.dataset.outlineKind === 'shape');
}

export function shapeSelectButton(row: HTMLElement): HTMLElement {
  return within(row)
    .getAllByRole('button')
    .find((btn) => btn.hasAttribute('aria-pressed'))!;
}

export function shapeOutlineSelectButtons(): HTMLElement[] {
  return shapeOutlineRows().map(shapeSelectButton);
}
