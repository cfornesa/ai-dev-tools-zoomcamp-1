import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';
import type { UseSceneConversionResult } from './useSceneConversion';

type SceneConversionPanelProps = {
  sceneConversion: UseSceneConversionResult;
  /** Called once Accept has actually persisted a brand-new `Project3D` --
   * the caller (`EditorWorkspace.tsx`) is expected to navigate to its
   * editor, since this panel has no route-navigation concerns itself. */
  onAccepted: (project3dPublicId: string) => void;
};

const MAX_PROVIDER_ATTEMPTS_DISPLAY = 3;
const MAX_REPAIR_ATTEMPTS_DISPLAY = 2;

const UNSUPPORTED_SHAPE_LABELS: Record<string, string> = {
  line: 'lines',
  path: 'paths',
  particleEmitter: 'particle emitters',
  image: 'images',
};

function unsupportedShapesSummary(types: string[]): string {
  const labels = types.map((t) => UNSUPPORTED_SHAPE_LABELS[t] ?? t);
  return labels.join(', ');
}

/**
 * Issue #528: "Convert to 3D" -- an AI-assisted, bounded, reviewable
 * conversion of the current 2D project's saved scene into a brand-new 3D
 * project. Mirrors `AIRunPanel.tsx`'s progress/review/accept UI shape, but
 * is deliberately its own smaller component: there is no create/edit or
 * whole-scene/selection choice here (`useSceneConversion.ts` always runs
 * the single conversion operation against the project's current saved
 * version), and Accept navigates to a brand-new 3D project rather than
 * replacing the current working copy in place.
 */
function SceneConversionPanel({ sceneConversion, onAccepted }: SceneConversionPanelProps) {
  const {
    prompt,
    setPrompt,
    vendor,
    setVendor,
    model,
    setModel,
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
  } = sceneConversion;

  async function handleAccept() {
    const project3dPublicId = await accept();
    if (project3dPublicId) onAccepted(project3dPublicId);
  }

  if (reconnecting) {
    return (
      <p role="status" aria-live="polite" data-testid="scene-conversion-reconnecting">
        Reconnecting to your conversion…
      </p>
    );
  }

  if (!run) {
    return (
      <div className="scene-conversion-panel" data-testid="scene-conversion-form">
        <p>
          Convert this project&apos;s saved scene into a new 3D project using AI. Circles become
          spheres and rectangles become boxes; other shapes (lines, paths, particle emitters,
          images) can&apos;t be converted and are skipped.
        </p>

        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="scene-conversion-vendor">AI provider</label>
          <select
            id="scene-conversion-vendor"
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
          <label htmlFor="scene-conversion-prompt">Extra guidance (optional)</label>
          <textarea
            id="scene-conversion-prompt"
            value={prompt}
            disabled={starting}
            placeholder="e.g. give it a warm, sunset lighting mood"
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="behavior-card-field ai-proposal-field-full-width">
          <label htmlFor="scene-conversion-model">Model (optional)</label>
          <input
            id="scene-conversion-model"
            className="ai-proposal-field-full-width"
            type="text"
            value={model}
            disabled={starting}
            placeholder="Uses the account default"
            onChange={(event) => setModel(event.target.value)}
          />
        </div>

        <button
          type="button"
          disabled={starting}
          data-testid="scene-conversion-start"
          onClick={() => void start()}
        >
          {starting ? 'Starting…' : 'Convert to 3D'}
        </button>

        {startError && (
          <div role="alert" aria-live="assertive" data-testid="scene-conversion-start-error">
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

  const isTerminal = ['accepted', 'cancelled', 'failed', 'expired'].includes(run.status);

  return (
    <div className="scene-conversion-panel" data-testid="scene-conversion-active">
      <p data-testid="scene-conversion-status" role="status" aria-live="polite">
        {run.status === 'running' &&
          `Converting… attempt ${run.attempts || 1} of ${MAX_PROVIDER_ATTEMPTS_DISPLAY}` +
            (run.repairs > 0 ? ` (repair ${run.repairs} of ${MAX_REPAIR_ATTEMPTS_DISPLAY})` : '')}
        {run.status === 'awaiting_review' && 'A 3D candidate is ready for review.'}
        {run.status === 'accepted' && 'Accepted — a new 3D project was created.'}
        {run.status === 'cancelled' && 'Stopped. Nothing was saved.'}
        {run.status === 'failed' &&
          `This conversion failed: ${run.error_reason || 'unknown error'}.`}
        {run.status === 'expired' && 'This conversion expired before finishing.'}
      </p>

      {run.unsupported_shape_types.length > 0 && (
        <p data-testid="scene-conversion-unsupported-shapes" role="status">
          {run.unsupported_shape_types.length} shape type
          {run.unsupported_shape_types.length === 1 ? '' : 's'} with no 3D equivalent will be
          skipped: {unsupportedShapesSummary(run.unsupported_shape_types)}.
        </p>
      )}

      {run.status === 'running' && run.validation_summary && (
        <p data-testid="scene-conversion-validation-summary">
          Previous attempt was rejected: {run.validation_summary}
        </p>
      )}

      {run.plan_summary && <p data-testid="scene-conversion-plan-summary">{run.plan_summary}</p>}

      {run.status === 'running' && (
        <button type="button" data-testid="scene-conversion-stop" onClick={() => void stop()}>
          Stop
        </button>
      )}

      {advanceError && (
        <div role="alert" aria-live="assertive" data-testid="scene-conversion-advance-error">
          <p>{advanceError.message}</p>
          <button type="button" onClick={dismiss} data-testid="scene-conversion-dismiss">
            Start over
          </button>
        </div>
      )}

      {run.status === 'awaiting_review' && (
        <section
          aria-label="3D conversion candidate preview"
          data-testid="scene-conversion-preview"
        >
          <p role="status" aria-live="polite">
            Nothing has been saved yet — review, then Accept or Reject.
          </p>
          <div data-testid="scene-conversion-preview-canvas" className="ai-proposal-preview">
            {run.candidate_scene && (
              <Scene3DPreview
                scene={run.candidate_scene as unknown as Scene3DDocument}
                showScreenshotButton={false}
                showGestureControl={false}
                showSoundControl={false}
              />
            )}
          </div>

          <div className="editor-tool-group">
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={accepting}
              data-testid="scene-conversion-accept"
            >
              {accepting ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => void stop()}
              disabled={accepting}
              data-testid="scene-conversion-reject"
            >
              Reject
            </button>
          </div>

          {acceptError && (
            <div role="alert" aria-live="assertive" data-testid="scene-conversion-accept-error">
              <p>{acceptError.message}</p>
            </div>
          )}
        </section>
      )}

      {run.status === 'failed' && run.error_reason === 'stale_base' && (
        <div role="alert" aria-live="assertive" data-testid="scene-conversion-stale-base">
          <p>
            This project changed since the conversion started. Start a fresh conversion against the
            current scene to try again.
          </p>
          <button type="button" onClick={dismiss} data-testid="scene-conversion-rebase-retry">
            Rebase and retry
          </button>
        </div>
      )}

      {isTerminal && run.error_reason !== 'stale_base' && (
        <button type="button" onClick={dismiss} data-testid="scene-conversion-start-new">
          Start a new conversion
        </button>
      )}
    </div>
  );
}

export default SceneConversionPanel;
