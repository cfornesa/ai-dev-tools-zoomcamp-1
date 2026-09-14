import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as sceneConversionApi from '../api/sceneConversion';
import type { SceneConversionRun } from '../api/sceneConversion';
import { useSceneConversion } from './useSceneConversion';

vi.mock('../api/sceneConversion');

const mockedStart = vi.mocked(sceneConversionApi.startSceneConversion);
const mockedGet = vi.mocked(sceneConversionApi.getSceneConversion);
const mockedAdvance = vi.mocked(sceneConversionApi.advanceSceneConversion);
const mockedCancel = vi.mocked(sceneConversionApi.cancelSceneConversion);
const mockedAccept = vi.mocked(sceneConversionApi.acceptSceneConversion);

const CANDIDATE_SCENE = { schemaVersion: 1, documentType: 'scene3d', id: 'scene-1' };

function makeRun(overrides: Partial<SceneConversionRun> = {}): SceneConversionRun {
  return {
    id: 1,
    status: 'running',
    source_project_id: 'p1',
    source_version_id: 1,
    attempts: 0,
    repairs: 0,
    candidate_scene: null,
    unsupported_shape_types: [],
    plan_summary: '',
    validation_summary: '',
    error_reason: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 },
    accepted_project3d_id: null,
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

describe('useSceneConversion', () => {
  it('starts idle with no stored run', async () => {
    const { result } = renderHook(() => useSceneConversion('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    expect(result.current.run).toBeNull();
  });

  it('starts a conversion, advances until awaiting_review, and stores the run id', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance
      .mockResolvedValueOnce(makeRun({ status: 'running', attempts: 1 }))
      .mockResolvedValueOnce(
        makeRun({
          status: 'awaiting_review',
          attempts: 2,
          candidate_scene: CANDIDATE_SCENE,
          unsupported_shape_types: ['line'],
        }),
      );

    const { result } = renderHook(() => useSceneConversion('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));
    expect(result.current.run?.candidate_scene).toEqual(CANDIDATE_SCENE);
    expect(result.current.run?.unsupported_shape_types).toEqual(['line']);
    expect(window.localStorage.getItem('gesture-studio:scene-conversion:p1')).toBe('1');
  });

  it('reconnects to a stored running run on mount without starting a new one', async () => {
    window.localStorage.setItem('gesture-studio:scene-conversion:p1', '42');
    mockedGet.mockResolvedValue(makeRun({ id: 42, status: 'running' }));
    mockedAdvance.mockResolvedValue(
      makeRun({ id: 42, status: 'awaiting_review', candidate_scene: CANDIDATE_SCENE }),
    );

    const { result } = renderHook(() => useSceneConversion('p1'));

    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));
    expect(mockedGet).toHaveBeenCalledWith(42);
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('clears a stored terminal run on reconnect', async () => {
    window.localStorage.setItem('gesture-studio:scene-conversion:p1', '9');
    mockedGet.mockResolvedValue(makeRun({ id: 9, status: 'accepted' }));

    const { result } = renderHook(() => useSceneConversion('p1'));

    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    expect(result.current.run).toBeNull();
    expect(window.localStorage.getItem('gesture-studio:scene-conversion:p1')).toBeNull();
  });

  it('stop cancels the run and clears the stored id', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(makeRun({ status: 'running' }));
    mockedCancel.mockResolvedValue(makeRun({ status: 'cancelled' }));

    const { result } = renderHook(() => useSceneConversion('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.run?.status).toBe('running'));

    await act(async () => {
      await result.current.stop();
    });

    expect(mockedCancel).toHaveBeenCalledWith(1);
    expect(result.current.run?.status).toBe('cancelled');
    expect(window.localStorage.getItem('gesture-studio:scene-conversion:p1')).toBeNull();
  });

  it('accept returns the accepted 3D project id and clears the stored run id', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(
      makeRun({ status: 'awaiting_review', candidate_scene: CANDIDATE_SCENE }),
    );
    mockedAccept.mockResolvedValue(
      makeRun({ status: 'accepted', accepted_project3d_id: 'proj3d-1', accepted_version_id: 5 }),
    );

    const { result } = renderHook(() => useSceneConversion('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.run?.status).toBe('awaiting_review'));

    let accepted: string | null = null;
    await act(async () => {
      accepted = await result.current.accept();
    });

    expect(accepted).toBe('proj3d-1');
    expect(window.localStorage.getItem('gesture-studio:scene-conversion:p1')).toBeNull();
  });

  it('dismiss clears a terminal run back to the entry form', async () => {
    mockedStart.mockResolvedValue(makeRun({ status: 'running' }));
    mockedAdvance.mockResolvedValue(makeRun({ status: 'failed', error_reason: 'timeout' }));

    const { result } = renderHook(() => useSceneConversion('p1'));
    await waitFor(() => expect(result.current.reconnecting).toBe(false));
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.run?.status).toBe('failed'));

    act(() => result.current.dismiss());

    expect(result.current.run).toBeNull();
  });
});
