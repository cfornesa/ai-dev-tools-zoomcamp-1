import {
  getMediaBlob,
  listMediaAssetsForProject,
  openLocalProjectDatabase,
  type LocalMediaAssetRecord,
} from './localProjectRepository';
import { buildPiecePackage, parsePiecePackage, type PiecePackageMedia } from './piecePackage';
import { getSceneVersion, listSceneVersions, type Project } from '../api/projects';

export type Server2dPiecePackageResult = {
  bytes: Uint8Array;
  missingAssets: LocalMediaAssetRecord[];
};

/** Builds a validated package for a server-backed 2D project without mutating
 * the server project or its browser-local media store. */
export async function buildServer2dPiecePackage(
  project: Pick<Project, 'id' | 'title' | 'description' | 'tags' | 'visibility'>,
): Promise<Server2dPiecePackageResult> {
  const summaries = (await listSceneVersions(project.id)).sort(
    (left, right) => left.sequence - right.sequence,
  );
  const versions = await Promise.all(
    summaries.map((summary) => getSceneVersion(project.id, summary.id)),
  );
  const db = await openLocalProjectDatabase();
  try {
    const assets = await listMediaAssetsForProject(db, project.id);
    const mediaAssets: PiecePackageMedia[] = [];
    const missingAssets: LocalMediaAssetRecord[] = [];
    for (const asset of assets) {
      const blob = await getMediaBlob(db, asset.id);
      if (!blob) {
        missingAssets.push(asset);
        continue;
      }
      mediaAssets.push({
        filename: asset.filename,
        altText: asset.altText,
        mimeType: asset.mimeType,
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    const bytes = await buildPiecePackage({
      kind: '2d',
      title: project.title,
      description: project.description,
      tags: project.tags,
      visibilityIntent: project.visibility,
      appVersion: 'server-2d',
      records: versions.map((version) => ({ schemaVersion: 1, data: version.scene_json })),
      mediaAssets,
    });
    // Re-parse before returning so callers can never offer an unchecked ZIP.
    await parsePiecePackage(bytes);
    return { bytes, missingAssets };
  } finally {
    db.close();
  }
}

export function server2dPackageFilename(title: string): string {
  const safeTitle = title
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^\.+|\.+$/g, '');
  return `${safeTitle || 'piece'}-package.zip`;
}
