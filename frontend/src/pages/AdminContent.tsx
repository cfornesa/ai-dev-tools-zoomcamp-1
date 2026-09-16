import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  applyAdminContentAction,
  fetchAdminAccess,
  fetchAdminContent,
  setAdminAccess,
  type AdminContentAction,
  type AdminContentRow,
  type AdminAccessEntry,
} from '../api/adminContent';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

function AdminContent() {
  const auth = useAuth();
  const [rows, setRows] = useState<AdminContentRow[] | null>(null);
  const [admins, setAdmins] = useState<AdminAccessEntry[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (auth.status !== 'signed-in' || !auth.user.is_application_admin) return;
    Promise.all([fetchAdminContent(), fetchAdminAccess()])
      .then(([content, access]) => {
        setRows(content);
        setAdmins(access);
      })
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
      const changed = await setAdminAccess(username.trim(), true);
      setAdmins((current) =>
        current?.some((entry) => entry.user_id === changed.user_id)
          ? current.map((entry) => (entry.user_id === changed.user_id ? changed : entry))
          : [...(current ?? []), changed],
      );
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
      {rows && (
        <section className="admin-console-section" aria-labelledby="admin-content-list-heading">
          <h3 id="admin-content-list-heading">Content operations</h3>
          {visibleRows.length === 0 ? (
            <p role="status">No matching content.</p>
          ) : (
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
                            className="admin-action-primary"
                          >
                            <span aria-hidden="true">↑</span> Publish
                          </button>
                        )}
                        {!row.deleted &&
                          (row.status === 'public' || row.status === 'published') && (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => void runAction(row, 'unpublish')}
                              className="admin-action-secondary"
                            >
                              <span aria-hidden="true">↓</span> Unpublish
                            </button>
                          )}
                        {row.deleted ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void runAction(row, 'restore')}
                            className="admin-action-secondary"
                          >
                            <span aria-hidden="true">↩</span> Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void runAction(row, 'delete')}
                            className="admin-action-danger"
                          >
                            <span aria-hidden="true">⌫</span> Move to trash
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      <section className="admin-console-section" aria-labelledby="admin-access-heading">
        <form
          className="admin-page-form"
          aria-label="Application-admin access"
          onSubmit={changeAccess}
        >
          <h3 id="admin-access-heading">Application-admin access</h3>
          <label htmlFor="admin-content-username">Username</label>
          <input
            id="admin-content-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <button className="admin-action-primary" type="submit" disabled={busyId !== null}>
            <span aria-hidden="true">＋</span> Grant access
          </button>
          <p>
            Use an exact username or verified email address. Provider handles alone are not
            accepted.
          </p>
        </form>
      </section>
      {admins && (
        <section className="admin-console-section" aria-labelledby="admin-roster-heading">
          <h3 id="admin-roster-heading">Current application administrators</h3>
          {admins.length === 0 ? (
            <p>No managed administrators.</p>
          ) : (
            <ul aria-label="Application administrators">
              {admins.map((entry) => (
                <li key={entry.user_id}>
                  <span>
                    {entry.username}
                    {entry.verified_email ? ` (${entry.verified_email})` : ''} —{' '}
                    {entry.providers.join(', ') || 'no linked providers'}
                  </span>
                  <button
                    className="admin-action-danger"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => {
                      setBusyId(`revoke:${entry.user_id}`);
                      void setAdminAccess(entry.username, false)
                        .then(() => {
                          setAdmins(
                            (current) =>
                              current?.filter((candidate) => candidate.user_id !== entry.user_id) ??
                              null,
                          );
                          setMessage(`Application-admin access revoked from ${entry.username}.`);
                        })
                        .catch(() => setError('Could not revoke application-admin access.'))
                        .finally(() => setBusyId(null));
                    }}
                  >
                    <span aria-hidden="true">−</span> Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

export default AdminContent;
