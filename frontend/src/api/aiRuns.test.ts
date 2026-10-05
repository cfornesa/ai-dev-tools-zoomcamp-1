import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from './client';
import { acceptAIRun, cancelAIRun } from './aiRuns';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

describe('AI run decision request reasons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the exact optional reason payload to accept', async () => {
    await acceptAIRun(42, 'Keep this direction.');
    expect(apiFetch).toHaveBeenCalledWith('/api/ai/runs/42/accept/', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Keep this direction.' }),
      signal: undefined,
    });
  });

  it('sends the exact optional reason payload to cancel', async () => {
    await cancelAIRun(43, 'Discard this direction.');
    expect(apiFetch).toHaveBeenCalledWith('/api/ai/runs/43/cancel/', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Discard this direction.' }),
      signal: undefined,
    });
  });

  it('preserves the existing bodyless accept and cancel requests when no reason is provided', async () => {
    await acceptAIRun(44);
    await cancelAIRun(45);
    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/ai/runs/44/accept/', {
      method: 'POST',
      signal: undefined,
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/ai/runs/45/cancel/', {
      method: 'POST',
      signal: undefined,
    });
  });
});
