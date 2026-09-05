import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountEntitlementsApi from '../api/accountEntitlements';
import { ApiError } from '../api/client';
import EntitlementsSummary from './EntitlementsSummary';

vi.mock('../api/accountEntitlements', async () => {
  const actual = await vi.importActual<typeof import('../api/accountEntitlements')>(
    '../api/accountEntitlements',
  );
  return { ...actual, fetchAccountEntitlements: vi.fn() };
});

const mockedFetch = vi.mocked(accountEntitlementsApi.fetchAccountEntitlements);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntitlementsSummary', () => {
  it('shows the effective tier and per-feature usage from the server', async () => {
    mockedFetch.mockResolvedValue({
      plan_key: 'free',
      features: [
        { feature: 'ai_scene_create', cap: 5, used: 2, remaining: 3 },
        { feature: 'ai_art_generate', cap: 5, used: 5, remaining: 0 },
      ],
      reset_at: '2026-01-16T00:00:00+00:00',
    });
    render(<EntitlementsSummary />);

    expect(await screen.findByText('free')).toBeInTheDocument();
    expect(screen.getByText(/AI scene creation: 2\/5 used \(3 remaining\)/)).toBeInTheDocument();
    expect(screen.getByText(/AI art generation: 5\/5 used \(0 remaining\)/)).toBeInTheDocument();
  });

  it('shows an unauthorized message on a 401', async () => {
    mockedFetch.mockRejectedValue(new ApiError(401, { detail: 'Authentication required.' }));
    render(<EntitlementsSummary />);

    expect(await screen.findByText('Sign in to see your plan and usage.')).toBeInTheDocument();
  });

  it('offers a retry on a generic failure, which reloads the summary', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network down'));
    render(<EntitlementsSummary />);

    expect(await screen.findByText('Could not load your plan and usage.')).toBeInTheDocument();

    mockedFetch.mockResolvedValueOnce({
      plan_key: 'paid',
      features: [{ feature: 'ai_scene_create', cap: 20, used: 0, remaining: 20 }],
      reset_at: '2026-01-16T00:00:00+00:00',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('paid')).toBeInTheDocument();
  });
});
