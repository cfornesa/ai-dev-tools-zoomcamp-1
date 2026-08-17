import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import EditorPanelSwitcher, { type EditorPanelName } from '../components/EditorPanelSwitcher';
import { useEditorWorkspaceState } from './useEditorWorkspaceState';
import { useIsNarrowViewport } from './useIsNarrowViewport';

/**
 * Task 21: the three-panel editor workspace shell. Loads the project and
 * its current scene version into a working copy on mount, then renders
 * three landmark regions (Tools, Preview, Inspector) side by side at
 * >=1024px, or one at a time behind a keyboard-operable switcher below
 * that. Tool behavior, scene rendering, and inspector editing are all out
 * of scope here (Tasks 23, 25, 60) — each panel is currently a stub other
 * tasks will fill in without needing to touch this shell.
 */
function EditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { loadState, project, workingCopy, retry } = useEditorWorkspaceState(id);
  const isNarrow = useIsNarrowViewport();
  const [activePanel, setActivePanel] = useState<EditorPanelName>('preview');

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading editor…
      </p>
    );
  }

  if (loadState === 'access-denied') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          You don't have access to this project.
        </p>
        <p>
          <Link to="/">Back to your projects</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'no-scene') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          This project has no valid scene to load.
        </p>
        <p>
          <Link to="/">Back to your projects</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          Something went wrong loading this project. Please try again.
        </p>
        <button type="button" onClick={() => retry()}>
          Retry
        </button>
      </div>
    );
  }

  const shapeCount = Array.isArray(workingCopy?.shapes) ? workingCopy.shapes.length : 0;

  function panelHidden(panel: EditorPanelName): boolean {
    return isNarrow && activePanel !== panel;
  }

  return (
    <div>
      <header className="editor-workspace-header">
        <h2>{project?.title}</h2>
        <Link to={`/projects/${id}/settings`}>Edit project details</Link>
      </header>

      {isNarrow && <EditorPanelSwitcher activePanel={activePanel} onSelect={setActivePanel} />}

      <div className="editor-workspace">
        <section
          role="region"
          aria-label="Tools"
          data-panel="tools"
          id="editor-panel-tools"
          className="editor-panel"
          hidden={panelHidden('tools')}
        >
          <h3>Tools</h3>
          <p>Shape and tool controls are added in a later task.</p>
        </section>

        <section
          role="region"
          aria-label="Preview"
          data-panel="preview"
          id="editor-panel-preview"
          className="editor-panel"
          hidden={panelHidden('preview')}
        >
          <h3>Preview</h3>
          <p>Scene rendering is added in a later task.</p>
          <p>{shapeCount} shape(s) in the working copy.</p>
        </section>

        <section
          role="region"
          aria-label="Inspector"
          data-panel="inspector"
          id="editor-panel-inspector"
          className="editor-panel"
          hidden={panelHidden('inspector')}
        >
          <h3>Inspector</h3>
          <p>Property editing is added in a later task.</p>
        </section>
      </div>
    </div>
  );
}

export default EditorWorkspace;
