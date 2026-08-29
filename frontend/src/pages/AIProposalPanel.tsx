import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import type { SceneDocument, SceneVersion } from '../api/projects';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { ScenePreview, SceneRendererId } from '../render/scenePreview';
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
    phase,
    genError,
    proposal,
    generate,
    cancelGeneration,
    reject,
    accept,
    acceptState,
  } = useAIProposal(projectId);

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
        {/* Issue #198: optional, defaults to the server's own model.
            Remembered per browser via `useAIProposal`'s own localStorage
            key, the same convention `cameraOverlaySettings.ts` uses for
            opacity/mirrored. A malformed id is caught by the server's
            existing `model_invalid` validation error, surfaced through
            the same error UI as every other validation error below. */}
        <div className="behavior-card-field">
          <label htmlFor="ai-proposal-model">Mistral model (optional)</label>
          <input
            id="ai-proposal-model"
            type="text"
            value={model}
            disabled={pending}
            placeholder="Uses the account default when blank"
            onChange={(event) => setModel(event.target.value)}
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
