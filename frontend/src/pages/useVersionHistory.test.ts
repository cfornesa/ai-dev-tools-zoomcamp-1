import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import { ApiError } from '../api/client';
import type { SceneDocument, SceneVersion, SceneVersionSummary } from '../api/projects';
import { useVersionHistory } from './useVersionHistory';

vi.mock('../api/projects');

const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedSaveSceneVersion = vi.mocked(projectsApi.saveSceneVersion);
const mockedRestoreSceneVersion = vi.mocked(projectsApi.restoreSceneVersion);
const mockedDeleteSceneVersion = vi.mocked(projectsApi.deleteSceneVersion);

const VALID_SCENE: SceneDocument = {
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

function version(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return { ...summary(), scene_json: VALID_SCENE, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useVersionHistory loading', () => {
  it('loads history on mount and exposes it once ready', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);

    const { result } = renderHook(() => useVersionHistory('p1', true));

    expect(result.current.historyLoadState).toBe('loading');
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));
    expect(result.current.versions).toEqual([summary()]);
  });

  it('reports an auth error and preserves nothing to lose on a 404 (non-owner/expired session)', async () => {
    mockedListSceneVersions.mockRejectedValue(new ApiError(404, null));

    const { result } = renderHook(() => useVersionHistory('p1', true));

    await waitFor(() => expect(result.current.historyLoadState).toBe('error'));
    expect(result.current.historyError?.kind).toBe('auth');
    expect(result.current.historyError?.message).toMatch(/sign in again/i);
  });

  it('reports a generic server error on an unexpected failure, and retry re-attempts it', async () => {
    mockedListSceneVersions.mockRejectedValueOnce(new Error('network down'));
    mockedListSceneVersions.mockResolvedValueOnce([summary()]);

    const { result } = renderHook(() => useVersionHistory('p1', true));

    await waitFor(() => expect(result.current.historyLoadState).toBe('error'));
    expect(result.current.historyError?.kind).toBe('server');

    act(() => result.current.reloadHistory());

    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));
    expect(result.current.versions).toEqual([summary()]);
  });

  it('does not fetch when disabled (editor not ready yet)', () => {
    renderHook(() => useVersionHistory('p1', false));
    expect(mockedListSceneVersions).not.toHaveBeenCalled();
  });
});

describe('useVersionHistory save', () => {
  it('creates exactly one new version for a valid scene and identifies it', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);
    const saved = version({ id: 2, sequence: 2, change_label: 'Added a circle' });
    mockedSaveSceneVersion.mockResolvedValue(saved);

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    let outcome: SceneVersion | null = null;
    await act(async () => {
      outcome = await result.current.save(VALID_SCENE, 'manual', 'Added a circle');
    });

    expect(mockedSaveSceneVersion).toHaveBeenCalledTimes(1);
    expect(mockedSaveSceneVersion).toHaveBeenCalledWith('p1', {
      scene_json: VALID_SCENE,
      origin: 'manual',
      change_label: 'Added a circle',
    });
    expect(outcome).toEqual(saved);
    expect(result.current.saveState.error).toBeNull();
    // The new version is folded into the history list without a refetch.
    expect(result.current.versions.map((v) => v.id)).toContain(2);
  });

  it('rejects an invalid scene client-side without ever calling the API, and reports a validation error', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    let outcome: SceneVersion | null = version();
    await act(async () => {
      outcome = await result.current.save({ not: 'a valid scene' }, 'manual', '');
    });

    expect(outcome).toBeNull();
    expect(mockedSaveSceneVersion).not.toHaveBeenCalled();
    expect(result.current.saveState.error?.kind).toBe('validation');
  });

  it('surfaces the server-side validation-failure shape without creating a version', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);
    mockedSaveSceneVersion.mockRejectedValue(
      new ApiError(400, {
        errors: [{ path: '$.shapes[0]', rule: 'unsupportedType', message: 'Unknown shape type.' }],
      }),
    );

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    let outcome: SceneVersion | null = version();
    await act(async () => {
      outcome = await result.current.save(VALID_SCENE, 'manual', '');
    });

    expect(outcome).toBeNull();
    expect(result.current.saveState.error).toEqual({
      kind: 'validation',
      message: expect.stringMatching(/failed validation/i),
      details: [{ path: '$.shapes[0]', rule: 'unsupportedType', message: 'Unknown shape type.' }],
    });
    // No optimistic/partial entry was added to history for the failed save.
    expect(result.current.versions).toEqual([summary()]);
  });

  it('reports an auth error on a 403/404 save response', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);
    mockedSaveSceneVersion.mockRejectedValue(new ApiError(404, null));

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    await act(async () => {
      await result.current.save(VALID_SCENE, 'manual', '');
    });

    expect(result.current.saveState.error?.kind).toBe('auth');
  });

  it('reports a generic server error for anything else (e.g. a 500)', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);
    mockedSaveSceneVersion.mockRejectedValue(new ApiError(500, { detail: 'boom' }));

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    await act(async () => {
      await result.current.save(VALID_SCENE, 'manual', '');
    });

    expect(result.current.saveState.error?.kind).toBe('server');
  });
});

describe('useVersionHistory restore', () => {
  it('creates a new latest version from the source without mutating the source object', async () => {
    const source = summary({ id: 1, sequence: 1 });
    mockedListSceneVersions.mockResolvedValue([source]);
    const restored = version({ id: 3, sequence: 3, origin: 'restore', parent: 1 });
    mockedRestoreSceneVersion.mockResolvedValue(restored);

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    const sourceSnapshot = JSON.stringify(source);

    let outcome: SceneVersion | null = null;
    await act(async () => {
      outcome = await result.current.restore(1);
    });

    expect(mockedRestoreSceneVersion).toHaveBeenCalledWith('p1', 1);
    expect(outcome).toEqual(restored);
    // The original source object this hook already held is untouched —
    // restoring never mutates historical data in place.
    expect(JSON.stringify(source)).toBe(sourceSnapshot);
    expect(result.current.versions.map((v) => v.id)).toEqual([1, 3]);
  });

  it('reports a conflict error when restoring the current version (backend-enforced, and mirrors the disabled UI control)', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);
    mockedRestoreSceneVersion.mockRejectedValue(
      new ApiError(400, { detail: 'The current version cannot be restored.' }),
    );

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    await act(async () => {
      await result.current.restore(1);
    });

    expect(result.current.restoreState.error?.kind).toBe('conflict');
  });
});

describe('useVersionHistory soft-delete', () => {
  it('removes an eligible version from the list on success', async () => {
    mockedListSceneVersions.mockResolvedValue([
      summary({ id: 1 }),
      summary({ id: 2, sequence: 2 }),
    ]);
    mockedDeleteSceneVersion.mockResolvedValue(undefined);

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    let outcome = false;
    await act(async () => {
      outcome = await result.current.remove(1);
    });

    expect(mockedDeleteSceneVersion).toHaveBeenCalledWith('p1', 1);
    expect(outcome).toBe(true);
    expect(result.current.versions.map((v) => v.id)).toEqual([2]);
  });

  it('reports a conflict error when deleting the current version', async () => {
    mockedListSceneVersions.mockResolvedValue([summary()]);
    mockedDeleteSceneVersion.mockRejectedValue(
      new ApiError(400, { detail: 'The current version cannot be soft-deleted.' }),
    );

    const { result } = renderHook(() => useVersionHistory('p1', true));
    await waitFor(() => expect(result.current.historyLoadState).toBe('ready'));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.remove(1);
    });

    expect(outcome).toBe(false);
    expect(result.current.deleteState.error?.kind).toBe('conflict');
    // Nothing was removed from the list on failure.
    expect(result.current.versions).toEqual([summary()]);
  });
});
