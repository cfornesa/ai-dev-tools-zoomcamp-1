import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import { getSceneVersion, type SceneDocument, type SceneVersion } from '../api/projects';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { ScenePreview, SceneRendererId } from '../render/scenePreview';
import AIRunPanel, { type AIRunSelectableObject } from './AIRunPanel';
import { buildOutline } from './sceneOutline';
import { useAIProposal, type ProposalMode } from './useAIProposal';
import { useAIRun } from './useAIRun';
import { useSavedAIPreferences } from './useSavedAIPreferences';

/** Issue #462/#463: the 2D-specific candidate-preview renderer passed to
 * the shared `AIRunPanel` -- mounts its own p5 instance against the
 * run's `candidate_scene`, the same lifecycle `AIProposalPanel`'s own
 * one-shot preview below already uses, just scoped to one candidate
 * scene rather than a live `proposal`. */
function AIRunCandidatePreview2D({ scene }: { scene: SceneDocument }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ScenePreview | null>(null);
  const rendererRef = useRef<SceneRendererId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const rendererId = resolveSceneRendererId(scene);
    const preview = createScenePreview(mountRef.current, rendererId);
    previewRef.current = preview;
    rendererRef.current = rendererId;
    try {
      preview.render(scene);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not render this candidate.');
    }
    return () => {
      preview.destroy();
      previewRef.current = null;
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-renders whenever `scene` identity changes
  }, [scene]);

  return (
    <>
      <div ref={mountRef} aria-hidden="true" />
      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </>
  );
}

type WorkflowMode = 'one-shot' | 'agent';

type AIProposalPanelProps = {
  projectId: string;
  /** The editor's current working scene — read (never written) as the
   * source for an edit proposal, and rendered as the "before" reference.
   * Generating or previewing a proposal never mutates this. */
  workingCopy: SceneDocument | null;
  /** `project.current_version_id` at render time — captured into the
   * proposal when generation starts, then resent unchanged on Accept so
   * the server can detect a stale base. */
  currentVersionId: number | null;
  /** Called only after Accept has actually persisted a new version — the
   * caller is responsible for updating `persistedVersion`/`workingCopy`/
   * `project` from the returned version, exactly like
   * `VersionHistoryPanel`'s `onSaved`. Reject never calls this. */
  onAccepted: (version: SceneVersion) => void;
  /** Issue #159: when set, seeds this panel into Edit mode with a specific
   * prompt — e.g. "Ask AI to fix this" from `EditorWorkspace.tsx`'s
   * `previewError`. Re-applies every time `nonce` changes (even to the
   * identical `prompt` text), which is why `nonce` exists: two clicks
   * describing the same error must each re-seed, not just the first. */
  seed?: { prompt: string; nonce: number } | null;
};

const MODE_LABELS: Record<ProposalMode, string> = {
  create: 'Generate a new scene',
  edit: 'Propose an edit',
};

const PROVIDER_MODELS = {
  mistral: [],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
} as const;

/**
 * Task 48: the AI proposal UI — prompt entry, pending, success (visual
 * preview + summary), and the three documented error states, plus
 * Accept/Reject. Shared by "Create" and "Edit" via `mode`; both go through
 * the same `useAIProposal` state machine.
 *
 * The preview is a wholly separate p5 instance from the main editor
 * canvas (`EditorWorkspace.tsx`'s own `previewRef`) — it renders
 * `proposal.scene`, never `workingCopy`, and is destroyed whenever there
 * is no proposal to show, so a rejected/accepted/cleared proposal never
 * leaves a stale rendering behind.
 */
function AIProposalPanel({
  projectId,
  workingCopy,
  currentVersionId,
  onAccepted,
  seed,
}: AIProposalPanelProps) {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    model,
    setModel,
    vendor,
    setVendor,
    personaId,
    setPersonaId,
    phase,
    genError,
    proposal,
    generate,
    cancelGeneration,
    reject,
    accept,
    acceptState,
    attemptCount,
    retryGeneration,
    canRetryGeneration,
  } = useAIProposal(projectId);

  // Issue #462: the persisted "Agent workflow" run, offered alongside the
  // one-shot flow above rather than replacing it -- both hooks are always
  // mounted (an in-progress agent run must keep polling even while this
  // panel happens to render the one-shot form), and only one is visible
  // at a time via `workflowMode`.
  const aiRun = useAIRun<SceneVersion>('project', projectId, getSceneVersion);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('one-shot');

  // Issue #462's own acceptance criterion: "Resolve selection to stable
  // IDs rather than trusting text mentions" -- reuses the same outline
  // rows the Layers panel is built from (`sceneOutline.ts`), restricted
  // to `shape` rows only. This is also what makes an unsupported draw.io
  // graph node "explicitly unavailable rather than flattened or silently
  // altered" for a scoped edit: `buildOutline` never emits graph nodes at
  // all, so one can never be selected here in the first place.
  const aiRunSelectableObjects: AIRunSelectableObject[] = workingCopy
    ? buildOutline(workingCopy)
        .filter((row) => row.kind === 'shape')
        .map((row) => ({ id: row.id, label: row.label, disabled: row.inheritedLocked }))
    : [];

  // Carries vendor/model/persona over when switching between the one-shot
  // and agent flows -- a snapshot at the moment of the switch (the same
  // pattern `seed` below uses to carry a prompt into this panel), not a
  // continuous two-way binding, since the two flows otherwise keep
  // entirely independent state.
  function handleWorkflowModeChange(next: WorkflowMode) {
    if (next === workflowMode) return;
    if (next === 'agent') {
      aiRun.setVendor(vendor);
      aiRun.setModel(model);
      aiRun.setPersonaId(personaId);
    } else {
      setVendor(aiRun.vendor);
      setModel(aiRun.model);
      setPersonaId(aiRun.personaId);
    }
    setWorkflowMode(next);
  }

  const { models: savedModels, personas: savedPersonas } = useSavedAIPreferences();

  // Issue #159: applies (or re-applies) the caller's seed — switches this
  // panel to Edit mode and fills in `prompt` — every time `seed?.nonce`
  // changes. Keyed off `nonce` rather than the `seed` object's identity or
  // `seed.prompt` text alone so a second "Ask AI to fix this" click with
  // the exact same error message still re-seeds (a caller that memoized
  // the same object/string wouldn't otherwise re-trigger this effect).
  useEffect(() => {
    if (!seed) return;
    setMode('edit');
    setPrompt(seed.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  const previewMountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ScenePreview | null>(null);
  // Issue #206: which renderer adapter `previewRef.current` currently is,
  // so the render effect below can tell it apart from the renderer the
  // incoming `proposal.scene` actually wants and recreate the preview
  // instance when they differ (e.g. a create-proposal for a canvas2d scene
  // arriving while this panel still has the default p5 instance mounted).
  const previewRendererRef = useRef<SceneRendererId | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewMountRef.current) return;
    const preview = createScenePreview(previewMountRef.current, 'p5');
    previewRef.current = preview;
    previewRendererRef.current = 'p5';
    return () => {
      preview.destroy();
      previewRef.current = null;
      previewRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!proposal) {
      setPreviewError(null);
      return;
    }
    const rendererId = resolveSceneRendererId(proposal.scene);
    if (previewMountRef.current && previewRendererRef.current !== rendererId) {
      previewRef.current?.destroy();
      previewRef.current = createScenePreview(previewMountRef.current, rendererId);
      previewRendererRef.current = rendererId;
    }
    if (!previewRef.current) return;
    try {
      previewRef.current.render(proposal.scene);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this proposal.');
    }
  }, [proposal]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await generate(workingCopy, currentVersionId);
  }

  async function handleAccept() {
    const version = await accept();
    if (version) onAccepted(version);
  }

  const pending = phase === 'pending';

  const modeRoving = useRovingRadioGroup(
    [
      { value: 'create' as const, disabled: pending || acceptState.pending },
      { value: 'edit' as const, disabled: pending || acceptState.pending },
    ],
    mode,
    setMode,
  );

  return (
    <div className="ai-proposal-panel">
      <h4>AI assistant</h4>

      {/* Issue #462: offered alongside the one-shot flow below, not in
          place of it -- "Agent workflow" is a bounded, persisted
          plan-validate-revise run with real progress and an intermediate
          preview; the one-shot flow stays the fast path for a single
          create/edit. */}
      <div role="radiogroup" aria-label="AI workflow" className="editor-tool-group">
        <button
          type="button"
          role="radio"
          aria-checked={workflowMode === 'one-shot'}
          onClick={() => handleWorkflowModeChange('one-shot')}
        >
          One-shot
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={workflowMode === 'agent'}
          onClick={() => handleWorkflowModeChange('agent')}
        >
          Agent workflow
        </button>
      </div>

      {workflowMode === 'agent' && (
        <AIRunPanel
          aiRun={aiRun}
          workingCopy={workingCopy}
          onAccepted={onAccepted}
          selectableObjects={aiRunSelectableObjects}
          renderCandidatePreview={(scene) => (
            <AIRunCandidatePreview2D scene={scene as SceneDocument} />
          )}
        />
      )}

      {workflowMode === 'one-shot' && (
        <>
          <div role="radiogroup" aria-label="AI action" className="editor-tool-group">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'create'}
              disabled={pending || acceptState.pending}
              onClick={() => setMode('create')}
              {...modeRoving.getRadioProps('create')}
            >
              Create
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'edit'}
              disabled={pending || acceptState.pending}
              onClick={() => setMode('edit')}
              {...modeRoving.getRadioProps('edit')}
            >
              Edit
            </button>
          </div>

          <form aria-label={MODE_LABELS[mode]} onSubmit={handleSubmit}>
            <div className="behavior-card-field ai-proposal-field-full-width">
              <label htmlFor="ai-proposal-vendor">AI provider</label>
              <select
                id="ai-proposal-vendor"
                className="ai-proposal-field-full-width"
                value={vendor}
                disabled={pending}
                onChange={(event) => {
                  const nextVendor = event.target.value as typeof vendor;
                  setVendor(nextVendor);
                  setModel(nextVendor === 'mistral' ? '' : PROVIDER_MODELS[nextVendor][0]);
                }}
              >
                <option value="mistral">Mistral</option>
                <option value="gemini">Google Gemini</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div className="behavior-card-field">
              <label htmlFor="ai-proposal-prompt">
                {mode === 'create'
                  ? 'Describe the scene you want to generate'
                  : 'Describe the change you want to make'}
              </label>
              <textarea
                id="ai-proposal-prompt"
                value={prompt}
                disabled={pending}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </div>
            {/* Issue #198/#262: optional, defaults to the server's own model.
            Sourced from the user's saved Mistral models (Account
            settings, #261) rather than free text -- the selected value is
            still remembered per browser via `useAIProposal`'s own
            localStorage key. A malformed id is caught by the server's
            existing `model_invalid` validation error, surfaced through
            the same error UI as every other validation error below. */}
            <div className="behavior-card-field ai-proposal-field-full-width">
              <label htmlFor="ai-proposal-model">
                {vendor === 'mistral' ? 'Mistral' : vendor} model (optional)
              </label>
              {vendor !== 'mistral' ? (
                <select
                  id="ai-proposal-model"
                  className="ai-proposal-field-full-width"
                  value={model || PROVIDER_MODELS[vendor][0]}
                  disabled={pending}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {PROVIDER_MODELS[vendor].map((providerModel) => (
                    <option key={providerModel} value={providerModel}>
                      {providerModel}
                    </option>
                  ))}
                </select>
              ) : savedModels.length === 0 ? (
                <p className="ai-proposal-empty-preference">
                  No saved models yet — add one in <a href="/account/settings">Account settings</a>{' '}
                  to pick from a list here.
                </p>
              ) : (
                <select
                  id="ai-proposal-model"
                  className="ai-proposal-field-full-width"
                  value={model}
                  disabled={pending}
                  onChange={(event) => setModel(event.target.value)}
                >
                  <option value="">Uses the account default</option>
                  {savedModels.map((saved) => (
                    <option key={saved.id} value={saved.slug}>
                      {saved.label ? `${saved.label} (${saved.slug})` : saved.slug}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {/* Issue #257/#262: an optional Persona layers additive style/tone
            guidance on top of the mandatory technical system prompt --
            never a replacement for it (#260). */}
            <div className="behavior-card-field ai-proposal-field-full-width">
              <label htmlFor="ai-proposal-persona">Persona (optional)</label>
              {savedPersonas.length === 0 ? (
                <p className="ai-proposal-empty-preference">
                  No Personas yet — add one in <a href="/account/settings">Account settings</a> to
                  pick from a list here.
                </p>
              ) : (
                <select
                  id="ai-proposal-persona"
                  className="ai-proposal-field-full-width"
                  value={personaId ?? ''}
                  disabled={pending}
                  onChange={(event) =>
                    setPersonaId(event.target.value === '' ? null : Number(event.target.value))
                  }
                >
                  <option value="">No persona</option>
                  {savedPersonas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button type="submit" disabled={pending || prompt.trim().length === 0}>
              {pending ? 'Generating…' : mode === 'create' ? 'Generate scene' : 'Propose edit'}
            </button>
            {pending && (
              <button type="button" onClick={cancelGeneration} data-testid="ai-cancel-generation">
                Cancel
              </button>
            )}
          </form>

          {pending && (
            <p role="status" aria-live="polite" data-testid="ai-pending-status">
              {attemptCount > 1
                ? `Contacting the AI assistant… (attempt ${attemptCount})`
                : 'Contacting the AI assistant…'}
            </p>
          )}

          {(phase === 'validation-error' ||
            phase === 'quota-error' ||
            phase === 'provider-error') &&
            genError && (
              <div role="alert" aria-live="assertive" data-testid={`ai-error-${phase}`}>
                <p>{genError.message}</p>
                {attemptCount > 1 && <p>Failed after {attemptCount} attempts.</p>}
                {genError.code === 'personal_key_required' && (
                  <p>
                    <a href="/account/settings">
                      Configure your personal Mistral key in Account settings
                    </a>
                  </p>
                )}
                {canRetryGeneration && (
                  <button
                    type="button"
                    data-testid="ai-retry-generation"
                    onClick={() => void retryGeneration(workingCopy, currentVersionId)}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

          {phase === 'success' && proposal && (
            <section aria-label="AI proposal preview" data-testid="ai-proposal-success">
              <p role="status" aria-live="polite">
                Proposal ready. Nothing has been saved yet — review, then Accept or Reject.
              </p>
              <div
                ref={previewMountRef}
                data-testid="ai-proposal-preview-canvas"
                className="ai-proposal-preview"
                aria-hidden="true"
              />
              {previewError && (
                <p role="alert" aria-live="assertive">
                  {previewError}
                </p>
              )}
              <p data-testid="ai-proposal-summary">{proposal.summary}</p>

              <div className="editor-tool-group">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={acceptState.pending}
                  data-testid="ai-accept-button"
                >
                  {acceptState.pending ? 'Accepting…' : 'Accept'}
                </button>
                <button
                  type="button"
                  onClick={reject}
                  disabled={acceptState.pending}
                  data-testid="ai-reject-button"
                >
                  Reject
                </button>
              </div>

              {acceptState.error && (
                <div role="alert" aria-live="assertive" data-testid="ai-accept-error">
                  <p>{acceptState.error.message}</p>
                  {acceptState.error.kind === 'auth' && (
                    <p>
                      <a href="/accounts/login/">Sign in again</a>
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default AIProposalPanel;
