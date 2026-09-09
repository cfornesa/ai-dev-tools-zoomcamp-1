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
  it('gives every element a unique id and labels every credential input accessibly', async () => {
    const { container } = render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    await screen.findByText('DeepSeek key: not configured');

    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    const credentialInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    );
    expect(credentialInputs).toHaveLength(3);
    for (const input of credentialInputs) {
      const labels = container.querySelectorAll(`label[for="${input.id}"]`);
      expect(labels).toHaveLength(1);
      expect(labels[0]).toHaveTextContent(/api key/i);
    }
  });

  it('shows only a non-sensitive configured status', async () => {
    mockedFetchProviders.mockResolvedValue({
      providers: [
        { vendor: 'mistral', label: 'Mistral', implemented: true, configured: true },
        { vendor: 'gemini', label: 'Google Gemini', implemented: true, configured: false },
        { vendor: 'deepseek', label: 'DeepSeek', implemented: true, configured: false },
      ],
    });
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Mistral key: configured')).toBeInTheDocument();
    const mistralCard = screen
      .getByLabelText(/^mistral api key$/i)
      .closest('.account-settings-section');
    expect(mistralCard).not.toBeNull();
    expect(within(mistralCard as HTMLElement).getByLabelText(/^mistral api key$/i)).toHaveValue('');
    expect(
      within(mistralCard as HTMLElement).getByRole('button', { name: /replace key/i }),
    ).toHaveClass('shell-action');
    expect(
      within(mistralCard as HTMLElement).getByRole('button', { name: /remove key/i }),
    ).toHaveClass('shell-action');
  });

  it('shows named vendor cards and clears non-Mistral keys after saving', async () => {
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
    mockedSaveProvider.mockResolvedValue({ vendor: 'mistral', configured: true });
    mockedRemoveProvider.mockResolvedValue();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/^mistral api key$/i);
    const mistralCard = input.closest('.account-settings-section');
    expect(mistralCard).not.toBeNull();
    await user.type(input, 'sk-user-key-12345');
    await user.click(
      within(mistralCard as HTMLElement).getByRole('button', { name: /^save key$/i }),
    );

    expect(mockedSaveProvider).toHaveBeenCalledWith('mistral', 'sk-user-key-12345');
    expect(input).toHaveValue('');
    expect(await screen.findByText('Mistral key: configured')).toBeInTheDocument();
    await user.click(
      within(mistralCard as HTMLElement).getByRole('button', { name: /^remove key$/i }),
    );
    expect(mockedRemoveProvider).toHaveBeenCalledWith('mistral');
    expect(await screen.findByText('Mistral key: not configured')).toBeInTheDocument();
  });

  it('links to Mistral model documentation', async () => {
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
