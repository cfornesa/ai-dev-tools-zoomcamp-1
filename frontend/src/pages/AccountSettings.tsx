import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  fetchMistralCredential,
  removeMistralCredential,
  saveMistralCredential,
} from '../api/credentials';

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
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}

export default AccountSettings;
