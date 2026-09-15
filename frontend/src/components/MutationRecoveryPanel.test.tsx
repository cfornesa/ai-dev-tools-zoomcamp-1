import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MutationRecoveryPanel } from './MutationRecoveryPanel';

describe('MutationRecoveryPanel', () => {
  it('explains ownership-safe recovery choices', () => {
    render(
      <MutationRecoveryPanel
        operation={{ lastErrorCode: 'authentication-required' } as never}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Private sync paused' })).toBeVisible();
    expect(screen.getByText(/sign-in expired/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Resume sync' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Discard queued mutation' })).toBeVisible();
  });
});
