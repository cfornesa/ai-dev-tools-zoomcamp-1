import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Issue #159: the Code tab — a pretty-printed, editable JSON view of the
 * live `workingCopy`, kept in sync with the Visual tab in both directions.
 * Covers the acceptance criteria that only show up at this
 * `EditorWorkspace` integration level (not a smaller unit): valid Code
 * edits actually reaching `workingCopy`, invalid Code edits leaving it
 * untouched, Visual edits showing up in Code the next time it's viewed,
 * and Visual/Code parity for an identical edit made through each surface.
 *
 * `previewError`'s localization/"Ask AI to fix this" affordance is covered
 * separately in `EditorWorkspace.previewErrorLocalization.test.tsx`, which
 * mocks `p5Adapter.ts` to force a controlled render failure — this file
 * deliberately uses the REAL `p5Adapter`/jsdom `canvas` pipeline (same as
 * the main `EditorWorkspace.test.tsx`) since none of its scenarios need a
 * render failure.
 */

vi.mock('../api/projects');

const mockedGetProject = vi.mocked(projectsApi.getProject);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
    description: '',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    thumbnail_url: null,
    current_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

const BLANK_SCENE = {
  schemaVersion: 1,
  id: 'scene-blank',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function baseVersion(overrides: Partial<SceneVersion> = {}): SceneVersion {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    scene_json: BLANK_SCENE,
    ...overrides,
  };
}

function baseSummary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  const { scene_json: _scene_json, ...rest } = baseVersion(overrides);
  return rest;
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Gallery placeholder</p>} />
        <Route path="/projects/:id" element={<EditorWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function loadReadyWorkspace() {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion());
  const result = renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
  return result;
}

function codeTextarea(): HTMLTextAreaElement {
  return screen.getByTestId('editor-scene-code-textarea') as HTMLTextAreaElement;
}

function htmlTextarea(): HTMLTextAreaElement {
  return screen.getByTestId('editor-scene-html-textarea') as HTMLTextAreaElement;
}

function cssTextarea(): HTMLTextAreaElement {
  return screen.getByTestId('editor-scene-css-textarea') as HTMLTextAreaElement;
}

function jsTextarea(): HTMLTextAreaElement {
  return screen.getByTestId('editor-scene-js-textarea') as HTMLTextAreaElement;
}

async function openCodeTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Code' }));
}

async function openVisualTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Visual' }));
}

async function openSubTab(
  user: ReturnType<typeof userEvent.setup>,
  tab: 'json' | 'html' | 'css' | 'js',
) {
  await user.click(screen.getByTestId(`editor-code-subtab-${tab}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue([baseSummary()]);
});

describe('Code tab: shows and round-trips workingCopy', () => {
  it('shows the working copy as pretty-printed JSON', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);

    const parsed = JSON.parse(codeTextarea().value);
    expect(parsed).toEqual(BLANK_SCENE);
    // Pretty-printed, not minified.
    expect(codeTextarea().value).toContain('\n');
  });

  it('a valid edit on blur updates workingCopy and Visual reflects it immediately', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);

    const withShape = {
      ...BLANK_SCENE,
      shapes: [
        {
          type: 'circle',
          id: 'circle-from-code',
          layerId: 'layer-1',
          groupId: null,
          transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
          radius: 20,
        },
      ],
    };
    fireEvent.change(codeTextarea(), { target: { value: JSON.stringify(withShape, null, 2) } });
    fireEvent.blur(codeTextarea());

    // No inline Code-tab validation error.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await openVisualTab(user);
    expect(screen.getByText(/1 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('invalid JSON is rejected: workingCopy and the Visual render are left untouched', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);
    fireEvent.change(codeTextarea(), { target: { value: '{ this is not valid json' } });
    fireEvent.blur(codeTextarea());

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid scene json/i);

    await openVisualTab(user);
    // The last-known-good scene (still 0 shapes) rendered, unaffected by
    // the rejected edit.
    expect(screen.getByText(/0 shape\(s\) in the working copy/)).toBeInTheDocument();
  });

  it('schema-invalid (but parseable) JSON is rejected with its own inline error, distinct from previewError', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);
    const danglingRef = {
      ...BLANK_SCENE,
      shapes: [
        {
          type: 'circle',
          id: 'circle-bad',
          layerId: 'no-such-layer',
          groupId: null,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#fff', stroke: null, strokeWidth: 0 },
          radius: 5,
        },
      ],
    };
    fireEvent.change(codeTextarea(), { target: { value: JSON.stringify(danglingRef, null, 2) } });
    fireEvent.blur(codeTextarea());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid scene json/i);
    expect(alert).toHaveTextContent(/does not match any layer/i);

    await openVisualTab(user);
    expect(screen.getByText(/0 shape\(s\) in the working copy/)).toBeInTheDocument();
  });
});

describe('Code tab: Visual -> Code sync', () => {
  it('reflects a Visual edit (adding a shape) the next time the Code tab is viewed', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(screen.getByText(/1 shape\(s\) in the working copy/)).toBeInTheDocument();

    await openCodeTab(user);

    const parsed = JSON.parse(codeTextarea().value) as { shapes: Array<{ type: string }> };
    expect(parsed.shapes).toHaveLength(1);
    expect(parsed.shapes[0].type).toBe('circle');
  });

  it('reflects a Visual layer rename the next time the Code tab is viewed', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const nameField = screen.getByLabelText('Layer name for Layer 1');
    fireEvent.change(nameField, { target: { value: 'Renamed via Visual' } });
    fireEvent.blur(nameField);

    await openCodeTab(user);
    const parsed = JSON.parse(codeTextarea().value) as { layers: Array<{ name: string }> };
    expect(parsed.layers[0].name).toBe('Renamed via Visual');
  });
});

describe('Code tab: Visual/Code parity', () => {
  it('an identical edit made via Visual and via Code produces schema-equivalent workingCopy JSON', async () => {
    // Visual path: rename the layer through LayersPanel's rename field.
    const visualInstance = await loadReadyWorkspace();
    const user = userEvent.setup();
    const nameField = screen.getByLabelText('Layer name for Layer 1');
    fireEvent.change(nameField, { target: { value: 'Parity Layer' } });
    fireEvent.blur(nameField);
    await openCodeTab(user);
    const viaVisual = JSON.parse(codeTextarea().value) as Record<string, unknown>;
    visualInstance.unmount();

    // Code path (a fresh instance of the same starting scene): type the
    // identical resulting document directly into the Code tab, rather than
    // performing the equivalent action through any Visual control.
    await loadReadyWorkspace();
    const user2 = userEvent.setup();
    await openCodeTab(user2);
    const codeEdit = {
      ...BLANK_SCENE,
      layers: [{ ...BLANK_SCENE.layers[0], name: 'Parity Layer' }],
    };
    fireEvent.change(codeTextarea(), { target: { value: JSON.stringify(codeEdit, null, 2) } });
    fireEvent.blur(codeTextarea());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const viaCode = JSON.parse(codeTextarea().value) as Record<string, unknown>;

    expect(viaVisual).toEqual(viaCode);
  });
});

/**
 * Issue #177 (task 145's audit finding): the Code tab's sub-editors used to
 * seed their local text state once, on `CodeTab` mount, and never resynced
 * from a later `workingCopy` change -- so clicking the toolbar's Undo/Redo
 * (which stay visible and clickable while the Code tab is open) silently
 * left the displayed text stale, and a bare Visual<->Code toggle (with no
 * real scene change) silently discarded an in-progress unsaved edit. The
 * fix keeps `CodeTab` permanently mounted and resyncs each sub-tab off
 * `workingCopy`'s identity via a `useEffect`, only when there's no pending
 * unsaved edit in that sub-tab -- see `SceneCodeEditor`'s doc comment in
 * `EditorWorkspace.tsx` for the full strategy.
 */
describe('Code tab: resyncs on workingCopy change (issue #177)', () => {
  it('Undo while the Code tab is open, with no pending edit, silently updates the JSON sub-tab', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);
    expect(JSON.parse(codeTextarea().value).shapes).toHaveLength(0);

    // Add a shape via the toolbar, which stays visible while Code is open.
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    expect(JSON.parse(codeTextarea().value).shapes).toHaveLength(1);

    // Undo, without ever leaving the Code tab.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(JSON.parse(codeTextarea().value).shapes).toHaveLength(0);

    // Redo, again without leaving the Code tab.
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(JSON.parse(codeTextarea().value).shapes).toHaveLength(1);

    // No stale-content warning shown for a clean resync.
    expect(screen.queryByTestId('editor-scene-code-reload')).not.toBeInTheDocument();
  });

  it('Undo while the JSON sub-tab has a pending unsaved edit does not silently overwrite it', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    // A committed change to undo.
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    await openCodeTab(user);
    const unsavedEdit = '{ "still typing this JSON edit"';
    fireEvent.change(codeTextarea(), { target: { value: unsavedEdit } });
    // Deliberately no blur -- this is a pending, uncommitted edit.

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    // The unsaved edit is preserved, not silently replaced by the
    // post-undo workingCopy.
    expect(codeTextarea().value).toBe(unsavedEdit);
    // A clear inline notice is shown instead of a silent overwrite.
    const notice = await screen.findByTestId('editor-scene-code-reload');
    expect(notice).toBeInTheDocument();

    // The user can explicitly discard their edit and load the latest.
    await user.click(notice);
    expect(JSON.parse(codeTextarea().value).shapes).toHaveLength(0);
    expect(screen.queryByTestId('editor-scene-code-reload')).not.toBeInTheDocument();
  });

  it('a Visual -> Code -> Visual -> Code round trip preserves an unsaved edit in every sub-tab', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);

    // JSON sub-tab (already active).
    const jsonEdit = '{ "unsaved json edit"';
    fireEvent.change(codeTextarea(), { target: { value: jsonEdit } });

    // HTML sub-tab.
    await openSubTab(user, 'html');
    const originalHtml = htmlTextarea().value;
    const htmlEdit = `${originalHtml}\n<!-- unsaved html edit -->`;
    fireEvent.change(htmlTextarea(), { target: { value: htmlEdit } });

    // CSS sub-tab.
    await openSubTab(user, 'css');
    const originalCss = cssTextarea().value;
    const cssEdit = `${originalCss}\n/* unsaved css edit */`;
    fireEvent.change(cssTextarea(), { target: { value: cssEdit } });

    // JS sub-tab.
    await openSubTab(user, 'js');
    const originalJs = jsTextarea().value;
    const jsEdit = `${originalJs}\n// unsaved js edit`;
    fireEvent.change(jsTextarea(), { target: { value: jsEdit } });

    // Round trip: Code -> Visual -> Code, with no actual workingCopy change.
    await openVisualTab(user);
    await openCodeTab(user);

    expect(codeTextarea().value).toBe(jsonEdit);
    expect(htmlTextarea().value).toBe(htmlEdit);
    expect(cssTextarea().value).toBe(cssEdit);
    expect(jsTextarea().value).toBe(jsEdit);

    // A second round trip confirms it isn't a one-time fluke.
    await openVisualTab(user);
    await openCodeTab(user);

    expect(codeTextarea().value).toBe(jsonEdit);
    expect(htmlTextarea().value).toBe(htmlEdit);
    expect(cssTextarea().value).toBe(cssEdit);
    expect(jsTextarea().value).toBe(jsEdit);
  });

  it('a save in the HTML/CSS sub-tab does not corrupt a pending unsaved edit in the sibling JS sub-tab', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await openCodeTab(user);

    // Unsaved, uncommitted edit sitting in JS.
    await openSubTab(user, 'js');
    const originalJs = jsTextarea().value;
    const jsEdit = `${originalJs}\n// unsaved js edit, not yet saved`;
    fireEvent.change(jsTextarea(), { target: { value: jsEdit } });

    // A real, successful HTML/CSS save (opacity change on the layer's
    // background is not part of this scene, so just re-save the
    // unmodified, valid HTML/CSS as-is to exercise a real commit).
    await openSubTab(user, 'html');
    await user.click(screen.getByTestId('editor-scene-html-css-save'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // The sibling JS sub-tab's unsaved edit is untouched by that save.
    await openSubTab(user, 'js');
    expect(jsTextarea().value).toBe(jsEdit);
  });
});
