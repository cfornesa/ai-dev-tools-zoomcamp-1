import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  createAdminPage,
  deleteAdminPage,
  fetchAdminPages,
  type CmsPage,
  type CmsPageFields,
  type SeoConfig,
  updateAdminPage,
} from '../api/adminPages';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

const EMPTY_PAGE: CmsPageFields = {
  title: '',
  slug: '',
  description: '',
  status: 'draft',
  nav_label: '',
  show_in_nav: false,
  sort_order: 0,
  system_key: null,
  seo_config: {
    title: '',
    description: '',
    canonical_policy: 'self',
    indexing: 'index',
    og_title: '',
    og_description: '',
    og_image_url: '',
    twitter_card: 'summary',
    answer_summary: '',
    structured_data: {},
  },
};

function AdminPages() {
  const auth = useAuth();
  const [pages, setPages] = useState<CmsPage[] | null>(null);
  const [draft, setDraft] = useState<CmsPageFields>(EMPTY_PAGE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.status !== 'signed-in' || !auth.user.is_application_admin) return;
    fetchAdminPages()
      .then(setPages)
      .catch(() => setError('Could not load CMS pages.'));
  }, [auth]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in' || !auth.user.is_application_admin) {
    return <Navigate to="/" replace />;
  }

  function beginCreate() {
    setEditingId(null);
    setEditorOpen(true);
    setDraft(EMPTY_PAGE);
    setError(null);
    setMessage(null);
  }

  function beginEdit(page: CmsPage) {
    setEditingId(page.id);
    setEditorOpen(true);
    setDraft({
      title: page.title,
      slug: page.slug,
      description: page.description,
      status: page.status,
      nav_label: page.nav_label,
      show_in_nav: page.show_in_nav,
      sort_order: page.sort_order,
      system_key: page.system_key,
      seo_config: page.seo_config,
    });
    setError(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(EMPTY_PAGE);
    setError(null);
    setMessage(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved =
        editingId === null
          ? await createAdminPage(draft)
          : await updateAdminPage(
              editingId,
              pages?.find((page) => page.id === editingId)?.revision ?? 0,
              draft,
            );
      setPages((current) =>
        editingId === null
          ? [...(current ?? []), saved]
          : (current ?? []).map((page) => (page.id === saved.id ? saved : page)),
      );
      setEditingId(saved.id);
      setMessage('Page saved.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This page changed elsewhere. Reload the list and try again.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('That page data is not valid.');
      } else {
        setError('Could not save the page. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(page: CmsPage) {
    if (!window.confirm(`Move “${page.title}” to trash?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminPage(page.id, page.revision);
      setPages((current) => (current ?? []).filter((item) => item.id !== page.id));
      if (editingId === page.id) beginCreate();
      setMessage('Page moved to trash.');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'This page is protected or changed elsewhere.'
          : 'Could not move the page to trash.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-panel admin-pages" aria-labelledby="admin-pages-heading">
      <nav className="admin-console-nav" aria-label="Admin console">
        <strong>Admin console</strong>
        <a href="/admin/pages" aria-current="page">
          Pages
        </a>
        <a href="/admin/content">Content</a>
        <a href="/admin/settings">Settings and plans</a>
        <a href="/">Return to public site</a>
      </nav>
      <div className="admin-pages-heading-row">
        <h2 id="admin-pages-heading">Pages</h2>
        <button type="button" onClick={beginCreate} disabled={busy}>
          New page
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {pages === null && !error && <p role="status">Loading pages…</p>}
      {pages && (
        <section className="admin-console-section" aria-labelledby="admin-pages-list-heading">
          <h3 id="admin-pages-list-heading">CMS page operations</h3>
          {pages.length === 0 ? (
            <p role="status">No CMS pages yet.</p>
          ) : (
            <div className="admin-page-list" role="list" aria-label="CMS pages">
              {pages.map((page) => (
                <article key={page.id} className="admin-page-row" role="listitem">
                  <div>
                    <h3>{page.title}</h3>
                    <p>
                      <code>/{page.slug}</code> · {page.status} · updated{' '}
                      {new Date(page.updated_at).toLocaleString()}
                    </p>
                    <p>
                      {page.description.slice(0, 50)}
                      {page.description.length > 50 ? '…' : ''}
                    </p>
                    <p>Author: {page.author ?? 'System'}</p>
                  </div>
                  <div className="admin-page-actions">
                    <button
                      className="admin-action-secondary"
                      type="button"
                      onClick={() => beginEdit(page)}
                      disabled={busy}
                    >
                      <span aria-hidden="true">✎</span> Edit
                    </button>
                    <button
                      className="admin-action-danger"
                      type="button"
                      onClick={() => void remove(page)}
                      disabled={busy || Boolean(page.system_key)}
                    >
                      <span aria-hidden="true">⌫</span> Move to trash
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {editorOpen && (
        <section className="admin-console-section" aria-labelledby="admin-page-editor-heading">
          <form className="admin-page-form" aria-label="CMS page editor" onSubmit={save}>
            <h3 id="admin-page-editor-heading">
              {editingId === null ? 'Create page' : 'Edit page'}
            </h3>
            <label htmlFor="cms-page-title">Title</label>
            <input
              id="cms-page-title"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              required
              maxLength={200}
            />
            <label htmlFor="cms-page-slug">Slug</label>
            <input
              id="cms-page-slug"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              required
              maxLength={120}
            />
            <label htmlFor="cms-page-description">Description</label>
            <textarea
              id="cms-page-description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              maxLength={5000}
              rows={5}
            />
            <fieldset>
              <legend>SEO and AEO metadata</legend>
              <label htmlFor="cms-seo-title">Search title</label>
              <input
                id="cms-seo-title"
                maxLength={200}
                value={draft.seo_config.title}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    seo_config: { ...draft.seo_config, title: event.target.value },
                  })
                }
              />
              <label htmlFor="cms-seo-description">Search description</label>
              <textarea
                id="cms-seo-description"
                maxLength={320}
                rows={3}
                value={draft.seo_config.description}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    seo_config: { ...draft.seo_config, description: event.target.value },
                  })
                }
              />
              <label htmlFor="cms-seo-indexing">Indexing</label>
              <select
                id="cms-seo-indexing"
                value={draft.seo_config.indexing}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    seo_config: {
                      ...draft.seo_config,
                      indexing: event.target.value as SeoConfig['indexing'],
                    },
                  })
                }
              >
                <option value="index">Index</option>
                <option value="noindex">No index</option>
              </select>
              <label htmlFor="cms-seo-answer">Answer summary</label>
              <textarea
                id="cms-seo-answer"
                maxLength={1000}
                rows={3}
                value={draft.seo_config.answer_summary}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    seo_config: { ...draft.seo_config, answer_summary: event.target.value },
                  })
                }
              />
            </fieldset>
            <label htmlFor="cms-page-status">Status</label>
            <select
              id="cms-page-status"
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as CmsPageFields['status'] })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <label htmlFor="cms-page-nav-label">Navigation label</label>
            <input
              id="cms-page-nav-label"
              value={draft.nav_label}
              onChange={(event) => setDraft({ ...draft, nav_label: event.target.value })}
              maxLength={100}
            />
            <label>
              <input
                type="checkbox"
                checked={draft.show_in_nav}
                onChange={(event) => setDraft({ ...draft, show_in_nav: event.target.checked })}
              />
              Show in navigation
            </label>
            <div className="admin-settings-actions">
              <button className="admin-action-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save page'}
              </button>
              <button
                className="admin-action-secondary"
                type="button"
                onClick={cancelEdit}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}

export default AdminPages;
