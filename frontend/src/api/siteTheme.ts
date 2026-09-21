import { apiFetch } from './client';
import type { PresentationOptions } from './adminSettings';

export type ThemeTokens = Record<string, string> & {
  presentation?: PresentationOptions;
  theme_palettes?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
};

export async function fetchSiteTheme(): Promise<ThemeTokens> {
  return apiFetch<ThemeTokens>('/api/site-theme/');
}
