import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import {
  getProject,
  listPieceVersions,
  openLocalProjectDatabase,
  saveLocal3DVersion,
  updateProject,
  type LocalPieceVersionRecord,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';
import Project3DWorkspace, { type Project3DWorkspaceStorage } from './Project3DWorkspace';
import type { Project3D, SceneVersion3D } from '../api/projects3d';

function versionToApi(version: LocalPieceVersionRecord, owner: string): SceneVersion3D {
  return {
    id: version.sequence,
    sequence: version.sequence,
    origin: 'manual',
    scene_json: version.payload,
    created_by: owner,
    created_at: version.createdAt,
  };
}

function projectToApi(
  project: LocalProjectRecord,
  currentVersion: SceneVersion3D | null,
): Project3D {
  return {
    id: project.id,
    owner: project.ownerId,
    title: project.title,
    visibility: 'private',
    thumbnail_url: null,
    current_version: currentVersion,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

/** Local-first 3D route for #937. It adapts the existing 3D editor to the
 * shared IndexedDB project/version repository; no API request is made and
 * the server-backed `/projects3d/:id` route remains unchanged. */
export default function LocalProject3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const owner = auth.user?.username;

  const storage = useMemo<Project3DWorkspaceStorage | undefined>(() => {
    if (!owner || !id) return undefined;
    return {
      local: true,
      async loadProject(projectId) {
        const db = await openLocalProjectDatabase();
        try {
          const project = await getProject(db, owner, projectId);
          if (!project || project.kind !== '3d') throw new Error('Local 3D project unavailable');
          const versions = await listPieceVersions(db, owner, projectId);
          const current = versions.at(-1) ?? null;
          return {
            project: projectToApi(project, current ? versionToApi(current, owner) : null),
            versions: versions.map((version) => versionToApi(version, owner)),
          };
        } finally {
          db.close();
        }
      },
      async saveVersion(projectId, scene) {
        const db = await openLocalProjectDatabase();
        try {
          const version = await saveLocal3DVersion(
            db,
            owner,
            projectId,
            scene as unknown as Record<string, unknown>,
          );
          return versionToApi(version, owner);
        } finally {
          db.close();
        }
      },
      async updateMetadata(projectId, data) {
        const db = await openLocalProjectDatabase();
        try {
          const project = await updateProject(db, owner, projectId, { title: data.title });
          const versions = await listPieceVersions(db, owner, projectId);
          const current = versions.at(-1) ?? null;
          return projectToApi(project, current ? versionToApi(current, owner) : null);
        } finally {
          db.close();
        }
      },
    };
  }, [id, owner]);

  if (auth.status === 'signed-out') return <Navigate to="/accounts/login/" replace />;
  if (!id || !owner) return <p role="status">Opening local 3D editor…</p>;
  if (!storage) return <p role="alert">This local 3D editor is unavailable.</p>;
  return <Project3DWorkspace initialProjectId={id} storage={storage} />;
}
