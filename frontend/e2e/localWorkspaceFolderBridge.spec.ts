import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

type BrowserBridgeHandle = {
  kind: 'directory';
  queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied'>;
  requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied'>;
  getFileHandle(name: string): Promise<{
    kind: 'file';
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
  entries(): AsyncIterableIterator<[string, { kind: 'file'; name: string }]>;
};

type BrowserBridgeModule = {
  pickFolder(): Promise<BrowserBridgeHandle>;
  listArchiveFiles(handle: BrowserBridgeHandle): Promise<string[]>;
  readArchiveFile(handle: BrowserBridgeHandle, filename: string): Promise<Uint8Array>;
  writeArchiveFile(handle: BrowserBridgeHandle, filename: string, blob: Blob): Promise<void>;
  getHandlePermissionStatus(handle: BrowserBridgeHandle): Promise<string>;
};

async function exerciseMockedNativeBridge(page: Page) {
  return page.evaluate(async () => {
    const bridge = (await new Function(
      'return import("/src/storage/folderArchiveBridge.ts")',
    )()) as BrowserBridgeModule;
    let permission: 'granted' | 'denied' = 'granted';
    let revoked = false;
    let archive = new Blob(['before'], { type: 'application/zip' });
    const file = {
      kind: 'file' as const,
      name: 'workspace.zip',
      async getFile() {
        return new File([archive], 'workspace.zip', { type: 'application/zip' });
      },
      async createWritable() {
        return {
          async write(next: Blob) {
            archive = next;
          },
          async close() {},
        };
      },
    };
    const handle = {
      kind: 'directory' as const,
      name: 'workspace',
      async queryPermission() {
        if (revoked) throw new DOMException('revoked', 'NotFoundError');
        return permission;
      },
      async requestPermission() {
        return permission;
      },
      async getFileHandle(name: string) {
        if (name !== 'workspace.zip') throw new DOMException('missing', 'NotFoundError');
        return file;
      },
      async *entries() {
        yield ['workspace.zip', file] as const;
        yield ['notes.txt', { kind: 'file', name: 'notes.txt' } as never] as const;
        yield ['../escape.zip', file] as const;
      },
    };
    (window as Window & { showDirectoryPicker?: () => Promise<unknown> }).showDirectoryPicker =
      async () => handle;

    const selected = await bridge.pickFolder();
    const files = await bridge.listArchiveFiles(selected);
    const before = new TextDecoder().decode(
      await bridge.readArchiveFile(selected, 'workspace.zip'),
    );
    await bridge.writeArchiveFile(selected, 'workspace.zip', new Blob(['after']));
    const after = new TextDecoder().decode(await bridge.readArchiveFile(selected, 'workspace.zip'));
    permission = 'denied';
    const denied = await bridge.getHandlePermissionStatus(selected);
    revoked = true;
    const revokedStatus = await bridge.getHandlePermissionStatus(selected);

    return { files, before, after, denied, revokedStatus };
  });
}

test.describe('Local workspace folder bridge (#534)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`covers grant, safe listing, reload, denial, and revocation at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings/storage');
      await expect(page.getByRole('heading', { name: 'Manage local projects' })).toBeVisible();
      const first = await exerciseMockedNativeBridge(page);
      expect(first).toEqual({
        files: ['workspace.zip'],
        before: 'before',
        after: 'after',
        denied: 'denied',
        revokedStatus: 'revoked',
      });

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Manage local projects' })).toBeVisible();
      const afterReload = await exerciseMockedNativeBridge(page);
      expect(afterReload.files).toEqual(['workspace.zip']);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('local-storage-folder-bridge.png') });
    });
  }
});
