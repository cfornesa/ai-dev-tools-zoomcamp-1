import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  type Plan,
  type EntitlementRole,
  type GlobalCapability,
  type CloudRetentionPolicy,
  type SiteSettings,
  type AIProviderModel,
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
  fetchAIProviderModels,
  createAIProviderModel,
  updateAIProviderModel,
  deleteAIProviderModel,
  type ProfileStyle,
  fetchProfileStyles,
  createProfileStyle,
  updateProfileStyle,
} from '../api/adminSettings';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import AdminConsoleNav from '../components/AdminConsoleNav';

const DEFAULT_THEME = {
  background: '#0b0d12',
  surface: '#151923',
  text: '#f3f4f6',
  muted: '#9ca3af',
  accent: '#c084fc',
};

function SiteTitleForm({
  settings,
  styles,
  onSaved,
}: {
  settings: SiteSettings;
  styles: ProfileStyle[];
  onSaved: (next: SiteSettings) => void;
}) {
  const [title, setTitle] = useState(settings.site_title);
  const [description, setDescription] = useState(settings.site_description ?? '');
  const [metadataTags, setMetadataTags] = useState((settings.metadata_tags ?? []).join(', '));
  const [theme, setTheme] = useState<Record<string, string>>({
    ...DEFAULT_THEME,
    ...(settings.theme_config ?? {}),
  });
  const [themeCleared, setThemeCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [styleKey, setStyleKey] = useState(settings.style_key ?? 'default');

  useEffect(() => {
    setTitle(settings.site_title);
    setDescription(settings.site_description ?? '');
    setMetadataTags((settings.metadata_tags ?? []).join(', '));
    setTheme({ ...DEFAULT_THEME, ...(settings.theme_config ?? {}) });
    setThemeCleared(false);
    setStyleKey(settings.style_key ?? 'default');
  }, [settings]);

  const dirty =
    title !== settings.site_title ||
    description !== (settings.site_description ?? '') ||
    metadataTags !== (settings.metadata_tags ?? []).join(', ') ||
    styleKey !== (settings.style_key ?? 'default') ||
    themeCleared ||
    JSON.stringify(theme) !==
      JSON.stringify({ ...DEFAULT_THEME, ...(settings.theme_config ?? {}) });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updateSiteSettings(
        title,
        settings.revision,
        themeCleared ? {} : theme,
        styleKey,
        description,
        metadataTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      );
      onSaved(next);
      setMessage('Global site metadata saved.');
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
    setDescription(settings.site_description ?? '');
    setMetadataTags((settings.metadata_tags ?? []).join(', '));
    setTheme({ ...DEFAULT_THEME, ...(settings.theme_config ?? {}) });
    setThemeCleared(false);
    setStyleKey(settings.style_key ?? 'default');
    setError(null);
    setMessage(null);
  }

  return (
    <form onSubmit={submit} aria-label="Site title settings" className="admin-settings-form">
      <label>
        Site title
        <input
          id="site-title-input"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
        />
      </label>
      <label>
        Site description
        <textarea
          id="site-description-input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          rows={3}
        />
      </label>
      <label>
        Metadata tags
        <input
          id="site-metadata-tags-input"
          type="text"
          value={metadataTags}
          onChange={(event) => setMetadataTags(event.target.value)}
          placeholder="creative coding, generative art"
          aria-describedby="site-metadata-tags-help"
        />
      </label>
      <p id="site-metadata-tags-help">Separate tags with commas.</p>
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
      <label>
        Global style preset
        <select
          id="site-style-select"
          value={styleKey}
          onChange={(event) => setStyleKey(event.target.value)}
        >
          {styles
            .filter((style) => style.enabled)
            .map((style) => (
              <option key={style.key} value={style.key}>
                {style.label}
              </option>
            ))}
        </select>
      </label>
      <div className="admin-settings-actions">
        <button className="admin-action-primary" type="submit" disabled={busy || !dirty}>
          Save
        </button>
        <button
          className="admin-action-secondary"
          type="button"
          onClick={cancel}
          disabled={busy || !dirty}
        >
          Cancel
        </button>
        <button
          className="admin-action-secondary"
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
        <button className="admin-action-primary" type="submit" disabled={busy}>
          Save retention policy
        </button>
        <button
          className="admin-action-danger"
          type="button"
          onClick={() => void purge()}
          disabled={busy}
        >
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
      <label>
        Daily AI requests
        <input
          id={`plan-${plan.plan_key}-daily`}
          type="number"
          min={0}
          step={1}
          value={dailyRequests}
          onChange={(event) => setDailyRequests(event.target.value)}
          required
        />
      </label>
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
      <label>
        PayPal plan id
        <input
          id={`plan-${plan.plan_key}-paypal`}
          type="text"
          value={paypalPlanId}
          onChange={(event) => setPaypalPlanId(event.target.value)}
        />
      </label>
      <label>
        Price
        <input
          id={`plan-${plan.plan_key}-price`}
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
        />
      </label>
      <label>
        Currency
        <input
          id={`plan-${plan.plan_key}-currency`}
          type="text"
          maxLength={3}
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          required
        />
      </label>
      <label>
        Billing interval
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
      </label>
      <label>
        Permission role
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
      </label>
      <div className="admin-settings-actions">
        <button className="admin-action-primary" type="submit" disabled={busy}>
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

const AI_PROVIDER_OPTIONS = ['mistral', 'gemini', 'deepseek'] as const;
const AI_TASK_KIND_OPTIONS = [
  ['one_shot_2d', 'One-shot 2D'],
  ['one_shot_3d', 'One-shot 3D'],
  ['agent_2d', 'Agent run (2D)'],
  ['agent_3d', 'Agent run (3D)'],
] as const;

function AIModelCatalogRow({
  model,
  onSaved,
  onDeleted,
}: {
  model: AIProviderModel;
  onSaved: (next: AIProviderModel) => void;
  onDeleted: (id: number) => void;
}) {
  const [displayLabel, setDisplayLabel] = useState(model.display_label);
  const [taskKinds, setTaskKinds] = useState<string[]>(model.task_kinds);
  const [agenticSupported, setAgenticSupported] = useState(model.agentic_supported);
  const [active, setActive] = useState(model.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function toggleTaskKind(key: string) {
    setTaskKinds((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await updateAIProviderModel(model.id, {
        revision: model.revision,
        display_label: displayLabel,
        task_kinds: taskKinds,
        agentic_supported: agenticSupported,
        active,
      });
      onSaved(next);
      setMessage('Saved.');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'This entry changed elsewhere. Reload before saving.'
          : 'Could not save this catalog entry.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the catalog entry for ${model.vendor}/${model.model_slug}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAIProviderModel(model.id, model.revision);
      onDeleted(model.id);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'This entry changed elsewhere. Reload before deleting.'
          : 'Could not delete this catalog entry.',
      );
      setBusy(false);
    }
  }

  return (
    <form
      className="admin-settings-form ai-model-catalog-row"
      aria-label={`Catalog entry ${model.vendor}/${model.model_slug}`}
      onSubmit={save}
    >
      <h4>
        {model.vendor}/{model.model_slug}
      </h4>
      <label htmlFor={`ai-model-label-${model.id}`}>
        Display label
        <input
          id={`ai-model-label-${model.id}`}
          type="text"
          value={displayLabel}
          onChange={(event) => setDisplayLabel(event.target.value)}
          required
        />
      </label>
      <fieldset>
        <legend>Task kinds</legend>
        {AI_TASK_KIND_OPTIONS.map(([key, label]) => (
          <label key={key} htmlFor={`ai-model-${model.id}-${key}`}>
            <input
              id={`ai-model-${model.id}-${key}`}
              type="checkbox"
              checked={taskKinds.includes(key)}
              onChange={() => toggleTaskKind(key)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`ai-model-agentic-${model.id}`}>
        <input
          id={`ai-model-agentic-${model.id}`}
          type="checkbox"
          checked={agenticSupported}
          onChange={(event) => setAgenticSupported(event.target.checked)}
        />
        Agentic supported (a product capability declaration, not proof of safe arbitrary code
        execution)
      </label>
      <label htmlFor={`ai-model-active-${model.id}`}>
        <input
          id={`ai-model-active-${model.id}`}
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Active (offered to the AI editor model controls)
      </label>
      <div className="admin-settings-actions">
        <button className="admin-action-primary" type="submit" disabled={busy}>
          Save
        </button>
        <button
          className="admin-action-danger"
          type="button"
          onClick={() => void remove()}
          disabled={busy}
        >
          Delete
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function AIModelCatalogCreateForm({ onCreated }: { onCreated: (model: AIProviderModel) => void }) {
  const [vendor, setVendor] = useState<(typeof AI_PROVIDER_OPTIONS)[number]>('mistral');
  const [modelSlug, setModelSlug] = useState('');
  const [displayLabel, setDisplayLabel] = useState('');
  const [taskKinds, setTaskKinds] = useState<string[]>([]);
  const [agenticSupported, setAgenticSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTaskKind(key: string) {
    setTaskKinds((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createAIProviderModel({
        vendor,
        model_slug: modelSlug,
        display_label: displayLabel,
        task_kinds: taskKinds,
        agentic_supported: agenticSupported,
      });
      onCreated(created);
      setModelSlug('');
      setDisplayLabel('');
      setTaskKinds([]);
      setAgenticSupported(false);
    } catch {
      setError('Could not create this catalog entry. Check the provider, slug, and task kinds.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-settings-form" aria-label="Add AI model catalog entry" onSubmit={create}>
      <h4>Add a model</h4>
      <label htmlFor="ai-model-new-vendor">
        Provider
        <select
          id="ai-model-new-vendor"
          value={vendor}
          onChange={(event) =>
            setVendor(event.target.value as (typeof AI_PROVIDER_OPTIONS)[number])
          }
        >
          {AI_PROVIDER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="ai-model-new-slug">
        Model slug
        <input
          id="ai-model-new-slug"
          type="text"
          value={modelSlug}
          onChange={(event) => setModelSlug(event.target.value)}
          required
        />
      </label>
      <label htmlFor="ai-model-new-label">
        Display label
        <input
          id="ai-model-new-label"
          type="text"
          value={displayLabel}
          onChange={(event) => setDisplayLabel(event.target.value)}
          required
        />
      </label>
      <fieldset>
        <legend>Task kinds</legend>
        {AI_TASK_KIND_OPTIONS.map(([key, label]) => (
          <label key={key} htmlFor={`ai-model-new-${key}`}>
            <input
              id={`ai-model-new-${key}`}
              type="checkbox"
              checked={taskKinds.includes(key)}
              onChange={() => toggleTaskKind(key)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label htmlFor="ai-model-new-agentic">
        <input
          id="ai-model-new-agentic"
          type="checkbox"
          checked={agenticSupported}
          onChange={(event) => setAgenticSupported(event.target.checked)}
        />
        Agentic supported
      </label>
      <div className="admin-settings-actions">
        <button
          className="admin-action-primary"
          type="submit"
          disabled={busy || taskKinds.length === 0}
        >
          Add model
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function AIModelCatalogSettings({
  models,
  onModels,
}: {
  models: AIProviderModel[];
  onModels: (next: AIProviderModel[]) => void;
}) {
  return (
    <div className="ai-model-catalog">
      <h3>AI model catalog</h3>
      <p>
        Declares which provider/model pairs the AI editor may offer, and which of those are enabled
        for bounded agent runs. Enabling agentic support is a product capability declaration -- it
        does not test provider quality or introduce shell, browser, credential, publishing, or
        autonomous deletion tools.
      </p>
      {models.map((model) => (
        <AIModelCatalogRow
          key={model.id}
          model={model}
          onSaved={(next) =>
            onModels(models.map((existing) => (existing.id === next.id ? next : existing)))
          }
          onDeleted={(id) => onModels(models.filter((existing) => existing.id !== id))}
        />
      ))}
      <AIModelCatalogCreateForm onCreated={(created) => onModels([...models, created])} />
    </div>
  );
}

function ProfileStyleCatalogSettings({
  styles,
  onStyles,
}: {
  styles: ProfileStyle[];
  onStyles: (next: ProfileStyle[]) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function toggle(style: ProfileStyle) {
    try {
      const next = await updateProfileStyle({ ...style, enabled: !style.enabled });
      onStyles(styles.map((item) => (item.id === next.id ? next : item)));
    } catch {
      setError('Could not update that profile style.');
    }
  }
  async function rename(style: ProfileStyle, label: string) {
    try {
      const next = await updateProfileStyle({ ...style, label });
      onStyles(styles.map((item) => (item.id === next.id ? next : item)));
    } catch {
      setError('Could not update that profile style.');
    }
  }
  async function create() {
    const key = newKey.trim().toLowerCase();
    if (!key) return;
    try {
      const created = await createProfileStyle({
        key,
        label: key,
        description: 'A token-only profile style.',
        tokens: { accent: '#c084fc' },
        presentation: {
          font_family: 'system',
          density: 'comfortable',
          radius: 'soft',
          border_style: 'solid',
        },
        enabled: true,
      });
      onStyles([...styles, created]);
      setNewKey('');
      setError(null);
    } catch {
      setError('Could not create that profile style.');
    }
  }
  return (
    <section className="admin-settings-card" aria-labelledby="profile-style-catalog-heading">
      <h3 id="profile-style-catalog-heading">Profile style catalog</h3>
      <p>Manage safe, token-only styles available in public profile settings.</p>
      {styles.map((style) => (
        <div className="admin-style-row" key={style.id}>
          <label htmlFor={`profile-style-label-${style.id}`}>Style label</label>
          <input
            id={`profile-style-label-${style.id}`}
            value={style.label}
            onChange={(event) =>
              onStyles(
                styles.map((item) =>
                  item.id === style.id ? { ...item, label: event.target.value } : item,
                ),
              )
            }
            onBlur={(event) => void rename(style, event.target.value)}
          />
          <span>{style.key}</span>
          <button
            className="admin-action-secondary"
            type="button"
            onClick={() => void toggle(style)}
          >
            {style.enabled ? 'Disable' : 'Enable'}
          </button>
          <div
            aria-label={`${style.label} preview`}
            className="profile-style-preview"
            style={{
              backgroundColor: style.tokens.background,
              color: style.tokens.text,
              borderColor: style.tokens.accent,
            }}
          >
            {style.enabled ? 'Enabled preview' : 'Disabled preview'}
          </div>
        </div>
      ))}
      <div className="admin-settings-actions">
        <label htmlFor="new-profile-style-key">New style key</label>
        <input
          id="new-profile-style-key"
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <button className="admin-action-primary" type="button" onClick={() => void create()}>
          Create style
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function AdminSettings() {
  const auth = useAuth();
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [roles, setRoles] = useState<EntitlementRole[] | null>(null);
  const [globals, setGlobals] = useState<Record<string, GlobalCapability> | null>(null);
  const [retentionPolicy, setRetentionPolicy] = useState<CloudRetentionPolicy | null>(null);
  const [aiModels, setAiModels] = useState<AIProviderModel[] | null>(null);
  const [profileStyles, setProfileStyles] = useState<ProfileStyle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in' || !auth.user.is_application_admin) return;
    Promise.all([
      fetchSiteSettings(),
      fetchPlans(),
      fetchRoles(),
      fetchGlobalCapabilities(),
      fetchCloudRetentionPolicy(),
      fetchAIProviderModels(),
      fetchProfileStyles(),
    ])
      .then(([settings, planList, roleList, globalList, retention, models, styles]) => {
        setSiteSettings(settings);
        setPlans(planList);
        setRoles(roleList);
        setGlobals(globalList);
        setRetentionPolicy(retention);
        setAiModels(models);
        setProfileStyles(styles);
      })
      .catch(() => setLoadError('Could not load admin settings.'));
  }, [auth]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in' || !auth.user.is_application_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="content-panel admin-settings">
      <AdminConsoleNav current="settings" />
      <h2>Admin settings</h2>
      {loadError && (
        <p role="alert" aria-live="assertive">
          {loadError}
        </p>
      )}
      {siteSettings ? (
        <section className="admin-console-section" aria-labelledby="admin-site-section-heading">
          <h3 id="admin-site-section-heading">Site identity and global theme</h3>
          <SiteTitleForm
            settings={siteSettings}
            styles={profileStyles ?? []}
            onSaved={setSiteSettings}
          />
        </section>
      ) : (
        !loadError && <p role="status">Loading site settings…</p>
      )}
      {plans ? (
        <section className="admin-console-section" aria-labelledby="admin-entitlements-heading">
          <h3 id="admin-entitlements-heading">Plans and capabilities</h3>
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
        </section>
      ) : (
        !loadError && <p role="status">Loading plans…</p>
      )}
      {roles && globals && (
        <section className="admin-console-section" aria-labelledby="admin-policy-section-heading">
          <h3 id="admin-policy-section-heading">Role and global access policy</h3>
          <EntitlementPolicy
            roles={roles}
            globals={globals}
            onRoles={setRoles}
            onGlobals={setGlobals}
          />
        </section>
      )}
      {retentionPolicy && (
        <section className="admin-console-section" aria-labelledby="admin-retention-heading">
          <h3 id="admin-retention-heading">Cloud retention</h3>
          <CloudRetentionSettings policy={retentionPolicy} onSaved={setRetentionPolicy} />
        </section>
      )}
      {aiModels ? (
        <section className="admin-console-section" aria-labelledby="admin-models-heading">
          <h3 id="admin-models-heading">AI provider models</h3>
          <AIModelCatalogSettings models={aiModels} onModels={setAiModels} />
        </section>
      ) : (
        !loadError && <p role="status">Loading AI model catalog…</p>
      )}
      {profileStyles ? (
        <section className="admin-console-section" aria-labelledby="admin-styles-heading">
          <h3 id="admin-styles-heading">Profile style catalog</h3>
          <ProfileStyleCatalogSettings styles={profileStyles} onStyles={setProfileStyles} />
        </section>
      ) : (
        !loadError && <p role="status">Loading profile style catalog…</p>
      )}
    </section>
  );
}

export default AdminSettings;
