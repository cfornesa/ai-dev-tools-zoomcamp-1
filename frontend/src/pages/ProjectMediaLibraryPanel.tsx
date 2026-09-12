import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { downloadBlob } from '../export/downloadBlob';
import type { SceneDocument } from '../api/projects';
import {
  addMediaReference,
  ensureProject,
  getMediaBlob,
  importMediaAsset,
  listMediaAssetsForProject,
  openLocalProjectDatabase,
  removeMediaReference,
  requestPersistentStorage,
  SUPPORTED_MEDIA_MIME_TYPES,
  updateMediaAssetMetadata,
  type LocalMediaAssetRecord,
} from '../storage/localProjectRepository';
import { exportLocalProject } from '../storage/localProjectExport';
import type { SceneEditor } from './useSceneEditor';

type Props = {
  projectId: string;
  projectTitle: string;
  ownerId: string;
  workingCopy: SceneDocument | null;
  sceneEditor: SceneEditor;
};

type PendingImport = { file: File; altText: string; decorative: boolean };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The local media operation failed.';
}

function imageUseCount(asset: LocalMediaAssetRecord): number {
  return Math.max(0, asset.refCount - 1);
}

export default function ProjectMediaLibraryPanel({
  projectId,
  projectTitle,
  ownerId,
  workingCopy,
  sceneEditor,
}: Props) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [assets, setAssets] = useState<LocalMediaAssetRecord[]>([]);
  const [storageText, setStorageText] = useState(
    'Storage status unavailable until the library opens.',
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<Array<HTMLButtonElement | null>>([]);

  async function refresh(nextDb = db) {
    if (!nextDb) return;
    setAssets(await listMediaAssetsForProject(nextDb, projectId));
  }

  async function openLibrary() {
    setFileMenuOpen(false);
    setLibraryOpen(true);
    setError(null);
    try {
      const nextDb = db ?? (await openLocalProjectDatabase());
      await ensureProject(nextDb, { id: projectId, ownerId, title: projectTitle });
      setDb(nextDb);
      await refresh(nextDb);
      const persistence = await requestPersistentStorage();
      setStorageText(
        persistence.supported
          ? persistence.persisted
            ? 'Browser storage is persistent for this session.'
            : 'Browser storage is best-effort; export a local project backup regularly.'
          : 'This browser does not expose persistent-storage status; export a local project backup regularly.',
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function closeFileMenu() {
    setFileMenuOpen(false);
    fileMenuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!fileMenuOpen) return;
    menuItemsRef.current[0]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) closeFileMenu();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFileMenu();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [fileMenuOpen]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = menuItemsRef.current.filter(
      (item): item is HTMLButtonElement => item !== null && !item.disabled,
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFileMenu();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (currentIndex + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  async function exportProject() {
    setFileMenuOpen(false);
    try {
      const nextDb = db ?? (await openLocalProjectDatabase());
      await ensureProject(nextDb, { id: projectId, ownerId, title: projectTitle });
      const exported = await exportLocalProject(nextDb, ownerId, projectId);
      downloadBlob(
        new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }),
        `${projectTitle || 'local-project'}.creatrart.json`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileMenuOpen(false);
    if (!SUPPORTED_MEDIA_MIME_TYPES.has(file.type)) {
      setError(`“${file.type || 'Unknown file type'}” is not a supported media file type.`);
      return;
    }
    setError(null);
    setPendingImport({ file, altText: file.name.replace(/\.[^.]+$/, ''), decorative: false });
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const altText = pendingImport.altText.trim();
    if (!pendingImport.decorative && !altText) {
      setError('Add meaningful alt text or choose Decorative image before importing.');
      return;
    }
    try {
      const nextDb = db ?? (await openLocalProjectDatabase());
      await ensureProject(nextDb, { id: projectId, ownerId, title: projectTitle });
      await importMediaAsset(nextDb, {
        projectId,
        blob: pendingImport.file,
        mimeType: pendingImport.file.type,
        filename: pendingImport.file.name,
        altText: pendingImport.decorative ? '' : altText,
      });
      setDb(nextDb);
      await refresh(nextDb);
      setPendingImport(null);
      setError(null);
      setLibraryOpen(true);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function insertAsset(asset: LocalMediaAssetRecord) {
    if (!db || !workingCopy) return;
    const layerId = sceneEditor.selectedLayerId ?? sceneEditor.layers[0]?.id;
    if (!layerId) {
      setError('The active scene has no layer available for a media layer.');
      return;
    }
    try {
      await addMediaReference(db, asset.id);
      const image = {
        id: crypto.randomUUID(),
        type: 'image' as const,
        layerId,
        groupId: null,
        transform: { x: 80, y: 80, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: null, stroke: null, strokeWidth: 0 },
        mediaAssetId: asset.id,
        altText: asset.altText || null,
        decorative: asset.altText.length === 0,
      };
      const shapes = Array.isArray(workingCopy.shapes) ? workingCopy.shapes : [];
      sceneEditor.commitScene({ ...workingCopy, shapes: [...shapes, image] });
      sceneEditor.selectShape(image.id);
      await refresh();
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function deleteAsset(asset: LocalMediaAssetRecord) {
    if (!db || imageUseCount(asset) > 0) return;
    try {
      await removeMediaReference(db, asset.id);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function saveRename(asset: LocalMediaAssetRecord) {
    if (!db || !renameValue.trim()) return;
    try {
      await updateMediaAssetMetadata(db, asset.id, {
        filename: renameValue.trim(),
        altText: asset.altText,
      });
      setRenamingId(null);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <>
      <div className="editor-file-menu" ref={menuRef}>
        <button
          ref={fileMenuButtonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={fileMenuOpen}
          onClick={() => setFileMenuOpen((open) => !open)}
        >
          File
        </button>
        {fileMenuOpen && (
          <div
            role="menu"
            aria-label="File menu"
            className="editor-file-menu-popover"
            onKeyDown={handleMenuKeyDown}
          >
            <button
              ref={(element) => {
                menuItemsRef.current[0] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => fileInputRef.current?.click()}
            >
              Import media
            </button>
            <button
              ref={(element) => {
                menuItemsRef.current[1] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => void openLibrary()}
            >
              Open media library
            </button>
            <button
              ref={(element) => {
                menuItemsRef.current[2] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => void exportProject()}
            >
              Export local project
            </button>
            <p role="status" aria-live="polite">
              {storageText}
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={[...SUPPORTED_MEDIA_MIME_TYPES].join(',')}
          hidden
          onChange={chooseFile}
          aria-label="Import media file"
        />
      </div>
      {pendingImport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-import-title"
          className="media-import-dialog"
        >
          <h3 id="media-import-title">Describe this image</h3>
          <p>{pendingImport.file.name}</p>
          <label htmlFor="media-import-alt-text">Meaningful alt text</label>
          <input
            id="media-import-alt-text"
            value={pendingImport.altText}
            onChange={(event) =>
              setPendingImport({ ...pendingImport, altText: event.target.value })
            }
            disabled={pendingImport.decorative}
          />
          <label>
            <input
              type="checkbox"
              checked={pendingImport.decorative}
              onChange={(event) =>
                setPendingImport({ ...pendingImport, decorative: event.target.checked })
              }
            />
            Decorative image
          </label>
          <button type="button" onClick={() => void confirmImport()}>
            Import image
          </button>
          <button type="button" onClick={() => setPendingImport(null)}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" aria-live="assertive" className="editor-media-error">
          {error}
        </p>
      )}
      {libraryOpen && (
        <section className="editor-media-library" aria-label="Project media library">
          <div className="editor-media-library-header">
            <h3>Project media library</h3>
            <button type="button" onClick={() => setLibraryOpen(false)}>
              Close media library
            </button>
          </div>
          <p role="status">{storageText}</p>
          {assets.length === 0 && <p>No media imported yet.</p>}
          <ul>
            {assets.map((asset) => (
              <MediaAssetRow
                key={asset.id}
                asset={asset}
                db={db}
                renaming={renamingId === asset.id}
                renameValue={renameValue}
                onRenameStart={() => {
                  setRenamingId(asset.id);
                  setRenameValue(asset.filename);
                }}
                onRenameChange={setRenameValue}
                onRenameSave={() => void saveRename(asset)}
                onInsert={() => void insertAsset(asset)}
                onDelete={() => void deleteAsset(asset)}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function MediaAssetRow({
  asset,
  db,
  renaming,
  renameValue,
  onRenameStart,
  onRenameChange,
  onRenameSave,
  onInsert,
  onDelete,
}: {
  asset: LocalMediaAssetRecord;
  db: IDBDatabase | null;
  renaming: boolean;
  renameValue: string;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameSave: () => void;
  onInsert: () => void;
  onDelete: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (db) {
      void getMediaBlob(db, asset.id).then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setThumbnail(url);
      });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.id, db]);

  return (
    <li className="editor-media-asset">
      {thumbnail ? (
        <img src={thumbnail} alt={asset.altText || ''} />
      ) : (
        <span aria-label="No image preview">No preview</span>
      )}
      <div>
        {renaming ? (
          <>
            <label htmlFor={`rename-media-${asset.id}`}>Asset name</label>
            <input
              id={`rename-media-${asset.id}`}
              value={renameValue}
              onChange={(event) => onRenameChange(event.target.value)}
            />
            <button type="button" onClick={onRenameSave}>
              Save metadata
            </button>
          </>
        ) : (
          <strong>{asset.filename}</strong>
        )}
        <p>
          {asset.mimeType} · {asset.byteSize} bytes ·{' '}
          {asset.altText ? 'Alt text set' : 'Decorative'} · Used in {imageUseCount(asset)} scene(s)
        </p>
        <button type="button" onClick={onInsert}>
          Insert into active scene
        </button>
        <button type="button" onClick={onRenameStart}>
          Rename metadata
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={imageUseCount(asset) > 0}
          aria-describedby={`delete-media-help-${asset.id}`}
        >
          Delete asset
        </button>
        <span id={`delete-media-help-${asset.id}`}>
          {imageUseCount(asset) > 0
            ? 'Remove scene references before deleting.'
            : 'Safe to delete: no scene references.'}
        </span>
      </div>
    </li>
  );
}
