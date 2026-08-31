import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiApi from '../api/ai';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import { ApiError } from '../api/client';
import type { SceneDocument, SceneVersion } from '../api/projects';
import { useAIProposal } from './useAIProposal';

vi.mock('../api/ai');
vi.mock('../api/aiRetryPreference');

const mockedCreateAIScene = vi.mocked(aiApi.createAIScene);
const mockedEditAIScene = vi.mocked(aiApi.editAIScene);
const mockedAcceptAIProposal = vi.mocked(aiApi.acceptAIProposal);
const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);

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

function makeVersion(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 5,
    sequence: 2,
    origin: 'ai_create',
    change_label: '',
    created_by: 'alice',
    parent: 1,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: VALID_SCENE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
});

describe('useAIProposal generation phases', () => {
  it('starts in the prompt state', () => {
    const { result } = renderHook(() => useAIProposal('p1'));
    expect(result.current.phase).toBe('prompt');
    expect(result.current.proposal).toBeNull();
  });

  it('rejects an empty prompt client-side without calling the API', async () => {
    const { result } = renderHook(() => useAIProposal('p1'));

    await act(async () => {
      await result.current.generate(VALID_SCENE, null);
    });

    expect(result.current.phase).toBe('validation-error');
    expect(mockedCreateAIScene).not.toHaveBeenCalled();
  });

  it('goes pending then success for a create proposal, carrying the base version id', async () => {
    let resolvePromise: (value: aiApi.AICreateSceneResponse) => void = () => {};
    mockedCreateAIScene.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setPrompt('make a red circle'));

    let generatePromise: Promise<void>;
    act(() => {
      generatePromise = result.current.generate(null, 7);
    });

    await waitFor(() => expect(result.current.phase).toBe('pending'));

    await act(async () => {
      resolvePromise({
        draft: true,
        operation: 'create_scene',
        scene: VALID_SCENE,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });
      await generatePromise;
    });

    expect(result.current.phase).toBe('success');
    expect(result.current.proposal?.mode).toBe('create');
    expect(result.current.proposal?.scene).toEqual(VALID_SCENE);
    expect(result.current.proposal?.baseVersionId).toBe(7);
    expect(result.current.proposal?.clientRequestId).toMatch(/[0-9a-f-]{36}/);
  });

  it('classifies a quota error distinctly from a validation error', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(result.current.phase).toBe('quota-error');
    expect(result.current.genError?.message).toMatch(/daily limit/i);
  });

  it('classifies a provider failure distinctly', async () => {
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(502, { error: 'provider_failure', detail: 'Mistral is down.' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(result.current.phase).toBe('provider-error');
  });

  it('uses editAIScene for edit mode, sending the current working scene and base version', async () => {
    mockedEditAIScene.mockResolvedValue({
      draft: true,
      operation: 'edit_scene',
      patch: [{ op: 'replace', path: '/canvas/backgroundColor', value: '#000000' }],
      scene: {
        ...VALID_SCENE,
        canvas: { ...(VALID_SCENE.canvas as Record<string, unknown>), backgroundColor: '#000000' },
      },
      change_summary: '1 change: 1 canvas property updated.',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('make it black'));

    await act(async () => {
      await result.current.generate(VALID_SCENE, 3);
    });

    expect(mockedEditAIScene).toHaveBeenCalledWith(
      'p1',
      'make it black',
      VALID_SCENE,
      3,
      expect.anything(),
      undefined,
      undefined,
    );
    expect(result.current.phase).toBe('success');
    expect(result.current.proposal?.summary).toBe('1 change: 1 canvas property updated.');
  });

  it('goes pending while editAIScene is in flight, before resolving', async () => {
    let resolvePromise: (value: aiApi.AIEditSceneResponse) => void = () => {};
    mockedEditAIScene.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('make it black'));

    let generatePromise: Promise<void>;
    act(() => {
      generatePromise = result.current.generate(VALID_SCENE, 3);
    });

    await waitFor(() => expect(result.current.phase).toBe('pending'));
    expect(result.current.proposal).toBeNull();

    await act(async () => {
      resolvePromise({
        draft: true,
        operation: 'edit_scene',
        patch: [{ op: 'replace', path: '/canvas/backgroundColor', value: '#000000' }],
        scene: {
          ...VALID_SCENE,
          canvas: {
            ...(VALID_SCENE.canvas as Record<string, unknown>),
            backgroundColor: '#000000',
          },
        },
        change_summary: '1 change: 1 canvas property updated.',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });
      await generatePromise;
    });

    expect(result.current.phase).toBe('success');
  });

  it('classifies a quota error distinctly from a validation error for edit mode', async () => {
    mockedEditAIScene.mockRejectedValue(
      new ApiError(429, { error: 'provider_quota_exceeded', detail: 'Provider quota reached.' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('make it black'));

    await act(async () => {
      await result.current.generate(VALID_SCENE, 3);
    });

    expect(result.current.phase).toBe('quota-error');
    expect(result.current.genError?.message).toMatch(/provider quota reached/i);
  });

  it('classifies a provider failure distinctly for edit mode', async () => {
    mockedEditAIScene.mockRejectedValue(
      new ApiError(502, { error: 'provider_failure', detail: 'Mistral is down.' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('make it black'));

    await act(async () => {
      await result.current.generate(VALID_SCENE, 3);
    });

    expect(result.current.phase).toBe('provider-error');
    expect(result.current.genError?.message).toMatch(/mistral is down/i);
  });

  it('classifies an edit-specific patch rejection (e.g. protected_field) as a provider error', async () => {
    mockedEditAIScene.mockRejectedValue(
      new ApiError(422, { error: 'protected_field', detail: 'Patch touched a protected field.' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('rename the scene id'));

    await act(async () => {
      await result.current.generate(VALID_SCENE, 3);
    });

    expect(result.current.phase).toBe('provider-error');
    expect(result.current.genError?.message).toMatch(/protected field/i);
  });

  it('classifies an unreferenced-element patch rejection (issue #158) as a distinct validation error', async () => {
    mockedEditAIScene.mockRejectedValue(
      new ApiError(422, {
        error: 'unreferenced_element',
        detail:
          "path '/shapes/2' touches an existing shapes element ('Circle 3') the prompt text doesn't appear to reference.",
      }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('make the sun bigger'));

    await act(async () => {
      await result.current.generate(VALID_SCENE, 3);
    });

    expect(result.current.phase).toBe('validation-error');
    expect(result.current.genError?.code).toBe('unreferenced_element');
    expect(result.current.genError?.message).toMatch(/circle 3/i);
  });

  it('rejects edit mode with no working scene without calling the API', async () => {
    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setMode('edit'));
    act(() => result.current.setPrompt('make it black'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(result.current.phase).toBe('validation-error');
    expect(mockedEditAIScene).not.toHaveBeenCalled();
  });
});

describe('useAIProposal accept/reject', () => {
  async function primeSuccessfulProposal() {
    mockedCreateAIScene.mockResolvedValue({
      draft: true,
      operation: 'create_scene',
      scene: VALID_SCENE,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const hook = renderHook(() => useAIProposal('p1'));
    act(() => hook.result.current.setPrompt('a scene'));
    await act(async () => {
      await hook.result.current.generate(null, null);
    });
    return hook;
  }

  it('accept calls the API with the proposal scene, base version, and a stable client_request_id, then resets to prompt', async () => {
    const { result } = await primeSuccessfulProposal();
    const acceptedVersion = makeVersion();
    mockedAcceptAIProposal.mockResolvedValue(acceptedVersion);

    const clientRequestId = result.current.proposal?.clientRequestId;

    let outcome: SceneVersion | null = null;
    await act(async () => {
      outcome = await result.current.accept();
    });

    expect(mockedAcceptAIProposal).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        operation: 'ai_create',
        scene_json: VALID_SCENE,
        base_version_id: null,
        client_request_id: clientRequestId,
      }),
      expect.anything(),
    );
    expect(outcome).toEqual(acceptedVersion);
    expect(result.current.phase).toBe('prompt');
    expect(result.current.proposal).toBeNull();
  });

  it('reject discards the proposal without calling the API', async () => {
    const { result } = await primeSuccessfulProposal();

    act(() => result.current.reject());

    expect(result.current.phase).toBe('prompt');
    expect(result.current.proposal).toBeNull();
    expect(mockedAcceptAIProposal).not.toHaveBeenCalled();
  });

  it('classifies a 409 accept response as a distinct stale-base error', async () => {
    const { result } = await primeSuccessfulProposal();
    mockedAcceptAIProposal.mockRejectedValue(
      new ApiError(409, { error: 'stale_base', detail: 'current_version has moved.' }),
    );

    await act(async () => {
      await result.current.accept();
    });

    expect(result.current.acceptState.error?.kind).toBe('stale-base');
    // The proposal is left intact so the user can decide what to do next.
    expect(result.current.proposal).not.toBeNull();
  });

  it('guards against a repeated/double-click Accept: only one request is sent', async () => {
    const { result } = await primeSuccessfulProposal();
    let resolveAccept: (value: SceneVersion) => void = () => {};
    mockedAcceptAIProposal.mockReturnValue(
      new Promise((resolve) => {
        resolveAccept = resolve;
      }),
    );

    let firstCall: Promise<SceneVersion | null>;
    let secondCall: Promise<SceneVersion | null>;
    act(() => {
      firstCall = result.current.accept();
      secondCall = result.current.accept();
    });

    await act(async () => {
      resolveAccept(makeVersion());
      await Promise.all([firstCall, secondCall]);
    });

    expect(mockedAcceptAIProposal).toHaveBeenCalledTimes(1);
  });

  it('ignores an accept response that resolves after unmount', async () => {
    const { result, unmount } = await primeSuccessfulProposal();
    let resolveAccept: (value: SceneVersion) => void = () => {};
    mockedAcceptAIProposal.mockReturnValue(
      new Promise((resolve) => {
        resolveAccept = resolve;
      }),
    );

    let acceptPromise: Promise<SceneVersion | null>;
    act(() => {
      acceptPromise = result.current.accept();
    });
    unmount();

    let outcome: SceneVersion | null = makeVersion();
    await act(async () => {
      resolveAccept(makeVersion());
      outcome = await acceptPromise;
    });

    // The stale post-unmount response must not be applied to any state
    // (nothing to assert on `result.current` post-unmount, but the
    // resolved value being ignored/null proves the guard fired).
    expect(outcome).toBeNull();
  });
});

describe('useAIProposal cancellation', () => {
  it('cancelGeneration aborts the in-flight request and returns to prompt without an error', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockedCreateAIScene.mockImplementation(
      (_projectId, _prompt, signal) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          signal?.addEventListener('abort', () => {
            const err = new DOMException('aborted', 'AbortError');
            reject(err);
          });
        }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setPrompt('a scene'));

    act(() => {
      void result.current.generate(null, null);
    });
    await waitFor(() => expect(result.current.phase).toBe('pending'));

    await act(async () => {
      result.current.cancelGeneration();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.phase).toBe('prompt');
    expect(result.current.genError).toBeNull();
  });

  it('a newer generate() call supersedes and ignores a slower prior response', async () => {
    const responses: Array<{
      resolve: (value: aiApi.AICreateSceneResponse) => void;
    }> = [];
    mockedCreateAIScene.mockImplementation(
      () =>
        new Promise((resolve) => {
          responses.push({ resolve });
        }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    act(() => result.current.setPrompt('first'));
    act(() => {
      void result.current.generate(null, null);
    });
    await waitFor(() => expect(mockedCreateAIScene).toHaveBeenCalledTimes(1));

    act(() => result.current.setPrompt('second'));
    act(() => {
      void result.current.generate(null, null);
    });
    await waitFor(() => expect(mockedCreateAIScene).toHaveBeenCalledTimes(2));

    // The first (now superseded) request resolves late.
    await act(async () => {
      responses[0].resolve({
        draft: true,
        operation: 'create_scene',
        scene: { ...VALID_SCENE, id: 'from-first-stale-response' },
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });
      await Promise.resolve();
    });

    // Still pending on the second (real, current) request — the stale
    // first response must not have applied its scene.
    expect(result.current.phase).toBe('pending');

    await act(async () => {
      responses[1].resolve({
        draft: true,
        operation: 'create_scene',
        scene: { ...VALID_SCENE, id: 'from-second-live-response' },
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });
      await Promise.resolve();
    });

    expect(result.current.phase).toBe('success');
    expect(result.current.proposal?.scene.id).toBe('from-second-live-response');
  });
});

// Issue #266: configurable automated retry for retry-worthy failures
// (invalid_structured_output, timeout, provider_failure), with the
// attempt count made visible either way.
describe('useAIProposal auto-retry (#266)', () => {
  it('auto-retries a retryable failure until it succeeds, when enabled', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 3 });
    mockedCreateAIScene
      .mockRejectedValueOnce(new ApiError(502, { error: 'provider_failure', detail: 'down' }))
      .mockResolvedValueOnce({
        draft: true,
        operation: 'create_scene',
        scene: VALID_SCENE,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });

    const { result } = renderHook(() => useAIProposal('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('success');
    expect(result.current.attemptCount).toBe(2);
  });

  it('stops auto-retrying once max_retries is exhausted and surfaces the error', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 2 });
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(504, { error: 'timeout', detail: 'timed out' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    // 1 initial attempt + 2 retries = 3 total calls.
    expect(mockedCreateAIScene).toHaveBeenCalledTimes(3);
    expect(result.current.phase).toBe('provider-error');
    expect(result.current.attemptCount).toBe(3);
  });

  it('never auto-retries a non-retryable failure, even when enabled', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 3 });
    mockedCreateAIScene.mockRejectedValue(
      new ApiError(429, { error: 'quota_exceeded', detail: 'Daily limit reached.' }),
    );

    const { result } = renderHook(() => useAIProposal('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('quota-error');
    expect(result.current.attemptCount).toBe(1);
    expect(result.current.canRetryGeneration).toBe(false);
  });

  it('with auto-retry off, a retryable failure never retries silently but can be retried explicitly', async () => {
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
    mockedCreateAIScene
      .mockRejectedValueOnce(new ApiError(502, { error: 'provider_failure', detail: 'down' }))
      .mockResolvedValueOnce({
        draft: true,
        operation: 'create_scene',
        scene: VALID_SCENE,
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
      });

    const { result } = renderHook(() => useAIProposal('p1'));
    await waitFor(() => expect(mockedFetchRetryPreference).toHaveBeenCalled());
    act(() => result.current.setPrompt('anything'));

    await act(async () => {
      await result.current.generate(null, null);
    });

    expect(mockedCreateAIScene).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('provider-error');
    expect(result.current.attemptCount).toBe(1);
    expect(result.current.canRetryGeneration).toBe(true);

    await act(async () => {
      result.current.retryGeneration(null, null);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.phase).toBe('success'));
    expect(mockedCreateAIScene).toHaveBeenCalledTimes(2);
    expect(result.current.attemptCount).toBe(2);
  });
});
