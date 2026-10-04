export const THEME_STORAGE_KEY = 'augmentrart:theme-preference:v1';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

export type SiteThemeTokens = {
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
  accent?: string;
  theme_palettes?: Record<ThemeMode, Record<string, string>>;
  presentation?: {
    font_family?: 'system' | 'serif' | 'mono' | 'script';
    density?: 'comfortable' | 'compact';
    radius?: 'sharp' | 'soft' | 'pill';
    border_style?: 'solid' | 'dashed' | 'none';
    shadow?: 'none' | 'soft' | 'offset';
    backdrop?: 'plain' | 'gradient' | 'cosmic';
  };
};

const siteFonts = {
  system: [
    "system-ui, 'Segoe UI', Roboto, sans-serif",
    "system-ui, 'Segoe UI', Roboto, sans-serif",
  ],
  serif: ["Georgia, 'Times New Roman', serif", "Georgia, 'Times New Roman', serif"],
  mono: ['ui-monospace, Consolas, monospace', 'ui-monospace, Consolas, monospace'],
  script: [
    "Lora, Georgia, 'Times New Roman', serif",
    "'Pinyon Script', Georgia, 'Times New Roman', serif",
  ],
} as const;

/** CSS custom properties and root attributes shared with the allauth templates. */
export function siteThemePresentation(theme: SiteThemeTokens, mode: ThemeMode) {
  const palette = theme.theme_palettes?.[mode] ?? {
    background: theme.background,
    surface: theme.surface,
    text: theme.text,
    muted: theme.muted,
    accent: theme.accent,
  };
  const presentation = theme.presentation ?? {};
  const fontFamily = presentation.font_family ?? 'system';
  const [siteFont, heading] = siteFonts[fontFamily];
  const variables: Record<string, string> = {
    '--bg': palette.background ?? '',
    '--code-bg': palette.surface ?? '',
    '--text-h': palette.text ?? '',
    '--text': palette.muted ?? '',
    '--accent': palette.accent ?? '',
    '--sans': siteFonts.system[0],
    '--site-font': siteFont,
    '--heading': heading,
  };
  if (presentation.density)
    variables['--site-density'] = presentation.density === 'compact' ? '12px' : '20px';
  if (presentation.radius)
    variables['--site-radius'] = { sharp: '2px', soft: '8px', pill: '999px' }[presentation.radius];
  if (presentation.border_style) variables['--site-border-style'] = presentation.border_style;
  return {
    variables,
    attributes: {
      'data-site-font': presentation.font_family ?? '',
      'data-site-shadow': presentation.shadow ?? '',
      'data-site-backdrop': presentation.backdrop ?? '',
    },
  };
}

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function systemThemeMode(): ThemeMode {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  return preference === 'system' ? systemThemeMode() : preference;
}

export function applyThemePreference(preference: ThemePreference): ThemeMode {
  const mode = resolveThemeMode(preference);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.themePreference = preference;
  root.style.colorScheme = mode;
  return mode;
}

export function persistThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private/blocked storage is a supported system-mode fallback.
  }
}

export function subscribeToSystemTheme(callback: () => void): () => void {
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => callback();
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  } catch {
    return () => undefined;
  }
}
