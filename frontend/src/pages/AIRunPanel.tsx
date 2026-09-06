import { useEffect, useRef, useState } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import type { SceneDocument, SceneVersion } from '../api/projects';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { ScenePreview, SceneRendererId } from '../render/scenePreview';
import { buildOutline } from './sceneOutline';
import type { UseAIRunResult } from './useAIRun';
import { useSavedAIPreferences } from './useSavedAIPreferences';

type AIRunPanelProps = {
  aiRun: UseAIRunResult;
  workingCopy: SceneDocument | null;
  onAccepted: (version: SceneVersion) => void;
};

// Issue #461's own server-side defaults, mirrored here purely for display
// ("current attempt/limit") -- the server enforces the real limits
// regardless of what this panel shows; if they're ever changed there,
// this label goes stale but no behavior does.
const MAX_PROVIDER_ATTEMPTS_DISPLAY = 3;
const MAX_REPAIR_ATTEMPTS_DISPLAY = 2;

const TARGET_MODE_LABELS = {
  create: 'Create piece',
  'edit-selection': 'Edit selected layer/object',
  'edit-whole': 'Edit whole scene',
} as const;

/**
 * Issue #462: the "Agent workflow" action alongside `AIProposalPanel`'s
 * one-shot Create/Edit -- a bounded, persisted plan-validate-revise run
 * (issue #461's `AIRun`) that shows real attempt/repair progress and an
 * intermediate preview before anything is saved. `aiRun` is the whole
 * `useAIRun` hook result, owned by the parent panel so vendor/model/
 * persona can be carried over from (and back to) the one-shot flow when
 * the user switches between them.
 */
function AIRunPanel({ aiRun, workingCopy, onAccepted }: AIRunPanelProps) {
  const {
    targetMode,
    setTargetMode,
    selectedShapeId,
    setSelectedShapeId,
    prompt,
    setPrompt,
    vendor,
    setVendor,
    model,
    setModel,
    personaId,
    setPersonaId,
    run,
    starting,
    startError,
    advanceError,
    accepting,
    acceptError,
    reconnecting,
    start,
    stop,
    accept,
    dismiss,
  } = aiRun;

  const { models: savedModels, personas: savedPersonas } = useSavedAIPreferences();

  const previewMountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<ScenePreview | null>(null);
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

  const candidateScene = run?.candidate_scene ?? null;

  useEffect(() => {
    if (!candidateScene) {
      setPreviewError(null);
      return;
    }
    const rendererId = resolveSceneRendererId(candidateScene);
    if (previewMountRef.current && previewRendererRef.current !== rendererId) {
      previewRef.current?.destroy();
      previewRef.current = createScenePreview(previewMountRef.current, rendererId);
      previewRendererRef.current = rendererId;
    }
    if (!previewRef.current) return;
    try {
      previewRef.current.render(candidateScene);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this candidate.');
    }
  }, [candidateScene]);

  const targetModeRoving = useRovingRadioGroup(
    [
      { value: 'create' as const, disabled: starting || run !== null },
      { value: 'edit-selection' as const, disabled: starting || run !== null || !workingCopy },
      { value: 'edit-whole' as const, disabled: starting || run !== null || !workingCopy },
    ],
    targetMode,
    setTargetMode,
  );

  // Issue #462's own acceptance criterion: "Resolve selection to stable
  // IDs rather than trusting text mentions" -- reuses the same outline
  // rows the Layers panel is built from (`sceneOutline.ts`), restricted
  // to `shape` rows only. This is also what makes an unsupported draw.io
  // graph node "explicitly unavailable rather than flattened or silently
  // altered" for a scoped edit: `buildOutline` never emits graph nodes at
  // all, so one can never be selected here in the first place.
  const selectableShapes =
    targetMode === 'edit-selection' && workingCopy
      ? buildOutline(workingCopy).filter((row) => row.kind === 'shape')
      : [];

  async function handleAccept() {
    const version = await accept();
    if (version) onAccepted(version);
  }

  if (reconnecting) {
    return (
      <p role="status" aria-live="polite" data-testid="ai-run-reconnecting">
        Reconnecting to your agent run…
      </p>
    );
  }

  if (!run) {
    return (
      <div className="ai-run-panel" data-testid="ai-run-form">
        <div role="radiogroup" aria-label="Agent action" className="editor-tool-group">
          {(['create', 'edit-selection', 'edit-whole'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={targetMode === value}
              disabled={starting || (value !== 'create' && !workingCopy)}
              onClick={() => setTargetMode(value)}
              {...targetModeRoving.getRadioProps(value)}
            >
              {TARGET_MODE_LABELS[value]}
            </button>
          ))}
        </div>

        {targetMode === 'edit-selection' && (
          <div className="behavior-card-field ai-proposal-field-full-width">
            <label htmlFor="ai-run-selected-object">Object to edit</label>
            <select
              id="ai-run-selected-object"
              className="ai-proposal-field-full-width"
              value={selectedShapeId ?? ''}
              disabled={starting}
              onChange={(event) => setSelectedShapeId(event.target.value || null)}
            >
              <option value="">Select an object…</option>
              {selectableShapes.map((row) =>
                row.kind === 'shape' ? (
                  <option key={row.id} value={row.id} disabled={row.inheritedLocked}>
                    {row.label}
                    {row.inheritedLocked ? ' (locked)' : ''}
                  </option>
                ) : null,
              )}
            </select>
            {selectableShapes.length === 0 && (
              <p className="ai-proposal-empty-preference">No editable objects in this scene yet.</p>
            )}
          </div>
        )}

        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="ai-run-vendor">AI provider</label>
          <select
            id="ai-run-vendor"
            className="ai-proposal-field-full-width"
            value={vendor}
            disabled={starting}
            onChange={(event) => setVendor(event.target.value as typeof vendor)}
          >
            <option value="mistral">Mistral</option>
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div className="behavior-card-field">
          <label htmlFor="ai-run-prompt">
            {targetMode === 'create'
              ? 'Describe the scene you want to generate'
              : 'Describe the change you want to make'}
          </label>
          <textarea
            id="ai-run-prompt"
            value={prompt}
            disabled={starting}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="ai-run-model">Model (optional)</label>
          {savedModels.length === 0 ? (
            <p className="ai-proposal-empty-preference">
              No saved models yet — add one in <a href="/account/settings">Account settings</a> to
              pick from a list here.
            </p>
          ) : (
            <select
              id="ai-run-model"
              className="ai-proposal-field-full-width"
              value={model}
              disabled={starting}
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
          <label htmlFor="ai-run-persona">Persona (optional)</label>
          {savedPersonas.length === 0 ? (
            <p className="ai-proposal-empty-preference">
              No Personas yet — add one in <a href="/account/settings">Account settings</a> to pick
              from a list here.
            </p>
          ) : (
            <select
              id="ai-run-persona"
              className="ai-proposal-field-full-width"
              value={personaId ?? ''}
              disabled={starting}
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

        <button
          type="button"
          disabled={starting || prompt.trim().length === 0}
          data-testid="ai-run-start"
          onClick={() => void start(workingCopy, null)}
        >
          {starting ? 'Starting…' : 'Start agent run'}
        </button>

        {startError && (
          <div role="alert" aria-live="assertive" data-testid="ai-run-start-error">
            <p>{startError.message}</p>
            {startError.code === 'missing_credential' && (
              <p>
                <a href="/account/settings">Configure your personal AI provider key</a>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // A run exists -- render its current server-reported state. Never a
  // fabricated progress percentage or hidden reasoning trace: only the
  // real attempt/repair counters and the server's own concise summaries.
  const isTerminal = ['accepted', 'cancelled', 'failed', 'expired'].includes(run.status);

  return (
    <div className="ai-run-panel" data-testid="ai-run-active">
      <p data-testid="ai-run-status" role="status" aria-live="polite">
        {run.status === 'running' &&
          `Working… attempt ${run.attempts || 1} of ${MAX_PROVIDER_ATTEMPTS_DISPLAY}` +
            (run.repairs > 0 ? ` (repair ${run.repairs} of ${MAX_REPAIR_ATTEMPTS_DISPLAY})` : '')}
        {run.status === 'awaiting_review' && 'A candidate is ready for review.'}
        {run.status === 'accepted' && 'Accepted.'}
        {run.status === 'cancelled' && 'Stopped. Nothing was saved.'}
        {run.status === 'failed' && `This run failed: ${run.error_reason || 'unknown error'}.`}
        {run.status === 'expired' && 'This run expired before finishing.'}
      </p>

      {run.status === 'running' && run.validation_summary && (
        <p data-testid="ai-run-validation-summary">
          Previous attempt was rejected: {run.validation_summary}
        </p>
      )}

      {run.plan_summary && <p data-testid="ai-run-plan-summary">{run.plan_summary}</p>}

      {run.status === 'running' && (
        <button type="button" data-testid="ai-run-stop" onClick={() => void stop()}>
          Stop
        </button>
      )}

      {advanceError && (
        <div role="alert" aria-live="assertive" data-testid="ai-run-advance-error">
          <p>{advanceError.message}</p>
          <button type="button" onClick={dismiss} data-testid="ai-run-dismiss">
            Start over
          </button>
        </div>
      )}

      {run.status === 'awaiting_review' && (
        <section aria-label="Agent run candidate preview" data-testid="ai-run-preview">
          <p role="status" aria-live="polite">
            Nothing has been saved yet — review, then Accept or Stop.
          </p>
          <div
            ref={previewMountRef}
            data-testid="ai-run-preview-canvas"
            className="ai-proposal-preview"
            aria-hidden="true"
          />
          {previewError && (
            <p role="alert" aria-live="assertive">
              {previewError}
            </p>
          )}
          {run.change_summary && <p data-testid="ai-run-change-summary">{run.change_summary}</p>}

          <div className="editor-tool-group">
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={accepting}
              data-testid="ai-run-accept"
            >
              {accepting ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => void stop()}
              disabled={accepting}
              data-testid="ai-run-reject"
            >
              Reject
            </button>
          </div>

          {acceptError && (
            <div role="alert" aria-live="assertive" data-testid="ai-run-accept-error">
              <p>{acceptError.message}</p>
            </div>
          )}
        </section>
      )}

      {run.status === 'failed' && run.error_reason === 'stale_base' && (
        <div role="alert" aria-live="assertive" data-testid="ai-run-stale-base">
          <p>
            This project changed since the run started. Start a fresh run against the current scene
            to try again.
          </p>
          <button type="button" onClick={dismiss} data-testid="ai-run-rebase-retry">
            Rebase and retry
          </button>
        </div>
      )}

      {isTerminal && run.error_reason !== 'stale_base' && (
        <button type="button" onClick={dismiss} data-testid="ai-run-start-new">
          Start a new run
        </button>
      )}
    </div>
  );
}

export default AIRunPanel;
