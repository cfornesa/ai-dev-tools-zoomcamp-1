import { expect, type Locator, type Page } from '@playwright/test';

import { createServerProject2D } from './createProject.js';
import { createServerProject3D } from './createProject3d.js';

/** Creates a server-backed structured project and opens its current AI panel. */
export async function createServerProjectAndOpenAIProposalPanel(
  page: Page,
  kind: '2d' | '3d',
): Promise<{ projectId: string; panel: Locator }> {
  const projectId =
    kind === '2d' ? await createServerProject2D(page) : await createServerProject3D(page);
  let panel: Locator;
  if (kind === '2d') {
    // The unified editor exposes its AI action from the always-visible
    // Preview actions. It opens the contextual proposal panel directly,
    // including at narrow widths where the Inspector tab is hidden.
    const trigger = page.getByRole('button', {
      name: 'Ask AI to improve this scene',
      exact: true,
    });
    await expect(trigger).toBeVisible();
    await trigger.click();
    // The AI panel is rendered inside Layers, which is a switchable panel
    // on narrow 2D editor viewports.
    const layersTab = page.getByRole('tab', { name: 'Layers', exact: true });
    if (await layersTab.isVisible()) await layersTab.click();
    panel = page.getByTestId('editor-ai-layer-panel').locator('.ai-proposal-panel');
  } else {
    // In the unified 3D editor the general AI panel is mounted by this action.
    const trigger = page.getByRole('button', {
      name: 'Ask AI to improve this scene',
      exact: true,
    });
    await expect(trigger).toBeVisible();
    await trigger.click();
    panel = page
      .getByRole('region', { name: 'Ask AI to improve this scene' })
      .locator('.ai-proposal-panel');
  }
  await expect(panel).toBeVisible();
  const createAction = panel.getByRole('radiogroup', { name: 'AI action' }).getByRole('radio', {
    name: 'Create',
    exact: true,
  });
  if (await createAction.isVisible()) await createAction.click();
  return { projectId, panel };
}
