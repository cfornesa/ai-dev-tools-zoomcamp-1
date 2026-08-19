import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';

import Layout from '../components/Layout';
import DraftRecoveryPrompt from './DraftRecoveryPrompt';
import type { RecoveryCandidate } from './useDraftRecovery';

/**
 * Task 63 (issue #63): automated accessibility checks for the crash-
 * recovery prompt (Task 44). `EditorWorkspace.a11y.test.tsx` (issue #64)
 * already covers this component's rendering inside the full workspace;
 * this file adds a direct, standalone check plus the discarding-in-progress
 * state that's easier to reach when not going through the whole workspace.
 */

const CANDIDATE: RecoveryCandidate = {
  source: 'local',
  sceneJson: {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  },
  savedAt: '2026-01-01T00:00:00Z',
  changeSummary: 'Added 1 shape.',
};

function renderPrompt(onDiscard = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            path="projects/:id"
            element={
              <DraftRecoveryPrompt
                candidate={CANDIDATE}
                onRecover={vi.fn()}
                onDiscard={onDiscard}
                onCancel={vi.fn()}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('DraftRecoveryPrompt accessibility', () => {
  it('has no axe violations in the default state', async () => {
    const { container } = renderPrompt();
    await screen.findByRole('alertdialog');
    expect(await axe(container)).toHaveNoViolations();
  });

  // Task 63 (issue #63): this dialog fully replaces the page's rendered
  // content while shown (see this component's own docstring), so its own
  // heading is the first one after `Layout.tsx`'s page-level `<h1>` -- an
  // `<h4>` here (the pre-fix level) skipped two heading levels, a real
  // `heading-order` defect axe alone did not catch until this scenario was
  // added (a single h1+h4 pair with no headings in between does not always
  // trip axe's rule the same way a populated document does, so this is
  // asserted directly rather than relying on the axe check above alone).
  it('uses an <h2>, not an <h4>, for its own title', async () => {
    renderPrompt();
    const heading = await screen.findByRole('heading', { name: /recover unsaved work/i });
    expect(heading.tagName).toBe('H2');
  });

  it('has no axe violations while discarding is in progress', async () => {
    let resolveDiscard: () => void = () => {};
    const onDiscard = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDiscard = resolve;
        }),
    );
    const user = userEvent.setup();
    const { container } = renderPrompt(onDiscard);

    await user.click(screen.getByRole('button', { name: /discard draft/i }));
    await screen.findByText(/discarding/i);

    expect(await axe(container)).toHaveNoViolations();
    resolveDiscard();
  });
});
