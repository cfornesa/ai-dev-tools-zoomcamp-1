import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as credentialsApi from '../api/credentials';
import AccountSettings from './AccountSettings';

vi.mock('../api/credentials');

const mockedFetch = vi.mocked(credentialsApi.fetchMistralCredential);
const mockedSave = vi.mocked(credentialsApi.saveMistralCredential);
const mockedRemove = vi.mocked(credentialsApi.removeMistralCredential);

beforeEach(() => vi.clearAllMocks());

describe('AccountSettings', () => {
  it('shows only a non-sensitive configured status', async () => {
    mockedFetch.mockResolvedValue({ configured: true });
    render(<AccountSettings />);

    expect(await screen.findByText('Mistral key: configured')).toBeInTheDocument();
    expect(screen.getByLabelText(/^mistral api key$/i, { selector: 'input' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /replace key/i })).toHaveClass('shell-action');
    expect(screen.getByRole('button', { name: /remove key/i })).toHaveClass('shell-action');
  });

  it('submits a key, clears the input, and supports removal', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    mockedSave.mockResolvedValue({ configured: true });
    mockedRemove.mockResolvedValue();
    const user = userEvent.setup();
    render(<AccountSettings />);

    const input = await screen.findByLabelText(/^mistral api key$/i, { selector: 'input' });
    await user.type(input, 'sk-user-key-12345');
    await user.click(screen.getByRole('button', { name: /save key/i }));

    expect(mockedSave).toHaveBeenCalledWith('sk-user-key-12345');
    expect(input).toHaveValue('');
    expect(await screen.findByText(/securely configured/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove key/i }));
    expect(mockedRemove).toHaveBeenCalledOnce();
    expect(await screen.findByText(/was removed/i)).toBeInTheDocument();
  });
});