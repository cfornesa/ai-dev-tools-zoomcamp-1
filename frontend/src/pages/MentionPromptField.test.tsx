import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import MentionPromptField from './MentionPromptField';

const OPTIONS = [
  {
    id: 'layer-1',
    label: 'Artwork',
    type: 'layer' as const,
    descendantIds: ['layer-1', 'shape-1'],
  },
  {
    id: 'locked-1',
    label: 'Locked group',
    type: 'group' as const,
    disabled: true,
    disabledReason: 'Locked',
    descendantIds: ['locked-1'],
  },
];

function ControlledField() {
  const [value, setValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return (
    <MentionPromptField
      id="prompt"
      label="Describe the change"
      value={value}
      onChange={setValue}
      options={OPTIONS}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
    />
  );
}

function renderField() {
  return render(<ControlledField />);
}

describe('MentionPromptField', () => {
  it('opens suggestions and inserts a removable typed chip with keyboard controls', async () => {
    const user = userEvent.setup();
    renderField();
    const field = screen.getByRole('textbox', { name: /describe the change/i });
    await user.type(field, '@art');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('ai-target-chip-layer-1')).toHaveTextContent('Artwork');
    expect(screen.getByRole('button', { name: /remove artwork target/i })).toBeInTheDocument();
  });

  it('keeps locked suggestions visible but unavailable', async () => {
    const user = userEvent.setup();
    renderField();
    await user.type(screen.getByRole('textbox'), '@locked');
    const option = screen.getByRole('option');
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveTextContent('Locked');
  });

  it('does not turn ordinary prose into a target chip', async () => {
    const user = userEvent.setup();
    renderField();
    await user.type(screen.getByRole('textbox'), 'Artwork should stay unchanged');
    expect(screen.queryByTestId('ai-target-chip-layer-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
