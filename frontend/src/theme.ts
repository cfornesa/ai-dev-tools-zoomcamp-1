export const THEME_STORAGE_KEY = 'augmentrart:theme-preference:v1';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

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
