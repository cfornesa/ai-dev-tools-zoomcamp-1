import { useEffect, useState } from 'react';

import {
  type AccountEntitlementSummary,
  featureLabel,
  fetchAccountEntitlements,
} from '../api/accountEntitlements';
import { ApiError } from '../api/client';

/** Issue #439: effective tier, per-feature cap/used/remaining, and the
 * shared reset window, entirely from server-resolved state -- nothing
 * here is derived or overridable on the client. */
function EntitlementsSummary() {
  const [summary, setSummary] = useState<AccountEntitlementSummary | null>(null);
  const [error, setError] = useState<'unauthorized' | 'failed' | null>(null);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchAccountEntitlements()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 401 ? 'unauthorized' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [loadToken]);

  if (error === 'unauthorized') {
    return (
      <p role="alert" aria-live="assertive">
        Sign in to see your plan and usage.
      </p>
    );
  }

  if (error === 'failed') {
    return (
      <div role="alert" aria-live="assertive">
        <p>Could not load your plan and usage.</p>
        <button type="button" onClick={() => setLoadToken((token) => token + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (!summary) {
    return <p role="status">Loading your plan and usage…</p>;
  }

  return (
    <section aria-label="Your plan and usage">
      <p>
        Current plan: <strong>{summary.plan_key}</strong>
      </p>
      <ul aria-label="Feature usage">
        {summary.features.map((feature) => (
          <li key={feature.feature}>
            {featureLabel(feature.feature)}: {feature.used}/{feature.cap} used ({feature.remaining}{' '}
            remaining)
          </li>
        ))}
      </ul>
      <p>
        Usage resets at <time dateTime={summary.reset_at}>{summary.reset_at}</time>.
      </p>
    </section>
  );
}

export default EntitlementsSummary;
