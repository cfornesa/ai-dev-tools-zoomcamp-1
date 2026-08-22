import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import type { SceneDocument, SceneVersion } from '../api/projects';
import { createP5ScenePreview, type P5ScenePreview } from '../render/p5Adapter';
import { useAIProposal, type ProposalMode } from './useAIProposal';

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
};

const MODE_LABELS: Record<ProposalMode, string> = {
  create: 'Generate a new scene',
  edit: 'Propose an edit',
};

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
}: AIProposalPanelProps) {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    phase,
    genError,
    proposal,
    generate,
    cancelGeneration,
    reject,
    accept,
    acceptState,
  } = useAIProposal(projectId);

  const previewMountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<P5ScenePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewMountRef.current) return;
    const preview = createP5ScenePreview(previewMountRef.current);
    previewRef.current = preview;
    return () => {
      preview.destroy();
      previewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!previewRef.current) return;
    if (!proposal) {
      setPreviewError(null);
      return;
    }
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
          Contacting the AI assistant…
        </p>
      )}

      {(phase === 'validation-error' || phase === 'quota-error' || phase === 'provider-error') &&
        genError && (
          <div role="alert" aria-live="assertive" data-testid={`ai-error-${phase}`}>
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
    </div>
  );
}

export default AIProposalPanel;
