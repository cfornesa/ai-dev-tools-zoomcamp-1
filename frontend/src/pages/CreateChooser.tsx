import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  createAiAssisted3DProject,
  createAiAssistedAnimation,
  createNew3DProject,
  createNewAnimation,
} from './galleryCreateActions';

type ChooserAction = { id: string; label: string; description: string; run: () => Promise<string> };

// Issue #268: the standalone "/create" page reached by clicking the
// gallery header's "+" icon directly. The renderer select stays in the
// gallery header only (the repository owner's explicit layout decision --
// see #268) -- the two 2D cards below use the same 'p5' default
// `createBlankProject` itself already defaults to, matching this app's
// pre-existing behavior for every creation path that never showed a
// renderer choice at all (e.g. issue #159's "Ask AI to fix this" flow).
const ACTIONS: ChooserAction[] = [
  {
    id: 'create-2d',
    label: 'Create a new animation',
    description: 'Start a blank 2D scene in the manual editor.',
    run: () => createNewAnimation('p5'),
  },
  {
    id: 'create-2d-ai',
    label: 'Create an AI-assisted animation',
    description: 'Start a blank 2D scene in the AI-assisted editor.',
    run: () => createAiAssistedAnimation('p5'),
  },
  {
    id: 'create-3d',
    label: 'Create a new 3D project',
    description: 'Start a blank 3D scene in the manual editor.',
    run: createNew3DProject,
  },
  {
    id: 'create-3d-ai',
    label: 'Create an AI-assisted 3D project',
    description: 'Start a blank 3D scene in the AI-assisted editor.',
    run: createAiAssisted3DProject,
  },
];

function CreateChooser() {
  const navigate = useNavigate();
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(action: ChooserAction) {
    setCreatingId(action.id);
    setError(null);
    try {
      navigate(await action.run());
    } catch {
      setError(`Could not create a project. Please try again.`);
      setCreatingId(null);
    }
  }

  return (
    <section aria-labelledby="create-chooser-heading">
      <h2 id="create-chooser-heading">Create</h2>

      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <ul className="template-grid">
        {ACTIONS.map((action) => {
          const titleId = `create-chooser-${action.id}-title`;
          return (
            <li key={action.id}>
              <article aria-labelledby={titleId} className="template-card">
                <h4 id={titleId}>{action.label}</h4>
                <p>{action.description}</p>
                <button
                  className="shell-action"
                  type="button"
                  onClick={() => void handleChoose(action)}
                  disabled={creatingId !== null}
                >
                  {creatingId === action.id ? 'Creating…' : action.label}
                </button>
              </article>
            </li>
          );
        })}
        <li>
          <article
            aria-labelledby="create-chooser-browse-templates-title"
            className="template-card"
          >
            <h4 id="create-chooser-browse-templates-title">Browse templates</h4>
            <p>Start from an existing template instead of a blank scene.</p>
            <Link className="shell-action" to="/templates">
              Browse templates
            </Link>
          </article>
        </li>
      </ul>
    </section>
  );
}

export default CreateChooser;
