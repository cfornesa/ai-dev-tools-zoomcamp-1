import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Issue #165 (task 133) added a selection-driven `scrollIntoView` effect
 * gated by a pure `isRowFullyVisible` helper, unit-tested directly here.
 *
 * Issue #166 (task 134): live user feedback reported the gated "only
 * scroll when out of view" behavior *still* reads as jarring, so
 * `LayersPanel.tsx` now performs no automatic scrolling on selection at
 * all — the effect and `isRowFullyVisible` were removed outright rather
 * than further tuned. Per this task's acceptance criteria this file is
 * updated (not deleted) to assert the NEW behavior: no such helper is
 * exported any more, and the component's source contains no
 * `scrollIntoView` call — a source-level regression guard against the
 * behavior being silently reintroduced. Behavioral (DOM-level) coverage
 * that selecting a shape never triggers a scroll lives in
 * `EditorWorkspace.layersAutoScroll.test.tsx`, which mounts the full
 * component tree end-to-end.
 */

const layersPanelSource = readFileSync(path.resolve(__dirname, './LayersPanel.tsx'), 'utf-8');

describe('LayersPanel auto-scroll removal (issue #166)', () => {
  it('no longer exports isRowFullyVisible', async () => {
    const module = await import('./LayersPanel');
    expect('isRowFullyVisible' in module).toBe(false);
  });

  it('contains no scrollIntoView call', () => {
    expect(layersPanelSource).not.toContain('scrollIntoView');
  });
});
