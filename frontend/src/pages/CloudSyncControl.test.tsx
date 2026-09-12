import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as cloudBackupApi from '../api/cloudBackup';
import { ApiError } from '../api/client';
import CloudSyncControl from './CloudSyncControl';

vi.mock('../api/cloudBackup', () => ({
  fetchCloudBackup: vi.fn(),
  setCloudBackupAction: vi.fn(),
}));

const fetchStatus = vi.mocked(cloudBackupApi.fetchCloudBackup);
const setAction = vi.mocked(cloudBackupApi.setCloudBackupAction);

describe('CloudSyncControl', () => {
  beforeEach(() => vi.resetAllMocks());

  it('offers an opt-in control when no backup exists and leaves local work unrestricted', async () => {
    fetchStatus.mockRejectedValue(new ApiError(404, null));
    render(<CloudSyncControl projectId="p1" />);
    expect(await screen.findByRole('button', { name: /enable cloud sync/i })).toBeVisible();
    expect(screen.getByText(/local project is never restricted/i)).toBeVisible();
  });

  it('enables and pauses an eligible project', async () => {
    fetchStatus.mockResolvedValue({ enabled: false, paused: false, read_only: false, revision: 0 });
    setAction.mockResolvedValue({ enabled: true, paused: false, read_only: false, revision: 0 });
    const user = userEvent.setup();
    render(<CloudSyncControl projectId="p1" />);
    await user.click(await screen.findByRole('button', { name: /enable cloud sync/i }));
    await waitFor(() => expect(setAction).toHaveBeenCalledWith('p1', 'enable'));
    expect(await screen.findByRole('button', { name: /pause cloud sync/i })).toBeVisible();
  });

  it('describes retained read-only copies without blocking local access', async () => {
    fetchStatus.mockResolvedValue({ enabled: true, paused: false, read_only: true, revision: 1 });
    render(<CloudSyncControl projectId="p1" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      /local editing and export remain available/i,
    );
  });
});
