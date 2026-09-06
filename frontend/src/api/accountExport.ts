import { apiFetch } from './client';

export type AccountExportVersion = {
  sequence: number;
  origin: string;
  created_at: string | null;
  [key: string]: unknown;
};

export type AccountExportProject = {
  public_id: string;
  title: string;
  is_deleted: boolean;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  versions: AccountExportVersion[];
  [key: string]: unknown;
};

export type AccountExportIdentity = {
  provider: string;
  enabled: boolean;
  connected_at: string;
};

export type AccountExport = {
  schema_version: number;
  profile: { username: string; email: string };
  identities: AccountExportIdentity[];
  entitlement: { plan_key: string; features: unknown[]; reset_at: string };
  subscription: { status: string; plan_key: string; paid_through: string | null } | null;
  ai_credentials: { mistral_configured: boolean; provider_credentials: string[] };
  projects: AccountExportProject[];
  projects_3d: AccountExportProject[];
  art_pieces: AccountExportProject[];
};

export async function fetchAccountExport(): Promise<AccountExport> {
  return apiFetch<AccountExport>('/api/account/export/');
}
