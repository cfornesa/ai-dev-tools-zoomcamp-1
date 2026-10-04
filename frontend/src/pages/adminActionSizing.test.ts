import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('admin action sizing (#1032)', () => {
  it('keeps every admin action variant on the shared 44px shell sizing', () => {
    expect(css).toMatch(
      /\.admin-action-primary,\s*\.admin-action-secondary,\s*\.admin-action-danger\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*8px\s+16px;/s,
    );
  });

  it('applies the shared sizing to admin navigation links', () => {
    expect(css).toMatch(
      /\.admin-console-nav-button\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*8px\s+16px;/s,
    );
  });
});
