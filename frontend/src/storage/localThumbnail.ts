import { captureSocialThumbnail } from '../export/captureSocialThumbnail';
import { captureSandboxScreenshot } from '../generative/artPieceThumbnailCapture';
import { buildArtPieceSandboxDocument } from '../generative/artPieceSandbox';
import type { ArtPieceLibrary } from '../api/artPieces';
import {
  getProject,
  listPieceVersions,
  listScenesForProject,
  openLocalProjectDatabase,
  updateProject,
  type LocalProjectRecord,
} from './localProjectRepository';

export const LOCAL_THUMBNAILS = true;
export const LOCAL_THUMBNAIL_WIDTH = 320;
export const LOCAL_THUMBNAIL_HEIGHT = 240;

async function resizeToCardThumbnail(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Thumbnail image could not be decoded.'));
    });
    image.src = url;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = LOCAL_THUMBNAIL_WIDTH;
    canvas.height = LOCAL_THUMBNAIL_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Thumbnail canvas is unavailable.');
    const scale = Math.max(
      LOCAL_THUMBNAIL_WIDTH / image.width,
      LOCAL_THUMBNAIL_HEIGHT / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(
      image,
      (LOCAL_THUMBNAIL_WIDTH - width) / 2,
      (LOCAL_THUMBNAIL_HEIGHT - height) / 2,
      width,
      height,
    );
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('PNG encoding failed.'))),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function captureGeneratedSource(source: string, engine: string): Promise<Blob> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.position = 'fixed';
  iframe.style.width = `${LOCAL_THUMBNAIL_WIDTH}px`;
  iframe.style.height = `${LOCAL_THUMBNAIL_HEIGHT}px`;
  iframe.style.opacity = '0';
  iframe.srcdoc = buildArtPieceSandboxDocument(source, engine as ArtPieceLibrary, 'regular');
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const dataUrl = await captureSandboxScreenshot(iframe);
    const response = await fetch(dataUrl);
    return await resizeToCardThumbnail(await response.blob());
  } finally {
    iframe.remove();
  }
}

/** Generates and persists a card thumbnail only when a local project lacks one.
 * Capture is intentionally best-effort: 3D has no reliable headless-WebGL
 * path and returns null, while all other failures leave the project unchanged. */
export async function ensureLocalThumbnail(
  project: LocalProjectRecord,
): Promise<LocalProjectRecord | null> {
  if (!LOCAL_THUMBNAILS || project.thumbnail) return project;
  if (project.kind === '3d') return null;
  let db: IDBDatabase | undefined;
  try {
    db = await openLocalProjectDatabase();
    const current = await getProject(db, project.ownerId, project.id);
    if (!current || current.thumbnail) return current;
    let captured: Blob;
    if (current.kind === 'generated') {
      const versions = await listPieceVersions(db, current.ownerId, current.id);
      const payload = versions.at(-1)?.payload ?? {};
      captured = await captureGeneratedSource(
        String(payload.source ?? ''),
        String(payload.engine ?? 'svg'),
      );
    } else {
      const scenes = await listScenesForProject(db, current.id);
      const scene = scenes.find((item) => item.id === current.activeSceneId) ?? scenes[0];
      if (!scene) return null;
      captured = await resizeToCardThumbnail(
        await captureSocialThumbnail(scene.sceneJson as never),
      );
    }
    return await updateProject(db, current.ownerId, current.id, {
      thumbnail: captured,
      thumbnailUpdatedAt: new Date().toISOString(),
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
