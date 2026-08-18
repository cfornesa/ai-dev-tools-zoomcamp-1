import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import {
  getProject,
  getSceneVersion,
  type Project,
  type SceneDocument,
  type SceneVersion,
} from '../api/projects';
import { validateScene } from '../validation/scene';

export type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';

/**
 * Task 21: fetches the project and (when present) its current scene
 * version on mount, and holds three distinct, separately-typed state
 * slices:
 *  - `project`: the fetched project metadata, as returned by the API.
 *  - `persistedVersion`: the scene version the working copy was loaded
 *    from, exactly as fetched — never mutated by editing.
 *  - `workingCopy`: an in-memory copy of that version's scene JSON that
 *    later tasks (23, 25, 60) will mutate as the user edits. Editing it
 *    here never touches `project` or `persistedVersion`, and never
 *    issues a PATCH/POST/PUT — this hook makes no mutating API call at
 *    all, only the two GETs needed to load.
 */
export function useEditorWorkspaceState(id: string | undefined) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [persistedVersion, setPersistedVersion] = useState<SceneVersion | null>(null);
  const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(null);

  const load = useCallback(() => {
    if (!id) return () => {};
    let cancelled = false;
    setLoadState('loading');
    setProject(null);
    setPersistedVersion(null);
    setWorkingCopy(null);

    (async () => {
      try {
        const fetchedProject = await getProject(id);
        if (cancelled) return;
        setProject(fetchedProject);

        if (fetchedProject.current_version == null) {
          setLoadState('no-scene');
          return;
        }

        const version = await getSceneVersion(id, fetchedProject.current_version);
        if (cancelled) return;

        const result = validateScene(version.scene_json);
        if (!result.valid) {
          setLoadState('no-scene');
          return;
        }

        setPersistedVersion(version);
        // A deep copy: the working copy must be free to mutate without
        // ever reaching back into the persisted version's own object graph.
        setWorkingCopy(structuredClone(version.scene_json));
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setLoadState('access-denied');
        } else {
          setLoadState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  return {
    loadState,
    project,
    persistedVersion,
    workingCopy,
    setWorkingCopy,
    // Task 41: exposed so a successful save/restore can update the
    // "current version" the editor is tracking without a full reload —
    // save/restore already return the exact new `SceneVersion`/`Project`
    // shape from the server, so there's no need to re-fetch either.
    setProject,
    setPersistedVersion,
    retry: load,
  };
}
