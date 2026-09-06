import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  type AIPersona,
  type MistralModelPreference,
  createAIPersona,
  createMistralModelPreference,
  deleteAIPersona,
  deleteMistralModelPreference,
  fetchAIPersonas,
  fetchMistralModelPreferences,
} from '../api/aiPreferences';
import { fetchAIRetryPreference, updateAIRetryPreference } from '../api/aiRetryPreference';
import { ApiError } from '../api/client';
import {
  type ProviderCredentialStatus,
  fetchProviderCredentials,
  fetchMistralCredential,
  removeProviderCredential,
  removeMistralCredential,
  saveProviderCredential,
  saveMistralCredential,
} from '../api/credentials';
import EntitlementsSummary from './EntitlementsSummary';

const MIN_MAX_RETRIES = 1;
const MAX_MAX_RETRIES = 10;

const MISTRAL_MODELS_DOCS_URL = 'https://docs.mistral.ai/getting-started/models/';

function AccountSettings() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMistralCredential()
      .then((status) => setConfigured(status.configured))
      .catch(() => setError('Could not load your Mistral key status.'));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const status = await saveMistralCredential(key);
      setKey('');
      setConfigured(status.configured);
      setMessage('Your Mistral key is securely configured.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? 'That key could not be saved. Check it and try again.'
          : 'Could not save your key.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await removeMistralCredential();
      setConfigured(false);
      setMessage('Your Mistral key was removed.');
    } catch {
      setError('Could not remove your Mistral key.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-panel account-settings">
      <div className="centered-state">
        <h2>Account settings</h2>
        <EntitlementsSummary />
        <p>
          <Link to="/account/settings/identities">Manage linked sign-in methods</Link>
        </p>
        <p>
          <Link to="/account/settings/sessions">Manage active sessions</Link>
        </p>
        <p>
          <Link to="/account/settings/export">Export your data</Link>
        </p>
        <p>AI generation uses your own Mistral API key. We never show or recover a saved key.</p>
        <p role="status" aria-live="polite">
          {configured === null
            ? 'Checking key status…'
            : configured
              ? 'Mistral key: configured'
              : 'Mistral key: not configured'}
        </p>
        <form onSubmit={submit} aria-label="Mistral API key" className="account-settings-form">
          <label htmlFor="mistral-key">Mistral API key</label>
          <input
            id="mistral-key"
            className="account-settings-input"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={busy}
          />
          <button className="shell-action" type="submit" disabled={busy || key.length < 10}>
            {busy ? 'Saving…' : configured ? 'Replace key' : 'Save key'}
          </button>
        </form>
        {configured && (
          <button
            className="shell-action"
            type="button"
            onClick={() => void remove()}
            disabled={busy}
          >
            Remove key
          </button>
        )}
        {configured && !message && <p>Your Mistral key is securely configured.</p>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <ProviderCredentialCards />
      <SavedMistralModels />
      <AIPersonas />
      <AIRetrySettings />
    </section>
  );
}

function ProviderCredentialCards() {
  const [providers, setProviders] = useState<ProviderCredentialStatus[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busyVendor, setBusyVendor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(fetchProviderCredentials())
      .then((data) => setProviders(data?.providers ?? []))
      .catch(() => setError('Could not load provider credential status.'));
  }, []);

  async function save(vendor: ProviderCredentialStatus['vendor']) {
    const key = keys[vendor] ?? '';
    setBusyVendor(vendor);
    setError(null);
    try {
      await saveProviderCredential(vendor, key);
      setProviders((current) =>
        current.map((provider) =>
          provider.vendor === vendor ? { ...provider, configured: true } : provider,
        ),
      );
      setKeys((current) => ({ ...current, [vendor]: '' }));
    } catch {
      setError(`Could not save your ${vendor} key.`);
    } finally {
      setBusyVendor(null);
    }
  }

  async function remove(vendor: ProviderCredentialStatus['vendor']) {
    setBusyVendor(vendor);
    setError(null);
    try {
      await removeProviderCredential(vendor);
      setProviders((current) =>
        current.map((provider) =>
          provider.vendor === vendor ? { ...provider, configured: false } : provider,
        ),
      );
    } catch {
      setError(`Could not remove your ${vendor} key.`);
    } finally {
      setBusyVendor(null);
    }
  }

  if (providers.length === 0 && !error) return null;
  return (
    <div className="centered-state account-settings-section" aria-labelledby="provider-credentials">
      <h3 id="provider-credentials">AI provider credentials</h3>
      <p>Keys are encrypted for your account and are never shown again after saving.</p>
      <div className="account-settings-list">
        {providers.map((provider) => (
          <div key={provider.vendor} className="account-settings-section">
            <h4>{provider.label}</h4>
            <p role="status">
              {provider.configured
                ? `${provider.label} key: configured`
                : `${provider.label} key: not configured`}
            </p>
            <label htmlFor={`${provider.vendor}-key`}>{provider.label} API key</label>
            <input
              id={`${provider.vendor}-key`}
              type="password"
              autoComplete="off"
              value={keys[provider.vendor] ?? ''}
              onChange={(event) =>
                setKeys((current) => ({ ...current, [provider.vendor]: event.target.value }))
              }
              disabled={busyVendor !== null}
            />
            <button
              type="button"
              className="shell-action"
              onClick={() => void save(provider.vendor)}
              disabled={busyVendor !== null || (keys[provider.vendor] ?? '').length < 10}
            >
              {busyVendor === provider.vendor
                ? 'Saving…'
                : provider.configured
                  ? 'Replace key'
                  : 'Save key'}
            </button>
            {provider.configured && (
              <button
                type="button"
                className="shell-action"
                onClick={() => void remove(provider.vendor)}
                disabled={busyVendor !== null}
              >
                Remove key
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function AIRetrySettings() {
  const [enabled, setEnabled] = useState(false);
  const [maxRetries, setMaxRetries] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAIRetryPreference()
      .then((preference) => {
        setEnabled(preference.auto_retry_enabled);
        setMaxRetries(preference.max_retries);
        setLoaded(true);
      })
      .catch(() => setError('Could not load your automatic retry setting.'));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await updateAIRetryPreference({
        auto_retry_enabled: enabled,
        max_retries: maxRetries,
      });
      setEnabled(saved.auto_retry_enabled);
      setMaxRetries(saved.max_retries);
      setMessage('Your automatic retry setting was saved.');
    } catch {
      setError('Could not save that setting. Check the retry count and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-state account-settings-section">
      <h3>Automatic retry</h3>
      <p>
        When an AI generation fails with a retryable error (an invalid response, a timeout, or a
        provider failure), automatically retry instead of leaving you to notice and resubmit.
        Retries still count against your existing AI request limits. Off by default — while off, we
        ask you to confirm before each retry.
      </p>
      {!loaded && !error && <p>Loading your automatic retry setting…</p>}
      {loaded && (
        <form
          onSubmit={submit}
          aria-label="Automatic retry settings"
          className="account-settings-form"
        >
          <label htmlFor="ai-retry-enabled">
            <input
              id="ai-retry-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={busy}
            />{' '}
            Automatically retry failed AI generations
          </label>
          <label htmlFor="ai-retry-max">Retry attempts</label>
          <input
            id="ai-retry-max"
            className="account-settings-input"
            type="number"
            min={MIN_MAX_RETRIES}
            max={MAX_MAX_RETRIES}
            value={maxRetries}
            onChange={(e) => setMaxRetries(Number(e.target.value))}
            disabled={busy}
          />
          <button
            className="shell-action"
            type="submit"
            disabled={
              busy ||
              maxRetries < MIN_MAX_RETRIES ||
              maxRetries > MAX_MAX_RETRIES ||
              !Number.isInteger(maxRetries)
            }
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function SavedMistralModels() {
  const [models, setModels] = useState<MistralModelPreference[] | null>(null);
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMistralModelPreferences()
      .then(setModels)
      .catch(() => setError('Could not load your saved Mistral models.'));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createMistralModelPreference(slug, label);
      setModels((current) => [...(current ?? []), created]);
      setSlug('');
      setLabel('');
    } catch {
      setError('Could not save that model. Check the slug and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError(null);
    try {
      await deleteMistralModelPreference(id);
      setModels((current) => (current ?? []).filter((m) => m.id !== id));
    } catch {
      setError('Could not remove that model.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-state account-settings-section">
      <h3>Saved Mistral models</h3>
      <p>
        Save your own Mistral model slugs to pick from a dropdown in the AI assistant, instead of
        retyping one each time. Look up valid slugs in{' '}
        <a href={MISTRAL_MODELS_DOCS_URL} target="_blank" rel="noopener noreferrer">
          Mistral&apos;s model documentation
        </a>
        .
      </p>
      <form
        onSubmit={submit}
        aria-label="Add a saved Mistral model"
        className="account-settings-form"
      >
        <label htmlFor="mistral-model-slug">Model slug</label>
        <input
          id="mistral-model-slug"
          className="account-settings-input"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={busy}
        />
        <label htmlFor="mistral-model-label">Label (optional)</label>
        <input
          id="mistral-model-label"
          className="account-settings-input"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={busy}
        />
        <button className="shell-action" type="submit" disabled={busy || slug.trim() === ''}>
          Add model
        </button>
      </form>
      {models === null && !error && <p>Loading your saved models…</p>}
      {models !== null && models.length === 0 && <p>No saved models yet.</p>}
      {models !== null && models.length > 0 && (
        <ul className="account-settings-list" aria-label="Saved Mistral models">
          {models.map((model) => (
            <li key={model.id}>
              <span>{model.label ? `${model.label} (${model.slug})` : model.slug}</span>
              <button
                className="shell-action"
                type="button"
                onClick={() => void remove(model.id)}
                disabled={busy}
                aria-label={`Remove saved model ${model.slug}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function AIPersonas() {
  const [personas, setPersonas] = useState<AIPersona[] | null>(null);
  const [name, setName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAIPersonas()
      .then(setPersonas)
      .catch(() => setError('Could not load your Personas.'));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createAIPersona(name, promptText);
      setPersonas((current) => [...(current ?? []), created]);
      setName('');
      setPromptText('');
    } catch {
      setError('Could not save that Persona. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError(null);
    try {
      await deleteAIPersona(id);
      setPersonas((current) => (current ?? []).filter((p) => p.id !== id));
    } catch {
      setError('Could not remove that Persona.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-state account-settings-section">
      <h3>Personas</h3>
      <p>
        A Persona adds your own style/tone guidance on top of the AI assistant&apos;s required
        technical instructions — it can never replace or remove them.
      </p>
      <form onSubmit={submit} aria-label="Add a Persona" className="account-settings-form">
        <label htmlFor="ai-persona-name">Persona name</label>
        <input
          id="ai-persona-name"
          className="account-settings-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <label htmlFor="ai-persona-prompt">Additive prompt text</label>
        <textarea
          id="ai-persona-prompt"
          className="account-settings-input account-settings-textarea"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          disabled={busy}
        />
        <button
          className="shell-action"
          type="submit"
          disabled={busy || name.trim() === '' || promptText.trim() === ''}
        >
          Add Persona
        </button>
      </form>
      {personas === null && !error && <p>Loading your Personas…</p>}
      {personas !== null && personas.length === 0 && <p>No Personas yet.</p>}
      {personas !== null && personas.length > 0 && (
        <ul className="account-settings-list" aria-label="Personas">
          {personas.map((persona) => (
            <li key={persona.id}>
              <span>{persona.name}</span>
              <button
                className="shell-action"
                type="button"
                onClick={() => void remove(persona.id)}
                disabled={busy}
                aria-label={`Remove Persona ${persona.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default AccountSettings;
