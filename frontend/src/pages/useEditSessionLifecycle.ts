import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CloudBackupFailure } from '../api/cloudBackupErrors';
import type { SceneDocument, SceneVersion } from '../api/projects';
import { saveNowBeforeClearing } from '../storage/cloudSnapshot';
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';

type DraftFailureSource = {
  getLastFailure: () => { message: string } | null;
  onFailureChange: (listener: () => void) => () => void;
};

type EditSessionLifecycleOptions = {
  id: string | undefined;
  workingCopy: SceneDocument | null;
  persistedVersion: SceneVersion | null;
  gatedWorkingCopy: SceneDocument | null;
  draftAutosave: DraftFailureSource & { clearDraft: () => Promise<unknown> };
  draftServerSync: DraftFailureSource & { deleteServerDraft: () => Promise<unknown> };
  navigate: (path: string) => void;
};

export function useEditSessionLifecycle({
  id,
  workingCopy,
  persistedVersion,
  gatedWorkingCopy,
  draftAutosave,
  draftServerSync,
  navigate,
}: EditSessionLifecycleOptions) {
  const isDirty = useMemo(
    () =>
      persistedVersion == null ||
      JSON.stringify(workingCopy) !== JSON.stringify(persistedVersion.scene_json),
    [workingCopy, persistedVersion],
  );
  useBeforeUnloadGuard(isDirty);

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [exitSaveFailure, setExitSaveFailure] = useState<CloudBackupFailure | null>(null);
  const [draftFailureNotice, setDraftFailureNotice] = useState<string | null>(null);
  const draftAutosaveRef = useRef(draftAutosave);
  draftAutosaveRef.current = draftAutosave;
  const draftServerSyncRef = useRef(draftServerSync);
  draftServerSyncRef.current = draftServerSync;

  const refreshDraftFailureNotice = useCallback(() => {
    const autosaveFailure = draftAutosaveRef.current.getLastFailure();
    const syncFailure = draftServerSyncRef.current.getLastFailure();
    const failure = syncFailure ?? autosaveFailure;
    setDraftFailureNotice(
      failure
        ? `Recovery draft couldn't be saved (${failure.message}). Your changes are still here — try saving explicitly.`
        : null,
    );
  }, []);

  useEffect(() => {
    if (!id) {
      setDraftFailureNotice(null);
      return;
    }
    refreshDraftFailureNotice();
    const unsubscribeAutosave = draftAutosaveRef.current.onFailureChange(refreshDraftFailureNotice);
    const unsubscribeSync = draftServerSyncRef.current.onFailureChange(refreshDraftFailureNotice);
    return () => {
      unsubscribeAutosave();
      unsubscribeSync();
    };
  }, [id, refreshDraftFailureNotice]);

  const clearDraftFailureNotice = useCallback(() => setDraftFailureNotice(null), []);
  const openExitConfirm = useCallback(() => setShowExitConfirm(true), []);
  const cancelExit = useCallback(() => {
    setShowExitConfirm(false);
    setExitSaveFailure(null);
  }, []);

  const handleConfirmExit = useCallback(() => {
    void draftAutosave.clearDraft();
    void draftServerSync.deleteServerDraft();
    setShowExitConfirm(false);
    setExitSaveFailure(null);
    navigate('/studio');
  }, [draftAutosave, draftServerSync, navigate]);

  const attemptExit = useCallback(async () => {
    if (id && gatedWorkingCopy) {
      setExitSaving(true);
      const result = await saveNowBeforeClearing(id, gatedWorkingCopy);
      setExitSaving(false);
      if (result.applicable && !result.success) {
        setExitSaveFailure(result.failure);
        return;
      }
    }
    handleConfirmExit();
  }, [gatedWorkingCopy, handleConfirmExit, id]);

  return {
    isDirty,
    showExitConfirm,
    exitSaving,
    exitSaveFailure,
    draftFailureNotice,
    openExitConfirm,
    cancelExit,
    handleConfirmExit,
    attemptExit,
    clearDraftFailureNotice,
  };
}
