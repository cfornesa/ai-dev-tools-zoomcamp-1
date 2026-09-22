import type { CSSProperties } from 'react';

import type { PublicProfile } from '../api/profile';
import type { PresentationOptions } from '../api/adminSettings';

function presentationFont(value: PresentationOptions['font_family'] | undefined): string {
  if (value === 'serif') return "Georgia, 'Times New Roman', serif";
  if (value === 'mono') return 'ui-monospace, Consolas, monospace';
  // Script is the Celestial heading treatment. Profile and card body copy
  // must remain readable; the shared heading cascade applies Pinyon Script
  // to headings separately.
  if (value === 'script') return "Lora, Georgia, 'Times New Roman', serif";
  return "system-ui, 'Segoe UI', Roboto, sans-serif";
}

function presentationRadius(value: PresentationOptions['radius'] | undefined): string {
  if (value === 'sharp') return '2px';
  if (value === 'pill') return '999px';
  return '8px';
}

/** Resolve profile tokens for both color modes without overriding the site cascade. */
export function profileStyleVars(profile: PublicProfile): CSSProperties {
  const fallback = profile.theme_config;
  const light = profile.theme_palettes?.light ?? fallback;
  const dark = profile.theme_palettes?.dark ?? fallback;
  const value = (palette: Record<string, string>, key: string) => palette[key] ?? '';
  return {
    '--profile-background-dark': value(dark, 'background'),
    '--profile-surface-dark': value(dark, 'surface'),
    '--profile-text-dark': value(dark, 'text'),
    '--profile-muted-dark': value(dark, 'muted'),
    '--profile-accent-dark': value(dark, 'accent'),
    '--profile-background-light': value(light, 'background'),
    '--profile-surface-light': value(light, 'surface'),
    '--profile-text-light': value(light, 'text'),
    '--profile-muted-light': value(light, 'muted'),
    '--profile-accent-light': value(light, 'accent'),
    '--profile-font': presentationFont(profile.presentation?.font_family),
    '--profile-radius': presentationRadius(profile.presentation?.radius),
    '--profile-density': profile.presentation?.density === 'compact' ? '12px' : '20px',
    '--profile-border-style': profile.presentation?.border_style ?? 'solid',
  } as CSSProperties;
}
