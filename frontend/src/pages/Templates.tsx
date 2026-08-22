import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { cloneTemplate, listTemplates, type Template } from '../api/templates';

type LoadState = 'loading' | 'error' | 'ready';

const UNCATEGORIZED = 'More templates';

function groupByCategory(templates: Template[]): Array<[string, Template[]]> {
  const groups = new Map<string, Template[]>();
  for (const template of templates) {
    const category = template.category.trim() || UNCATEGORIZED;
    const existing = groups.get(category);
    if (existing) {
      existing.push(template);
    } else {
      groups.set(category, [template]);
    }
  }
  return Array.from(groups.entries());
}

function Templates() {
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    listTemplates()
      .then((data) => {
        if (cancelled) return;
        setTemplates(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => groupByCategory(templates), [templates]);

  async function handleUseTemplate(template: Template) {
    setCloningId(template.id);
    setCloneError(null);
    try {
      const project = await cloneTemplate(template.id);
      navigate(`/projects/${project.id}`);
    } catch {
      setCloneError(`Could not create a project from "${template.name}". Please try again.`);
      setCloningId(null);
    }
  }

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading templates…
      </p>
    );
  }

  if (loadState === 'error') {
    return (
      <p role="alert" aria-live="assertive">
        We couldn't load the template catalog. Please try again.
      </p>
    );
  }

  return (
    <section aria-labelledby="templates-heading">
      <h2 id="templates-heading">Browse templates</h2>

      {cloneError && (
        <p role="alert" aria-live="assertive">
          {cloneError}
        </p>
      )}

      {grouped.map(([category, categoryTemplates]) => {
        const headingId = `template-category-${category.replace(/\s+/g, '-').toLowerCase()}`;
        return (
          <div key={category} aria-labelledby={headingId}>
            <h3 id={headingId}>{category}</h3>
            <ul className="template-grid">
              {categoryTemplates.map((template) => {
                const titleId = `template-${template.id}-title`;
                return (
                  <li key={template.id}>
                    <article aria-labelledby={titleId} className="template-card">
                      <h4 id={titleId}>{template.name}</h4>
                      {template.description && <p>{template.description}</p>}
                      {template.source_type === 'private' && (
                        <p>
                          <span className="visibility-badge">Your template</span>
                        </p>
                      )}
                      <button
                        className="shell-action"
                        type="button"
                        aria-label={`Use the "${template.name}" template to create a new project`}
                        onClick={() => handleUseTemplate(template)}
                        disabled={cloningId === template.id}
                      >
                        {cloningId === template.id ? 'Creating…' : 'Use this template'}
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export default Templates;
