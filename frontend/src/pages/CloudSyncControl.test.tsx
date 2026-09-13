import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as cloudBackupApi from '../api/cloudBackup';
import CloudSyncControl from './CloudSyncControl';

vi.mock('../api/cloudBackup', () => ({
  setCloudBackupAction: vi.fn(),
}));

const setAction = vi.mocked(cloudBackupApi.setCloudBackupAction);

describe('CloudSyncControl', () => {
  beforeEach(() => vi.resetAllMocks());

  it('offers an opt-in control when no backup exists and leaves local work unrestricted', async () => {
    render(<CloudSyncControl projectId="p1" />);
    expect(await screen.findByRole('button', { name: /enable cloud sync/i })).toBeVisible();
    expect(screen.getByText(/local project is never restricted/i)).toBeVisible();
  });

  it('enables and pauses an eligible project', async () => {
    setAction.mockResolvedValue({
      enabled: true,
      paused: false,
      read_only: false,
      retention_state: 'active',
      retain_until: null,
      revision: 0,
    });
    const user = userEvent.setup();
    render(<CloudSyncControl projectId="p1" />);
    await user.click(await screen.findByRole('button', { name: /enable cloud sync/i }));
    await waitFor(() => expect(setAction).toHaveBeenCalledWith('p1', 'enable'));
    expect(await screen.findByRole('button', { name: /pause cloud sync/i })).toBeVisible();
  });

  it('describes retained read-only copies without blocking local access', async () => {
    setAction.mockResolvedValue({
      enabled: true,
      paused: false,
      read_only: true,
      retention_state: 'entitlement_expired',
      retain_until: null,
      revision: 1,
    });
    render(<CloudSyncControl projectId="p1" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable cloud sync/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      /local editing and export remain available/i,
    );
  });

  it('reports provider failure without disabling local editing or export', async () => {
    setAction.mockRejectedValue(new Error('provider unavailable'));
    render(<CloudSyncControl projectId="p1" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable cloud sync/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /local editing and export are unaffected/i,
    );
  });
});
