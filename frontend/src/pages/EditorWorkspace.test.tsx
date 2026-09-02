import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projectsApi from '../api/projects';
import type { Project, SceneVersion } from '../api/projects';
import EditorWorkspace from './EditorWorkspace';

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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
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
  setViewportWidth(1024); // wide layout by default
});

afterEach(() => {
  setViewportWidth(1024);
});

describe('EditorWorkspace load states', () => {
  it('shows an accessible loading state while the project/version fetch is in flight', () => {
    mockedGetProject.mockReturnValue(new Promise(() => {}));

    renderWorkspace();

    expect(screen.getByRole('status')).toHaveTextContent(/loading editor/i);
  });

  // Issue #94 (extended by issue #127): Preview leads the layout, in DOM
  // order — not just visually — followed by Details/Tools/Layers/Canvas/Inspector.
  it('renders the six landmark regions, in DOM order with Preview first, once the working copy loads', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    await screen.findByRole('region', { name: 'Tools' });
    const regions = screen.getAllByRole('region');
    expect(regions.map((r) => r.getAttribute('data-panel'))).toEqual([
      'preview',
      'details',
      'tools',
      'layers',
      'canvas',
      'inspector',
    ]);
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveAttribute(
      'data-panel',
      'preview',
    );
    expect(screen.getByRole('region', { name: 'Details' })).toHaveAttribute(
      'data-panel',
      'details',
    );
    expect(screen.getByRole('region', { name: 'Tools' })).toHaveAttribute('data-panel', 'tools');
    expect(screen.getByRole('region', { name: 'Layers' })).toHaveAttribute('data-panel', 'layers');
    expect(screen.getByRole('region', { name: 'Inspector' })).toHaveAttribute(
      'data-panel',
      'inspector',
    );
  });

  it('shows an access-denied message with a link back to the gallery on a 401', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(401, { detail: 'nope' }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
    expect(screen.getByRole('link', { name: /back to your projects/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows an access-denied message with a link back to the gallery on a 403', async () => {
    mockedGetProject.mockRejectedValue(new ApiError(403, { detail: 'nope' }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/don't have access/i);
  });

  it('shows a "no valid scene" message when current_version is null', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ current_version: null }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no valid scene to load/i);
    expect(mockedGetSceneVersion).not.toHaveBeenCalled();
  });

  it('shows a "no valid scene" message when the fetched version fails validation', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion({ scene_json: { bogus: true } }));

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no valid scene to load/i);
  });

  it('shows an error message with a working retry action on any other failure', async () => {
    mockedGetProject.mockRejectedValueOnce(new Error('network down'));
    mockedGetProject.mockResolvedValueOnce(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(/went wrong loading/i);
    const retryButton = screen.getByRole('button', { name: /retry/i });

    await user.click(retryButton);

    await screen.findByRole('region', { name: 'Preview' });
    expect(mockedGetProject).toHaveBeenCalledTimes(2);
  });
});

describe('EditorWorkspace responsive layout', () => {
  it('shows all three panels simultaneously at >=1024px, with no switcher', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(1024);

    renderWorkspace();

    await screen.findByRole('region', { name: 'Tools' });
    expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Inspector' })).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  // Issue #109 (revised by issue #157, owner correction 2026-08-24): at
  // >=1024px the CSS grid gives Preview a dominant column
  // (`.editor-panel[data-panel='preview']`) and stacks Details/Tools/
  // Inspector in a narrower sidebar column instead of the previous
  // equal-width four-panel flex row — see index.css's `.editor-workspace`
  // comment. jsdom doesn't apply real CSS grid layout, so this can't
  // measure rendered widths; it instead asserts the things this test
  // suite CAN verify: every panel section still carries the `data-panel`
  // attribute the grid's column/row placement selectors key off of (so a
  // future rename of that attribute would be caught here), and the
  // stylesheet itself gives Preview a generous `minmax(420px, 1fr)` track
  // and the Layers sidebar a bounded `minmax(280px, 320px)` track (issue
  // #179), guaranteeing room for its controls at desktop widths.
  it('gives the Preview panel a dominant, sidebar-reclaiming grid column in the desktop stylesheet', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(1024);

    renderWorkspace();

    await screen.findByRole('region', { name: 'Preview' });
    for (const panel of ['preview', 'details', 'tools', 'layers', 'inspector']) {
      expect(document.querySelector(`[data-panel="${panel}"]`)).not.toBeNull();
    }

    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');
    const gridMatch = css.match(
      /\.editor-workspace\s*\{[^}]*grid-template-columns:\s*minmax\((\d+)px,\s*1fr\)\s+minmax\((\d+)px,\s+(\d+)px\)/,
    );
    expect(gridMatch).not.toBeNull();
    const previewMinPx = Number(gridMatch?.[1]);
    const sidebarMinPx = Number(gridMatch?.[2]);
    const sidebarMaxPx = Number(gridMatch?.[3]);
    // Preview keeps its own generous floor, while the sidebar keeps enough
    // room for all layer-row controls even at the narrow end of desktop.
    expect(sidebarMinPx).toBeGreaterThanOrEqual(280);
    expect(sidebarMaxPx).toBeLessThanOrEqual(360);
    expect(previewMinPx).toBeGreaterThanOrEqual(400);
    expect(css).toMatch(/\.editor-panel\[data-panel='preview'\]\s*\{\s*grid-column:\s*1;/);
  });

  it('lets the editor use the full desktop viewport while keeping content panels bounded', () => {
    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');

    expect(css).toMatch(/#root\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/\.app-shell\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/\.editor-workspace\s*\{[^}]*width:\s*calc\(100%\s*-\s*48px\)/);
    expect(css).toMatch(/\.content-panel\s*\{[^}]*max-width:\s*1126px/);
    expect(css).toMatch(/\.content-panel\s*\{[^}]*margin:\s*0\s+auto\s+32px/);
  });

  it('gives layer rows a contained, non-shrinking control strip', () => {
    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');

    expect(css).toMatch(/\.editor-outline-row-layer\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/);
    expect(css).toMatch(
      /\.editor-outline-row-layer > button,\s*\.editor-outline-row-more\s*\{[^}]*flex:\s*0 0 auto/,
    );
    expect(css).toMatch(/\.editor-outline-layer-name\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.editor-outline-row-more summary\s*\{[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.editor-outline-row-layer\s*\{[^}]*box-sizing:\s*border-box/);
    expect(css).toMatch(/\.editor-outline-row-layer > button\[aria-label\^='Delete layer'\]/);
  });

  it('defines the studio frame and compact panel chrome without removing focusable controls', () => {
    const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8');

    expect(css).toMatch(/\.editor-scene-canvas-viewport\s*\{[^}]*background:\s*#242830/);
    expect(css).toMatch(/\.editor-scene-canvas-viewport\s*\{[^}]*box-shadow:/);
    expect(css).toMatch(/\.editor-panel > h3\s*\{[^}]*border-bottom:/);
    expect(css).toMatch(/\.editor-collapsible-section-toggle\s*\{[^}]*min-height:\s*36px/);
    expect(css).toMatch(/\.app-shell-editor \.app-shell-header\s*\{[^}]*padding-block:/);
  });

  // Issue #93 hard requirement: Preview must never become unreachable while
  // using Tools or Inspector, at any viewport width — so below 1024px it's
  // no longer one of three mutually-exclusive tabs. It always stays
  // visible; only Tools/Inspector alternate via a two-way switcher.
  it('keeps Preview visible alongside a keyboard-operable Tools/Inspector switcher below 1024px, Tools by default', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);

    renderWorkspace();

    await screen.findByRole('tablist', { name: /editor panels/i });
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    expect(document.querySelector('[data-panel="preview"]')).not.toHaveAttribute('hidden');
    expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
    expect(document.querySelector('[data-panel="inspector"]')).not.toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Preview' })).not.toBeInTheDocument();

    const toolsTab = screen.getByRole('tab', { name: 'Tools' });
    expect(toolsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches between Tools and Inspector when a switcher tab is activated by keyboard, without ever hiding Preview', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);
    const user = userEvent.setup();

    renderWorkspace();

    const inspectorTab = await screen.findByRole('tab', { name: 'Inspector' });
    inspectorTab.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('region', { name: 'Inspector' })).toBeVisible();
    expect(document.querySelector('[data-panel="tools"]')).not.toBeVisible();
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    expect(inspectorTab).toHaveAttribute('aria-selected', 'true');
  });

  it('does not overlap or hide the switcher itself at the 320px minimum width', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);

    renderWorkspace();

    const tablist = await screen.findByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    tabs.forEach((tab) => expect(tab).toBeVisible());
  });

  // Issue #93: a regression test at several representative widths (not just
  // the 320px floor and the 1024px breakpoint above) asserting Preview,
  // Tools, and Inspector are all simultaneously *reachable* — Preview by
  // always being visible, and Tools/Inspector by being one switcher click
  // away from whichever is currently hidden.
  it.each([320, 480, 768, 1023])(
    'keeps Preview, Tools, and Inspector all simultaneously reachable at %dpx',
    async (width) => {
      mockedGetProject.mockResolvedValue(baseProject());
      mockedGetSceneVersion.mockResolvedValue(baseVersion());
      setViewportWidth(width);
      const user = userEvent.setup();

      renderWorkspace();

      await screen.findByRole('tablist', { name: /editor panels/i });
      // Preview is reachable right now, unconditionally.
      expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();

      // Tools is reachable: either already visible, or one tab click away.
      if (!screen.getByRole('region', { name: 'Tools' }).matches(':not([hidden])')) {
        await user.click(screen.getByRole('tab', { name: 'Tools' }));
      }
      expect(screen.getByRole('region', { name: 'Tools' })).toBeVisible();
      expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();

      // Inspector is reachable the same way, without ever losing Preview.
      await user.click(screen.getByRole('tab', { name: 'Inspector' }));
      expect(screen.getByRole('region', { name: 'Inspector' })).toBeVisible();
      expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible();
    },
  );

  // Issue #157 (owner correction, 2026-08-24): below the 1024px breakpoint
  // the authoring toolbar must be a true canvas overlay, not merely a
  // page-level row somewhere inside the Preview panel. It is rendered once
  // inside the actual scene canvas so it remains attached to the artwork
  // when the surrounding editor layout changes.
  it('places the toolbar inside the scene canvas below 1024px', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(375);

    renderWorkspace();

    await screen.findByRole('tablist', { name: /editor panels/i });
    const toolbars = screen.getAllByRole('toolbar', { name: 'Editor actions' });
    expect(toolbars).toHaveLength(1);
    const toolbar = toolbars[0];
    expect(toolbar.closest('[data-panel]')).toHaveAttribute('data-panel', 'preview');

    expect(toolbar.closest('[data-testid="scene-canvas"]')).toBe(
      screen.getByTestId('scene-canvas'),
    );
  });

  // Issue #157 parity follow-up: desktop uses the same true canvas placement
  // as narrow layouts, so the toolbar never reverts to a bulky page-level row.
  it('places the editor toolbar inside the scene canvas at >=1024px', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(1024);

    renderWorkspace();

    await screen.findByRole('region', { name: 'Preview' });
    const toolbars = screen.getAllByRole('toolbar', { name: 'Editor actions' });
    expect(toolbars).toHaveLength(1);
    expect(toolbars[0].closest('[data-testid="scene-canvas"]')).toBe(
      screen.getByTestId('scene-canvas'),
    );
  });

  // Issue #184: the viewport fills its responsive framing box at mobile
  // width; the canonical aspect ratio now belongs to the measured scene
  // child, rather than being imposed on the outer viewport itself.
  it('preserves the scene canvas aspect ratio at mobile width', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(375);

    renderWorkspace();

    const canvasViewport = await screen.findByTestId('scene-canvas-viewport');
    expect(canvasViewport.style.width).toBe('100%');
    expect(canvasViewport.style.aspectRatio).toBe('');
  });

  // Issue #157: "canvas is the widest element" was the original (owner-
  // rejected) criterion; the corrected scope requires the canvas to stay
  // genuinely interactive at mobile width, not just render. This mirrors
  // EditorWorkspace.transform.test.tsx's own move-drag assertion, just at
  // a 375px viewport instead of the suite's implicit desktop default,
  // confirming the Task 26 pointer handlers (add, select, and drag-to-
  // move) still work once the toolbar/layout changes above land.
  it('keeps the canvas selectable and draggable at mobile width', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(375);

    renderWorkspace();

    // "Add circle" lives in the Layers panel (issue #131), which isn't the
    // switcher's default active tab ('tools') — switch to it first, same
    // as a real mobile user would tap the Layers tab before adding a shape.
    await screen.findByRole('tab', { name: 'Layers' });
    fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));
    await screen.findByRole('button', { name: 'Add circle' });
    fireEvent.click(screen.getByRole('button', { name: 'Add circle' }));

    // Return to the canvas panel before asserting the live stage. The
    // narrow-layout switcher hides non-active panels, so this mirrors the
    // real interaction sequence instead of querying a hidden canvas.
    fireEvent.click(screen.getByRole('tab', { name: 'Canvas' }));

    const canvas = screen.getByTestId('scene-canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
    fireEvent.click(canvas, { clientX: 400, clientY: 300 });

    // Added circle is auto-selected with move/resize/rotate handles, same
    // as the desktop-width behavior this issue must not regress.
    expect(await screen.findByTestId('shape-handle-move')).toBeInTheDocument();

    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 450, clientY: 260 });
    fireEvent.pointerUp(window, { clientX: 450, clientY: 260 });

    const liveSummary = canvas.querySelector('.editor-scene-shape') as HTMLElement;
    expect(liveSummary.textContent).toContain('x=450, y=260');
  });
});

describe('EditorWorkspace keyboard accessibility', () => {
  it('has a single logical forward Tab order through the narrow-layout switcher', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(320);
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('tablist');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Edit title' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveFocus();

    // The header's Save control (next to Publish) is disabled with
    // nothing unsaved, so it's skipped entirely in the tab order.
    await user.tab();
    // Publication status is deliberately keyboard-actionable so users can
    // discover and change Draft/Published without relying on the adjacent
    // prose status line.
    expect(screen.getByRole('button', { name: 'Published' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Exit without saving' })).toHaveFocus();

    // Task 129 (issue #154): Layers is now the first switcher tab, ahead
    // of Details/Tools/Inspector, reflecting `EditorPanelSwitcher.tsx`'s
    // reordered `PANELS` array.
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Layers' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Canvas' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Tools' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Inspector' })).toHaveFocus();

    // Shift+Tab reverses the same order, with no trap.
    await user.tab({ shift: true });
    expect(screen.getByRole('tab', { name: 'Tools' })).toHaveFocus();
  });

  it('moves focus into the exit-without-saving dialog on open and restores it to the trigger on cancel', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(1024);
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const trigger = screen.getByRole('button', { name: 'Exit without saving' });
    trigger.focus();
    await user.click(trigger);

    const dialog = await screen.findByRole('alertdialog', { name: 'Exit without saving?' });
    expect(dialog).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('dismisses the exit-without-saving dialog on Escape without exiting, and restores focus', async () => {
    mockedGetProject.mockResolvedValue(baseProject());
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    setViewportWidth(1024);
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('region', { name: 'Tools' });

    const trigger = screen.getByRole('button', { name: 'Exit without saving' });
    await user.click(trigger);
    await screen.findByRole('alertdialog', { name: 'Exit without saving?' });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    // Escape cancelled rather than confirmed the exit — still on this page.
    expect(screen.getByRole('region', { name: 'Tools' })).toBeInTheDocument();
  });
});

// Task 94 (issue #94), point 4: inline title editing — renaming a project
// without leaving the editor or reloading.
describe('EditorWorkspace inline title editing', () => {
  it('shows the title as plain text with an Edit affordance by default', async () => {
    mockedGetProject.mockResolvedValue(baseProject({ title: 'My animation' }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion());

    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'My animation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('swaps to a text input on Edit, saves through updateProjectMetadata, and updates the heading in place', async () => {
    const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);
    mockedGetProject.mockResolvedValue(baseProject({ title: 'My animation' }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    mockedUpdateProjectMetadata.mockResolvedValue(baseProject({ title: 'Renamed' }));
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('heading', { name: 'My animation' });

    await user.click(screen.getByRole('button', { name: 'Edit title' }));
    const titleInput = screen.getByLabelText('Title');
    expect(titleInput).toHaveValue('My animation');
    const titleForm = within(titleInput.closest('form')!);

    await user.clear(titleInput);
    await user.type(titleInput, 'Renamed');
    await user.click(titleForm.getByRole('button', { name: 'Save' }));

    expect(mockedUpdateProjectMetadata).toHaveBeenCalledWith('p1', { title: 'Renamed' });
    expect(await screen.findByRole('heading', { name: 'Renamed' })).toBeInTheDocument();
    // No navigation away from the editor happened — Tools is still here.
    expect(screen.getByRole('region', { name: 'Tools' })).toBeInTheDocument();
  });

  it('Cancel discards the draft and restores the original title without saving', async () => {
    const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);
    mockedGetProject.mockResolvedValue(baseProject({ title: 'My animation' }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('heading', { name: 'My animation' });

    await user.click(screen.getByRole('button', { name: 'Edit title' }));
    const titleInput = screen.getByLabelText('Title');
    const titleForm = within(titleInput.closest('form')!);
    await user.clear(titleInput);
    await user.type(titleInput, 'Discarded');
    await user.click(titleForm.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'My animation' })).toBeInTheDocument();
    expect(mockedUpdateProjectMetadata).not.toHaveBeenCalled();
  });

  it('rejects a blank title without saving', async () => {
    const mockedUpdateProjectMetadata = vi.mocked(projectsApi.updateProjectMetadata);
    mockedGetProject.mockResolvedValue(baseProject({ title: 'My animation' }));
    mockedGetSceneVersion.mockResolvedValue(baseVersion());
    const user = userEvent.setup();

    renderWorkspace();
    await screen.findByRole('heading', { name: 'My animation' });

    await user.click(screen.getByRole('button', { name: 'Edit title' }));
    const titleInput = screen.getByLabelText('Title');
    const titleForm = within(titleInput.closest('form')!);
    await user.clear(titleInput);
    await user.click(titleForm.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/title cannot be blank/i);
    expect(mockedUpdateProjectMetadata).not.toHaveBeenCalled();
  });
});
