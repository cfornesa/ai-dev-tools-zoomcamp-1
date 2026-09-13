import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  applyAdminContentAction,
  fetchAdminContent,
  setAdminAccess,
  type AdminContentAction,
  type AdminContentRow,
} from '../api/adminContent';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

function AdminContent() {
  const auth = useAuth();
  const [rows, setRows] = useState<AdminContentRow[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (auth.status !== 'signed-in' || !auth.user.is_application_admin) return;
    fetchAdminContent()
      .then(setRows)
      .catch(() => setError('Could not load admin content.'));
  }, [auth]);

  const visibleRows = useMemo(
    () => rows?.filter((row) => filter === 'all' || row.resource_type.startsWith(filter)) ?? [],
    [filter, rows],
  );

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in' || !auth.user.is_application_admin) {
    return <Navigate to="/" replace />;
  }

  async function runAction(row: AdminContentRow, action: AdminContentAction['action']) {
    if (action === 'delete' && !window.confirm(`Move “${row.title}” to trash?`)) return;
    setBusyId(`${row.resource_type}:${row.resource_id}`);
    setError(null);
    setMessage(null);
    try {
      const updated = await applyAdminContentAction({
        resource_type: row.resource_type as AdminContentAction['resource_type'],
        resource_id: row.resource_id,
        action,
      });
      setRows(
        (current) =>
          current?.map((item) =>
            item.resource_type === updated.resource_type && item.resource_id === updated.resource_id
              ? updated
              : item,
          ) ?? null,
      );
      setMessage(`${action} completed.`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'That content changed or is protected; reload and try again.'
          : 'The content action could not be completed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function changeAccess(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setBusyId('access');
    setError(null);
    try {
      await setAdminAccess(username.trim(), true);
      setMessage(`Application-admin access granted to ${username.trim()}.`);
      setUsername('');
    } catch {
      setError('Could not change application-admin access.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="content-panel admin-pages" aria-labelledby="admin-content-heading">
      <nav className="admin-console-nav" aria-label="Admin console">
        <strong>Admin console</strong>
        <a href="/admin/pages">Pages</a>
        <a href="/admin/content" aria-current="page">
          Content
        </a>
        <a href="/admin/settings">Settings and plans</a>
        <a href="/">Return to public site</a>
      </nav>
      <div className="admin-pages-heading-row">
        <h2 id="admin-content-heading">Content operations</h2>
        <label>
          Filter
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Everything</option>
            <option value="project">2D projects</option>
            <option value="project3d">3D projects</option>
            <option value="art_piece">Generated pieces</option>
            <option value="media">Cloud media</option>
          </select>
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {rows === null && !error && <p role="status">Loading content…</p>}
      {rows && visibleRows.length === 0 && <p role="status">No matching content.</p>}
      {visibleRows.length > 0 && (
        <div className="admin-page-list" role="list" aria-label="Admin content">
          {visibleRows.map((row) => {
            const canAct = ['project', 'project3d', 'art_piece'].includes(row.resource_type);
            const key = `${row.resource_type}:${row.resource_id}`;
            return (
              <article key={key} className="admin-page-row" role="listitem">
                <div>
                  <h3>{row.title}</h3>
                  <p>
                    {row.resource_type} · {row.status} · owner {row.owner} · updated{' '}
                    {new Date(row.updated_at).toLocaleString()}
                  </p>
                  {row.version_count !== null && <p>{row.version_count} saved versions</p>}
                </div>
                {canAct && (
                  <div className="admin-page-actions">
                    {!row.deleted && row.status !== 'public' && row.status !== 'published' && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(row, 'publish')}
                      >
                        Publish
                      </button>
                    )}
                    {!row.deleted && (row.status === 'public' || row.status === 'published') && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(row, 'unpublish')}
                      >
                        Unpublish
                      </button>
                    )}
                    {row.deleted ? (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(row, 'restore')}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void runAction(row, 'delete')}
                      >
                        Move to trash
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <form
        className="admin-page-form"
        aria-label="Application-admin access"
        onSubmit={changeAccess}
      >
        <h3>Application-admin access</h3>
        <label htmlFor="admin-content-username">Username</label>
        <input
          id="admin-content-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <button type="submit" disabled={busyId !== null}>
          Grant access
        </button>
        <p>Revocation remains available through the environment identity reconciliation command.</p>
      </form>
    </section>
  );
}

export default AdminContent;
