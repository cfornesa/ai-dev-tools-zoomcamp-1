import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  type Plan,
  type SiteSettings,
  fetchPlans,
  fetchSiteSettings,
  updatePlan,
  updateSiteSettings,
} from '../api/adminSettings';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

function SiteTitleForm({
  settings,
  onSaved,
}: {
  settings: SiteSettings;
  onSaved: (next: SiteSettings) => void;
}) {
  const [title, setTitle] = useState(settings.site_title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTitle(settings.site_title);
  }, [settings.site_title]);

  const dirty = title !== settings.site_title;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updateSiteSettings(title, settings.revision);
      onSaved(next);
      setMessage('Site title saved.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Someone else changed this since you loaded it. Reload the page and try again.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('That title is not valid.');
      } else {
        setError('Could not save the site title. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setTitle(settings.site_title);
    setError(null);
    setMessage(null);
  }

  return (
    <form onSubmit={submit} aria-label="Site title settings" className="admin-settings-form">
      <label htmlFor="site-title-input">Site title</label>
      <input
        id="site-title-input"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={200}
        required
      />
      <div className="admin-settings-actions">
        <button type="submit" disabled={busy || !dirty}>
          Save
        </button>
        <button type="button" onClick={cancel} disabled={busy || !dirty}>
          Cancel
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </form>
  );
}

const ALL_FEATURE_KEYS = ['ai_scene_create', 'ai_scene_edit', 'ai_art_generate'];

function PlanForm({ plan, onSaved }: { plan: Plan; onSaved: (next: Plan) => void }) {
  const [dailyRequests, setDailyRequests] = useState(String(plan.daily_ai_requests));
  const [featureKeys, setFeatureKeys] = useState<string[]>(plan.feature_keys);
  const [active, setActive] = useState(plan.active);
  const [paypalPlanId, setPaypalPlanId] = useState(plan.paypal_plan_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDailyRequests(String(plan.daily_ai_requests));
    setFeatureKeys(plan.feature_keys);
    setActive(plan.active);
    setPaypalPlanId(plan.paypal_plan_id);
  }, [plan]);

  function toggleFeature(feature: string) {
    setFeatureKeys((current) =>
      current.includes(feature)
        ? current.filter((existing) => existing !== feature)
        : [...current, feature],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(dailyRequests);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Daily AI requests must be a whole number, zero or greater.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updatePlan(plan.plan_key, {
        daily_ai_requests: parsed,
        feature_keys: featureKeys,
        active,
        paypal_plan_id: paypalPlanId,
        revision: plan.revision,
      });
      onSaved(next);
      setMessage(`${plan.plan_key} plan saved.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          'Someone else changed this plan since you loaded it. Reload the page and try again.',
        );
      } else if (err instanceof ApiError && err.status === 400) {
        setError('That value is not valid.');
      } else {
        setError('Could not save this plan. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={`${plan.plan_key} plan`}
      className="admin-settings-form admin-plan-form"
    >
      <h3>{plan.plan_key} plan</h3>
      <label htmlFor={`plan-${plan.plan_key}-daily`}>Daily AI requests</label>
      <input
        id={`plan-${plan.plan_key}-daily`}
        type="number"
        min={0}
        step={1}
        value={dailyRequests}
        onChange={(event) => setDailyRequests(event.target.value)}
        required
      />
      <fieldset>
        <legend>Included features</legend>
        {ALL_FEATURE_KEYS.map((feature) => (
          <label key={feature}>
            <input
              type="checkbox"
              checked={featureKeys.includes(feature)}
              onChange={() => toggleFeature(feature)}
            />
            {feature}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`plan-${plan.plan_key}-active`}>
        <input
          id={`plan-${plan.plan_key}-active`}
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Active
      </label>
      <label htmlFor={`plan-${plan.plan_key}-paypal`}>PayPal plan id</label>
      <input
        id={`plan-${plan.plan_key}-paypal`}
        type="text"
        value={paypalPlanId}
        onChange={(event) => setPaypalPlanId(event.target.value)}
      />
      <div className="admin-settings-actions">
        <button type="submit" disabled={busy}>
          Save
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </form>
  );
}

function AdminSettings() {
  const auth = useAuth();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in' || !auth.user.is_application_admin) return;
    Promise.all([fetchSiteSettings(), fetchPlans()])
      .then(([settings, planList]) => {
        setSiteSettings(settings);
        setPlans(planList);
      })
      .catch(() => setLoadError('Could not load admin settings.'));
  }, [auth]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in' || !auth.user.is_application_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="content-panel admin-settings">
      <h2>Admin settings</h2>
      {loadError && (
        <p role="alert" aria-live="assertive">
          {loadError}
        </p>
      )}
      {siteSettings ? (
        <SiteTitleForm settings={siteSettings} onSaved={setSiteSettings} />
      ) : (
        !loadError && <p role="status">Loading site settings…</p>
      )}
      {plans ? (
        <div className="admin-plans">
          {plans.map((plan) => (
            <PlanForm
              key={plan.plan_key}
              plan={plan}
              onSaved={(next) =>
                setPlans((current) =>
                  (current ?? []).map((existing) =>
                    existing.plan_key === next.plan_key ? next : existing,
                  ),
                )
              }
            />
          ))}
        </div>
      ) : (
        !loadError && <p role="status">Loading plans…</p>
      )}
    </section>
  );
}

export default AdminSettings;
