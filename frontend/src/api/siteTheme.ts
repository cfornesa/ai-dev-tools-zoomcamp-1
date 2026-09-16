import { apiFetch } from './client';
import type { PresentationOptions } from './adminSettings';

export type ThemeTokens = Record<string, string> & { presentation?: PresentationOptions };

export async function fetchSiteTheme(): Promise<ThemeTokens> {
  return apiFetch<ThemeTokens>('/api/site-theme/');
}
