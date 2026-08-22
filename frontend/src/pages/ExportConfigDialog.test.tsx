import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { Project, SceneDocument, SceneVersion, SceneVersionSummary } from '../api/projects';
import * as captureModule from '../export/captureSocialThumbnail';
import { generateHtmlExport } from '../export/generateHtmlExport';
import ExportConfigDialog from './ExportConfigDialog';

vi.mock('../api/projects');

const mockedListSceneVersions = vi.mocked(projectsApi.listSceneVersions);
const mockedGetSceneVersion = vi.mocked(projectsApi.getSceneVersion);
const mockedSaveSceneVersion = vi.mocked(projectsApi.saveSceneVersion);
const mockedRestoreSceneVersion = vi.mocked(projectsApi.restoreSceneVersion);
const mockedDeleteSceneVersion = vi.mocked(projectsApi.deleteSceneVersion);

const BASE_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
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

function sceneWithCameraNode(): SceneDocument {
  return {
    ...BASE_SCENE,
    graph: {
      nodes: [{ id: 'n1', family: 'input', type: 'handSignal', params: {} }],
      connections: [],
    },
  };
}

function summary(overrides: Partial<SceneVersionSummary> = {}): SceneVersionSummary {
  return {
    id: 1,
    sequence: 1,
    origin: 'manual',
    change_label: null,
    created_by: 'alice',
    parent: null,
    fork_source_version: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function versionDetail(
  overrides: Partial<SceneVersion> = {},
  scene: SceneDocument = BASE_SCENE,
): SceneVersion {
  return { ...summary(), scene_json: scene, ...overrides };
}

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My animation',
    description: 'A description that says something.',
    tags: [],
    visibility: 'private',
    allow_public_remix: false,
    export_attribution: false,
    current_version: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const TWO_VERSIONS: SceneVersionSummary[] = [
  summary({ id: 1, sequence: 1 }),
  summary({ id: 2, sequence: 2 }),
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedListSceneVersions.mockResolvedValue(TWO_VERSIONS);
  mockedGetSceneVersion.mockImplementation((_projectId, versionId) =>
    Promise.resolve(versionDetail({ id: versionId, sequence: versionId })),
  );
});

async function openDialog(project = baseProject()) {
  const user = userEvent.setup();
  render(<ExportConfigDialog projectId="p1" project={project} />);
  await user.click(screen.getByRole('button', { name: /export…/i }));
  const dialog = await screen.findByRole('dialog', { name: /export project/i });
  // Let the default-version-selection and scene-detail-fetch effects settle.
  await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalled());
  return { user, dialog };
}

describe('ExportConfigDialog defaults', () => {
  it('defaults to the latest saved version, p5.js, CDN-linked HTML, attribution off, and thumbnail ZIP off', async () => {
    const { dialog } = await openDialog();

    const versionSelect = within(dialog).getByLabelText<HTMLSelectElement>('Saved version');
    await waitFor(() => expect(versionSelect.value).toBe('2'));
    expect(within(dialog).getByText(/version 2/i)).toBeInTheDocument();

    const rendererSelect = within(dialog).getByLabelText<HTMLSelectElement>('Renderer');
    expect(rendererSelect.value).toBe('p5js');
    expect(rendererSelect).toBeDisabled();

    const dependencySelect = within(dialog).getByLabelText<HTMLSelectElement>('Output format');
    expect(dependencySelect.value).toBe('cdn-html');
    expect(dependencySelect).toBeDisabled();

    expect(within(dialog).getByLabelText(/created with.*attribution/i)).not.toBeChecked();
    expect(within(dialog).getByLabelText(/social-thumbnail zip/i)).not.toBeChecked();

    await waitFor(() => expect(within(dialog).getByLabelText('Demo only')).toBeChecked());
  });
});

describe('ExportConfigDialog version selection', () => {
  it('lists every non-soft-deleted version and selecting an older one never restores/saves/deletes anything', async () => {
    const { user, dialog } = await openDialog();

    const versionSelect = within(dialog).getByLabelText<HTMLSelectElement>('Saved version');
    const options = within(versionSelect).getAllByRole('option');
    expect(options).toHaveLength(2);

    await user.selectOptions(versionSelect, '1');
    await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalledWith('p1', 1));

    expect(mockedSaveSceneVersion).not.toHaveBeenCalled();
    expect(mockedRestoreSceneVersion).not.toHaveBeenCalled();
    expect(mockedDeleteSceneVersion).not.toHaveBeenCalled();
  });
});

describe('ExportConfigDialog renderer compatibility', () => {
  it('blocks export and names each exact unsupported feature', async () => {
    mockedGetSceneVersion.mockResolvedValue(
      versionDetail(
        {},
        {
          ...BASE_SCENE,
          shapes: [{ id: 's1', type: 'sprite3d', layerId: 'layer-1' } as never],
        },
      ),
    );

    const { dialog } = await openDialog();

    const errorRegion = await within(dialog).findByTestId('export-compatibility-errors');
    expect(errorRegion).toHaveTextContent(
      'Shape type "sprite3d" is not supported by the p5.js renderer.',
    );
    expect(within(dialog).getByRole('button', { name: /^export$/i })).toBeDisabled();
  });
});

describe('ExportConfigDialog interaction mode availability', () => {
  it('offers only demo-only for a scene with no camera-driven bindings', async () => {
    mockedGetSceneVersion.mockResolvedValue(versionDetail({}, BASE_SCENE));

    const { dialog } = await openDialog();

    await waitFor(() => expect(within(dialog).getByLabelText('Demo only')).not.toBeDisabled());
    expect(within(dialog).getByLabelText('Camera only')).toBeDisabled();
    expect(within(dialog).getByLabelText('Demo + camera')).toBeDisabled();
    expect(within(dialog).getByText(/no camera-driven bindings/i)).toBeInTheDocument();
  });

  it('offers all three modes for a scene using a handSignal binding', async () => {
    mockedGetSceneVersion.mockResolvedValue(versionDetail({}, sceneWithCameraNode()));

    const { dialog } = await openDialog();

    await waitFor(() => expect(within(dialog).getByLabelText('Camera only')).not.toBeDisabled());
    expect(within(dialog).getByLabelText('Demo only')).not.toBeDisabled();
    expect(within(dialog).getByLabelText('Demo + camera')).not.toBeDisabled();
  });
});

describe('ExportConfigDialog title/description gating', () => {
  it('blocks export on invalid current metadata even with an older, otherwise-valid version selected', async () => {
    const invalidProject = baseProject({ title: 'Untitled animation', description: '' });
    const { user, dialog } = await openDialog(invalidProject);

    const versionSelect = within(dialog).getByLabelText<HTMLSelectElement>('Saved version');
    await user.selectOptions(versionSelect, '1');
    await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalledWith('p1', 1));

    const errorRegion = await within(dialog).findByTestId('export-metadata-errors');
    expect(errorRegion).toHaveTextContent(/meaningful title/i);
    expect(errorRegion).toHaveTextContent(/add a description/i);
    expect(within(dialog).getByRole('button', { name: /^export$/i })).toBeDisabled();
  });

  it('allows export once metadata is valid, regardless of which version is selected', async () => {
    const { user, dialog } = await openDialog(baseProject());

    const versionSelect = within(dialog).getByLabelText<HTMLSelectElement>('Saved version');
    await user.selectOptions(versionSelect, '1');
    await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalledWith('p1', 1));

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).not.toBeDisabled(),
    );
  });
});

describe('ExportConfigDialog terminal export action', () => {
  it('is an intentional no-op stub: it only hands the assembled config to onExport, never calls a backend export endpoint', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();
    render(<ExportConfigDialog projectId="p1" project={baseProject()} onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: /export…/i }));
    const dialog = await screen.findByRole('dialog', { name: /export project/i });
    await waitFor(() => expect(mockedGetSceneVersion).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).not.toBeDisabled(),
    );

    await user.click(within(dialog).getByRole('button', { name: /^export$/i }));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        renderer: 'p5js',
        dependencyMode: 'cdn-html',
        includeAttribution: false,
        includeSocialThumbnailZip: false,
        interactionMode: 'demo',
        scene: BASE_SCENE,
      }),
    );
  });

  it('the default onExport (Task 56) generates and downloads a standalone HTML file for a valid scene', async () => {
    mockedGetSceneVersion.mockResolvedValue(versionDetail({}, BASE_SCENE));
    const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user, dialog } = await openDialog(baseProject());
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).not.toBeDisabled(),
    );

    await user.click(within(dialog).getByRole('button', { name: /^export$/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/html');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(screen.queryByTestId('export-generation-errors')).not.toBeInTheDocument();

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('the default onExport surfaces blocking reasons and never downloads for an unsupported scene', async () => {
    mockedGetSceneVersion.mockResolvedValue(
      versionDetail(
        {},
        { ...BASE_SCENE, shapes: [{ id: 's1', type: 'sprite3d', layerId: 'layer-1' } as never] },
      ),
    );
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    const { dialog } = await openDialog(baseProject());

    // The compatibility check already disables the button before any
    // click is possible -- this is the same gate `defaultOnExport` itself
    // also re-checks as a safety net (see `generateHtmlExport.ts`).
    const errorRegion = await within(dialog).findByTestId('export-compatibility-errors');
    expect(errorRegion).toHaveTextContent('sprite3d');
    expect(within(dialog).getByRole('button', { name: /^export$/i })).toBeDisabled();
    expect(createObjectURL).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('Task 59: leaves the HTML-only download completely unchanged when the thumbnail ZIP checkbox stays off (regression check)', async () => {
    mockedGetSceneVersion.mockResolvedValue(versionDetail({}, BASE_SCENE));
    const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user, dialog } = await openDialog(baseProject());
    expect(within(dialog).getByLabelText(/social-thumbnail zip/i)).not.toBeChecked();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).not.toBeDisabled(),
    );

    await user.click(within(dialog).getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/html');

    // Byte-for-byte identical to a standalone generateHtmlExport() call for
    // the exact same config -- not just "some HTML blob was downloaded" --
    // proving the unchecked-ZIP-checkbox path is genuinely unchanged from
    // the Task 56 HTML-only flow, not merely similar to it.
    const project = baseProject();
    const expected = generateHtmlExport({
      scene: BASE_SCENE,
      title: project.title,
      description: project.description,
      interactionMode: 'demo',
      includeAttribution: false,
    });
    expect(expected.ok).toBe(true);
    if (!expected.ok) throw new Error('unreachable');
    const actualHtml = await blobArg.text();
    expect(actualHtml).toBe(expected.html);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('Task 59: downloads a ZIP containing index.html and thumbnail.png when the thumbnail ZIP checkbox is enabled', async () => {
    mockedGetSceneVersion.mockResolvedValue(versionDetail({}, BASE_SCENE));
    const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-zip-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user, dialog } = await openDialog(baseProject());
    await user.click(within(dialog).getByLabelText(/social-thumbnail zip/i));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).not.toBeDisabled(),
    );

    await user.click(within(dialog).getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));

    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/zip');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-zip-url');
    expect(screen.queryByTestId('export-generation-errors')).not.toBeInTheDocument();

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('Task 59: surfaces a clear error and never downloads anything when thumbnail capture fails', async () => {
    mockedGetSceneVersion.mockResolvedValue(versionDetail({}, BASE_SCENE));
    const createObjectURL = vi.fn((_obj: Blob | MediaSource) => 'blob:mock-zip-url');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(captureModule, 'captureSocialThumbnail').mockRejectedValue(
      new captureModule.ThumbnailCaptureError('Thumbnail capture failed: simulated failure.'),
    );

    const { user, dialog } = await openDialog(baseProject());
    await user.click(within(dialog).getByLabelText(/social-thumbnail zip/i));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^export$/i })).not.toBeDisabled(),
    );

    await user.click(within(dialog).getByRole('button', { name: /^export$/i }));

    const errorRegion = await within(dialog).findByTestId('export-generation-errors');
    expect(errorRegion).toHaveTextContent(/simulated failure/i);
    expect(createObjectURL).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe('ExportConfigDialog accessibility', () => {
  it('is a labelled, keyboard-operable dialog with every field reachable and operable via keyboard', async () => {
    const { user, dialog } = await openDialog();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: /export project/i })).toBeInTheDocument();

    // Every field has an accessible label.
    within(dialog).getByLabelText('Saved version');
    within(dialog).getByLabelText('Renderer');
    within(dialog).getByLabelText('Output format');
    within(dialog).getByLabelText(/created with.*attribution/i);
    within(dialog).getByLabelText(/social-thumbnail zip/i);
    within(dialog).getByLabelText('Demo only');

    // Toggle the attribution checkbox via keyboard alone.
    const attributionCheckbox = within(dialog).getByLabelText(/created with.*attribution/i);
    attributionCheckbox.focus();
    await user.keyboard(' ');
    expect(attributionCheckbox).toBeChecked();

    // Escape closes the dialog and returns focus to the trigger.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /export…/i })).toHaveFocus();
  });

  it('surfaces compatibility and metadata errors as live, screen-reader-announced regions', async () => {
    mockedGetSceneVersion.mockResolvedValue(
      versionDetail(
        {},
        { ...BASE_SCENE, shapes: [{ id: 's1', type: 'sprite3d', layerId: 'layer-1' } as never] },
      ),
    );
    const { dialog } = await openDialog(
      baseProject({ title: 'Untitled animation', description: '' }),
    );

    const compatibilityAlert = await within(dialog).findByTestId('export-compatibility-errors');
    expect(compatibilityAlert).toHaveAttribute('role', 'alert');
    expect(compatibilityAlert).toHaveAttribute('aria-live', 'assertive');

    const metadataAlert = within(dialog).getByTestId('export-metadata-errors');
    expect(metadataAlert).toHaveAttribute('role', 'alert');
    expect(metadataAlert).toHaveAttribute('aria-live', 'assertive');
  });
});
