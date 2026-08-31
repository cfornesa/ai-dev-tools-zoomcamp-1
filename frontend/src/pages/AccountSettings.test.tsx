import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiPreferencesApi from '../api/aiPreferences';
import * as credentialsApi from '../api/credentials';
import AccountSettings from './AccountSettings';

vi.mock('../api/credentials');
vi.mock('../api/aiPreferences');

const mockedFetch = vi.mocked(credentialsApi.fetchMistralCredential);
const mockedSave = vi.mocked(credentialsApi.saveMistralCredential);
const mockedRemove = vi.mocked(credentialsApi.removeMistralCredential);

const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedCreateModel = vi.mocked(aiPreferencesApi.createMistralModelPreference);
const mockedDeleteModel = vi.mocked(aiPreferencesApi.deleteMistralModelPreference);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedCreatePersona = vi.mocked(aiPreferencesApi.createAIPersona);
const mockedDeletePersona = vi.mocked(aiPreferencesApi.deleteAIPersona);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchModels.mockResolvedValue([]);
  mockedFetchPersonas.mockResolvedValue([]);
});

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

  it('links to Mistral model documentation', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    render(<AccountSettings />);

    const link = await screen.findByRole('link', { name: /mistral's model documentation/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('mistral.ai'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('adds and removes a saved Mistral model', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    mockedCreateModel.mockResolvedValue({
      id: 1,
      slug: 'mistral-small-latest',
      label: 'Small',
      created_at: '2026-01-01T00:00:00Z',
    });
    mockedDeleteModel.mockResolvedValue();
    const user = userEvent.setup();
    render(<AccountSettings />);

    expect(await screen.findByText('No saved models yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/model slug/i), 'mistral-small-latest');
    await user.type(screen.getByLabelText(/label \(optional\)/i), 'Small');
    await user.click(screen.getByRole('button', { name: /add model/i }));

    expect(mockedCreateModel).toHaveBeenCalledWith('mistral-small-latest', 'Small');
    expect(await screen.findByText('Small (mistral-small-latest)')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /remove saved model mistral-small-latest/i }),
    );
    expect(mockedDeleteModel).toHaveBeenCalledWith(1);
    expect(await screen.findByText('No saved models yet.')).toBeInTheDocument();
  });

  it('adds and removes a Persona', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    mockedCreatePersona.mockResolvedValue({
      id: 5,
      name: 'Playful',
      prompt_text: 'Prefer bright colors.',
      created_at: '2026-01-01T00:00:00Z',
    });
    mockedDeletePersona.mockResolvedValue();
    const user = userEvent.setup();
    render(<AccountSettings />);

    expect(await screen.findByText('No Personas yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/persona name/i), 'Playful');
    await user.type(screen.getByLabelText(/additive prompt text/i), 'Prefer bright colors.');
    await user.click(screen.getByRole('button', { name: /add persona/i }));

    expect(mockedCreatePersona).toHaveBeenCalledWith('Playful', 'Prefer bright colors.');
    expect(await screen.findByText('Playful')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove persona playful/i }));
    expect(mockedDeletePersona).toHaveBeenCalledWith(5);
    expect(await screen.findByText('No Personas yet.')).toBeInTheDocument();
  });
});
