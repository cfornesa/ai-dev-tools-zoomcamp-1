export const LOCAL_TRANSFER_CONSENT_VERSION = 'local-transfer-v1';
const CONSENT_KEY_PREFIX = 'creatrart:local-transfer-consent:';

type LocalTransferConsent = {
  version: string;
  ownerId: string;
  projectId: string;
  versionId: string;
  consentedAt: string;
};

function key(ownerId: string, projectId: string, versionId: string): string {
  return `${CONSENT_KEY_PREFIX}${ownerId}:${projectId}:${versionId}`;
}

/** Copies existing explicit consent records to the canonical owner key after
 * a legacy local project has been verified against the current profile handle.
 * The old entries are retained, making recovery idempotent and non-destructive. */
export function rekeyLocalTransferConsentOwner(
  legacyOwnerId: string,
  ownerId: string,
  projectId: string,
): void {
  if (typeof window === 'undefined' || legacyOwnerId === ownerId) return;
  const prefix = `${CONSENT_KEY_PREFIX}${legacyOwnerId}:${projectId}:`;
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const oldKey = storage.key(index);
      if (!oldKey?.startsWith(prefix)) continue;
      const raw = storage.getItem(oldKey);
      if (!raw) continue;
      const record = JSON.parse(raw) as Partial<LocalTransferConsent>;
      if (
        record.version !== LOCAL_TRANSFER_CONSENT_VERSION ||
        record.ownerId !== legacyOwnerId ||
        record.projectId !== projectId ||
        typeof record.versionId !== 'string' ||
        typeof record.consentedAt !== 'string'
      ) {
        continue;
      }
      const nextKey = key(ownerId, projectId, record.versionId);
      if (!storage.getItem(nextKey)) {
        storage.setItem(nextKey, JSON.stringify({ ...record, ownerId }));
      }
    }
  } catch {
    // Consent remains fail-closed if browser storage is unavailable.
  }
}

export function hasLocalTransferConsent(
  ownerId: string,
  projectId: string,
  versionId: string,
): boolean {
  try {
    const raw = window.localStorage.getItem(key(ownerId, projectId, versionId));
    if (!raw) return false;
    const record = JSON.parse(raw) as Partial<LocalTransferConsent>;
    return (
      record.version === LOCAL_TRANSFER_CONSENT_VERSION &&
      record.ownerId === ownerId &&
      record.projectId === projectId &&
      record.versionId === versionId &&
      typeof record.consentedAt === 'string'
    );
  } catch {
    return false;
  }
}

export function recordLocalTransferConsent(
  ownerId: string,
  projectId: string,
  versionId: string,
): boolean {
  const record: LocalTransferConsent = {
    version: LOCAL_TRANSFER_CONSENT_VERSION,
    ownerId,
    projectId,
    versionId,
    consentedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(key(ownerId, projectId, versionId), JSON.stringify(record));
    return true;
  } catch {
    // A blocked preference store must fail closed: the caller should not
    // continue into an off-browser request without a durable consent record.
    return false;
  }
}
