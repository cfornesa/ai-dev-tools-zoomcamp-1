import { apiFetch } from './client';

export type ThemeTokens = Record<string, string>;

export async function fetchSiteTheme(): Promise<ThemeTokens> {
  return apiFetch<ThemeTokens>('/api/site-theme/');
}
