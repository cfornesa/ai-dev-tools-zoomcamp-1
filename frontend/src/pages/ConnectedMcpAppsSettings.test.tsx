import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchConnectedMcpApps, revokeConnectedMcpApp } from '../api/connectedMcpApps';
import ConnectedMcpAppsSettings from './ConnectedMcpAppsSettings';

const mockedFetchConnectedMcpApps = vi.mocked(fetchConnectedMcpApps);

vi.mock('../api/connectedMcpApps', () => ({
  fetchConnectedMcpApps: vi.fn(),
  revokeConnectedMcpApp: vi.fn(),
}));

describe('ConnectedMcpAppsSettings', () => {
  afterEach(() => vi.resetAllMocks());

  it('lists approved scopes and removes an app after revocation', async () => {
    mockedFetchConnectedMcpApps.mockResolvedValue([
      {
        id: 12,
        name: 'Desktop editor',
        scopes: ['gallery:read', 'projects:write'],
        last_authorized: '2026-10-04T12:00:00Z',
      },
    ]);
    vi.mocked(revokeConnectedMcpApp).mockResolvedValue({ revoked: true });
    render(<ConnectedMcpAppsSettings />);

    expect(await screen.findByText('Desktop editor')).toBeInTheDocument();
    expect(screen.getByText('Approved access: gallery:read, projects:write')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Desktop editor' }));

    await waitFor(() => expect(revokeConnectedMcpApp).toHaveBeenCalledWith(12));
    await waitFor(() => expect(screen.getByText('No connected MCP apps.')).toBeInTheDocument());
  });

  it('shows an actionable error when the list cannot load', async () => {
    mockedFetchConnectedMcpApps.mockRejectedValue(new Error('network unavailable'));
    render(<ConnectedMcpAppsSettings />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load connected MCP apps. Please try again.',
    );
  });
});
