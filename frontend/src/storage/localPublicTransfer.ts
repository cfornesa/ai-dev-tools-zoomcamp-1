import { ApiError } from '../api/client';
import { updateArtPiece, type ArtPiece } from '../api/artPieces';
import { intakePiecePackage } from '../api/pieceIntake';
import { type PublishValidationErrorBody } from '../api/projects';
import { publishProject3D, type Project3D } from '../api/projects3d';
import { fetchStorageEstimate } from '../api/storageUsage';
import {
  getProject,
  listPieceVersions,
  updateProject,
  type LocalPieceKind,
  type LocalPieceVersionRecord,
  type LocalProjectRecord,
} from './localProjectRepository';
import { buildLocalPiecePackage } from './localPiecePackage';

export type LocalPublicTransferResult = {
  project: LocalProjectRecord;
  published: Project3D | ArtPiece;
};

export class LocalPublicTransferError extends Error {
  readonly kind: 'validation' | 'over-quota' | 'missing-assets' | 'unsupported-kind';

  constructor(kind: LocalPublicTransferError['kind'], message: string) {
    super(message);
    this.name = 'LocalPublicTransferError';
    this.kind = kind;
  }
}

function publishValidationMessage(error: unknown): string | null {
  if (
    !(error instanceof ApiError) ||
    error.status !== 400 ||
    !error.body ||
    typeof error.body !== 'object'
  ) {
    return null;
  }
  const body = error.body as Partial<PublishValidationErrorBody> & { detail?: unknown };
  if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
  return body.errors && typeof body.errors === 'object'
    ? Object.values(body.errors).flat().join(' ')
    : null;
}

export function localPieceKindNeedsVersion(kind: LocalPieceKind): boolean {
  return kind === '3d' || kind === 'generated';
}

export async function publishLocalPiece(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  title: string,
  description: string,
): Promise<LocalPublicTransferResult> {
  const project = await getProject(db, ownerId, projectId);
  if (!project || (project.kind !== '3d' && project.kind !== 'generated')) {
    throw new LocalPublicTransferError(
      'unsupported-kind',
      'This local piece kind is not supported by the 3D/generated transfer.',
    );
  }

  let versions: LocalPieceVersionRecord[] = [];
  if (localPieceKindNeedsVersion(project.kind)) {
    versions = await listPieceVersions(db, ownerId, projectId);
    if (versions.length === 0) {
      throw new LocalPublicTransferError(
        'validation',
        'Save at least one version before publishing this piece.',
      );
    }
  }

  const built = await buildLocalPiecePackage(db, ownerId, projectId, { title, description });
  if (built.missingAssets.length > 0) {
    throw new LocalPublicTransferError(
      'missing-assets',
      'Missing local media; export or repair it before publishing.',
    );
  }
  const estimate = await fetchStorageEstimate({
    pieceBytes: built.pieceBytes,
    mediaBytes: built.mediaBytes,
    pieceFiles: 1,
    mediaFiles: built.mediaFiles,
  });
  if (!estimate.fits.public) {
    throw new LocalPublicTransferError(
      'over-quota',
      `Over quota; ${Math.max(estimate.remaining_after.public.bytes, 0)} bytes remain.`,
    );
  }

  let intake: Awaited<ReturnType<typeof intakePiecePackage>>;
  try {
    intake = await intakePiecePackage(
      built.bytes,
      `local-publish-${projectId}-${project.updatedAt}`,
    );
  } catch (error) {
    const message = publishValidationMessage(error);
    if (message) throw new LocalPublicTransferError('validation', message);
    throw error;
  }
  // Persist the title and the verified intake before publishing. If publish
  // fails, this is deliberately the defined private, server-backed state.
  const synced = await updateProject(db, ownerId, projectId, {
    title,
    cloudSyncState: 'synced',
    remotePublicId: intake.public_id,
    remoteVersion: intake.version,
  });
  try {
    const published =
      project.kind === '3d'
        ? await publishProject3D(intake.public_id)
        : await updateArtPiece(intake.public_id, {
            title,
            description,
            status: 'published',
          });
    return { project: synced, published };
  } catch (error) {
    const message = publishValidationMessage(error);
    if (message) throw new LocalPublicTransferError('validation', message);
    throw error;
  }
}
