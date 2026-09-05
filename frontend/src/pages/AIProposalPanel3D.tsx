import { useEffect, useRef, type FormEvent } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import type { SceneVersion3D } from '../api/projects3d';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';
import { useAIProposal3D, type ProposalMode3D } from './useAIProposal3D';
import { useSavedAIPreferences } from './useSavedAIPreferences';

const PROVIDER_MODELS = {
  mistral: [],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
} as const;

type AIProposalPanel3DProps = {
  projectId: string;
  workingCopy: Scene3DDocument | null;
  currentVersionId: number | null;
  onAccepted: (version: SceneVersion3D) => void;
  /** Issue #283: the 3D counterpart of `AIProposalPanel.tsx`'s identically
   * named/shaped prop (issue #159) — when set, seeds this panel into Edit
   * mode with a specific prompt every time `seed.nonce` changes. */
  seed?: { prompt: string; nonce: number } | null;
};

const MODE_LABELS: Record<ProposalMode3D, string> = {
  create: 'Generate a new scene',
  edit: 'Propose an edit',
};

/**
 * Issue #232: the 3D counterpart of `AIProposalPanel.tsx` -- same prompt
 * entry / pending / success / error states and Accept/Reject flow, driven
 * by `useAIProposal3D` instead. Issue #267: the success state now also
 * renders a live `Scene3DPreview` of `proposal.scene` (never
 * `workingCopy`), reusing the same Three.js component `Project3DWorkspace.tsx`/
 * `AiProject3DWorkspace.tsx` use for the real editor canvas -- so the user
 * sees exactly what a Create/Edit proposal will produce before choosing
 * Accept or Reject, mirroring the 2D panel's `previewMountRef` preview.
 * Rejecting only clears client-side proposal state (`reject()` in
 * `useAIProposal3D.ts`); the working/saved scene is never touched.
 */
function AIProposalPanel3D({
  projectId,
  workingCopy,
  currentVersionId,
  onAccepted,
  seed,
}: AIProposalPanel3DProps) {
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
  } = useAIProposal3D(projectId);

  const { models: savedModels, personas: savedPersonas } = useSavedAIPreferences();

  const workingCopyRef = useRef(workingCopy);
  workingCopyRef.current = workingCopy;

  // Issue #283: mirrors `AIProposalPanel.tsx`'s identical #159 seed effect
  // exactly — keyed off `seed?.nonce` (not the `seed` object's identity or
  // its `prompt` text alone) so a second seed with the same prompt text
  // still re-applies.
  useEffect(() => {
    if (!seed) return;
    setMode('edit');
    setPrompt(seed.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [seed?.nonce]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await generate(workingCopyRef.current, currentVersionId);
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

  const proposedScene = proposal?.scene as
    { objects?: unknown[]; lights?: unknown[]; groups?: unknown[] } | undefined;

  return (
    <div className="ai-proposal-panel">
      <h4>AI assistant</h4>

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
        <div className="behavior-card-field">
          <label htmlFor="ai-proposal-3d-prompt">
            {mode === 'create'
              ? 'Describe the scene you want to generate'
              : 'Describe the change you want to make'}
          </label>
          <textarea
            id="ai-proposal-3d-prompt"
            value={prompt}
            disabled={pending}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="ai-proposal-3d-vendor">AI provider</label>
          <select
            id="ai-proposal-3d-vendor"
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
        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="ai-proposal-3d-model">
            {vendor === 'mistral' ? 'Mistral' : vendor} model (optional)
          </label>
          {vendor !== 'mistral' ? (
            <select
              id="ai-proposal-3d-model"
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
              No saved models yet — add one in <a href="/account/settings">Account settings</a> to
              pick from a list here.
            </p>
          ) : (
            <select
              id="ai-proposal-3d-model"
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
        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="ai-proposal-3d-persona">Persona (optional)</label>
          {savedPersonas.length === 0 ? (
            <p className="ai-proposal-empty-preference">
              No Personas yet — add one in <a href="/account/settings">Account settings</a> to pick
              from a list here.
            </p>
          ) : (
            <select
              id="ai-proposal-3d-persona"
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
          <button type="button" onClick={cancelGeneration} data-testid="ai-3d-cancel-generation">
            Cancel
          </button>
        )}
      </form>

      {pending && (
        <p role="status" aria-live="polite" data-testid="ai-3d-pending-status">
          {attemptCount > 1
            ? `Contacting the AI assistant… (attempt ${attemptCount})`
            : 'Contacting the AI assistant…'}
        </p>
      )}

      {(phase === 'validation-error' || phase === 'quota-error' || phase === 'provider-error') &&
        genError && (
          <div role="alert" aria-live="assertive" data-testid={`ai-3d-error-${phase}`}>
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
                data-testid="ai-3d-retry-generation"
                onClick={() => void retryGeneration(workingCopyRef.current, currentVersionId)}
              >
                Retry
              </button>
            )}
          </div>
        )}

      {phase === 'success' && proposal && (
        <section aria-label="AI proposal preview" data-testid="ai-3d-proposal-success">
          <p role="status" aria-live="polite">
            Proposal ready. Nothing has been saved yet — review, then Accept or Reject.
          </p>
          <div data-testid="ai-3d-proposal-preview">
            {/* Issue #286/#294/#306: no screenshot, gesture-control, or
                sound affordance here -- an unaccepted proposal isn't the
                project's actual saved state yet. */}
            <Scene3DPreview
              scene={proposal.scene as unknown as Scene3DDocument}
              showScreenshotButton={false}
              showGestureControl={false}
              showSoundControl={false}
            />
          </div>
          <p data-testid="ai-3d-proposal-scene-summary">
            {proposedScene?.objects?.length ?? 0} object(s), {proposedScene?.lights?.length ?? 0}{' '}
            light(s), {proposedScene?.groups?.length ?? 0} group(s) proposed.
          </p>
          <p data-testid="ai-3d-proposal-summary">{proposal.summary}</p>

          <div className="editor-tool-group">
            <button
              type="button"
              onClick={handleAccept}
              disabled={acceptState.pending}
              data-testid="ai-3d-accept-button"
            >
              {acceptState.pending ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={acceptState.pending}
              data-testid="ai-3d-reject-button"
            >
              Reject
            </button>
          </div>

          {acceptState.error && (
            <div role="alert" aria-live="assertive" data-testid="ai-3d-accept-error">
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
    </div>
  );
}

export default AIProposalPanel3D;
