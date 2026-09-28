import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ProjectMediaLibraryPanel from './ProjectMediaLibraryPanel';

const repo = vi.hoisted(() => ({
  addMediaReference: vi.fn(),
  ensureProject: vi.fn(),
  exportLocalProject: vi.fn(),
  getMediaBlob: vi.fn().mockResolvedValue(null),
  importMediaAsset: vi.fn(),
  listMediaAssetsForProject: vi.fn().mockResolvedValue([]),
  openLocalProjectDatabase: vi.fn().mockResolvedValue({}),
  removeMediaReference: vi.fn(),
  requestPersistentStorage: vi.fn().mockResolvedValue({ supported: true, persisted: false }),
  updateMediaAssetMetadata: vi.fn(),
  SUPPORTED_MEDIA_MIME_TYPES: new Set(['image/png', 'image/jpeg', 'audio/mpeg']),
}));
const packageExport = vi.hoisted(() => ({
  buildServer2dPiecePackage: vi.fn().mockResolvedValue({
    bytes: new Uint8Array([80, 75]),
    missingAssets: [],
  }),
}));

vi.mock('../storage/localProjectRepository', () => repo);
vi.mock('../storage/localProjectExport', () => ({ exportLocalProject: repo.exportLocalProject }));
vi.mock('../storage/server2dPiecePackage', () => ({
  buildServer2dPiecePackage: packageExport.buildServer2dPiecePackage,
  server2dPackageFilename: (title: string) => `${title}-package.zip`,
}));

const commitScene = vi.fn();
const selectShape = vi.fn();
const sceneEditor = {
  selectedLayerId: 'layer-1',
  layers: [{ id: 'layer-1' }],
  commitScene,
  selectShape,
} as never;

const workingCopy = { shapes: [], layers: [{ id: 'layer-1' }] } as never;

function renderPanel(publicationStatus?: ReactNode) {
  return render(
    <ProjectMediaLibraryPanel
      projectId="project-1"
      projectTitle="Local project"
      ownerId="alice"
      workingCopy={workingCopy}
      sceneEditor={sceneEditor}
      publicationStatus={publicationStatus}
    />,
  );
}

describe('ProjectMediaLibraryPanel', () => {
  it('keeps publication status inside the File menu', async () => {
    const user = userEvent.setup();
    renderPanel(<div data-testid="publication-status">Draft</div>);
    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByTestId('publication-status')).toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'File menu' })).toContainElement(
      screen.getByTestId('publication-status'),
    );
  });

  it('exposes File actions and requires meaningful alt text or an explicit decorative choice', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menu', { name: 'File menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Import media' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open media library' })).toBeInTheDocument();

    const input = screen.getByLabelText('Import media file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['pixels'], 'sunset.png', { type: 'image/png' })] },
    });
    expect(screen.getByRole('dialog', { name: 'Describe this media' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import media' })).toBeInTheDocument();
  });

  it('accepts an audio asset through the same owner media-library import path', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    const input = screen.getByLabelText('Import media file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['audio'], 'ambient.mp3', { type: 'audio/mpeg' })] },
    });
    expect(screen.getByRole('dialog', { name: 'Describe this media' })).toBeInTheDocument();
    expect(screen.getByText('ambient.mp3')).toBeInTheDocument();
  });

  it('moves through File menu items with the keyboard and restores focus on Escape', async () => {
    const user = userEvent.setup();
    renderPanel();
    const fileButton = screen.getByRole('button', { name: 'File' });
    await user.click(fileButton);
    const importItem = screen.getByRole('menuitem', { name: 'Import media' });
    const libraryItem = screen.getByRole('menuitem', { name: 'Open media library' });
    await waitFor(() => expect(importItem).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(libraryItem).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(fileButton).toHaveFocus();
    expect(screen.queryByRole('menu', { name: 'File menu' })).not.toBeInTheDocument();
  });

  it('prepares a validated server-backed piece package from the File menu', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export piece package' }));
    await waitFor(() => expect(packageExport.buildServer2dPiecePackage).toHaveBeenCalled());
  });

  it('offers an explicit omit-or-cancel choice when package media is missing', async () => {
    packageExport.buildServer2dPiecePackage.mockResolvedValueOnce({
      bytes: new Uint8Array([80, 75]),
      missingAssets: [{ id: 'asset-missing', filename: 'missing.png' }],
    });
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export piece package' }));
    const dialog = await screen.findByRole('dialog', { name: 'Some media is unavailable' });
    expect(dialog).toHaveTextContent('missing.png');
    expect(
      within(dialog).getByRole('button', { name: 'Export without missing media' }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel export' }));
    expect(
      screen.queryByRole('dialog', { name: 'Some media is unavailable' }),
    ).not.toBeInTheDocument();
  });

  it('reports unsupported files without opening the import metadata dialog', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    const input = screen.getByLabelText('Import media file') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['script'], 'payload.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('is not a supported media file type');
    expect(screen.queryByRole('dialog', { name: 'Describe this media' })).not.toBeInTheDocument();
  });

  it('lists a library asset and inserts it as an independently selectable image layer', async () => {
    repo.listMediaAssetsForProject.mockResolvedValueOnce([
      {
        id: 'asset-1',
        projectId: 'project-1',
        mimeType: 'image/png',
        byteSize: 12,
        checksum: 'abc',
        filename: 'sunset.png',
        altText: 'Sunset',
        createdAt: '2026-01-01',
        refCount: 1,
      },
    ]);
    repo.addMediaReference.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open media library' }));
    await screen.findByText('sunset.png');
    await user.click(screen.getByRole('button', { name: 'Insert into active scene' }));
    await waitFor(() => expect(commitScene).toHaveBeenCalled());
    const nextScene = commitScene.mock.calls.at(-1)?.[0];
    expect(nextScene.shapes[0]).toMatchObject({
      type: 'image',
      mediaAssetId: 'asset-1',
      altText: 'Sunset',
    });
    expect(selectShape).toHaveBeenCalledWith(nextScene.shapes[0].id);
  });

  it('edits the filename and alt-text metadata together', async () => {
    repo.listMediaAssetsForProject.mockResolvedValueOnce([
      {
        id: 'asset-2',
        projectId: 'project-1',
        mimeType: 'image/jpeg',
        byteSize: 24,
        checksum: 'def',
        filename: 'old.jpg',
        altText: 'Old description',
        createdAt: '2026-01-02',
        refCount: 1,
      },
    ]);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open media library' }));
    const asset = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('old.jpg'))!;
    await user.click(within(asset).getByRole('button', { name: 'Rename metadata' }));
    await user.clear(screen.getByLabelText('Asset name'));
    await user.type(screen.getByLabelText('Asset name'), 'new.jpg');
    await user.clear(screen.getByLabelText('Descriptive label (leave blank for decorative)'));
    await user.type(
      screen.getByLabelText('Descriptive label (leave blank for decorative)'),
      'New description',
    );
    await user.click(screen.getByRole('button', { name: 'Save metadata' }));
    expect(repo.updateMediaAssetMetadata).toHaveBeenCalledWith(expect.anything(), 'asset-2', {
      filename: 'new.jpg',
      altText: 'New description',
    });
  });
});
