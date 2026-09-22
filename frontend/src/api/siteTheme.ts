import { apiFetch } from './client';
import type { DesignPalettes, PaletteDefinition, PresentationOptions } from './adminSettings';

export type ThemeTokens = Record<string, string> & {
  presentation?: PresentationOptions;
  theme_palettes?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  palette_key?: string;
  design_palettes?: DesignPalettes;
  available_palettes?: PaletteDefinition[];
  site_title?: string;
};

export async function fetchSiteTheme(): Promise<ThemeTokens> {
  return apiFetch<ThemeTokens>('/api/site-theme/');
}
