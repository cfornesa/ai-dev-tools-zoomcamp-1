import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { cleanupExportGenerator, writeTempArtifact } from '../../e2e/support/exportHarness';

describe('export artifact harness teardown', () => {
  it('removes artifacts when setup fails before a generator exists', async () => {
    const { filePath } = writeTempArtifact('setup-failed.html', '<html></html>');

    await expect(cleanupExportGenerator(undefined)).resolves.toBeUndefined();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('closes an initialized generator and removes its artifacts', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const { filePath } = writeTempArtifact('setup-succeeded.html', '<html></html>');

    await cleanupExportGenerator({ close });

    expect(close).toHaveBeenCalledOnce();
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
