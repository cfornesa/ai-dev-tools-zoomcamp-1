import type { Page } from '@playwright/test';

/**
 * Issue #113: issue #95 flipped every editor `CollapsibleSection`
 * (`frontend/src/pages/CollapsibleSection.tsx`) to default closed, but no
 * Playwright spec was updated for it, so most scenarios that reach the
 * editor now time out waiting for an element inside a collapsed section
 * (e.g. "Add circle" inside "Add & edit shapes"). Mirrors
 * `frontend/src/testUtils/expandCollapsibleSections.ts`'s role in the
 * Vitest suite: expand every currently-collapsed toggle in one pass rather
 * than naming sections one at a time, so a scenario never has to be
 * updated again just because it starts touching one more panel. Waits for
 * at least one toggle to exist first -- `createBlankProjectViaUI`'s
 * `waitForURL` alone does not guarantee the Tools/Inspector panels have
 * finished their own fetch and mounted yet.
 */
export async function expandAllCollapsibleSections(page: Page): Promise<void> {
  const toggles = page.locator('.editor-collapsible-section-toggle');
  await toggles.first().waitFor({ state: 'visible' });
  const count = await toggles.count();
  for (let i = 0; i < count; i += 1) {
    const toggle = toggles.nth(i);
    // The desktop editor mounts all panel regions at once, while the narrow
    // editor keeps inactive regions mounted but hidden. Only visible toggles
    // can be expanded in the current viewport.
    if (!(await toggle.isVisible())) continue;
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
  }
}

/**
 * Expands exactly one named section (e.g. `'Add & edit shapes'`), leaving
 * every other section's state untouched -- needed wherever
 * `expandAllCollapsibleSections`' one-shot "open everything" isn't safe,
 * e.g. `interactionRuntime.spec.ts`'s "Behaviors" section: it mounts
 * `BehaviorCardsPanel`, whose target `<select>` seeds itself once, at
 * mount, from whatever shapes exist *right then* (issue #116) -- so a
 * scenario that needs a shape added first must open "Add & edit shapes"
 * alone, add the shape, and only then open "Behaviors" (or call
 * `expandAllCollapsibleSections` for the rest). No-ops if already open.
 */
export async function expandSection(page: Page, heading: string): Promise<void> {
  const closed = page.getByRole('button', { name: new RegExp(`^▸ ${heading}$`) });
  const open = page.getByRole('button', { name: new RegExp(`^▾ ${heading}$`) });
  if ((await open.count()) > 0) return; // already open -- no-op
  await closed.waitFor({ state: 'visible' });
  await closed.click();
}
