import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { getSceneVersion } from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import { listProjectActivity } from '../api/projectActivity';
import type { ProjectActivityItem } from '../api/projectActivity';
import { summarizeSceneDiff } from './sceneDiff';
import type { SceneDiffSummary } from './sceneDiff';
import { useVersionHistory, type VersionActionError } from './useVersionHistory';

const ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manual save',
  ai_create: 'AI: generated scene',
  ai_edit: 'AI: proposed edit',
  restore: 'Restored',
  fork: 'Forked',
};

function originLabel(origin: string): string {
  return ORIGIN_LABELS[origin] ?? origin;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function ActionErrorMessage({
  error,
  testId,
}: {
  error: VersionActionError;
  testId: string;
}) {
  return (
    <div role="alert" aria-live="assertive" data-testid={testId}>
      <p>{error.message}</p>
      {error.kind === 'validation' && error.details.length > 0 && (
        <ul>
          {error.details.map((detail, index) => (
            <li key={`${detail.path}-${detail.rule}-${index}`}>
              {detail.path}: {detail.message}
            </li>
          ))}
        </ul>
      )}
      {error.kind === 'auth' && (
        <p>
          <a href="/accounts/login/">Sign in again</a>
        </p>
      )}
    </div>
  );
}

/**
 * Task 64 (issue #64): the "delete this version?" confirmation, as its own
 * component so `useAlertDialogFocus` (focus-into-dialog on open, Escape
 * cancels rather than deleting, focus returns to the trigger on close)
 * runs for exactly this dialog's own mount/unmount lifecycle — see that
 * hook's doc comment. One of these mounts per row while its own version's
 * delete is pending, so each gets its own independent hook instance.
 */
function VersionDeleteConfirm({
  versionId,
  sequence,
  onDelete,
  onCancel,
}: {
  versionId: number;
  sequence: number;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const titleId = `version-delete-confirm-title-${versionId}`;
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby={titleId}
      className="version-delete-confirm"
    >
      <h5 id={titleId}>Delete version {sequence}?</h5>
      <p>This removes it from history. This cannot be undone from here.</p>
      <button type="button" onClick={onDelete}>
        Delete version
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

type VersionHistoryPanelProps = {
  projectId: string;
  project: Project | null;
  persistedVersion: SceneVersion | null;
  isDirty: boolean;
  onRestored: (version: SceneVersion) => void;
};

type ActivityLoadState = 'loading' | 'ready' | 'error';
type VersionComparisonState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'ready';
      summary: SceneDiffSummary;
      left: SceneVersionSummary;
      right: SceneVersionSummary;
    }
  | { kind: 'empty' }
  | { kind: 'error' };

function EntityDiffList({
  label,
  added,
  removed,
  changed,
}: {
  label: string;
  added: SceneDiffSummary['shapes']['added'];
  removed: SceneDiffSummary['shapes']['removed'];
  changed: SceneDiffSummary['shapes']['changed'];
}) {
  const entries = [
    ...added.items.map((item) => `Added: ${item.id}`),
    ...removed.items.map((item) => `Removed: ${item.id}`),
    ...changed.items.map((item) => `Changed: ${item.id} (${item.properties.join(', ')})`),
  ];
  const total = added.count + removed.count + changed.count;
  return (
    <section className="version-comparison-group">
      <h6>
        {label} ({total})
      </h6>
      {entries.length ? (
        <ul>
          {entries.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : (
        <p>No changes</p>
      )}
      {added.omitted + removed.omitted + changed.omitted > 0 && (
        <p>Some details are omitted from this summary.</p>
      )}
    </section>
  );
}

function LayerDiffList({ summary }: { summary: SceneDiffSummary }) {
  const layers = summary.layers;
  const entries = [
    ...layers.added.items.map((item) => `Added: ${item.id}`),
    ...layers.removed.items.map((item) => `Removed: ${item.id}`),
    ...layers.reordered.items.map(
      (item) => `Reordered: ${item.id} (${item.from + 1} → ${item.to + 1})`,
    ),
    ...layers.renamed.items.map((item) => `Renamed: ${item.from} → ${item.to}`),
  ];
  const total =
    layers.added.count + layers.removed.count + layers.reordered.count + layers.renamed.count;
  return (
    <section className="version-comparison-group">
      <h6>Layers ({total})</h6>
      {entries.length ? (
        <ul>
          {entries.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : (
        <p>No changes</p>
      )}
      {layers.added.omitted +
        layers.removed.omitted +
        layers.reordered.omitted +
        layers.renamed.omitted >
        0 && <p>Some details are omitted from this summary.</p>}
    </section>
  );
}

function activityLabel(item: ProjectActivityItem): string {
  const sequence = item.details.sequence;
  if (item.action_type === 'version_saved' && typeof sequence === 'number') {
    return `Saved version ${sequence}`;
  }
  if (item.action_type === 'version_restored' && typeof sequence === 'number') {
    return `Restored version ${sequence}`;
  }
  if (item.action_type === 'ai_proposal_accepted') return 'Accepted an AI change';
  if (item.action_type === 'ai_proposal_rejected') return 'Discarded an AI change';
  return item.label;
}

function relativeTimestamp(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return iso;
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const unit: Intl.RelativeTimeFormatUnit =
    Math.abs(seconds) < 60
      ? 'second'
      : Math.abs(seconds) < 3600
        ? 'minute'
        : Math.abs(seconds) < 86400
          ? 'hour'
          : Math.abs(seconds) < 2_592_000
            ? 'day'
            : Math.abs(seconds) < 31_536_000
              ? 'month'
              : 'year';
  const divisor = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    month: 2_592_000,
    year: 31_536_000,
  }[unit];
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.round(seconds / divisor),
    unit,
  );
}

function ActivityHistory({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ProjectActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<ActivityLoadState>('loading');
  const [pageLoading, setPageLoading] = useState(false);
  const requestId = useRef(0);

  async function loadFirstPage() {
    const request = ++requestId.current;
    setLoadState('loading');
    setPageLoading(false);
    try {
      const page = await listProjectActivity(projectId);
      if (request !== requestId.current) return;
      setItems(page.results);
      setNextCursor(page.next_cursor);
      setLoadState('ready');
    } catch {
      if (request !== requestId.current) return;
      setItems([]);
      setNextCursor(null);
      setLoadState('error');
    }
  }

  useEffect(() => {
    void loadFirstPage();
    return () => {
      requestId.current += 1;
    };
    // A keyed ActivityHistory instance owns one project and performs one
    // first-page request on mount; pagination uses its own callback below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadMore() {
    if (!nextCursor || pageLoading) return;
    const cursor = nextCursor;
    const request = ++requestId.current;
    setPageLoading(true);
    try {
      const page = await listProjectActivity(projectId, cursor);
      if (request !== requestId.current) return;
      setItems((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...page.results.filter((item) => !knownIds.has(item.id))];
      });
      setNextCursor(page.next_cursor);
    } catch {
      if (request === requestId.current) setLoadState('error');
    } finally {
      if (request === requestId.current) setPageLoading(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading activity…
      </p>
    );
  }
  if (loadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          Could not load project activity. Please try again.
        </p>
        <button type="button" onClick={() => void loadFirstPage()}>
          Retry
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p role="status" aria-live="polite">
        No history yet
      </p>
    );
  }

  return (
    <>
      <ul aria-label="Project activity" className="version-history-list">
        {items.map((item) => {
          const reason = item.details.reason;
          return (
            <li key={item.id} className="version-history-item">
              <div className="version-history-details">
                <p>
                  <strong>{activityLabel(item)}</strong>
                </p>
                <p>
                  <time
                    dateTime={item.created_at}
                    title={new Date(item.created_at).toLocaleString()}
                  >
                    {relativeTimestamp(item.created_at)}
                  </time>
                </p>
                {typeof reason === 'string' && <p>{reason}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {pageLoading && (
        <p role="status" aria-live="polite">
          Loading more activity…
        </p>
      )}
      {nextCursor ? (
        <button type="button" disabled={pageLoading} onClick={() => void loadMore()}>
          Load more
        </button>
      ) : (
        <p role="status" aria-live="polite">
          End of activity
        </p>
      )}
    </>
  );
}

/**
 * Task 41: the immutable version-history view — inspect, restore, and
 * soft-delete, all going through the Task 14/15 APIs via
 * `useVersionHistory`. Deliberately separate from Task 42-44's
 * crash-recovery draft UI (autosave, recovery prompt) — this panel only
 * ever acts on an explicit user action (Restore / Delete), never saves
 * anything automatically.
 *
 * Issue #95 follow-up ("Maybe there needs to be a Save button as well"):
 * the explicit Save action itself moved out of this panel and into the
 * editor header (`SaveControl.tsx`, next to Publish) so it's reachable
 * without ever opening this section — this panel's own `useVersionHistory`
 * instance therefore no longer needs `save`/`saveState` at all; the
 * header's `SaveControl` owns its own separate instance for that (see its
 * doc comment on why a second instance, rather than a lifted/shared one,
 * is the simpler and cheaper choice here).
 *
 * Row previews: no thumbnail-generation system exists yet server-side
 * (`scenes/serializers.py`'s `THUMBNAIL_CHOICES` comment — that's Task
 * 54), so each row's preview is the documented fallback described in
 * `_docs/plan.md`'s "Version history UI" section: a small placeholder
 * carrying the version's own metadata (its number) rather than a
 * rendered image of the scene.
 */
function VersionHistoryPanel({
  projectId,
  project,
  persistedVersion,
  isDirty,
  onRestored,
}: VersionHistoryPanelProps) {
  const {
    historyLoadState,
    historyError,
    versions,
    reloadHistory,
    restore,
    restoreState,
    remove,
    deleteState,
  } = useVersionHistory(projectId, true);

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'versions' | 'activity'>('versions');
  const [compareFromId, setCompareFromId] = useState<number | null>(null);
  const [compareToId, setCompareToId] = useState('');
  const [comparison, setComparison] = useState<VersionComparisonState>({ kind: 'idle' });
  const comparisonRequestId = useRef(0);
  const versionTabRef = useRef<HTMLButtonElement>(null);
  const activityTabRef = useRef<HTMLButtonElement>(null);

  // Issue #115: `save`/`restore` above append their own result straight
  // into this hook's `versions` state, but a version created through a
  // sibling code path with its own separate `useVersionHistory` instance
  // -- the header's one-click `SaveControl`, or an accepted AI proposal
  // (`AIProposalPanel`'s `onAccepted`) -- only ever reaches this panel via
  // the `persistedVersion` prop `EditorWorkspace.tsx` updates, never this
  // list. Re-fetch whenever `persistedVersion` points at an id this list
  // doesn't already have, so every save path ends up visible here without
  // a reload. Skipped when it's already present (i.e. it came from this
  // instance's own `save`/`restore` moments ago) to avoid a redundant
  // fetch right after the optimistic append.
  const persistedVersionId = persistedVersion?.id ?? null;
  useEffect(() => {
    if (persistedVersionId == null) return;
    if (versions.some((version) => version.id === persistedVersionId)) return;
    reloadHistory();
    // Deliberately keyed only on the id changing, not on `versions`
    // itself -- including it would re-run this effect on every optimistic
    // append `save`/`restore` already make, which is harmless but
    // pointless extra work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedVersionId]);

  const currentVersionId = project?.current_version ?? null;

  async function handleRestore(versionId: number) {
    const restored = await restore(versionId);
    if (restored) {
      onRestored(restored);
    }
  }

  async function handleConfirmDelete(versionId: number) {
    const deleted = await remove(versionId);
    if (deleted) {
      setPendingDeleteId(null);
    }
  }

  function beginComparison(versionId: number) {
    comparisonRequestId.current += 1;
    setCompareFromId(versionId);
    setCompareToId('');
    setComparison({ kind: 'idle' });
  }

  async function handleCompare() {
    const fromId = compareFromId;
    const toId = Number(compareToId);
    if (fromId == null || !Number.isInteger(toId) || fromId === toId) return;
    const requestId = ++comparisonRequestId.current;
    setComparison({ kind: 'loading' });
    try {
      const [fromVersion, toVersion] = await Promise.all([
        getSceneVersion(projectId, fromId),
        getSceneVersion(projectId, toId),
      ]);
      if (requestId !== comparisonRequestId.current) return;
      const [left, right] = [fromVersion, toVersion].sort((a, b) => a.sequence - b.sequence);
      const result = summarizeSceneDiff(left.scene_json, right.scene_json);
      if (!result.ok) {
        setComparison({ kind: 'error' });
      } else if (
        result.shapes.added.count +
          result.shapes.removed.count +
          result.shapes.changed.count +
          result.layers.added.count +
          result.layers.removed.count +
          result.layers.reordered.count +
          result.layers.renamed.count +
          result.groups.added.count +
          result.groups.removed.count +
          result.groups.changed.count +
          result.bindings.added.count +
          result.bindings.removed.count +
          result.bindings.changed.count ===
          0 &&
        !result.canvas.changed
      ) {
        setComparison({ kind: 'empty' });
      } else {
        setComparison({ kind: 'ready', summary: result, left, right });
      }
    } catch {
      if (requestId === comparisonRequestId.current) setComparison({ kind: 'error' });
    }
  }

  const sortedVersions: SceneVersionSummary[] = [...versions].sort(
    (a, b) => a.sequence - b.sequence,
  );

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const tabs = [versionTabRef.current, activityTabRef.current];
    const currentIndex = tabs.indexOf(event.currentTarget);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextIndex === 0 ? 'versions' : 'activity');
    nextTab?.focus();
  }

  return (
    <div className="version-history-panel">
      <h4 aria-label="Version history" className="version-history-title">
        Version history
        <span role="tablist" aria-label="Project history views" className="version-history-tabs">
          <button
            ref={versionTabRef}
            type="button"
            role="tab"
            id="version-history-tab-versions"
            aria-selected={activeTab === 'versions'}
            aria-controls="version-history-panel-versions"
            tabIndex={activeTab === 'versions' ? 0 : -1}
            className="editor-panel-tab"
            onClick={() => setActiveTab('versions')}
            onKeyDown={handleTabKeyDown}
          >
            Versions
          </button>
          <button
            ref={activityTabRef}
            type="button"
            role="tab"
            id="version-history-tab-activity"
            aria-selected={activeTab === 'activity'}
            aria-controls="version-history-panel-activity"
            tabIndex={activeTab === 'activity' ? 0 : -1}
            className="editor-panel-tab"
            onClick={() => setActiveTab('activity')}
            onKeyDown={handleTabKeyDown}
          >
            Activity
          </button>
        </span>
      </h4>

      <p role="status" aria-live="polite" data-testid="working-state-status">
        {isDirty
          ? 'Unsaved changes'
          : `Saved${persistedVersion ? ` as version ${persistedVersion.sequence}` : ''}`}
      </p>

      <section
        role="tabpanel"
        id="version-history-panel-versions"
        aria-labelledby="version-history-tab-versions"
        tabIndex={0}
        hidden={activeTab !== 'versions'}
      >
        <h5>History</h5>
        {historyLoadState === 'loading' && (
          <p role="status" aria-live="polite">
            Loading version history…
          </p>
        )}

        {historyLoadState === 'error' && (
          <div>
            <p role="alert" aria-live="assertive">
              {historyError?.message ??
                'Could not load version history. Your working changes have not been lost.'}
            </p>
            <button type="button" onClick={() => reloadHistory()}>
              Retry
            </button>
          </div>
        )}

        {historyLoadState === 'ready' && sortedVersions.length === 0 && (
          <p role="alert" aria-live="assertive">
            No saved versions were found for this project. Every project is expected to always have
            at least one saved version, so this is unexpected — your working changes have not been
            lost. Try reloading the page, or use the Save button in the header to create the first
            version.
          </p>
        )}

        {historyLoadState === 'ready' && sortedVersions.length > 0 && (
          <ul aria-label="Version history" className="version-history-list">
            {sortedVersions.map((version) => {
              const isCurrent = version.id === currentVersionId;
              const isRestoringThis = restoreState.pending && restoreState.versionId === version.id;
              const isDeletingThis = deleteState.pending && deleteState.versionId === version.id;
              return (
                <li key={version.id} className="version-history-item">
                  <div className="version-history-thumb" aria-hidden="true">
                    v{version.sequence}
                  </div>
                  <div className="version-history-details">
                    <p>
                      <strong>Version {version.sequence}</strong>
                      {isCurrent && (
                        <span data-testid={`latest-marker-${version.id}`}> · Latest</span>
                      )}
                    </p>
                    <p>
                      {formatTimestamp(version.created_at)} · {version.created_by ?? 'Unknown'} ·{' '}
                      {originLabel(version.origin)}
                    </p>
                    <p>{version.change_label || 'No change label'}</p>
                  </div>
                  <div className="version-history-actions">
                    <button type="button" onClick={() => beginComparison(version.id)}>
                      Compare with…
                    </button>
                    <button
                      type="button"
                      disabled={isCurrent || isRestoringThis}
                      onClick={() => handleRestore(version.id)}
                    >
                      {isRestoringThis ? 'Restoring…' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      disabled={isCurrent || isDeletingThis}
                      onClick={() => setPendingDeleteId(version.id)}
                    >
                      Delete
                    </button>
                  </div>

                  {pendingDeleteId === version.id && (
                    <VersionDeleteConfirm
                      versionId={version.id}
                      sequence={version.sequence}
                      onDelete={() => handleConfirmDelete(version.id)}
                      onCancel={() => setPendingDeleteId(null)}
                    />
                  )}

                  {restoreState.error && restoreState.versionId === version.id && (
                    <ActionErrorMessage
                      error={restoreState.error}
                      testId={`restore-error-${version.id}`}
                    />
                  )}
                  {deleteState.error && deleteState.versionId === version.id && (
                    <ActionErrorMessage
                      error={deleteState.error}
                      testId={`delete-error-${version.id}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {compareFromId != null && (
          <section className="version-comparison" aria-label="Compare saved versions">
            <h5>
              Compare version{' '}
              {sortedVersions.find((version) => version.id === compareFromId)?.sequence ?? ''}
            </h5>
            <label htmlFor="version-comparison-target">Compare with</label>
            <select
              id="version-comparison-target"
              value={compareToId}
              onChange={(event) => {
                setCompareToId(event.target.value);
                setComparison({ kind: 'idle' });
              }}
            >
              <option value="">Choose a version</option>
              {sortedVersions
                .filter((version) => version.id !== compareFromId)
                .map((version) => (
                  <option key={version.id} value={version.id}>
                    Version {version.sequence}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!compareToId || comparison.kind === 'loading'}
              onClick={() => void handleCompare()}
            >
              Compare versions
            </button>
            <button
              type="button"
              onClick={() => {
                comparisonRequestId.current += 1;
                setCompareFromId(null);
                setComparison({ kind: 'idle' });
              }}
            >
              Close comparison picker
            </button>
            {comparison.kind === 'loading' && (
              <p role="status" aria-live="polite">
                Loading versions to compare…
              </p>
            )}
            {comparison.kind === 'error' && (
              <p role="alert">
                Could not compare these versions. One may have been deleted or is unavailable.
                Refresh history and try again.
              </p>
            )}
            {comparison.kind === 'empty' && (
              <p role="status" aria-live="polite">
                No differences
              </p>
            )}
            {comparison.kind === 'ready' && (
              <div
                className="version-comparison-results"
                aria-label={`Differences between versions ${comparison.left.sequence} and ${comparison.right.sequence}`}
              >
                <h5>
                  Version {comparison.left.sequence} → Version {comparison.right.sequence}
                </h5>
                <EntityDiffList label="Shapes" {...comparison.summary.shapes} />
                <LayerDiffList summary={comparison.summary} />
                <section className="version-comparison-group">
                  <h6>
                    Canvas (
                    {comparison.summary.canvas.changed
                      ? comparison.summary.canvas.properties.length
                      : 0}
                    )
                  </h6>
                  {comparison.summary.canvas.changed ? (
                    <ul>
                      {comparison.summary.canvas.properties.map((property) => (
                        <li key={property}>{property} changed</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No changes</p>
                  )}
                </section>
                <EntityDiffList label="Groups" {...comparison.summary.groups} />
                <EntityDiffList label="Bindings" {...comparison.summary.bindings} />
                <button type="button" onClick={() => setComparison({ kind: 'idle' })}>
                  Close comparison
                </button>
              </div>
            )}
          </section>
        )}
      </section>
      <section
        role="tabpanel"
        id="version-history-panel-activity"
        aria-labelledby="version-history-tab-activity"
        tabIndex={0}
        hidden={activeTab !== 'activity'}
      >
        {activeTab === 'activity' && <ActivityHistory key={projectId} projectId={projectId} />}
      </section>
    </div>
  );
}

export default VersionHistoryPanel;
