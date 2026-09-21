import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyThemePreference,
  persistThemePreference,
  readThemePreference,
  resolveThemeMode,
  THEME_STORAGE_KEY,
} from './theme';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  vi.restoreAllMocks();
});

describe('theme preference', () => {
  it('defaults to system and applies explicit modes to the document root', () => {
    expect(readThemePreference()).toBe('system');
    expect(applyThemePreference('dark')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('persists a valid choice and follows the live system preference', () => {
    persistThemePreference('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(readThemePreference()).toBe('light');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true } as MediaQueryList),
    });
    expect(resolveThemeMode('system')).toBe('dark');
    expect(applyThemePreference('system')).toBe('dark');
  });

  it('falls back to system when storage is blocked', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readThemePreference()).toBe('system');
    expect(() => persistThemePreference('dark')).not.toThrow();
  });
});
