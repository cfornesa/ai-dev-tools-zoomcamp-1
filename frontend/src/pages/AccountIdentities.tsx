import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  type AccountIdentity,
  fetchAccountIdentityProviders,
  fetchAccountIdentities,
  providerLabel,
  unlinkAccountIdentity,
} from '../api/accountIdentities';
import { ApiError, readCookie } from '../api/client';
import { useAuth } from '../auth/useAuth';

/** allauth's "connect" flow requires a real, top-level CSRF-protected
 * POST (SOCIALACCOUNT_LOGIN_ON_GET defaults to False) that redirects the
 * whole page to the provider's own consent screen -- not something
 * `fetch()`/apiFetch can do. Mirrors backend/templates/account/login.html's
 * own POST-form pattern for exactly the same reason. */
function ConnectProviderForm({ provider }: { provider: string }) {
  return (
    <form method="post" action={`/accounts/${provider}/login/`}>
      <input type="hidden" name="csrfmiddlewaretoken" value={readCookie('csrftoken') ?? ''} />
      <input type="hidden" name="process" value="connect" />
      <input type="hidden" name="next" value="/account/settings/identities" />
      <button type="submit">Connect {providerLabel(provider)}</button>
    </form>
  );
}

function AccountIdentities() {
  const auth = useAuth();
  const [identities, setIdentities] = useState<AccountIdentity[] | null>(null);
  const [providers, setProviders] = useState<Awaited<
    ReturnType<typeof fetchAccountIdentityProviders>
  > | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    Promise.all([fetchAccountIdentities(), fetchAccountIdentityProviders()])
      .then(([linked, registry]) => {
        setIdentities(linked);
        setProviders(registry);
      })
      .catch(() => setLoadError('Could not load your linked sign-in methods.'));
  }, [auth]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  async function unlink(provider: string) {
    setBusyProvider(provider);
    setUnlinkError(null);
    setMessage(null);
    try {
      const next = await unlinkAccountIdentity(provider);
      setIdentities(next);
      setMessage(`${providerLabel(provider)} disconnected.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setUnlinkError('You cannot remove your only usable sign-in method.');
      } else {
        setUnlinkError('Could not disconnect this sign-in method. Please try again.');
      }
    } finally {
      setBusyProvider(null);
    }
  }

  const linkedProviders = new Set((identities ?? []).map((identity) => identity.provider));

  return (
    <section className="content-panel account-identities">
      <h2>Linked sign-in methods</h2>
      {loadError && (
        <p role="alert" aria-live="assertive">
          {loadError}
        </p>
      )}
      {identities && providers ? (
        <ul aria-label="Linked sign-in methods">
          {identities.map((identity) => (
            <li key={identity.provider}>
              <span>{providerLabel(identity.provider)}</span>
              {!identity.enabled && <span> (currently disabled site-wide)</span>}
              <button
                type="button"
                onClick={() => unlink(identity.provider)}
                disabled={busyProvider === identity.provider}
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !loadError && <p role="status">Loading your linked sign-in methods…</p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {unlinkError && (
        <p role="alert" aria-live="assertive">
          {unlinkError}
        </p>
      )}
      <h3>Connect another sign-in method</h3>
      {(providers ?? [])
        .filter((provider) => provider.enabled && !linkedProviders.has(provider.provider))
        .map((provider) => (
          <ConnectProviderForm key={provider.provider} provider={provider.provider} />
        ))}
    </section>
  );
}

export default AccountIdentities;
