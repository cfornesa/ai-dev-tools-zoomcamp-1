import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiPreferencesApi from '../api/aiPreferences';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DWorkspace from './Project3DWorkspace';

/**
 * Issue #284: "Ask AI to change this" on a 3D outline row, wired through
 * Project3DWorkspace.tsx into its existing #283 floating AI panel.
 */

vi.mock('../api/projects3d');
vi.mock('../api/aiPreferences');
vi.mock('../api/aiRetryPreference');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);
const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    visibility: 'private',
    title: 'My 3D scene',
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
        objects: [
          {
            id: 'o1',
            type: 'box',
            groupId: null,
            transform: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              opacity: 1,
            },
            material: { color: '#ff0000' },
            visible: true,
            width: 1,
            height: 1,
            depth: 1,
          },
        ],
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
    <MemoryRouter initialEntries={['/projects3d/p1']}>
      <Routes>
        <Route path="/projects3d/:id" element={<Project3DWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchModels.mockResolvedValue([]);
  mockedFetchPersonas.mockResolvedValue([]);
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
});

describe('"Ask AI to change this" wiring (Project3DWorkspace, issue #284)', () => {
  it("seeds the floating AI panel with the clicked row's name/label and switches to Edit mode", async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My 3D scene' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ask AI to change Box 1' }));

    const panel = screen.getByTestId('project3d-ai-improve-panel');
    const editRadio = within(panel).getByRole('radio', { name: 'Edit' });
    expect(editRadio).toHaveAttribute('aria-checked', 'true');
    const promptField = within(panel).getByLabelText(/describe the change/i) as HTMLTextAreaElement;
    expect(promptField.value).toBe('Change Box 1: ');
  });
});
