import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);

  return channels.reduce((total, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function lightAccent(): string {
  const lightTheme = css.match(/:root\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)?.[1];
  const accent = lightTheme?.match(/--accent:\s*(#[0-9a-f]{6})/i)?.[1];
  if (!accent) throw new Error('Light theme accent token not found');
  return accent;
}

describe('light theme accent contrast', () => {
  it('keeps accent text and white text on accent at the WCAG AA floor', () => {
    const accent = lightAccent();
    const ratio = contrastRatio(accent, '#ffffff');

    expect(accent).toBe('#aa35ff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(4.504, 3);
    expect(contrastRatio('#ffffff', accent)).toBeGreaterThanOrEqual(4.5);
  });
});
