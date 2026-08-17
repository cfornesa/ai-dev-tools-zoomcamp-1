import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import { ApiError } from '../api/client';
import type { Project, SceneVersion } from '../api/projects';
import { useEditorWorkspaceState } from './useEditorWorkspaceState';

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);

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
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

const BLANK_SCENE = {
  schemaVersion: 1,
  id: 'scene-blank',
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

function baseVersion(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: BLANK_SCENE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEditorWorkspaceState loading', () => {
  it('loads the project and current version into three distinct state slices', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    const { result } = renderHook(() => useEditorWorkspaceState('p1'));

    expect(result.current.loadState).toBe('loading');
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    expect(result.current.project).toEqual(baseProject());
    expect(result.current.persistedVersion).toEqual(baseVersion());
    expect(result.current.workingCopy).toEqual(BLANK_SCENE);
    expect(mockedGetSceneVersion).toHaveBeenCalledWith('p1', 1);
  });

  it('does not fetch a version, and reports no-scene, when current_version is null', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ current_version: null }));

    const { result } = renderHook(() => useEditorWorkspaceState('p1'));

    await waitFor(() => expect(result.current.loadState).toBe('no-scene'));
    expect(mockedGetSceneVersion).not.toHaveBeenCalled();
    expect(result.current.workingCopy).toBeNull();
  });

  it('reports no-scene when the fetched version fails schema validation', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ scene_json: { not: 'a valid scene' } }));

    const { result } = renderHook(() => useEditorWorkspaceState('p1'));

    await waitFor(() => expect(result.current.loadState).toBe('no-scene'));
    expect(result.current.workingCopy).toBeNull();
    expect(result.current.persistedVersion).toBeNull();
  });

  it('reports access-denied on a 401/403 project fetch', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(403, { detail: 'nope' }));

    const { result } = renderHook(() => useEditorWorkspaceState('p1'));

    await waitFor(() => expect(result.current.loadState).toBe('access-denied'));
  });

  it('reports a generic error on any other fetch failure, and retry re-attempts it', async () => {
    mockedGetProject.mockRejectedValueOnce(new Error('network down'));
    mockedGetProject.mockResolvedValueOnce(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    const { result } = renderHook(() => useEditorWorkspaceState('p1'));

    await waitFor(() => expect(result.current.loadState).toBe('error'));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(mockedGetProject).toHaveBeenCalledTimes(2);
  });
});

describe('useEditorWorkspaceState working-copy isolation', () => {
  it('lets the working copy be edited without touching project/version state or firing a mutation', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    const { result } = renderHook(() => useEditorWorkspaceState('p1'));
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    const originalProject = result.current.project;
    const originalVersion = result.current.persistedVersion;

    act(() => {
      result.current.setWorkingCopy((current) => ({
        ...(current as typeof BLANK_SCENE),
        canvas: { ...(current as typeof BLANK_SCENE).canvas, backgroundColor: '#000000' },
      }));
    });

    expect((result.current.workingCopy as typeof BLANK_SCENE).canvas.backgroundColor).toBe(
      '#000000',
    );
    // The persisted slices are untouched, by reference and by value.
    expect(result.current.project).toBe(originalProject);
    expect(result.current.persistedVersion).toBe(originalVersion);
    const persistedScene = result.current.persistedVersion?.scene_json as
      typeof BLANK_SCENE | undefined;
    expect(persistedScene?.canvas.backgroundColor).toBe('#ffffff');

    expect(mockedUpdateProjectMetadata).not.toHaveBeenCalled();
  });
});
