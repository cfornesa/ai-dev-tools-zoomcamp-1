import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as ai3dApi from '../api/ai3d';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import { ApiError } from '../api/client';
import type { SceneDocument3D } from '../api/projects3d';
import { useAIProposal3D } from './useAIProposal3D';

vi.mock('../api/ai3d');
vi.mock('../api/aiRetryPreference');

const mockedCreateAIScene3D = vi.mocked(ai3dApi.createAIScene3D);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);

const MINIMAL_SCENE_3D: SceneDocument3D = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene-1',
  scene: {},
  camera: {},
  lights: [],
  groups: [],
  objects: [],
  randomness: { seed: 0, enabled: false },
};

function createResponse(): ai3dApi.AICreateScene3DResponse {
  return {
    draft: true,
    operation: 'create_scene3d',
    scene: MINIMAL_SCENE_3D,
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
});

// Issue #266 (3D counterpart of useAIProposal.test.ts's own coverage):
// configurable automated retry for retry-worthy failures, with the
// attempt count made visible either way.
describe('useAIProposal3D auto-retry (#266)', () => {
  it('auto-retries a retryable failure until it succeeds, when enabled', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 3 });
    mockedCreateAIScene3D
      .mockRejectedValueOnce(new ApiError(502, { error: 'provider_failure', detail: 'down' }))
      .mockResolvedValueOnce(createResponse());

    const { result } = renderHook(() => useAIProposal3D('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene3D).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('success');
    expect(result.current.attemptCount).toBe(2);
  });

  it('stops auto-retrying once max_retries is exhausted and surfaces the error', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 2 });
    mockedCreateAIScene3D.mockRejectedValue(
      new ApiError(504, { error: 'timeout', detail: 'timed out' }),
    );

    const { result } = renderHook(() => useAIProposal3D('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene3D).toHaveBeenCalledTimes(3);
    expect(result.current.phase).toBe('provider-error');
    expect(result.current.attemptCount).toBe(3);
  });

  it('never auto-retries a non-retryable failure, even when enabled', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 3 });
    mockedCreateAIScene3D.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );

    const { result } = renderHook(() => useAIProposal3D('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene3D).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('quota-error');
    expect(result.current.attemptCount).toBe(1);
    expect(result.current.canRetryGeneration).toBe(false);
  });

  it('with auto-retry off, a retryable failure never retries silently but can be retried explicitly', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
    mockedCreateAIScene3D
      .mockRejectedValueOnce(new ApiError(502, { error: 'provider_failure', detail: 'down' }))
      .mockResolvedValueOnce(createResponse());

    const { result } = renderHook(() => useAIProposal3D('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene3D).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('provider-error');
    expect(result.current.attemptCount).toBe(1);
    expect(result.current.canRetryGeneration).toBe(true);

    await act(async () => {
      result.current.retryGeneration(null, null);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.phase).toBe('success'));
    expect(mockedCreateAIScene3D).toHaveBeenCalledTimes(2);
    expect(result.current.attemptCount).toBe(2);
  });
});
