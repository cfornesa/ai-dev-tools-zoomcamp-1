import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneDocument, SceneVersionSummary } from '../api/projects';
import Layout from '../components/Layout';
import VersionHistoryPanel from './VersionHistoryPanel';

/**
 * Task 63 (issue #63): automated accessibility checks for the save/version
 * history panel, standalone (rather than through the whole
 * `EditorWorkspace`, which Task 62/issue #64's `EditorWorkspace.a11y.test.tsx`
 * already covers) — the working/saved status, the history list, and the
 * delete-confirmation alertdialog (already fixed with `useAlertDialogFocus`
 * by issue #64; this file only checks static ARIA structure).
 */

vi.mock('../api/projects');

const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);

const BASE_SCENE: SceneDocument = {
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
};

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    thumbnail_choice: 'auto',
    export_attribution: false,
    current_version: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function summary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPanel() {
  // A bare `<h3>` ancestor, matching the real app's nesting: in
  // `EditorWorkspace.tsx` this panel is always rendered under a section
  // `<h3>` (e.g. "Inspector") — this panel's own top-level heading is an
  // `<h4>`, valid only with that ancestor present. Without it here, axe's
  // `heading-order` rule would flag a jump from the implicit level-1 root
  // straight to `<h4>`, which is a standalone-test artifact, not a defect
  // that occurs in the real, always-nested render.
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            path="projects/:id"
            element={
              <>
                <h2>My animation</h2>
                <h3>Save section</h3>
                <VersionHistoryPanel
                  projectId="p1"
                  project={baseProject()}
                  persistedVersion={{ ...summary({ id: 2, sequence: 2 }), scene_json: BASE_SCENE }}
                  workingCopy={BASE_SCENE}
                  isDirty={false}
                  onSaved={vi.fn()}
                  onRestored={vi.fn()}
                />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VersionHistoryPanel accessibility', () => {
  it('has no axe violations with a populated history list', async () => {
    mockedListSceneVersions.mockResolvedValue([
      summary({ id: 1, sequence: 1 }),
      summary({ id: 2, sequence: 2, origin: 'ai_edit' }),
    ]);
    const { container } = renderPanel();
    await screen.findByText('Version 2');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the delete-confirmation alertdialog open', async () => {
    mockedListSceneVersions.mockResolvedValue([
      summary({ id: 1, sequence: 1 }),
      summary({ id: 2, sequence: 2 }),
    ]);
    const user = userEvent.setup();
    const { container } = renderPanel();
    await screen.findByText('Version 1');

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
    await user.click(deleteButtons[0]);
    await screen.findByRole('alertdialog');

    expect(await axe(container)).toHaveNoViolations();
  });
});
