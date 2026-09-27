import type { ArtPiece, ArtPieceVersion } from '../api/artPieces';
import { buildPiecePackage, parsePiecePackage } from './piecePackage';

export type ServerGeneratedPiecePackageResult = {
  bytes: Uint8Array;
  missingAssets: string[];
};

function safeTitle(title: string): string {
  const normalized = title
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${normalized || 'generated-art'}-package.zip`;
}

export function serverGeneratedPackageFilename(title: string): string {
  return safeTitle(title);
}

/** Builds and reparses the portable data package for one server-backed generated piece.
 * Generated pieces do not currently have a piece-scoped browser media store, so the
 * result intentionally reports no media and never invents asset entries. */
export async function buildServerGeneratedPiecePackage(
  piece: Pick<ArtPiece, 'title' | 'description' | 'engine' | 'status' | 'current_version'>,
  versions: ArtPieceVersion[],
): Promise<ServerGeneratedPiecePackageResult> {
  const orderedVersions = versions.slice().sort((a, b) => a.sequence - b.sequence);
  const current = piece.current_version ?? orderedVersions.at(-1) ?? null;
  const bytes = await buildPiecePackage({
    kind: 'generated',
    title: piece.title,
    description: piece.description,
    visibilityIntent:
      piece.status === 'published'
        ? 'public'
        : piece.status === 'draft'
          ? 'unpublished'
          : 'private',
    appVersion: 'augmentrart-web',
    records: orderedVersions.map((version) => ({
      schemaVersion: 1,
      data: {
        id: version.id,
        sequence: version.sequence,
        source: version.source,
        capabilities: version.capabilities,
        camera_placement: version.camera_placement ?? null,
        generation_metadata: version.generation_metadata ?? {},
        ink: version.ink ?? null,
        sonic: version.sonic ?? null,
        created_at: version.created_at,
      },
    })),
    source: current
      ? {
          engine: piece.engine,
          currentVersionId: current.id,
          source: current.source,
        }
      : null,
    ink: current?.ink ?? null,
    sonic: current?.sonic ?? null,
    capabilities: current?.capabilities ?? null,
  });
  await parsePiecePackage(bytes);
  return { bytes, missingAssets: [] };
}
