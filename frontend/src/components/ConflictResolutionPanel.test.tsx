import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConflictResolutionPanel } from './ConflictResolutionPanel';

const conflict = {
  context: {
    baseVersion: 'version-7',
    localOperationIds: ['local-1'],
    remoteOperationIds: ['remote-1'],
  },
  conflicts: [
    {
      path: 'scenes[scene-a].objects[shape-1].x',
      base: 10,
      local: 20,
      remote: 30,
      affectedIdentities: ['shape-1'],
      context: {
        baseVersion: 'version-7',
        localOperationIds: ['local-1'],
        remoteOperationIds: ['remote-1'],
      },
    },
  ],
  localSnapshot: { value: 20 },
  remoteSnapshot: { value: 30 },
  mergedSnapshot: { value: 25 },
};

describe('ConflictResolutionPanel', () => {
  it('exposes deterministic accessible choices and validates compose JSON', () => {
    const onResolve = vi.fn();
    render(<ConflictResolutionPanel conflict={conflict} onResolve={onResolve} />);

    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep local' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep remote' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Rebase / compose result' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep local' }));
    expect(onResolve).toHaveBeenCalledWith('keep-local', { value: 20 });

    fireEvent.change(screen.getByLabelText('Compose selected result'), {
      target: { value: '{not-json' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rebase / compose result' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter valid JSON');
  });
});
