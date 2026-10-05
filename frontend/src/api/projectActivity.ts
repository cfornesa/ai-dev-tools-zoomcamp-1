import { apiFetch } from './client';

/** One privacy-projected project activity item from #1133's owner-only API. */
export type ProjectActivityItem = {
  id: number;
  action_type: string;
  label: string;
  actor_display: string | null;
  created_at: string;
  details: Record<string, unknown>;
};

export type ProjectActivityPage = {
  results: ProjectActivityItem[];
  next_cursor: string | null;
};

/** Fetch one bounded activity page. Omitting cursor uses the API's default 25 rows. */
export function listProjectActivity(
  publicProjectId: string,
  cursor?: string,
): Promise<ProjectActivityPage> {
  const query = cursor === undefined ? '' : `?${new URLSearchParams({ cursor }).toString()}`;
  return apiFetch<ProjectActivityPage>(
    `/api/projects/${encodeURIComponent(publicProjectId)}/activity/${query}`,
  );
}
