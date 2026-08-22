import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

/**
 * Task 60 (issue #58): rendered-UI tests for the Inspector panel's
 * shape-styling section (`ShapeInspectorPanel.tsx`) — all 7 fields render
 * and edit for a selected shape, edits reach canonical scene state/preview/
 * outline without ever changing the shape's id, the documented clamp/
 * reject policy for out-of-range and invalid input, keyboard increment/
 * decrement plus direct text entry, and the four required selection-state
 * cases (no selection, multi-selection, hidden selection, selection
 * deletion). See `shapeStyleFields.test.ts` for the underlying pure logic
 * and `useSceneEditor.shapeStyle.test.ts` for the hook-level commit/undo
 * wiring.
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
}

async function addAndSelectCircle() {
  fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
  // createShape centers a circle on the 800x600 canvas: (400,300), r=50,
  // scaleX/scaleY 1, rotation 0, opacity 1, fill #4f46e5, stroke #1e1b4b,
  // strokeWidth 2.
}

function numericInput(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe('ShapeInspectorPanel: selection states', () => {
  it('shows a clear empty state with no selection, and no leftover fields', async () => {
    await loadReadyWorkspace();
    expect(
      screen.getByText(/No shape selected\. Select a shape in the canvas or the outline/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();
  });

  it('renders all 7 style fields for a selected shape with its current values', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    expect(numericInput('Position X').value).toBe('400');
    expect(numericInput('Position Y').value).toBe('300');
    expect(numericInput('Scale X').value).toBe('1');
    expect(numericInput('Scale Y').value).toBe('1');
    expect(numericInput('Rotation').value).toBe('0');
    expect(numericInput('Opacity').value).toBe('1');
    expect(numericInput('Stroke width').value).toBe('2');
    expect((screen.getByLabelText('Fill') as HTMLInputElement).value).toBe('#4f46e5');
    expect((screen.getByLabelText('Stroke') as HTMLInputElement).value).toBe('#1e1b4b');

    // Unit/range text is visible, accessible text (not just a tooltip).
    // Position X and Position Y share the exact same range text.
    expect(screen.getAllByText('-100000 to 100000 px', { exact: true })).toHaveLength(2);
    expect(screen.getByText(/-360 to 360 degrees/)).toBeInTheDocument();
    expect(screen.getByText(/0 to 1 \(0 = transparent, 1 = opaque\)/)).toBeInTheDocument();
  });

  it('shows a clear non-stale state when a shape is deleted while selected', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    expect(numericInput('Position X')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected shape' }));

    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();
    expect(
      screen.getByText(/No shape selected\. Select a shape in the canvas or the outline/),
    ).toBeInTheDocument();
  });

  it('shows a clear non-stale state after undo clears the selection back to nothing', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();
    expect(
      screen.getByText(/No shape selected\. Select a shape in the canvas or the outline/),
    ).toBeInTheDocument();
  });

  it("swaps to the newly selected shape's own values, with no stale carryover", async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' })); // auto-selected, x=350

    expect(numericInput('Position X').value).toBe('350');

    const [circleButton] = within(screen.getByRole('list', { name: 'Shape list' })).getAllByRole(
      'button',
    );
    fireEvent.click(circleButton);

    expect(numericInput('Position X').value).toBe('400');
  });

  it("shows a hidden-selection notice when the selected shape's layer is hidden, without blocking editing", async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.click(screen.getByRole('button', { name: 'Visible' })); // toggles layer 1 to Hidden

    expect(screen.getByText(/This shape is currently hidden/)).toBeInTheDocument();
    // Fields still render and remain editable while hidden.
    expect(numericInput('Position X')).toBeEnabled();
  });

  it('shows a multi-selection notice instead of single-shape fields when 2+ outline items are picked for grouping', async () => {
    await loadReadyWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }));

    const checkboxes = screen.getAllByRole('checkbox', { name: /Add .* to group selection/ });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(
      screen.getByText(/2 shapes are selected in the outline for grouping/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();
  });
});

describe('ShapeInspectorPanel: editing', () => {
  it('commits a valid direct-entry edit to canonical scene state and the preview, without changing the shape id', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const shapeButton = within(screen.getByRole('list', { name: 'Shape list' })).getByRole(
      'button',
    );
    const originalLabel = shapeButton.textContent; // "circle (xxxxxxxx)" — includes the stable id prefix

    fireEvent.change(numericInput('Position X'), { target: { value: '450' } });

    expect(numericInput('Position X').value).toBe('450');
    // The live canvas summary (Task 26) reads straight from workingCopy —
    // reactive confirmation the edit reached canonical scene state.
    const liveSummary = document.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=450');
    // The shape list (built from the same canonical shapes) still shows
    // the exact same id — nothing about the edit touched it.
    expect(shapeButton.textContent).toBe(originalLabel);

    // Undo reverts the edit through the same commit/undo history every
    // other mutation uses — further confirmation this reached canonical
    // state rather than only local component state.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(numericInput('Position X').value).toBe('400');
    expect(liveSummary.textContent).toContain('x=400');
  });

  it('clamps an out-of-range typed value into the documented range', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(numericInput('Stroke width'), { target: { value: '1000' } });

    // STROKE_WIDTH_LIMIT.max is 64 (schema/scene.schema.json's
    // style.strokeWidth) — the typed value is clamped, not rejected.
    expect(numericInput('Stroke width').value).toBe('64');
  });

  it('rejects invalid text with a specific error and never commits it', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(numericInput('Position X'), { target: { value: 'abc' } });

    expect(screen.getByText(/Position X must be a finite number/)).toBeInTheDocument();
    // The invalid text stays visible so the user isn't fought while typing.
    expect(numericInput('Position X').value).toBe('abc');
    const liveSummary = document.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=400');

    // Only the original "add circle" is on the undo stack — the rejected
    // edit produced no additional history entry.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('rejects a non-finite value (Infinity) and never commits it', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(numericInput('Rotation'), { target: { value: 'Infinity' } });

    expect(screen.getByText(/Rotation must be a finite number/)).toBeInTheDocument();
    expect(numericInput('Rotation').value).toBe('Infinity');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('rejects a syntactically-valid number that overflows to Infinity and never commits it', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(numericInput('Rotation'), { target: { value: '1e400' } });

    expect(screen.getByText(/Rotation must be a finite number/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('supports keyboard increment/decrement with no pointer interaction, committing each step to canonical state', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const input = numericInput('Rotation');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('1');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('2');

    // Undo reverts exactly one keyboard-increment step, proving each
    // arrow press committed its own canonical, undoable change.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(input.value).toBe('1');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('0');
  });

  it('supports direct text entry alongside keyboard increment/decrement on the same field', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();
    const input = numericInput('Scale X');

    fireEvent.change(input, { target: { value: '2.5' } });
    expect(input.value).toBe('2.5');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('2.6');
  });

  it('rejects a malformed fill color and never commits it', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(screen.getByLabelText('Fill'), { target: { value: 'not-a-color' } });

    expect(screen.getByText(/Fill must be a hex color/)).toBeInTheDocument();
    expect((screen.getByLabelText('Fill') as HTMLInputElement).value).toBe('not-a-color');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('No shapes yet.')).toBeInTheDocument();
  });

  it('commits a valid fill/stroke edit, reflected back in the field', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(screen.getByLabelText('Fill'), { target: { value: '#00ff00' } });
    expect(screen.queryByText(/Fill must be a hex color/)).not.toBeInTheDocument();
    expect((screen.getByLabelText('Fill') as HTMLInputElement).value).toBe('#00ff00');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('Fill') as HTMLInputElement).value).toBe('#4f46e5');
  });

  it('accepts an empty stroke as "none"', async () => {
    await loadReadyWorkspace();
    await addAndSelectCircle();

    fireEvent.change(screen.getByLabelText('Stroke'), { target: { value: '' } });

    expect(screen.queryByText(/Stroke must be a hex color/)).not.toBeInTheDocument();
  });
});
