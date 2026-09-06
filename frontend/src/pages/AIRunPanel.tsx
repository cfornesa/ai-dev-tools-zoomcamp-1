import type { ReactNode } from 'react';

import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
import type { UseAIRunResult } from './useAIRun';
import { useSavedAIPreferences } from './useSavedAIPreferences';

/** One selectable object/shape for "Edit selected ..." mode -- built by the
 * caller from its own document family's outline (2D: `sceneOutline.ts`'s
 * `buildOutline`; 3D: `scene3dTypes.ts`'s `object3DLabel` over
 * `scene.objects`), so this shared panel never needs to know either scene
 * shape. `disabled` renders the option present-but-unselectable (e.g. a
 * locked 2D layer) rather than omitting it -- explicit unavailability,
 * never a silent gap. */
export type AIRunSelectableObject = { id: string; label: string; disabled?: boolean };

type AIRunPanelProps<TVersion> = {
  aiRun: UseAIRunResult<TVersion>;
  workingCopy: Record<string, unknown> | null;
  onAccepted: (version: TVersion) => void;
  /** Precomputed by the caller from `workingCopy` -- see
   * `AIRunSelectableObject`'s doc comment. Only consulted while
   * `targetMode === 'edit-selection'`. */
  selectableObjects: AIRunSelectableObject[];
  /** Renders the awaiting-review candidate -- 2D mounts its own p5
   * instance; 3D renders the existing `Scene3DPreview` directly (which
   * already reacts to its own `scene` prop changing, per
   * `AIProposalPanel3D.tsx`'s identical usage) -- so this panel never
   * imports either renderer itself. */
  renderCandidatePreview: (candidateScene: Record<string, unknown>) => ReactNode;
  /** "Edit selected layer/object" (2D) vs "Edit selected object" (3D) --
   * the only copy difference between the two document families' otherwise
   * identical target-mode radiogroup. */
  editSelectionLabel?: string;
  /** Shown under the selection `<select>` when `selectableObjects` is
   * empty -- 2D says "objects"; 3D can be more specific ("no objects" vs
   * lights/camera not being offered at all). */
  noSelectableObjectsMessage?: string;
};

// Issue #461's own server-side defaults, mirrored here purely for display
// ("current attempt/limit") -- the server enforces the real limits
// regardless of what this panel shows; if they're ever changed there,
// this label goes stale but no behavior does.
const MAX_PROVIDER_ATTEMPTS_DISPLAY = 3;
const MAX_REPAIR_ATTEMPTS_DISPLAY = 2;

/**
 * Issue #462/#463: the "Agent workflow" action alongside the one-shot
 * Create/Edit panels (2D `AIProposalPanel.tsx`, 3D `AIProposalPanel3D.tsx`)
 * -- a bounded, persisted plan-validate-revise run (issue #461's `AIRun`)
 * that shows real attempt/repair progress and an intermediate preview
 * before anything is saved. `aiRun` is the whole `useAIRun` hook result
 * (issue #463: the one shared run orchestrator for both 2D and 3D), owned
 * by the parent panel so vendor/model/persona can be carried over from
 * (and back to) the one-shot flow when the user switches between them.
 * This component itself is document-family-agnostic -- see
 * `AIRunPanelProps`' doc comments for the two injection seams (selectable
 * objects, candidate preview) that make one file serve both routes
 * without a second orchestrator or a duplicated progress/review UI.
 */
function AIRunPanel<TVersion>({
  aiRun,
  workingCopy,
  onAccepted,
  selectableObjects,
  renderCandidatePreview,
  editSelectionLabel = 'Edit selected layer/object',
  noSelectableObjectsMessage = 'No editable objects in this scene yet.',
}: AIRunPanelProps<TVersion>) {
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

  const targetModeRoving = useRovingRadioGroup(
    [
      { value: 'create' as const, disabled: starting || run !== null },
      { value: 'edit-selection' as const, disabled: starting || run !== null || !workingCopy },
      { value: 'edit-whole' as const, disabled: starting || run !== null || !workingCopy },
    ],
    targetMode,
    setTargetMode,
  );

  const targetModeLabels: Record<typeof targetMode, string> = {
    create: 'Create piece',
    'edit-selection': editSelectionLabel,
    'edit-whole': 'Edit whole scene',
  };

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
              {targetModeLabels[value]}
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
              {selectableObjects.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={entry.disabled}>
                  {entry.label}
                  {entry.disabled ? ' (locked)' : ''}
                </option>
              ))}
            </select>
            {selectableObjects.length === 0 && (
              <p className="ai-proposal-empty-preference">{noSelectableObjectsMessage}</p>
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
          <div data-testid="ai-run-preview-canvas" className="ai-proposal-preview">
            {run.candidate_scene && renderCandidatePreview(run.candidate_scene)}
          </div>
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
