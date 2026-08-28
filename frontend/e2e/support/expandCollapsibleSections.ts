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
 * finished their own fetch and mounted yet. The editor also has a second
 * disclosure layer: top-level panels contain these nested sections and are
 * themselves closed by default. Open visible top-level panels first so a
 * hidden nested toggle can never become the first locator match.
 */
export async function expandAllCollapsibleSections(page: Page): Promise<void> {
  const topLevelToggles = page.locator('.editor-panel-disclosure-toggle:visible');
  await topLevelToggles.first().waitFor({ state: 'visible' });
  const topLevelCount = await topLevelToggles.count();
  for (let i = 0; i < topLevelCount; i += 1) {
    const toggle = topLevelToggles.nth(i);
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
  }

  const toggles = page.locator('.editor-collapsible-section-toggle:visible');
  const count = await toggles.count();
  for (let i = 0; i < count; i += 1) {
    const toggle = toggles.nth(i);
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
  if ((await open.count()) > 0 && (await open.first().isVisible())) return; // already open -- no-op

  // Behaviors is nested in Inspector. On a fresh editor load that panel can
  // still be closed even though its nested disclosure is mounted in the DOM.
  // Open the known owner explicitly so the nested button becomes visible.
  if (heading === 'Behaviors') {
    const inspectorSection = page.locator('section[data-panel="inspector"]');
    const inspectorTab = page.getByRole('tab', { name: 'Inspector', exact: true });
    if ((await inspectorTab.count()) > 0 && (await inspectorTab.isVisible())) {
      await inspectorTab.click();
    }
    const inspectorToggle = inspectorSection.locator('.editor-panel-disclosure-toggle').first();
    if (
      (await inspectorToggle.count()) > 0 &&
      (await inspectorToggle.getAttribute('aria-expanded')) === 'false'
    ) {
      await inspectorToggle.click({ force: true });
    }
    await closed.first().waitFor({ state: 'visible' });
    await closed.first().click();
    return;
  }

  // The section may live in a closed top-level panel. Resolve that panel
  // directly from the named section instead of relying on a hidden nested
  // locator filter, which is brittle when the panel content is mounted with
  // `hidden` and the nested disclosure has not yet become visible.
  const ownerPanel = page
    .locator('section.editor-panel')
    .filter({ has: closed.or(open) })
    .first();
  const ownerPanelToggle = ownerPanel.locator('.editor-panel-disclosure-toggle').first();
  if (
    (await ownerPanelToggle.count()) > 0 &&
    (await ownerPanelToggle.getAttribute('aria-expanded')) === 'false'
  ) {
    await ownerPanelToggle.click();
  }

  // A named nested section can be mounted inside a closed top-level panel.
  // Reveal that parent using the nested section's panel-content container,
  // then wait for the requested toggle itself to become actionable.
  const panelContent = page
    .locator('.editor-panel-content')
    .filter({ has: closed.or(open) })
    .first();
  if ((await panelContent.count()) > 0 && !(await panelContent.isVisible())) {
    const contentId = await panelContent.getAttribute('id');
    if (contentId) {
      const panelToggle = page.locator(
        `.editor-panel-disclosure-toggle[aria-controls="${contentId}"]`,
      );
      if ((await panelToggle.getAttribute('aria-expanded')) === 'false') {
        await panelToggle.click();
      }
    }
  }

  await closed.first().waitFor({ state: 'visible' });
  await closed.first().click();
}
