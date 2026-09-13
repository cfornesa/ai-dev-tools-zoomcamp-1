import { useEffect, useRef } from 'react';

import { fetchCloudBackup } from '../api/cloudBackup';
import { pushCloudSnapshot, isSnapshotDue } from '../storage/cloudSnapshot';
import { openLocalProjectDatabase } from '../storage/localProjectRepository';

/**
 * Issue #530: an opportunistic, silent scheduled-snapshot check -- run
 * once whenever a cloud-sync-eligible project is opened (not a repeating
 * background timer; cadence is measured in days, so "next time the
 * project is opened" is what "silent, periodic" (#529) means for a
 * local-first app with no server-side push access to browser data).
 *
 * Fetches the current cloud-backup status, and if `isSnapshotDue` says a
 * snapshot is due, silently builds and pushes one via
 * `../storage/cloudSnapshot.ts`. Never surfaces an error to the user and
 * never blocks the editor -- a failed scheduled snapshot is retried the
 * next time the project opens, exactly like a missed manual sync would
 * be.
 */
export function useCloudBackupSchedule(
  projectId: string | undefined,
  sceneJson: Record<string, unknown> | null,
) {
  const sceneJsonRef = useRef(sceneJson);
  sceneJsonRef.current = sceneJson;
  const attemptedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!projectId || attemptedRef.current === projectId) return;
    attemptedRef.current = projectId;

    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchCloudBackup(projectId);
        if (cancelled || !isSnapshotDue(status)) return;
        const scene = sceneJsonRef.current;
        if (!scene) return;
        const db = await openLocalProjectDatabase();
        try {
          await pushCloudSnapshot(db, projectId, scene, status.revision);
        } finally {
          db.close();
        }
      } catch {
        // Silent by design (#529): a missed or failed scheduled snapshot
        // is retried next time the project opens, never surfaced here.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);
}
