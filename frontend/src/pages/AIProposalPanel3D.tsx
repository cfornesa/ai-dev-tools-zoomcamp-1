import { useRef, type FormEvent } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import type { SceneVersion3D } from '../api/projects3d';
import type { Scene3DDocument } from './scene3dTypes';
import { useAIProposal3D, type ProposalMode3D } from './useAIProposal3D';
import { useSavedAIPreferences } from './useSavedAIPreferences';

type AIProposalPanel3DProps = {
  projectId: string;
  workingCopy: Scene3DDocument | null;
  currentVersionId: number | null;
  onAccepted: (version: SceneVersion3D) => void;
};

const MODE_LABELS: Record<ProposalMode3D, string> = {
  create: 'Generate a new scene',
  edit: 'Propose an edit',
};

/**
 * Issue #232: the 3D counterpart of `AIProposalPanel.tsx` -- same prompt
 * entry / pending / success / error states and Accept/Reject flow, driven
 * by `useAIProposal3D` instead. No live preview canvas (unlike the 2D
 * panel): no 3D renderer exists yet (#226's placeholder), so the success
 * state shows a text summary of the proposed scene instead, mirroring
 * `Project3DWorkspace.tsx`'s own placeholder convention.
 */
function AIProposalPanel3D({
  projectId,
  workingCopy,
  currentVersionId,
  onAccepted,
}: AIProposalPanel3DProps) {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    model,
    setModel,
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
  } = useAIProposal3D(projectId);

  const { models: savedModels, personas: savedPersonas } = useSavedAIPreferences();

  const workingCopyRef = useRef(workingCopy);
  workingCopyRef.current = workingCopy;

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
          <label htmlFor="ai-proposal-3d-model">Mistral model (optional)</label>
          {savedModels.length === 0 ? (
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
          Contacting the AI assistant…
        </p>
      )}

      {(phase === 'validation-error' || phase === 'quota-error' || phase === 'provider-error') &&
        genError && (
          <div role="alert" aria-live="assertive" data-testid={`ai-3d-error-${phase}`}>
            <p>{genError.message}</p>
            {genError.code === 'personal_key_required' && (
              <p>
                <a href="/account/settings">
                  Configure your personal Mistral key in Account settings
                </a>
              </p>
            )}
          </div>
        )}

      {phase === 'success' && proposal && (
        <section aria-label="AI proposal preview" data-testid="ai-3d-proposal-success">
          <p role="status" aria-live="polite">
            Proposal ready. Nothing has been saved yet — review, then Accept or Reject.
          </p>
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
