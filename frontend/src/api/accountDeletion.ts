import { apiFetch } from './client';

export type AccountDeletionErrorCode =
  'reauthentication_required' | 'confirmation_mismatch' | 'already_deleted';

export type AccountDeletionErrorBody = {
  error: AccountDeletionErrorCode;
  detail: string;
};

/** Issue #443: `password` is omitted (not sent as an empty string) for an
 * OAuth-only account with no usable password -- the server only requires
 * it when `user.has_usable_password()`. */
export async function deleteAccount(confirmation: string, password?: string): Promise<void> {
  await apiFetch<void>('/api/account/delete/', {
    method: 'POST',
    body: JSON.stringify({ confirmation, ...(password ? { password } : {}) }),
  });
}
