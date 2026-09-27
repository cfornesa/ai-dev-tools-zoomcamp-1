export const LOCAL_TRANSFER_CONSENT_VERSION = 'local-transfer-v1';

type LocalTransferConsent = {
  version: string;
  ownerId: string;
  projectId: string;
  versionId: string;
  consentedAt: string;
};

function key(ownerId: string, projectId: string, versionId: string): string {
  return `creatrart:local-transfer-consent:${ownerId}:${projectId}:${versionId}`;
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
