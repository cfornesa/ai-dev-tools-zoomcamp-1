import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiPreferencesApi from '../api/aiPreferences';
import * as aiRetryPreferenceApi from '../api/aiRetryPreference';
import * as credentialsApi from '../api/credentials';
import AccountSettings from './AccountSettings';

vi.mock('../api/credentials');
vi.mock('../api/aiPreferences');
vi.mock('../api/aiRetryPreference');

const mockedFetch = vi.mocked(credentialsApi.fetchMistralCredential);
const mockedSave = vi.mocked(credentialsApi.saveMistralCredential);
const mockedRemove = vi.mocked(credentialsApi.removeMistralCredential);
const mockedFetchProviders = vi.mocked(credentialsApi.fetchProviderCredentials);
const mockedSaveProvider = vi.mocked(credentialsApi.saveProviderCredential);
const mockedRemoveProvider = vi.mocked(credentialsApi.removeProviderCredential);

const mockedFetchModels = vi.mocked(aiPreferencesApi.fetchMistralModelPreferences);
const mockedCreateModel = vi.mocked(aiPreferencesApi.createMistralModelPreference);
const mockedDeleteModel = vi.mocked(aiPreferencesApi.deleteMistralModelPreference);
const mockedFetchPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedCreatePersona = vi.mocked(aiPreferencesApi.createAIPersona);
const mockedDeletePersona = vi.mocked(aiPreferencesApi.deleteAIPersona);

const mockedFetchRetryPreference = vi.mocked(aiRetryPreferenceApi.fetchAIRetryPreference);
const mockedUpdateRetryPreference = vi.mocked(aiRetryPreferenceApi.updateAIRetryPreference);

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchModels.mockResolvedValue([]);
  mockedFetchPersonas.mockResolvedValue([]);
  mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
  mockedFetchProviders.mockResolvedValue({
    providers: [
      { vendor: 'mistral', label: 'Mistral', implemented: true, configured: false },
      { vendor: 'gemini', label: 'Google Gemini', implemented: true, configured: false },
      { vendor: 'deepseek', label: 'DeepSeek', implemented: true, configured: false },
    ],
  });
});

describe('AccountSettings', () => {
  it('shows only a non-sensitive configured status', async () => {
    mockedFetch.mockResolvedValue({ configured: true });
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Mistral key: configured')).toBeInTheDocument();
    expect(screen.getByLabelText(/^mistral api key$/i, { selector: 'input' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /replace key/i })).toHaveClass('shell-action');
    expect(screen.getByRole('button', { name: /remove key/i })).toHaveClass('shell-action');
  });

  it('shows named vendor cards and clears non-Mistral keys after saving', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    mockedSaveProvider.mockResolvedValue({ vendor: 'gemini', configured: true });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/google gemini api key/i);
    await user.type(input, 'gemini-user-key-12345');
    const geminiCard = input.closest('.account-settings-section');
    expect(geminiCard).not.toBeNull();
    await user.click(
      within(geminiCard as HTMLElement).getByRole('button', { name: /^save key$/i }),
    );

    expect(mockedSaveProvider).toHaveBeenCalledWith('gemini', 'gemini-user-key-12345');
    expect(input).toHaveValue('');
    expect(screen.getByText('DeepSeek key: not configured')).toBeInTheDocument();
    expect(screen.getByLabelText(/deepseek api key/i)).toHaveValue('');
    expect(mockedRemoveProvider).not.toHaveBeenCalled();
  });

  it('submits a key, clears the input, and supports removal', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    mockedSave.mockResolvedValue({ configured: true });
    mockedRemove.mockResolvedValue();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/^mistral api key$/i, { selector: 'input' });
    await user.type(input, 'sk-user-key-12345');
    await user.click(
      within(input.closest('form') as HTMLFormElement).getByRole('button', { name: /save key/i }),
    );

    expect(mockedSave).toHaveBeenCalledWith('sk-user-key-12345');
    expect(input).toHaveValue('');
    expect(await screen.findByText(/securely configured/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove key/i }));
    expect(mockedRemove).toHaveBeenCalledOnce();
    expect(await screen.findByText(/was removed/i)).toBeInTheDocument();
  });

  it('links to Mistral model documentation', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

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
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

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
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

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

  it('loads and saves the automatic retry setting', async () => {
    mockedFetch.mockResolvedValue({ configured: false });
    mockedFetchRetryPreference.mockResolvedValue({ auto_retry_enabled: false, max_retries: 3 });
    mockedUpdateRetryPreference.mockResolvedValue({ auto_retry_enabled: true, max_retries: 5 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    const toggle = await screen.findByLabelText(/automatically retry failed ai generations/i);
    expect(toggle).not.toBeChecked();
    const retriesInput = screen.getByLabelText(/retry attempts/i);
    expect(retriesInput).toHaveValue(3);

    await user.click(toggle);
    await user.clear(retriesInput);
    await user.type(retriesInput, '5');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockedUpdateRetryPreference).toHaveBeenCalledWith({
      auto_retry_enabled: true,
      max_retries: 5,
    });
    expect(await screen.findByText(/automatic retry setting was saved/i)).toBeInTheDocument();
  });
});
