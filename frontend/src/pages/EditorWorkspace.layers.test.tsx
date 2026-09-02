import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';
import { expandAllCollapsibleSections } from '../testUtils/expandCollapsibleSections';

/**
 * Task 24 (renamed/extended by issue #127): interaction and
 * keyboard-operability tests for the Layers panel (`LayersPanel.tsx`,
 * formerly `SceneOutlinePanel.tsx`) — layers, groups, reordering,
 * visibility/lock, grouping/ungrouping, and (issue #127) pointer
 * drag-and-drop reordering/reparenting and its locked-row rejection —
 * layered on top of the Task 21/23 workspace shell. See
 * `sceneOutline.test.ts` and `useSceneEditor.outline.test.ts` for the
 * underlying logic tests.
 *
 * ## Simulating native drag-and-drop in jsdom
 *
 * jsdom has no real layout engine and no native `DataTransfer`
 * constructor, so `fireDrag` below fires the raw `dragstart`/`dragover`/
 * `drop`/`dragend` sequence directly via `fireEvent` with a hand-rolled
 * `dataTransfer` stub (a plain object with the handful of properties
 * `LayersPanel.tsx` actually touches), and `getBoundingClientRect` is
 * stubbed once per test file to a fixed rect so the drop-zone math
 * (`LayersPanel.tsx`'s `zoneForRow`) is deterministic — the same
 * "stub the geometry, fire the real events" approach any RTL suite needs
 * for drag-and-drop, since `@testing-library/user-event` has no built-in
 * drag support.
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

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Gallery placeholder</p>} />
        <Route path="/projects/:id" element={<EditorWorkspace />} />
        <Route path="/projects/:id/settings" element={<p>Settings placeholder</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function loadReadyWorkspace() {
  mockedGetProject.mockResolvedValue(baseProject());
  mockedGetSceneVersion.mockResolvedValue(baseVersion());
  renderWorkspace();
  await screen.findByRole('region', { name: 'Tools' });
  expandAllCollapsibleSections();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Open piece controls menu' }));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Edit scene' }));
}

function outlineList() {
  return screen.getByRole('list', { name: 'Scene outline' });
}

function outlineRows() {
  return within(outlineList()).getAllByRole('listitem');
}

/** Issue #131: a row's move up/down buttons and `MoveControls` reparent
 * select+button pair now live behind a per-row `<details>`/`<summary>`
 * disclosure (`LayersPanel.tsx`'s `RowMoreDisclosure`) rather than being
 * always visible, so any interaction with them has to open the row's
 * disclosure first — the same "click summary, then use what's inside"
 * sequence a real user (and a real browser, which actually hides collapsed
 * `<details>` content — jsdom does not) needs. `<summary>` doesn't expose
 * a `button` role via the accessibility tree computation this suite's
 * `getByRole` relies on, so this targets it by its visible "More" text
 * instead. */
async function openMore(row: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(row).getByText('More'));
}

/** A stub `DataTransfer` covering only what `LayersPanel.tsx` touches
 * (`setData`/`getData`/`effectAllowed`/`dropEffect`) — jsdom has no real
 * `DataTransfer` constructor to instantiate instead. */
function stubDataTransfer() {
  const data: Record<string, string> = {};
  return {
    setData: (key: string, value: string) => {
      data[key] = value;
    },
    getData: (key: string) => data[key] ?? '',
    effectAllowed: 'none',
    dropEffect: 'none',
  };
}

/** jsdom has no `DragEvent`/`MouseEvent` constructor (see
 * https://github.com/jsdom/jsdom/issues/1568 and the lack of any
 * `window.DragEvent` at all), so `@testing-library/dom`'s `fireEvent.drag*`
 * sugar — which asks `window.DragEvent || window.Event` for a constructor
 * and passes `clientY` through *that constructor's* `init` dictionary —
 * silently drops `clientY` (a plain `Event` constructor ignores unknown
 * init keys). Building the event by hand and assigning `clientY`/
 * `dataTransfer` directly onto the instance (a plain own-property
 * assignment, not routed through any constructor) sidesteps that: React's
 * synthetic event layer reads `nativeEvent.clientY` off whatever object it
 * receives, so this only needs the property to exist, not a "real"
 * `DragEvent` instance. */
function makeDragEvent(type: string, props: Record<string, unknown>): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  return event;
}

/** Fires the full native drag-and-drop event sequence `LayersPanel.tsx`
 * listens for: `dragstart` on `source`, `dragover` then `drop` on
 * `target` at `clientY` (interpreted against the stubbed fixed-height
 * bounding rect from `beforeEach` below to land on a specific
 * before/after/into zone — see `zoneForRow` in `LayersPanel.tsx`), then
 * `dragend` on `source` to mirror what a real drag always does whether or
 * not the drop was accepted. */
function fireDrag(source: HTMLElement, target: HTMLElement, clientY: number) {
  const dataTransfer = stubDataTransfer();
  fireEvent(source, makeDragEvent('dragstart', { dataTransfer }));
  fireEvent(target, makeDragEvent('dragover', { dataTransfer, clientY }));
  fireEvent(target, makeDragEvent('drop', { dataTransfer, clientY }));
  fireEvent(source, makeDragEvent('dragend', { dataTransfer }));
}

beforeEach(() => {
  // A fixed, deterministic bounding rect for every row so `zoneForRow`'s
  // before(<1/3)/into(1/3-2/3)/after(>2/3) math (or before(<1/2)/after
  // for shape rows, which never offer "into") produces a known zone from
  // a known `clientY`, regardless of jsdom's lack of real layout.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Task 41: VersionHistoryPanel always loads history on mount; default
  // to an empty (but successfully loaded) list so tests unrelated to
  // version history don't need to know about it.
  // A single-entry history (matching the default current_version: 1)
  // so unrelated tests don't trip the empty-history 'impossible state'
  // alert VersionHistoryPanel renders for a genuinely empty list.
  mockedListSceneVersions.mockResolvedValue([
    {
      id: 1,
      sequence: 1,
      origin: 'manual',
      change_label: null,
      created_by: 'alice',
      parent: null,
      fork_source_version: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
});

describe('EditorWorkspace scene outline: layers', () => {
  it('shows the initial layer in the outline', async () => {
    await loadReadyWorkspace();
    expect(within(outlineList()).getByLabelText('Layer name for Layer 1')).toBeInTheDocument();
  });

  it('adds a new layer via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add layer' }));

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'layer')).toHaveLength(2);
  });

  it('adds a layer via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const addLayerButton = screen.getByRole('button', { name: 'Add layer' });
    addLayerButton.focus();
    expect(addLayerButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'layer')).toHaveLength(2);
  });

  it('renames a layer by typing into its name field and blurring', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const nameField = within(outlineList()).getByLabelText('Layer name for Layer 1');
    await user.clear(nameField);
    await user.type(nameField, 'Background{Tab}');

    expect(within(outlineList()).getByLabelText('Layer name for Background')).toBeInTheDocument();
  });

  it('shows a textual explanation instead of deleting the only layer', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete layer Layer 1' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least one layer/i);
    expect(within(outlineList()).getByLabelText('Layer name for Layer 1')).toBeInTheDocument();
  });

  it('reorders two layers with the move buttons, reflected in outline order', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' }));

    // Second layer is "Layer 2"; move it above "Layer 1".
    const layer2Row = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'))!;
    await openMore(layer2Row, user);
    await user.click(screen.getByRole('button', { name: 'Move layer Layer 2 up' }));

    const layerNames = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'layer')
      .map((r) => within(r).getByRole('textbox').getAttribute('value') ?? '');
    expect(layerNames[0]).toBe('Layer 2');
  });

  // Issue #168 (task 136): the layer row's Visible/Locked toggle buttons
  // were converted to compact checkboxes wired to the exact same
  // `toggleLayerVisible`/`toggleLayerLocked` mutations — this now asserts
  // `checked` state rather than the old buttons' `aria-pressed`/label-text
  // flip, since a checkbox's accessible name ("Layer <name> visible") is
  // static across its checked/unchecked states.
  it('toggles layer visibility and lock state', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const visibleCheckbox = screen.getByRole('checkbox', { name: /visible$/i });
    expect(visibleCheckbox).toBeChecked();
    await user.click(visibleCheckbox);
    expect(visibleCheckbox).not.toBeChecked();

    const lockedCheckbox = screen.getByRole('checkbox', { name: /locked$/i });
    expect(lockedCheckbox).not.toBeChecked();
    await user.click(lockedCheckbox);
    expect(lockedCheckbox).toBeChecked();
  });
});

// Issue #168 (task 136) acceptance criteria this describe block covers
// directly: each checkbox has a real accessible name (not a bare
// unlabeled checkbox), and Tab/Space keyboard operability is preserved or
// improved versus the old buttons -- both properties `userEvent`
// exercises through actual keyboard events here, not just a click.
describe('EditorWorkspace scene outline: layer row Visible/Locked checkboxes (issue #168)', () => {
  it('gives each checkbox a distinct, non-empty accessible name', async () => {
    await loadReadyWorkspace();

    const visibleCheckbox = screen.getByRole('checkbox', { name: 'Layer Layer 1 visible' });
    const lockedCheckbox = screen.getByRole('checkbox', { name: 'Layer Layer 1 locked' });
    expect(visibleCheckbox).toBeInTheDocument();
    expect(lockedCheckbox).toBeInTheDocument();
    expect(visibleCheckbox).not.toBe(lockedCheckbox);
  });

  it('is reachable by Tab and toggles with Space, like any native checkbox', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    const visibleCheckbox = screen.getByRole('checkbox', { name: /visible$/i });
    visibleCheckbox.focus();
    expect(visibleCheckbox).toHaveFocus();
    expect(visibleCheckbox).toBeChecked();

    await user.keyboard(' ');
    expect(visibleCheckbox).not.toBeChecked();

    await user.keyboard(' ');
    expect(visibleCheckbox).toBeChecked();
  });
});

describe('EditorWorkspace scene outline: selection sync', () => {
  // Issue #131: the Tools panel's separate "Shape list" `<ul>` (a
  // duplicate of this exact outline) was removed — `LayersPanel.tsx`'s
  // outline is now the single place shapes are listed and selected, so
  // there's nothing left to cross-check selection against. This still
  // exercises the same underlying selection behavior these two tests used
  // to (clicking a shape row marks it, and only it, selected).
  it('selecting a shape in the outline marks only that shape selected', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' })); // auto-selected

    const outlineRectangleButton = within(outlineList()).getByRole('button', {
      name: 'Rectangle 1',
    });
    expect(outlineRectangleButton).toHaveAttribute('aria-pressed', 'true');

    const outlineCircleButton = within(outlineList()).getByRole('button', { name: 'Circle 1' });
    await user.click(outlineCircleButton);

    expect(outlineCircleButton).toHaveAttribute('aria-pressed', 'true');
    expect(outlineRectangleButton).toHaveAttribute('aria-pressed', 'false');
  });

  // Issue #153: the underlying `selectedShapeId` was already correct in
  // both directions; only the visible row highlight was missing.
  it('visibly marks the selected shape row via data-selected, and only that row', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' })); // auto-selected

    const rectangleRow = within(outlineList())
      .getByRole('button', { name: 'Rectangle 1' })
      .closest('li');
    const circleRow = within(outlineList()).getByRole('button', { name: 'Circle 1' }).closest('li');
    expect(rectangleRow).toHaveAttribute('data-selected', 'true');
    expect(circleRow).not.toHaveAttribute('data-selected');

    await user.click(within(outlineList()).getByRole('button', { name: 'Circle 1' }));

    expect(circleRow).toHaveAttribute('data-selected', 'true');
    expect(rectangleRow).not.toHaveAttribute('data-selected');
  });

  it('keeps shape selection and renaming distinct in the outline row', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const row = within(outlineList()).getByRole('button', { name: 'Circle 1' }).closest('li')!;
    const renameField = within(row).getByRole('textbox', { name: 'Shape name for Circle 1' });
    const selectButton = within(row).getByRole('button', { name: 'Circle 1' });

    expect(renameField).toBeInTheDocument();
    expect(selectButton).toHaveAttribute('title', 'Select shape Circle 1');
    expect(selectButton).not.toHaveTextContent('Circle 1');
  });

  it('selects a layer from its name and Visible checkbox while preserving the toggle', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const layerRow = within(outlineList())
      .getAllByRole('listitem')
      .find(
        (row) => row.dataset.outlineKind === 'layer' && within(row).queryByDisplayValue('Layer 2'),
      )!;
    const visible = within(layerRow).getByRole('checkbox', { name: 'Layer Layer 2 visible' });
    const name = within(layerRow).getByRole('textbox', { name: 'Layer name for Layer 2' });

    await user.click(visible);
    expect(visible).not.toBeChecked();
    expect(layerRow).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('selection-hud')).toHaveTextContent('Layer 2');

    await user.click(visible);
    expect(visible).toBeChecked();
    expect(layerRow).toHaveAttribute('data-selected', 'true');

    await user.click(name);
    expect(layerRow).toHaveAttribute('data-selected', 'true');
  });

  it('selects the layer from the visible-label region as well as the checkbox', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const layerRow = within(outlineList())
      .getAllByRole('listitem')
      .find(
        (row) => row.dataset.outlineKind === 'layer' && within(row).queryByDisplayValue('Layer 2'),
      )!;
    const visibleLabel = within(layerRow).getByText('Vis', { selector: 'span' });
    const visible = within(layerRow).getByRole('checkbox', { name: 'Layer Layer 2 visible' });

    await user.click(visibleLabel);

    expect(layerRow).toHaveAttribute('data-selected', 'true');
    expect(visible).not.toBeChecked();
    expect(screen.getByTestId('selection-hud')).toHaveTextContent('Layer 2');
  });

  it('keeps canvas settings in their dedicated panel instead of the Layers outline', async () => {
    await loadReadyWorkspace();

    const canvasPanel = screen.getByRole('region', { name: 'Canvas' });
    expect(within(canvasPanel).getByRole('group', { name: 'Canvas settings' })).toBeInTheDocument();
    expect(
      within(canvasPanel).getByRole('spinbutton', { name: 'Canvas opacity' }),
    ).toBeInTheDocument();
    expect(within(outlineList()).queryByRole('group', { name: 'Canvas settings' })).toBeNull();
  });

  it('keeps layer selection synchronized with visible canvas highlights and shape selection', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeRow = within(outlineList()).getByRole('button', { name: 'Circle 1' }).closest('li')!;
    const layerRow = within(outlineList())
      .getAllByRole('listitem')
      .find(
        (row) => row.dataset.outlineKind === 'layer' && within(row).queryByDisplayValue('Layer 2'),
      )!;
    await user.click(within(layerRow).getByRole('textbox', { name: 'Layer name for Layer 2' }));

    expect(layerRow).toHaveAttribute('data-selected', 'true');
    expect(shapeRow).toHaveAttribute('data-selected', 'true');
    expect(document.querySelector('[data-testid^="scene-shape-"]')).toHaveClass(
      'editor-scene-shape-layer-selected',
    );
    expect(screen.getByTestId('selection-hud')).toHaveTextContent(/1 visible shape/);

    await user.click(within(shapeRow).getByRole('button', { name: 'Circle 1' }));
    expect(layerRow).toHaveAttribute('data-selected', 'true');
    expect(shapeRow).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('selection-hud')).toHaveTextContent('Circle 1');
  });
});

describe('EditorWorkspace scene outline: friendly shape labels (Task 80 / issue #110)', () => {
  it('labels each shape by friendly type name and 1-based ordinal, never a raw UUID', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    expect(within(outlineList()).getByRole('button', { name: 'Circle 1' })).toBeInTheDocument();
    expect(within(outlineList()).getByRole('button', { name: 'Circle 2' })).toBeInTheDocument();
    expect(within(outlineList()).getByRole('button', { name: 'Rectangle 1' })).toBeInTheDocument();

    const shapeRows = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'shape');
    for (const row of shapeRows) {
      // A raw scene id is a UUID (36 chars including hyphens); no row's
      // text should contain one verbatim.
      expect(row.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });
});

describe('EditorWorkspace scene outline: inherited visibility/lock legibility (Task 80 / issue #110)', () => {
  // Issue #164 (task 132): the group row's inherited-hidden/locked
  // annotation text (the thing this test used to assert on directly) was
  // removed from the always-visible row along with the row's own Visible/
  // Locked buttons — see `LayersPanel.tsx`'s group-row comment and this
  // task's `_docs/tasks.md` resolution notes. The underlying "own state is
  // unaffected by an ancestor's" behavior this test protects still exists
  // (the mutations are unchanged), so this now verifies it through
  // `SelectionHud.tsx`'s Visible toggle instead of the row's own inline
  // one.
  it("shows a group's own Visible toggle state independent of an ancestor's, via the selection HUD", async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    // Task 111 (issue #142): addShape gives the circle its own fresh
    // layer ("Layer 2", created after the scene's pre-existing "Layer 1")
    // -- the new group adopts the first selected item's (the circle's)
    // layerId, so that's the group's actual ancestor layer row, not
    // whichever layer row happens to come first.
    const rows = within(outlineList()).getAllByRole('listitem');
    const layerRow = rows.find(
      (r) =>
        r.dataset.outlineKind === 'layer' && within(r).queryByLabelText('Layer name for Layer 2'),
    )!;
    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton); // select the group so its HUD appears

    // Hiding the layer (the group's only ancestor) doesn't touch the
    // group's own flag -- the HUD's Visible toggle (which reflects/mutates
    // only the group's own state, never the cascaded one) still reads
    // "Visible" afterward. Issue #168 (task 136): the layer row's own
    // Visible toggle is now a checkbox, not a button.
    await user.click(within(layerRow).getByRole('checkbox', { name: /visible$/i }));
    // Issue #183: the complete layer row is also a selection surface, so
    // the checkbox click selects the layer while toggling its visibility.
    await user.click(groupButton);

    const hud = screen.getByTestId('selection-hud');
    expect(within(hud).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
  });
});

describe('EditorWorkspace scene outline: grouping', () => {
  it('combines two multi-selected shapes into a group via keyboard', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    expect(checkboxes).toHaveLength(2);
    checkboxes[0].focus();
    await user.keyboard(' ');
    checkboxes[1].focus();
    await user.keyboard(' ');

    const combineButton = screen.getByRole('button', { name: 'Combine into group' });
    expect(combineButton).toBeEnabled();
    await user.click(combineButton);

    const groupRows = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'group');
    expect(groupRows).toHaveLength(1);
    expect(within(groupRows[0]).getByText(/Group: Group 1 \(2 item\(s\)\)/)).toBeInTheDocument();
  });

  it('is disabled with fewer than two items selected for grouping', async () => {
    await loadReadyWorkspace();
    expect(screen.getByRole('button', { name: 'Combine into group' })).toBeDisabled();
  });

  it('ungroups a selected group back into top-level shapes', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton); // select the group as the active selection

    const ungroupButton = screen.getByRole('button', { name: 'Ungroup selected' });
    expect(ungroupButton).toBeEnabled();
    await user.click(ungroupButton);

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'group')).toHaveLength(0);
    expect(rows.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(2);
  });

  it('deletes a selected group and its shapes', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    const groupButton = within(outlineList()).getByRole('button', { name: /Group: Group 1/ });
    await user.click(groupButton);

    await user.click(screen.getByRole('button', { name: 'Delete selected group' }));

    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'group')).toHaveLength(0);
    expect(rows.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(0);
  });
});

describe('EditorWorkspace scene outline: reorder', () => {
  it('reorders shapes within the outline with move up/down buttons', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const shapeRowsBefore = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsBefore.map((r) => r.dataset.outlineId)).toHaveLength(2);
    const [firstId, secondId] = shapeRowsBefore.map((r) => r.dataset.outlineId);

    // Issue #164 (task 132): Move up/down for a shape/group row now live
    // in `SelectionHud.tsx`, shown while that row is selected -- the
    // rectangle (`shapeRowsBefore[1]`) already is, since "Add rectangle"
    // auto-selects it.
    const hud = screen.getByTestId('selection-hud');
    await user.click(within(hud).getByRole('button', { name: /Move .* up/ }));

    const shapeRowsAfter = within(outlineList())
      .getAllByRole('listitem')
      .filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsAfter.map((r) => r.dataset.outlineId)).toEqual([secondId, firstId]);
  });
});

describe('EditorWorkspace scene outline: reparenting (Task 76)', () => {
  it('moves a shape to a different layer via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    // Issue #164 (task 132): the shape's `MoveControls` (Move to layer/
    // Move to group) now live in `SelectionHud.tsx`, shown while the shape
    // is selected -- the just-added circle already is (add auto-selects).
    const hud = screen.getByTestId('selection-hud');
    const layerSelect = within(hud).getByRole('combobox', { name: /Target layer for/ });
    await user.selectOptions(layerSelect, 'Layer 2');
    await user.click(within(hud).getByRole('button', { name: /Move .* to layer/ }));

    const rowsAfter = within(outlineList()).getAllByRole('listitem');
    // The shape row should now be nested under Layer 2, i.e. appear after
    // the "Layer 2" row rather than immediately after "Layer 1".
    const layer2Index = rowsAfter.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndex = rowsAfter.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndex).toBeGreaterThan(layer2Index);
  });

  it('moves a shape to a different layer via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const hud = screen.getByTestId('selection-hud');
    const layerSelect = within(hud).getByRole('combobox', {
      name: /Target layer for/,
    }) as HTMLSelectElement;
    layerSelect.focus();
    expect(layerSelect).toHaveFocus();
    await user.selectOptions(layerSelect, 'Layer 2');

    const moveButton = within(hud).getByRole('button', { name: /Move .* to layer/ });
    moveButton.focus();
    expect(moveButton).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(hud).getByRole('status')).toHaveTextContent(/Moved Circle 1 to layer Layer 2/);

    const rowsAfter = within(outlineList()).getAllByRole('listitem');
    const layer2Index = rowsAfter.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndex = rowsAfter.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndex).toBeGreaterThan(layer2Index);
  });

  it('moves a shape into a different group via pointer click', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    await user.click(screen.getByRole('button', { name: 'Add circle' })); // auto-selected

    // Issue #164 (task 132): same relocation as the layer-move tests above.
    const hud = screen.getByTestId('selection-hud');
    const groupSelect = within(hud).getByRole('combobox', { name: /Target group for/ });
    await user.selectOptions(groupSelect, 'Group 1');
    await user.click(within(hud).getByRole('button', { name: /Move .* to group/ }));

    const groupRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'group')!;
    expect(within(groupRow).getByText(/Group: Group 1 \(3 item\(s\)\)/)).toBeInTheDocument();
  });

  it('promotes a grouped shape back to top level via keyboard-only interaction', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));

    // Issue #164 (task 132): grouping selects the new *group*, not one of
    // its member shapes (`groupItems`'s `selectId`), so this shape's
    // `MoveControls` (now in `SelectionHud.tsx`) aren't visible until it's
    // explicitly selected first — a step this test didn't need before,
    // since the row's own always-visible `MoveControls` needed no
    // selection at all.
    const groupedShapeRow = within(outlineList())
      .getAllByRole('listitem')
      .find((r) => r.dataset.outlineKind === 'shape')!;
    // Issue #282 added a second "Ask AI to change this" button to each
    // shape row, so this can no longer assume the row's only button is
    // its own select/name button -- select it by its exact accessible
    // name (the shape's plain label, unlike the AI button's longer
    // "Ask AI to change ..." label).
    await user.click(within(groupedShapeRow).getByRole('button', { name: 'Circle 1' }));

    const hud = screen.getByTestId('selection-hud');
    const groupSelect = within(hud).getByRole('combobox', {
      name: /Target group for/,
    }) as HTMLSelectElement;
    groupSelect.focus();
    expect(groupSelect).toHaveFocus();
    await user.selectOptions(groupSelect, 'Top level');

    const moveButton = within(hud).getByRole('button', { name: /Move .* to group/ });
    moveButton.focus();
    await user.keyboard('{Enter}');

    // The group keeps its one remaining child rather than being pruned.
    const rows = within(outlineList()).getAllByRole('listitem');
    expect(rows.filter((r) => r.dataset.outlineKind === 'group')).toHaveLength(1);
    expect(
      within(rows.find((r) => r.dataset.outlineKind === 'group')!).getByText(/\(1 item\(s\)\)/),
    ).toBeInTheDocument();
    expect(rows.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(2);
  });

  it('shows a textual explanation instead of moving a group into its own descendant', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' })); // -> Group 1

    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    const rowsBefore = within(outlineList()).getAllByRole('listitem');
    const looseShapeCheckbox = within(
      rowsBefore.filter((r) => r.dataset.outlineKind === 'shape').slice(-1)[0],
    ).getByRole('checkbox');
    const innerGroupCheckbox = within(
      rowsBefore.find((r) => r.dataset.outlineKind === 'group')!,
    ).getByRole('checkbox');
    await user.click(looseShapeCheckbox);
    await user.click(innerGroupCheckbox);
    await user.click(screen.getByRole('button', { name: 'Combine into group' })); // -> Group 2 (outer)

    // Issue #164 (task 132): grouping selects the newly created group
    // (`groupItems`'s `selectId`), so "Group 2" (the outer group just
    // created) is already selected and its `MoveControls` are already in
    // `SelectionHud.tsx` -- no explicit selection click needed here.
    const hud = screen.getByTestId('selection-hud');
    const groupSelect = within(hud).getByRole('combobox', { name: /Target group for/ });
    await user.selectOptions(groupSelect, 'Group 1');
    await user.click(within(hud).getByRole('button', { name: /Move .* to group/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(/descendant/i);
  });

  it('undoes a shape-to-layer move in a single step', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    // Issue #164 (task 132): same relocation as the earlier layer-move
    // tests -- the just-added circle is already selected.
    const hud = screen.getByTestId('selection-hud');
    const layerSelect = within(hud).getByRole('combobox', { name: /Target layer for/ });
    await user.selectOptions(layerSelect, 'Layer 2');
    await user.click(within(hud).getByRole('button', { name: /Move .* to layer/ }));

    const rowsAfterMove = within(outlineList()).getAllByRole('listitem');
    const layer2IndexAfterMove = rowsAfterMove.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndexAfterMove = rowsAfterMove.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndexAfterMove).toBeGreaterThan(layer2IndexAfterMove);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    const rowsAfterUndo = within(outlineList()).getAllByRole('listitem');
    const layer1IndexAfterUndo = rowsAfterUndo.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 1'),
    );
    const shapeIndexAfterUndo = rowsAfterUndo.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndexAfterUndo).toBeGreaterThan(layer1IndexAfterUndo);
  });
});

describe('EditorWorkspace scene outline: undo integration', () => {
  it('undoes a grouping action in a single step', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));
    expect(
      within(outlineList())
        .getAllByRole('listitem')
        .filter((r) => r.dataset.outlineKind === 'group'),
    ).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(
      within(outlineList())
        .getAllByRole('listitem')
        .filter((r) => r.dataset.outlineKind === 'group'),
    ).toHaveLength(0);
  });
});

describe('EditorWorkspace scene outline: dedicated Layers panel landmark (issue #127)', () => {
  it('renders the outline inside its own "Layers" region, distinct from Tools', async () => {
    await loadReadyWorkspace();

    const layersRegion = screen.getByRole('region', { name: 'Layers' });
    expect(within(layersRegion).getByRole('list', { name: 'Scene outline' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Tools' })).queryByRole('list', {
        name: 'Scene outline',
      }),
    ).not.toBeInTheDocument();
  });

  it('is reachable as its own switcher tab below 1024px, mutually exclusive with Tools', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 320,
    });
    window.dispatchEvent(new Event('resize'));
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('tablist', { name: /editor panels/i });

    // Tools is the default active tab; Layers isn't visible yet.
    expect(document.querySelector('[data-panel="layers"]')).not.toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Layers' }));

    expect(screen.getByRole('region', { name: 'Layers' })).toBeVisible();
    expect(document.querySelector('[data-panel="tools"]')).not.toBeVisible();
    // Preview never goes away, regardless of which switcher tab is active.
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    window.dispatchEvent(new Event('resize'));
  });
});

describe('EditorWorkspace scene outline: pointer drag-and-drop (issue #127)', () => {
  it('reorders two top-level shapes by dragging one above the other, matching canvas z-order', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' })); // Circle 1
    await user.click(screen.getByRole('button', { name: 'Add rectangle' })); // Rectangle 1

    const [circleRow, rectangleRow] = outlineRows().filter(
      (r) => r.dataset.outlineKind === 'shape',
    );
    const circleId = circleRow.dataset.outlineId;
    const rectangleId = rectangleRow.dataset.outlineId;

    // Issue #194: the top of the Layers panel is frontmost (drawn last) —
    // Circle is added first (panel top, lower `order`), Rectangle second
    // (panel bottom, higher `order`), so Rectangle (backmost) draws
    // *before* Circle (frontmost) in DOM/z-order.
    const zOrderBefore = Array.from(document.querySelectorAll('[data-testid^="scene-shape-"]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(zOrderBefore).toEqual([`scene-shape-${rectangleId}`, `scene-shape-${circleId}`]);

    // Drag Rectangle above Circle (clientY 5, a shape row's "before" zone —
    // see the stubbed 40px-tall rect in `beforeEach`).
    fireDrag(rectangleRow, circleRow, 5);

    const shapeRowsAfter = outlineRows().filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsAfter.map((r) => r.dataset.outlineId)).toEqual([rectangleId, circleId]);

    // Rectangle is now at the top of the panel (frontmost), Circle at the
    // bottom (backmost) -- the rendered z-order flips to match: Circle
    // draws first/back, Rectangle draws last/front.
    const zOrderAfter = Array.from(document.querySelectorAll('[data-testid^="scene-shape-"]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(zOrderAfter).toEqual([`scene-shape-${circleId}`, `scene-shape-${rectangleId}`]);
  });

  it('undoes a pointer drag reorder in a single step', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const [circleRow, rectangleRow] = outlineRows().filter(
      (r) => r.dataset.outlineKind === 'shape',
    );
    const circleId = circleRow.dataset.outlineId;
    const rectangleId = rectangleRow.dataset.outlineId;

    fireDrag(rectangleRow, circleRow, 5);
    expect(
      outlineRows()
        .filter((r) => r.dataset.outlineKind === 'shape')
        .map((r) => r.dataset.outlineId),
    ).toEqual([rectangleId, circleId]);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(
      outlineRows()
        .filter((r) => r.dataset.outlineKind === 'shape')
        .map((r) => r.dataset.outlineId),
    ).toEqual([circleId, rectangleId]);
  });

  it('reparents a loose shape into a group by dragging it onto the group row', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' })); // -> Group 1

    await user.click(screen.getByRole('button', { name: 'Add circle' })); // loose Circle 2
    const rowsBefore = outlineRows();
    const looseShapeRow = rowsBefore.filter((r) => r.dataset.outlineKind === 'shape').slice(-1)[0];
    const groupRow = rowsBefore.find((r) => r.dataset.outlineKind === 'group')!;

    // clientY 20 lands in a group row's middle-third "into" zone (see
    // `zoneForRow` in LayersPanel.tsx and the stubbed 40px rect above).
    fireDrag(looseShapeRow, groupRow, 20);

    const groupRowAfter = outlineRows().find((r) => r.dataset.outlineKind === 'group')!;
    expect(within(groupRowAfter).getByText(/Group: Group 1 \(3 item\(s\)\)/)).toBeInTheDocument();
  });

  it('reparents a shape to a different layer by dragging it onto that layer row', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2
    await user.click(screen.getByRole('button', { name: 'Add circle' })); // on Layer 1

    const shapeRow = outlineRows().find((r) => r.dataset.outlineKind === 'shape')!;
    const layer2Row = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'layer')
      .find((r) => within(r).queryByDisplayValue('Layer 2'))!;

    fireDrag(shapeRow, layer2Row, 20);

    const rowsAfter = outlineRows();
    const layer2Index = rowsAfter.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const shapeIndex = rowsAfter.findIndex((r) => r.dataset.outlineKind === 'shape');
    expect(shapeIndex).toBeGreaterThan(layer2Index);
  });

  it('reorders two layers by dragging one above the other', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2

    const layerRows = outlineRows().filter((r) => r.dataset.outlineKind === 'layer');
    const [layer1Row, layer2Row] = layerRows;

    // clientY 5 lands in a layer row's "before" zone (top third).
    fireDrag(layer2Row, layer1Row, 5);

    const namesAfter = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'layer')
      .map((r) => within(r).getByRole('textbox').getAttribute('value') ?? '');
    expect(namesAfter[0]).toBe('Layer 2');
  });
});

describe('EditorWorkspace scene outline: locked-row drag rejection (issue #127)', () => {
  it('is not draggable once its effective lock state is true', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    // Task 111 (issue #142): addShape gives the circle its own fresh
    // layer ("Layer 2", after the scene's pre-existing "Layer 1") -- lock
    // that one specifically, since more than one Locked checkbox now
    // exists. Issue #168 (task 136): the layer row's Locked toggle is now
    // a checkbox, not a button.
    const circleLayerRow = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'layer')
      .find((r) => within(r).queryByDisplayValue('Layer 2'))!;
    await user.click(within(circleLayerRow).getByRole('checkbox', { name: /locked$/i }));

    const shapeRow = outlineRows().find((r) => r.dataset.outlineKind === 'shape')!;
    expect(shapeRow).toHaveAttribute('draggable', 'false');
  });

  it('rejects a drop that would reparent an item into a locked layer, leaving the scene unchanged', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add layer' })); // Layer 2

    const layer2RowInit = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'layer')
      .find((r) => within(r).queryByDisplayValue('Layer 2'))!;
    const layer2LockedCheckbox = within(layer2RowInit).getByRole('checkbox', { name: /locked$/i });
    await user.click(layer2LockedCheckbox);
    expect(layer2LockedCheckbox).toBeChecked();

    // Task 111 (issue #142): addShape gives the circle its own fresh
    // layer ("Layer 3", not "Layer 1" as this comment used to assume).
    await user.click(screen.getByRole('button', { name: 'Add circle' }));

    const shapeRow = outlineRows().find((r) => r.dataset.outlineKind === 'shape')!;
    const layer2Row = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'layer')
      .find((r) => within(r).queryByDisplayValue('Layer 2'))!;

    fireDrag(shapeRow, layer2Row, 20);

    // Rejected: Layer 2's own section (between its row and the next layer
    // row) still contains no shape row -- the circle wasn't reparented
    // onto it. (It stays on its own "Layer 3", which happens to render
    // after Layer 2 regardless of whether the drop succeeded, since it
    // was already created after Layer 2 -- so row *position* alone can't
    // prove rejection here the way it could when every shape shared one
    // layer.)
    const rowsAfter = outlineRows();
    const layer2Index = rowsAfter.findIndex(
      (r) => r.dataset.outlineKind === 'layer' && within(r).queryByDisplayValue('Layer 2'),
    );
    const nextLayerIndex = rowsAfter.findIndex(
      (r, i) => i > layer2Index && r.dataset.outlineKind === 'layer',
    );
    const layer2Section = rowsAfter.slice(layer2Index + 1, nextLayerIndex);
    expect(layer2Section.some((r) => r.dataset.outlineKind === 'shape')).toBe(false);
    expect(rowsAfter.filter((r) => r.dataset.outlineKind === 'shape')).toHaveLength(1);
    expect(sceneEditorOutlineErrorAbsent()).toBe(true);
  });
});

/** A rejected drag-and-drop is a silent no-op by design (the same
 * "invalid drops... show a rejected/no-drop affordance" acceptance
 * criterion, not a textual error) — unlike a rejected keyboard "Move to
 * layer"/"Move to group" action, which does surface `outlineError`. This
 * just documents/confirms no stray alert leaks from a rejected drag. */
function sceneEditorOutlineErrorAbsent(): boolean {
  return screen.queryByRole('alert') === null;
}

describe('EditorWorkspace scene outline: no duplicate/missing rows (issue #127)', () => {
  it('renders exactly one row per layer/group/shape across add/remove/reorder/reparent/undo/redo', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();

    function assertNoDuplicates(expectedCount: number) {
      const rows = outlineRows();
      const ids = rows.map((r) => r.dataset.outlineId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(rows).toHaveLength(expectedCount);
    }

    assertNoDuplicates(1); // Layer 1 only

    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    assertNoDuplicates(2); // + Layer 2

    // Task 111 (issue #142): addShape gives every new shape its own fresh
    // layer too, so each "Add circle"/"Add rectangle" below adds TWO rows
    // (the shape and its own new layer), not one.
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    assertNoDuplicates(6); // + 2 shapes, each on its own new layer

    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' }));
    assertNoDuplicates(7); // 4 layers + 1 group + 2 nested shapes

    const shapesInGroup = outlineRows().filter((r) => r.dataset.outlineKind === 'shape');
    fireDrag(shapesInGroup[1], shapesInGroup[0], 5); // reorder within the group
    assertNoDuplicates(7);

    await user.click(screen.getByRole('button', { name: 'Add circle' })); // loose Circle 2 + its own layer
    assertNoDuplicates(9);

    const looseShape = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'shape')
      .slice(-1)[0];
    const groupRow = outlineRows().find((r) => r.dataset.outlineKind === 'group')!;
    fireDrag(looseShape, groupRow, 20); // reparent into the group
    assertNoDuplicates(9);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    assertNoDuplicates(9);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    assertNoDuplicates(9);
  });
});

/** Task 129 (issue #161): the touch-compatible counterpart to `fireDrag`
 * above, exercising `LayersPanel.tsx`'s Pointer Events path
 * (`onHandlePointerDown`/`Move`/`Up`) instead of native HTML5
 * `dragstart`/`dragover`/`drop`. Unlike `DragEvent`, jsdom's real
 * `PointerEvent` constructor honors `pointerId`/`pointerType`/`clientX`/
 * `clientY` directly, so no hand-rolled event/`dataTransfer` stub is needed
 * — only `document.elementFromPoint` (which jsdom doesn't implement at all)
 * needs stubbing, standing in for "whichever row is currently under the
 * finger" the same way `target`'s own bounding rect already stands in for
 * real layout. Every event fires on the row's own `.editor-outline-drag-handle`
 * span, matching where `LayersPanel.tsx` actually attaches these listeners
 * (not the row itself). */
function firePointerDrag(source: HTMLElement, target: HTMLElement, clientY: number) {
  const handle = source.querySelector('.editor-outline-drag-handle');
  if (!handle) throw new Error('row has no drag handle');
  document.elementFromPoint = vi.fn().mockReturnValue(target);
  const pointerId = 7;
  fireEvent(
    handle,
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    }),
  );
  fireEvent(
    handle,
    new PointerEvent('pointermove', {
      bubbles: true,
      pointerId,
      pointerType: 'touch',
      clientX: 0,
      clientY,
    }),
  );
  fireEvent(
    handle,
    new PointerEvent('pointerup', {
      bubbles: true,
      pointerId,
      pointerType: 'touch',
      clientX: 0,
      clientY,
    }),
  );
}

describe('EditorWorkspace scene outline: touch drag-and-drop (issue #161)', () => {
  it('reorders two top-level shapes by touch-dragging one above the other', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' })); // Circle 1
    await user.click(screen.getByRole('button', { name: 'Add rectangle' })); // Rectangle 1

    const [circleRow, rectangleRow] = outlineRows().filter(
      (r) => r.dataset.outlineKind === 'shape',
    );
    const circleId = circleRow.dataset.outlineId;
    const rectangleId = rectangleRow.dataset.outlineId;

    // clientY 5 lands in a shape row's "before" zone (see the stubbed 40px
    // rect in the top-level `beforeEach`).
    firePointerDrag(rectangleRow, circleRow, 5);

    const shapeRowsAfter = outlineRows().filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsAfter.map((r) => r.dataset.outlineId)).toEqual([rectangleId, circleId]);
  });

  it('reparents a loose shape into a group by touch-dragging it onto the group row', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    // Issue #168 (task 136) added Visible/Locked checkboxes to layer
    // rows in this same outline list, so an unscoped `getAllByRole`
    // would also pick those up -- filter to the "Select for grouping"
    // checkboxes this helper actually means.
    const checkboxes = within(outlineList()).getAllByRole('checkbox', {
      name: /to group selection$/i,
    });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: 'Combine into group' })); // -> Group 1

    await user.click(screen.getByRole('button', { name: 'Add circle' })); // loose Circle 2
    const rowsBefore = outlineRows();
    const looseShapeRow = rowsBefore.filter((r) => r.dataset.outlineKind === 'shape').slice(-1)[0];
    const groupRow = rowsBefore.find((r) => r.dataset.outlineKind === 'group')!;

    // clientY 20 lands in a group row's middle-third "into" zone.
    firePointerDrag(looseShapeRow, groupRow, 20);

    const groupRowAfter = outlineRows().find((r) => r.dataset.outlineKind === 'group')!;
    expect(within(groupRowAfter).getByText(/Group: Group 1 \(3 item\(s\)\)/)).toBeInTheDocument();
  });

  it('ignores a mouse pointerdown on the drag handle, leaving the native HTML5 path as the only mouse mechanism', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const [circleRow, rectangleRow] = outlineRows().filter(
      (r) => r.dataset.outlineKind === 'shape',
    );
    const circleId = circleRow.dataset.outlineId;
    const rectangleId = rectangleRow.dataset.outlineId;

    const handle = rectangleRow.querySelector('.editor-outline-drag-handle')!;
    document.elementFromPoint = vi.fn().mockReturnValue(circleRow);
    fireEvent(
      handle,
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 7,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
      }),
    );
    fireEvent(
      handle,
      new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'mouse' }),
    );

    expect(outlineRows().map((r) => r.dataset.outlineId)).toContain(rectangleId);
    const shapeRowsAfter = outlineRows().filter((r) => r.dataset.outlineKind === 'shape');
    expect(shapeRowsAfter.map((r) => r.dataset.outlineId)).toEqual([circleId, rectangleId]);
  });

  it('does not touch-drag a locked row', async () => {
    await loadReadyWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add circle' }));
    const circleLayerRow = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'layer')
      .find((r) => within(r).queryByDisplayValue('Layer 2'))!;
    await user.click(within(circleLayerRow).getByRole('checkbox', { name: /locked$/i }));

    await user.click(screen.getByRole('button', { name: 'Add rectangle' }));
    const shapeRows = outlineRows().filter((r) => r.dataset.outlineKind === 'shape');
    const lockedShapeRow = shapeRows[0]; // the circle, on the now-locked Layer 2
    const otherShapeRow = shapeRows[1];
    const idsBefore = shapeRows.map((r) => r.dataset.outlineId);

    firePointerDrag(lockedShapeRow, otherShapeRow, 5);

    const idsAfter = outlineRows()
      .filter((r) => r.dataset.outlineKind === 'shape')
      .map((r) => r.dataset.outlineId);
    expect(idsAfter).toEqual(idsBefore);
    expect(sceneEditorOutlineErrorAbsent()).toBe(true);
  });
});
