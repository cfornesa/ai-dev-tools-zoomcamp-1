import type { Project3D, SceneVersion3D } from '../api/projects3d';
import { buildPiecePackage, parsePiecePackage } from './piecePackage';

export type Server3dPiecePackageResult = { bytes: Uint8Array; missingAssets: string[] };

export function server3dPackageFilename(title: string): string {
  const safe = title
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${safe || '3d-scene'}-package.zip`;
}

export async function buildServer3dPiecePackage(
  project: Pick<Project3D, 'title' | 'visibility' | 'current_version'>,
  versions: SceneVersion3D[],
): Promise<Server3dPiecePackageResult> {
  const ordered = versions.slice().sort((a, b) => a.sequence - b.sequence);
  const current = project.current_version ?? ordered.at(-1) ?? null;
  const bytes = await buildPiecePackage({
    kind: '3d',
    title: project.title,
    description: '',
    visibilityIntent: project.visibility === 'public' ? 'public' : 'private',
    appVersion: 'augmentrart-web',
    records: ordered.map((version) => ({
      schemaVersion: 1,
      data: version.scene_json,
    })),
    source: current
      ? { currentVersionId: current.id, renderer: current.scene_json.renderer ?? null }
      : null,
  });
  await parsePiecePackage(bytes);
  return { bytes, missingAssets: [] };
}
