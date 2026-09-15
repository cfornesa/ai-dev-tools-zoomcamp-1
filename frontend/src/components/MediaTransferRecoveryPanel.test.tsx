import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaTransferRecoveryPanel } from './MediaTransferRecoveryPanel';

describe('MediaTransferRecoveryPanel', () => {
  it('offers retry and discard without deleting local artwork', async () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    render(
      <MediaTransferRecoveryPanel
        transfers={[
          {
            transferId: 't1',
            ownerId: 'alice',
            projectId: 'p1',
            assetId: 'asset-1',
            byteLength: 10,
            checksum: 'a'.repeat(64),
            chunkSize: 4,
            acknowledgedRanges: [],
            attemptCount: 1,
            state: 'paused',
            lastErrorCode: 'quota-exceeded',
          },
        ]}
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByText(/storage quota was exceeded/i)).toBeVisible();
    screen.getByRole('button', { name: 'Retry transfer' }).click();
    screen.getByRole('button', { name: 'Discard transfer' }).click();
    expect(onResume).toHaveBeenCalledWith('t1');
    expect(onDiscard).toHaveBeenCalledWith('t1');
  });
});
