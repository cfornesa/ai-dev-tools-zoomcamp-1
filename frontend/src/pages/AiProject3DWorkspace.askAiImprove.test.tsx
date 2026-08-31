import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import AiProject3DWorkspace from './AiProject3DWorkspace';

/**
 * Issue #283: the AI-assisted 3D editor already has an always-present
 * `AIProposalPanel3D` (the whole point of this editor), so "Ask AI to
 * improve this scene" simply re-seeds it into Edit mode with a generic
 * prompt rather than mounting a second instance.
 */

vi.mock('../api/projects3d');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My AI 3D scene',
    thumbnail_url: null,
    current_version: {
      id: 1,
      sequence: 1,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: {
        schemaVersion: 1,
        documentType: 'scene3d',
        id: 'scene3d-1',
        scene: { backgroundColor: '#000000' },
        camera: {
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          fov: 50,
          near: 0.1,
          far: 1000,
        },
        lights: [],
        groups: [],
        objects: [],
        randomness: { seed: 0, enabled: false },
      },
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/ai-projects3d/p1']}>
      <Routes>
        <Route path="/ai-projects3d/:id" element={<AiProject3DWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiProject3DWorkspace "Ask AI to improve this scene"', () => {
  it('re-seeds the always-present AIProposalPanel3D into Edit mode with a generic prompt', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My AI 3D scene' });
    const user = userEvent.setup();

    const panel = screen.getByRole('region', { name: 'AI assistant' });
    // Starts in Create mode (the editor's default).
    expect(within(panel).getByRole('radio', { name: 'Create' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Ask AI to improve this scene' }));

    expect(within(panel).getByRole('radio', { name: 'Edit' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const promptField = within(panel).getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toBe('Improve this scene: ');
  });
});
