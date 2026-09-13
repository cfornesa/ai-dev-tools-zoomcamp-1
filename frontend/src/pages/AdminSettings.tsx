import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  type Plan,
  type EntitlementRole,
  type GlobalCapability,
  type CloudRetentionPolicy,
  type SiteSettings,
  fetchPlans,
  fetchRoles,
  fetchGlobalCapabilities,
  fetchCloudRetentionPolicy,
  updateCloudRetentionPolicy,
  purgeCloudRetention,
  updateRole,
  updateGlobalCapability,
  fetchSiteSettings,
  updatePlan,
  updateSiteSettings,
} from '../api/adminSettings';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

const DEFAULT_THEME = {
  background: '#0b0d12',
  surface: '#151923',
  text: '#f3f4f6',
  muted: '#9ca3af',
  accent: '#c084fc',
};

function SiteTitleForm({
  settings,
  onSaved,
}: {
  settings: SiteSettings;
  onSaved: (next: SiteSettings) => void;
}) {
  const [title, setTitle] = useState(settings.site_title);
  const [theme, setTheme] = useState<Record<string, string>>({
    ...DEFAULT_THEME,
    ...(settings.theme_config ?? {}),
  });
  const [themeCleared, setThemeCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTitle(settings.site_title);
    setTheme({ ...DEFAULT_THEME, ...(settings.theme_config ?? {}) });
    setThemeCleared(false);
  }, [settings]);

  const dirty =
    title !== settings.site_title ||
    themeCleared ||
    JSON.stringify(theme) !==
      JSON.stringify({ ...DEFAULT_THEME, ...(settings.theme_config ?? {}) });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updateSiteSettings(title, settings.revision, themeCleared ? {} : theme);
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
    setTheme({ ...DEFAULT_THEME, ...(settings.theme_config ?? {}) });
    setThemeCleared(false);
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
      <fieldset>
        <legend>Site theme tokens</legend>
        {['background', 'surface', 'text', 'muted', 'accent'].map((token) => (
          <label key={token} htmlFor={`site-theme-${token}`}>
            {token}
            <input
              id={`site-theme-${token}`}
              type="color"
              value={theme[token] ?? '#000000'}
              onChange={(event) => {
                setThemeCleared(false);
                setTheme((current) => ({ ...current, [token]: event.target.value }));
              }}
            />
          </label>
        ))}
      </fieldset>
      <div className="admin-settings-actions">
        <button type="submit" disabled={busy || !dirty}>
          Save
        </button>
        <button type="button" onClick={cancel} disabled={busy || !dirty}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            setTheme({ ...DEFAULT_THEME });
            setThemeCleared(true);
          }}
          disabled={busy || themeCleared}
        >
          Reset theme
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
const CAPABILITY_KEYS = [
  'editor_2d_local',
  'editor_3d_local',
  'generated_pieces',
  'ai_scene_create',
  'ai_scene_edit',
  'ai_art_generate',
  'publishing',
  'cloud_project_sync',
];

function EntitlementPolicy({
  roles,
  globals,
  onRoles,
  onGlobals,
}: {
  roles: EntitlementRole[];
  globals: Record<string, GlobalCapability>;
  onRoles: (roles: EntitlementRole[]) => void;
  onGlobals: (globals: Record<string, GlobalCapability>) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  async function toggleRole(role: EntitlementRole, key: string) {
    const current = role.capabilities[key];
    const enabled = typeof current === 'object' ? !current.enabled : !current;
    try {
      const next = await updateRole({
        ...role,
        capabilities: { ...role.capabilities, [key]: enabled },
      });
      onRoles(roles.map((item) => (item.role_key === next.role_key ? next : item)));
      setMessage(`${role.label} updated.`);
    } catch {
      setMessage('Could not update that role; reload and try again if it changed.');
    }
  }
  async function toggleGlobal(key: string) {
    const setting = globals[key] ?? { enabled: true, revision: 1 };
    try {
      const next = await updateGlobalCapability(key, !setting.enabled, setting.revision);
      onGlobals({ ...globals, [key]: { enabled: next.enabled, revision: next.revision } });
      setMessage(`${key} global setting updated.`);
    } catch {
      setMessage('Could not update that global setting; reload and try again.');
    }
  }
  return (
    <section aria-label="Entitlement policy" className="admin-entitlement-policy">
      <h3>Roles and global permissions</h3>
      <p>
        Each role is a reusable section of atomic capabilities. Global switches apply to every
        account.
      </p>
      <div className="admin-role-sections">
        {roles.map((role) => (
          <fieldset key={role.role_key}>
            <legend>
              {role.label} ({role.role_key})
            </legend>
            {CAPABILITY_KEYS.map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={
                    typeof role.capabilities[key] === 'object'
                      ? Boolean((role.capabilities[key] as { enabled: boolean }).enabled)
                      : Boolean(role.capabilities[key])
                  }
                  onChange={() => void toggleRole(role, key)}
                />
                {key}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <fieldset>
        <legend>Global switches</legend>
        {CAPABILITY_KEYS.map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={(globals[key] ?? { enabled: true }).enabled}
              onChange={() => void toggleGlobal(key)}
            />
            {key}
          </label>
        ))}
      </fieldset>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

function CloudRetentionSettings({
  policy,
  onSaved,
}: {
  policy: CloudRetentionPolicy;
  onSaved: (next: CloudRetentionPolicy) => void;
}) {
  const [draft, setDraft] = useState(policy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(policy), [policy]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const next = await updateCloudRetentionPolicy(draft);
      onSaved(next);
      setMessage('Cloud retention policy saved.');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'The policy changed elsewhere. Reload before saving.'
          : 'Could not save the cloud retention policy.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (
      !window.confirm('Permanently delete expired remote copies? Local projects are unaffected.')
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await purgeCloudRetention(100, true);
      setMessage(
        `Purge complete: ${result.purged_backups} backups, ${result.purged_blobs} blobs, and ${result.purged_manifests} manifests removed.`,
      );
    } catch {
      setError('Could not purge expired remote copies.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-settings-form" aria-label="Cloud retention policy" onSubmit={save}>
      <h3>Cloud media retention</h3>
      <p>These windows affect remote copies only; local IndexedDB work is never deleted.</p>
      {(
        [
          ['deleted_grace_days', 'Deleted project grace days'],
          ['entitlement_grace_days', 'Cancelled or expired plan grace days'],
          ['disabled_sync_grace_days', 'Disabled-sync grace days'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} htmlFor={`retention-${key}`}>
          {label}
          <input
            id={`retention-${key}`}
            type="number"
            min={0}
            max={3650}
            value={draft[key]}
            onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
            required
          />
        </label>
      ))}
      <div className="admin-settings-actions">
        <button type="submit" disabled={busy}>
          Save retention policy
        </button>
        <button type="button" onClick={() => void purge()} disabled={busy}>
          Purge expired remote copies
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function PlanForm({
  plan,
  roles,
  onSaved,
}: {
  plan: Plan;
  roles: EntitlementRole[];
  onSaved: (next: Plan) => void;
}) {
  const [dailyRequests, setDailyRequests] = useState(String(plan.daily_ai_requests));
  const [featureKeys, setFeatureKeys] = useState<string[]>(plan.feature_keys);
  const [active, setActive] = useState(plan.active);
  const [paypalPlanId, setPaypalPlanId] = useState(plan.paypal_plan_id);
  const [price, setPrice] = useState(plan.price);
  const [currency, setCurrency] = useState(plan.currency);
  const [interval, setInterval] = useState(plan.interval);
  const [roleKey, setRoleKey] = useState(plan.role_key ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDailyRequests(String(plan.daily_ai_requests));
    setFeatureKeys(plan.feature_keys);
    setActive(plan.active);
    setPaypalPlanId(plan.paypal_plan_id);
    setPrice(plan.price);
    setCurrency(plan.currency);
    setInterval(plan.interval);
    setRoleKey(plan.role_key ?? '');
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
        price,
        currency,
        interval,
        role_key: roleKey || null,
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
      <label htmlFor={`plan-${plan.plan_key}-price`}>Price</label>
      <input
        id={`plan-${plan.plan_key}-price`}
        type="number"
        min={0}
        step="0.01"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        required
      />
      <label htmlFor={`plan-${plan.plan_key}-currency`}>Currency</label>
      <input
        id={`plan-${plan.plan_key}-currency`}
        type="text"
        maxLength={3}
        value={currency}
        onChange={(event) => setCurrency(event.target.value.toUpperCase())}
        required
      />
      <label htmlFor={`plan-${plan.plan_key}-interval`}>Billing interval</label>
      <select
        id={`plan-${plan.plan_key}-interval`}
        value={interval}
        onChange={(event) => setInterval(event.target.value)}
      >
        <option value="day">day</option>
        <option value="week">week</option>
        <option value="month">month</option>
        <option value="year">year</option>
      </select>
      <label htmlFor={`plan-${plan.plan_key}-role`}>Permission role</label>
      <select
        id={`plan-${plan.plan_key}-role`}
        value={roleKey}
        onChange={(event) => setRoleKey(event.target.value)}
      >
        <option value="">No role (legacy plan features)</option>
        {roles.map((role) => (
          <option key={role.role_key} value={role.role_key}>
            {role.label}
          </option>
        ))}
      </select>
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
  const [roles, setRoles] = useState<EntitlementRole[] | null>(null);
  const [globals, setGlobals] = useState<Record<string, GlobalCapability> | null>(null);
  const [retentionPolicy, setRetentionPolicy] = useState<CloudRetentionPolicy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in' || !auth.user.is_application_admin) return;
    Promise.all([
      fetchSiteSettings(),
      fetchPlans(),
      fetchRoles(),
      fetchGlobalCapabilities(),
      fetchCloudRetentionPolicy(),
    ])
      .then(([settings, planList, roleList, globalList, retention]) => {
        setSiteSettings(settings);
        setPlans(planList);
        setRoles(roleList);
        setGlobals(globalList);
        setRetentionPolicy(retention);
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
              roles={roles ?? []}
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
      {roles && globals && (
        <EntitlementPolicy
          roles={roles}
          globals={globals}
          onRoles={setRoles}
          onGlobals={setGlobals}
        />
      )}
      {retentionPolicy && (
        <CloudRetentionSettings policy={retentionPolicy} onSaved={setRetentionPolicy} />
      )}
    </section>
  );
}

export default AdminSettings;
