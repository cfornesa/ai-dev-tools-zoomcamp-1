import { strToU8, zipSync } from 'fflate';

import { listArtPieceVersions, listArtPieces, type ArtPiece } from '../api/artPieces';
import { fetchAccountExport, type AccountExport } from '../api/accountExport';
import { listProjects, type Project } from '../api/projects';
import { listProjects3D, listSceneVersions3D, type Project3D } from '../api/projects3d';
import { buildLocalPiecePackage } from './localPiecePackage';
import {
  listProjectsForOwner,
  openLocalProjectDatabase,
  type LocalProjectRecord,
} from './localProjectRepository';
import { buildServer2dPiecePackage } from './server2dPiecePackage';
import { buildServer3dPiecePackage } from './server3dPiecePackage';
import { buildServerGeneratedPiecePackage } from './serverGeneratedPiecePackage';

export type AccountExportProgress = {
  completed: number;
  total: number;
  label: string;
};

export type AccountExportFailure = {
  label: string;
  reason: string;
};

export type AccountExportArchiveResult = {
  blob: Blob;
  byteSize: number;
  account: AccountExport;
  packageCount: number;
  failures: AccountExportFailure[];
};

type PackageJob = {
  label: string;
  build: () => Promise<Uint8Array>;
};

async function checksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safePathPart(value: string, fallback: string): string {
  const result = value.trim().replace(/[^a-z0-9._-]+/gi, '_');
  return result || fallback;
}

function serverJobs(
  projects: Project[],
  projects3d: Project3D[],
  artPieces: ArtPiece[],
): PackageJob[] {
  return [
    ...projects.map((project) => ({
      label: `2D: ${project.title}`,
      build: async () => (await buildServer2dPiecePackage(project)).bytes,
    })),
    ...projects3d.map((project) => ({
      label: `3D: ${project.title}`,
      build: async () => {
        const versions = await listSceneVersions3D(project.id);
        return (await buildServer3dPiecePackage(project, versions)).bytes;
      },
    })),
    ...artPieces.map((piece) => ({
      label: `Generated: ${piece.title}`,
      build: async () => {
        const versions = await listArtPieceVersions(piece.public_id);
        return (await buildServerGeneratedPiecePackage(piece, versions)).bytes;
      },
    })),
  ];
}

function localJobs(db: IDBDatabase, ownerId: string, projects: LocalProjectRecord[]): PackageJob[] {
  return projects.map((project) => ({
    label: `Local: ${project.title}`,
    build: async () => (await buildLocalPiecePackage(db, ownerId, project.id)).bytes,
  }));
}

/** Build the account-wide ZIP from the existing account JSON and validated
 * piece-package builders. A failed piece is recorded and does not prevent the
 * remaining packages from being delivered. Local storage is read-only. */
export async function buildAccountExportArchive(
  ownerId: string,
  onProgress?: (progress: AccountExportProgress) => void,
): Promise<AccountExportArchiveResult> {
  const [account, projects, projects3d, artPieces, db] = await Promise.all([
    fetchAccountExport(),
    listProjects(),
    listProjects3D(),
    listArtPieces(),
    openLocalProjectDatabase(),
  ]);
  let localProjects: LocalProjectRecord[];
  try {
    localProjects = await listProjectsForOwner(db, ownerId);
  } catch {
    db.close();
    throw new Error('Could not read local pieces for the account export.');
  }

  const jobs = [
    ...serverJobs(projects, projects3d, artPieces),
    ...localJobs(db, ownerId, localProjects),
  ];
  const entries: Record<string, Uint8Array> = {};
  const failures: AccountExportFailure[] = [];
  const manifestPackages: Array<{
    index: number;
    path: string | null;
    label: string;
    byteSize: number | null;
    sha256: string | null;
    error?: string;
  }> = [];

  try {
    const accountBytes = strToU8(JSON.stringify(account, null, 2));
    entries['account.json'] = accountBytes;
    const accountChecksum = await checksum(accountBytes);
    entries['manifest.json'] = strToU8('');
    onProgress?.({ completed: 0, total: jobs.length, label: 'Preparing account metadata' });

    for (const [index, job] of jobs.entries()) {
      onProgress?.({ completed: index, total: jobs.length, label: job.label });
      try {
        const bytes = await job.build();
        const path = `pieces/${index}-${safePathPart(job.label, `piece-${index}`)}.zip`;
        entries[path] = bytes;
        manifestPackages.push({
          index,
          path,
          label: job.label,
          byteSize: bytes.byteLength,
          sha256: await checksum(bytes),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown package failure.';
        failures.push({ label: job.label, reason });
        manifestPackages.push({
          index,
          path: null,
          label: job.label,
          byteSize: null,
          sha256: null,
          error: reason,
        });
      }
    }
    onProgress?.({ completed: jobs.length, total: jobs.length, label: 'Finalizing ZIP' });
    const manifest = {
      formatVersion: 1,
      partial: failures.length > 0,
      exportedAt: new Date().toISOString(),
      account: { path: 'account.json', byteSize: accountBytes.byteLength, sha256: accountChecksum },
      packages: manifestPackages,
      failures,
    };
    entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
    const zipped = zipSync(entries, { level: 0 });
    return {
      blob: new Blob([zipped], { type: 'application/zip' }),
      byteSize: zipped.byteLength,
      account,
      packageCount: manifestPackages.filter((item) => item.path !== null).length,
      failures,
    };
  } finally {
    db.close();
  }
}
