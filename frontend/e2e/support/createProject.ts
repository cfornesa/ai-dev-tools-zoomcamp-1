import type { Page } from '@playwright/test';

/**
 * Creates a blank 2D project through the Gallery's "More creation options"
 * menu and waits for the resulting canonical `/users/@handle/edit/:slug`
 * route, returning the project's real id (not the slug).
 *
 * Issue #268 replaced the single "Create a new animation" menu item with
 * renderer-specific 2D actions ("Create a new 2D project with p5.js" /
 * "...with Canvas2D" / "...with SVG") plus "Create a new 3D project".
 * Scenarios that only need an empty 2D canvas and don't care which renderer
 * backs it use the p5.js action here so every spec creates a project the
 * same way instead of each re-deriving (and drifting from) the current
 * menu item text.
 *
 * `createNewAnimation` (`galleryCreateActions.ts`) now navigates straight to
 * `project.editor_url`, the canonical slug-based route -- `/projects/:id`
 * (`LegacyStructuredEditorRedirect`) is never hit by this flow anymore, and
 * the slug in the URL isn't the project's real id. `CanonicalArtPieceEditor`
 * resolves that slug via `GET /api/users/@:handle/edit/:slug/`
 * (`fetchOwnerArtPiece`) right after mounting, so this helper reads the
 * project id out of that same response instead of the URL. Issue #746
 * centralized this after CI broke on the removed "Create a new animation"
 * label and this canonical-route drift.
 */
export async function createBlankProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        /\/api\/users\/@[^/]+\/edit\/[^/]+\/$/.test(new URL(res.url()).pathname),
    ),
    page.getByRole('menuitem', { name: 'Create a new 2D project with p5.js' }).click(),
  ]);
  await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
  const body = (await response.json()) as { piece?: { id?: string } };
  const id = body.piece?.id;
  if (!id) throw new Error(`Could not extract a project id from ${response.url()}`);
  return id;
}
