import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ai3dApi from '../api/ai3d';
import * as aiPreferencesApi from '../api/aiPreferences';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import * as generateHtmlExport3D from '../export/generateHtmlExport3D';
import AiProject3DWorkspace from './AiProject3DWorkspace';

/**
 * Issue #291: "Download standalone bundle" in the AI-assisted 3D editor
 * -- same wiring as #290 (manual editor)'s coverage, adapted for this
 * editor's always-present AIProposalPanel3D/accept flow.
 */

vi.mock('../api/projects3d');
vi.mock('../api/ai3d');
vi.mock('../api/aiPreferences');
vi.mock('../api/aiRetryPreference');
vi.mock('../export/generateHtmlExport3D');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);
const mockedCreateAIScene3D = vi.mocked(ai3dApi.createAIScene3D);
const mockedAcceptAIProposal3D = vi.mocked(ai3dApi.acceptAIProposal3D);
const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);
const mockedGenerateScene3DBundle = vi.mocked(generateHtmlExport3D.generateScene3DBundle);
const mockedTriggerScene3DBundleDownload = vi.mocked(
  generateHtmlExport3D.triggerScene3DBundleDownload,
);

const ORIGINAL_SCENE = {
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
};

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
      scene_json: ORIGINAL_SCENE,
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
  mockedFetchModels.mockResolvedValue([]);
  mockedFetchPersonas.mockResolvedValue([]);
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
});

describe('"Download standalone bundle" (AI-assisted 3D editor, issue #291)', () => {
  it('generates and downloads the bundle for the current scene', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    mockedGenerateScene3DBundle.mockResolvedValue({
      ok: true,
      zipBlob: new Blob(['fake zip']),
      filename: 'my-ai-3d-scene.zip',
    });
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My AI 3D scene' });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('ai-project3d-export-button'));

    await waitFor(() => expect(mockedGenerateScene3DBundle).toHaveBeenCalledTimes(1));
    const [scenePassed, baseName] = mockedGenerateScene3DBundle.mock.calls[0];
    expect(scenePassed).toEqual(ORIGINAL_SCENE);
    expect(baseName).toBe('My AI 3D scene');
    expect(mockedTriggerScene3DBundleDownload).toHaveBeenCalledWith(
      expect.any(Blob),
      'my-ai-3d-scene.zip',
    );
  });

  it('reflects an accepted AI proposal, not the original persisted scene', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    mockedGenerateScene3DBundle.mockResolvedValue({
      ok: true,
      zipBlob: new Blob(['fake zip']),
      filename: 'export.zip',
    });
    const proposedScene = { ...ORIGINAL_SCENE, scene: { backgroundColor: '#123456' } };
    mockedCreateAIScene3D.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: proposedScene,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    mockedAcceptAIProposal3D.mockResolvedValue({
      id: 2,
      sequence: 2,
      origin: 'ai',
      created_by: 'alice',
      created_at: '2026-01-02T00:00:00Z',
      scene_json: proposedScene,
    });
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My AI 3D scene' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/describe the scene/i), 'a bare stage');
    await user.click(screen.getByRole('button', { name: /generate scene/i }));
    await screen.findByTestId('ai-3d-proposal-success');
    await user.click(screen.getByTestId('ai-3d-accept-button'));
    await waitFor(() => expect(mockedAcceptAIProposal3D).toHaveBeenCalledTimes(1));

    await user.click(screen.getByTestId('ai-project3d-export-button'));

    await waitFor(() => expect(mockedGenerateScene3DBundle).toHaveBeenCalledTimes(1));
    const [scenePassed] = mockedGenerateScene3DBundle.mock.calls[0];
    expect(scenePassed).toEqual(proposedScene);
  });

  it('shows the exact validation-failure reasons and never downloads when the bundle can not be generated', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    mockedGenerateScene3DBundle.mockResolvedValue({
      ok: false,
      reasons: ['camera: must have required property fov'],
    });
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My AI 3D scene' });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('ai-project3d-export-button'));

    expect(await screen.findByTestId('ai-project3d-export-error')).toHaveTextContent(
      'camera: must have required property fov',
    );
    expect(mockedTriggerScene3DBundleDownload).not.toHaveBeenCalled();
  });
});
