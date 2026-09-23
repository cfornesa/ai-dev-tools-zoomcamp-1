import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('public piece page heading styles (#738)', () => {
  it('uses the configured heading token and shared page-title scale', () => {
    expect(css).toMatch(
      /\.public-piece-page-heading\s*\{[^}]*font-family:\s*var\(--heading\);[^}]*font-size:\s*clamp\(1\.35rem,\s*4vw,\s*2rem\);/s,
    );
  });

  it('uses the site density for regular and immersive page-container top spacing', () => {
    expect(css).toMatch(
      /\.public-project-viewer\s*\{[^}]*padding:\s*var\(--site-density\)\s+24px\s+24px;/s,
    );
    expect(css).toMatch(
      /\.public-art-piece-viewer\s*\{[^}]*padding:\s*var\(--site-density\)\s+24px\s+24px;/s,
    );
    expect(css).toMatch(
      /\.immersive-project3d-viewer\s*\{[^}]*padding:\s*var\(--site-density\)\s+24px\s+24px;/s,
    );
  });

  it('preserves chrome-less embed spacing while styling immersive info headings', () => {
    expect(css).toMatch(
      /\.public-project-viewer\[data-embed-route='true'\]\s*\{[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.public-art-piece-viewer\[data-embed-route='true'\]\s*\{[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.immersive-project3d-viewer \.public-piece-page-heading,\s*\.immersive-art-piece-viewer \.public-piece-page-heading/s,
    );
  });
});
