import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as generateHtmlExport3D from '../export/generateHtmlExport3D';
import * as projects3dApi from '../api/projects3d';
import type { Project3D } from '../api/projects3d';
import Project3DWorkspace from './Project3DWorkspace';

/**
 * Issue #290: "Download standalone bundle" in the manual 3D editor --
 * mirrors `ExportConfigDialog.test.tsx`'s existing 2D coverage, scoped
 * down to this editor's single-button (not full-dialog) design.
 */

vi.mock('../api/projects3d');
vi.mock('../export/generateHtmlExport3D');

const mockedGetProject3D = vi.mocked(projects3dApi.getProject3D);
const mockedGenerateScene3DBundle = vi.mocked(generateHtmlExport3D.generateScene3DBundle);
const mockedTriggerScene3DBundleDownload = vi.mocked(
  generateHtmlExport3D.triggerScene3DBundleDownload,
);

function baseProject(overrides: Partial<Project3D> = {}): Project3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'My 3D scene',
    thumbnail_url: null,
    current_version: {
      id: 1,
      sequence: 1,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: {
        schemaVersion: 1,
        documentType: 'scene3d',
        id: 'scene3d-1',
        scene: { backgroundColor: '#000000' },
        camera: {
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          fov: 50,
          near: 0.1,
          far: 1000,
        },
        lights: [],
        groups: [],
        objects: [
          {
            id: 'obj-1',
            type: 'box',
            groupId: null,
            transform: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              opacity: 1,
            },
            material: { color: '#ff0000' },
            visible: true,
            width: 1,
            height: 1,
            depth: 1,
          },
        ],
        randomness: { seed: 0, enabled: false },
      },
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/projects3d/p1']}>
      <Routes>
        <Route path="/projects3d/:id" element={<Project3DWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('"Download standalone bundle" (manual 3D editor, issue #290)', () => {
  it('generates and downloads the bundle for the current working scene', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    const zipBlob = new Blob(['fake zip']);
    mockedGenerateScene3DBundle.mockResolvedValue({
      ok: true,
      zipBlob,
      filename: 'my-3d-scene.zip',
    });
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My 3D scene' });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('project3d-export-button'));

    await waitFor(() => expect(mockedGenerateScene3DBundle).toHaveBeenCalledTimes(1));
    const [scenePassed, baseName] = mockedGenerateScene3DBundle.mock.calls[0];
    expect(scenePassed).toEqual(baseProject().current_version!.scene_json);
    expect(baseName).toBe('My 3D scene');
    expect(mockedTriggerScene3DBundleDownload).toHaveBeenCalledWith(zipBlob, 'my-3d-scene.zip');
    expect(screen.queryByTestId('project3d-export-error')).not.toBeInTheDocument();
  });

  it('reflects unsaved edits, not a stale/persisted copy', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    mockedGenerateScene3DBundle.mockResolvedValue({
      ok: true,
      zipBlob: new Blob(['fake zip']),
      filename: 'my-3d-scene.zip',
    });
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My 3D scene' });
    const user = userEvent.setup();

    // Outline3DInspector.onChange replaces workingScene wholesale, purely
    // locally -- no server call, no explicit Save -- exactly the "unsaved
    // edit" case this test needs.
    const outlineList = screen.getByTestId('outline3d-list');
    const objectRow = within(outlineList).getAllByRole('button')[1];
    await user.click(objectRow);
    const colorField = await screen.findByLabelText('Color');
    fireEvent.change(colorField, { target: { value: '#123456' } });

    await user.click(screen.getByTestId('project3d-export-button'));

    await waitFor(() => expect(mockedGenerateScene3DBundle).toHaveBeenCalledTimes(1));
    const [scenePassed] = mockedGenerateScene3DBundle.mock.calls[0];
    expect(
      (scenePassed as { objects: Array<{ material: { color: string } }> }).objects[0].material
        .color,
    ).toBe('#123456');
  });

  it('shows the exact validation-failure reasons and never downloads when the bundle can not be generated', async () => {
    mockedGetProject3D.mockResolvedValue(baseProject());
    mockedGenerateScene3DBundle.mockResolvedValue({
      ok: false,
      reasons: ['camera: must have required property fov'],
    });
    renderWorkspace();
    await screen.findByRole('heading', { name: 'My 3D scene' });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('project3d-export-button'));

    expect(await screen.findByTestId('project3d-export-error')).toHaveTextContent(
      'camera: must have required property fov',
    );
    expect(mockedTriggerScene3DBundleDownload).not.toHaveBeenCalled();
  });
});
