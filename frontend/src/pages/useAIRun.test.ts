import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiRunsApi from '../api/aiRuns';
import type { AIRun } from '../api/aiRuns';
import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { SceneDocument, SceneVersion } from '../api/projects';
import { useAIRun } from './useAIRun';

vi.mock('../api/aiRuns');
vi.mock('../api/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/projects')>();
  return { ...actual, getSceneVersion: vi.fn() };
});

const mockedStart = vi.mocked(aiRunsApi.startAIRun);
const mockedGet = vi.mocked(aiRunsApi.getAIRun);
const mockedAdvance = vi.mocked(aiRunsApi.advanceAIRun);
const mockedCancel = vi.mocked(aiRunsApi.cancelAIRun);
const mockedAccept = vi.mocked(aiRunsApi.acceptAIRun);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);

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

function makeRun(overrides: Partial<AIRun> = {}): AIRun {
  return {
    id: 1,
    status: 'running',
    target_type: 'project',
    project_id: 'p1',
    project3d_id: null,
    operation: 'create',
    scope: 'whole_scene',
    selected_target_ids: [],
    attempts: 0,
    repairs: 0,
    candidate_scene: null,
    candidate_patch: null,
    change_summary: '',
    plan_summary: '',
    validation_summary: '',
    error_reason: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 },
    accepted_version_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deadline_at: '2026-01-01T00:02:00Z',
    cancelled_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('useAIRun', () => {
  it('starts idle with no stored run', async () => {
    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    expect(result.current.run).toBeNull();
  });

  it('rejects an empty prompt client-side without starting a run', async () => {
    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));

    await act(async () => {
      await result.current.start(null, null);
    });

    expect(result.current.startError?.code).toBe('request_invalid');
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('starts a run, advances until awaiting_review, and stores the run id', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance
      .mockResolvedValueOnce(makeRun({ status: 'running', attempts: 1 }))
      .mockResolvedValueOnce(
        makeRun({
          status: 'awaiting_review',
          attempts: 2,
          candidate_scene: VALID_SCENE,
          change_summary: 'Made a scene.',
        }),
      );

    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    act(() => result.current.setPrompt('a red circle'));

    await act(async () => {
      await result.current.start(null, null);
    });

    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));
    expect(result.current.run?.candidate_scene).toEqual(VALID_SCENE);
    expect(window.localStorage.getItem('gesture-studio:ai-run:p1')).toBe('1');
  });

  it('reconnects to a stored running run on mount without starting a new one', async () => {
    window.localStorage.setItem('gesture-studio:ai-run:p1', '42');
    mockedGet.mockResolvedValue(makeRun({ id: 42, status: 'running' }));
    mockedAdvance.mockResolvedValue(
      makeRun({ id: 42, status: 'awaiting_review', candidate_scene: VALID_SCENE }),
    );

    const { result } = renderHook(() => useAIRun('p1'));

    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));
    expect(mockedGet).toHaveBeenCalledWith(42);
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('reconnects to a stored awaiting_review run without calling advance again', async () => {
    window.localStorage.setItem('gesture-studio:ai-run:p1', '7');
    mockedGet.mockResolvedValue(
      makeRun({ id: 7, status: 'awaiting_review', candidate_scene: VALID_SCENE }),
    );

    const { result } = renderHook(() => useAIRun('p1'));

    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));
    expect(mockedAdvance).not.toHaveBeenCalled();
  });

  it('clears a stored terminal run on reconnect', async () => {
    window.localStorage.setItem('gesture-studio:ai-run:p1', '9');
    mockedGet.mockResolvedValue(makeRun({ id: 9, status: 'accepted' }));

    const { result } = renderHook(() => useAIRun('p1'));

    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    expect(result.current.run).toBeNull();
    expect(window.localStorage.getItem('gesture-studio:ai-run:p1')).toBeNull();
  });

  it('stop cancels the run and clears the stored id', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(makeRun({ status: 'running' }));
    mockedCancel.mockResolvedValue(makeRun({ status: 'cancelled' }));

    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    act(() => result.current.setPrompt('a red circle'));
    await act(async () => {
      await result.current.start(null, null);
    });
    await waitFor(() => expect(result.current.run?.status).toBe('running'));

    await act(async () => {
      await result.current.stop();
    });

    expect(mockedCancel).toHaveBeenCalledWith(1);
    expect(result.current.run?.status).toBe('cancelled');
    expect(window.localStorage.getItem('gesture-studio:ai-run:p1')).toBeNull();
  });

  it('accept fetches the accepted SceneVersion and clears the stored run id', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(
      makeRun({ status: 'awaiting_review', candidate_scene: VALID_SCENE }),
    );
    mockedAccept.mockResolvedValue(
      makeRun({ status: 'accepted', accepted_version_id: 55, candidate_scene: VALID_SCENE }),
    );
    const version: SceneVersion = {
      id: 55,
      sequence: 1,
      origin: 'ai_create',
      change_label: '',
      created_by: 'alice',
      parent: null,
      fork_source_version: null,
      created_at: '2026-01-01T00:00:00Z',
      scene_json: VALID_SCENE,
    };
    mockedGetSceneVersion.mockResolvedValue(version);

    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    act(() => result.current.setPrompt('a red circle'));
    await act(async () => {
      await result.current.start(null, null);
    });
    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));

    let accepted: SceneVersion | null = null;
    await act(async () => {
      accepted = await result.current.accept();
    });

    expect(accepted).toEqual(version);
    expect(mockedGetSceneVersion).toHaveBeenCalledWith('p1', 55);
    expect(window.localStorage.getItem('gesture-studio:ai-run:p1')).toBeNull();
  });

  it('surfaces a stale-base accept failure without a fetched version', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(
      makeRun({ status: 'awaiting_review', candidate_scene: VALID_SCENE }),
    );
    mockedAccept.mockRejectedValue(new ApiError(409, { error: 'stale_base', detail: 'stale' }));

    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    act(() => result.current.setPrompt('a red circle'));
    await act(async () => {
      await result.current.start(null, null);
    });
    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));

    let accepted: SceneVersion | null = null;
    await act(async () => {
      accepted = await result.current.accept();
    });

    expect(accepted).toBeNull();
    expect(result.current.acceptError?.code).toBe('stale_base');
  });

  it('dismiss clears the run and stored id back to idle', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(makeRun({ status: 'failed', error_reason: 'timeout' }));

    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    act(() => result.current.setPrompt('a red circle'));
    await act(async () => {
      await result.current.start(null, null);
    });
    await waitFor(() => expect(result.current.run?.status).toBe('failed'));

    act(() => result.current.dismiss());

    expect(result.current.run).toBeNull();
    expect(window.localStorage.getItem('gesture-studio:ai-run:p1')).toBeNull();
  });

  it('requires a selection when target mode is edit-selection', async () => {
    const { result } = renderHook(() => useAIRun('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    act(() => {
      result.current.setTargetMode('edit-selection');
      result.current.setPrompt('make it blue');
    });

    await act(async () => {
      await result.current.start(VALID_SCENE, 3);
    });

    expect(result.current.startError?.code).toBe('request_invalid');
    expect(mockedStart).not.toHaveBeenCalled();
  });
});
