/** Issue #742: persisted 3D camera placement and export contract. */
import fs from 'node:fs';

import JSZip from 'jszip';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const THREEJS_CUBE = `
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.z = 4;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(320, 240);
document.getElementById('art-piece-container').appendChild(renderer.domElement);
scene.add(new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
));
renderer.render(scene, camera);
`;

async function mockCamera(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const streamFactory = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const canvasContext = canvas.getContext('2d')!;
      canvasContext.fillStyle = '#2563eb';
      canvasContext.fillRect(0, 0, 32, 32);
      return (
        canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }
      ).captureStream(5);
    };
    const mediaDevices = window.navigator.mediaDevices;
    const mediaDevicesPrototype = Object.getPrototypeOf(mediaDevices) as MediaDevices;
    const getUserMedia = () => Promise.resolve(streamFactory());
    Object.defineProperty(mediaDevicesPrototype, 'getUserMedia', {
      configurable: true,
      value: getUserMedia,
    });
    Object.defineProperty(mediaDevices, 'getUserMedia', {
      configurable: true,
      writable: true,
      value: getUserMedia,
    });
  });
}

async function createPublishedPiece(
  context: BrowserContext,
  cameraPlacement: 'overlay' | 'background',
): Promise<{ publicId: string; slug: string }> {
  const created = await apiPost(context, '/api/art-pieces/', {
    title: `Camera placement ${cameraPlacement} #742`,
    description: 'Disposable camera placement contract fixture.',
    prompt: `A Three.js cube with camera ${cameraPlacement}`,
    engine: 'threejs',
    camera_placement: cameraPlacement,
    capabilities: {
      screenshot: true,
      sound: true,
      camera_view: true,
      hand_steering: true,
      fullscreen: true,
      immersive: true,
      download: true,
    },
    source: THREEJS_CUBE,
  });
  expect(created.status()).toBe(201);
  const piece = (await created.json()) as {
    public_id: string;
    public_slug: string;
    current_version?: { camera_placement?: 'overlay' | 'background' | null };
  };
  expect(piece.current_version?.camera_placement).toBe(cameraPlacement);
  const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
    status: 'published',
  });
  expect(published.status()).toBe(200);
  return { publicId: piece.public_id, slug: piece.public_slug };
}

async function downloadZip(page: import('@playwright/test').Page, label: string): Promise<JSZip> {
  await page.getByRole('button', { name: 'Open download menu' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  const file = await download;
  return JSZip.loadAsync(fs.readFileSync((await file.path())!));
}

async function gotoPublicPiece(
  page: import('@playwright/test').Page,
  publicId: string,
  label: string,
): Promise<void> {
  const response = await page.goto(`/art-pieces/p/${publicId}`, { waitUntil: 'domcontentloaded' });
  console.log(`[742] ${label} URL=${page.url()} status=${response?.status() ?? 'none'}`);
  expect(response?.status(), `${label} response status`).toBe(200);
  expect(page.url(), `${label} final URL`).toContain(`/art-pieces/p/${publicId}`);
}

test.describe('public 3D camera placement contract (#742)', () => {
  test('owner choice, live camera modes, geometry, labels, and ZIP variants', async ({
    page,
    context,
  }, testInfo) => {
    const fixtures = requireE2EFixtures();
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const overlay = await createPublishedPiece(context, 'overlay');
    const background = await createPublishedPiece(context, 'background');

    // The authenticated create response and detail projection prove that the
    // author-selected placement survives into the current version without
    // requiring an unrelated AI refinement run in this browser contract.
    const backgroundDetail = await apiGet(context, `/api/art-pieces/${background.publicId}/`);
    expect(backgroundDetail.status()).toBe(200);
    const detail = (await backgroundDetail.json()) as {
      current_version: { camera_placement: 'overlay' | 'background' };
    };
    expect(detail.current_version.camera_placement).toBe('background');

    const storageState = await context.storageState();
    const fakeBrowser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    try {
      const publicContext = await fakeBrowser.newContext({
        permissions: ['camera'],
        storageState,
      });
      await mockCamera(publicContext);
      const publicPage = await publicContext.newPage();
      try {
        for (const [mode, piece] of [
          ['overlay', overlay],
          ['background', background],
        ] as const) {
          await test.step(`${mode}: public route`, async () => {
            await gotoPublicPiece(publicPage, piece.publicId, `${mode} public route`);
          });
          const stage = publicPage.locator('.art-piece-stage');
          const frame = stage.locator('iframe[title="Art piece preview"]');
          await expect(frame).toBeVisible();
          const toolbar = publicPage.getByRole('toolbar', { name: 'Piece actions' });
          await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toHaveAttribute(
            'title',
            'Open download menu',
          );
          await toolbar.getByRole('button', { name: 'Open download menu' }).hover();
          await expect(
            toolbar.getByRole('button', { name: 'Open download menu' }).getByRole('tooltip'),
          ).toHaveText('Open download menu');

          await toolbar.getByRole('button', { name: 'Piece controls' }).click();
          const controls = stage.getByRole('group', { name: 'Camera view' });
          await expect(controls.getByRole('button', { name: 'Enable camera view' })).toBeVisible();
          const opacity = controls.getByRole('slider', { name: 'Camera overlay opacity' });
          await expect(opacity).toBeVisible();
          await controls.getByRole('button', { name: 'Enable camera view' }).click();
          await expect(stage.getByTestId('camera-status')).toContainText('Camera is active.');
          await opacity.fill('0.65');
          await expect(opacity).toHaveValue('0.65');

          const video = stage.locator('> video');
          await expect(video).toBeVisible();
          await expect(video).toHaveCSS('opacity', '0.65');
          const streamState = await video.evaluate((element) => {
            const stream = (element as HTMLVideoElement).srcObject as MediaStream | null;
            return {
              trackState: stream?.getVideoTracks()[0]?.readyState,
              trackCount: stream?.getVideoTracks().length ?? 0,
              zIndex: getComputedStyle(element).zIndex,
            };
          });
          expect(streamState.trackState).toBe('live');
          expect(streamState.trackCount).toBeGreaterThan(0);

          for (const viewport of [
            { name: 'desktop', width: 1440, height: 900 },
            { name: 'mobile', width: 375, height: 812 },
          ]) {
            await test.step(`${mode}: ${viewport.name} geometry`, async () => {
              await publicPage.setViewportSize(viewport);
              const geometry = await stage.evaluate((stageElement) => {
                const stageBox = stageElement.getBoundingClientRect();
                const videoElement = stageElement.querySelector('video');
                const videoBox = videoElement?.getBoundingClientRect();
                return {
                  stage: {
                    x: stageBox.x,
                    y: stageBox.y,
                    width: stageBox.width,
                    height: stageBox.height,
                  },
                  video: videoBox
                    ? {
                        x: videoBox.x,
                        y: videoBox.y,
                        width: videoBox.width,
                        height: videoBox.height,
                      }
                    : null,
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                };
              });
              expect(geometry.video).not.toBeNull();
              expect(geometry.video?.x).toBeCloseTo(geometry.stage.x, 0);
              expect(geometry.video?.y).toBeCloseTo(geometry.stage.y, 0);
              expect(geometry.video?.width).toBeCloseTo(geometry.stage.width, 0);
              expect(geometry.video?.height).toBeCloseTo(geometry.stage.height, 0);
              expect(geometry.video!.x).toBeGreaterThanOrEqual(geometry.stage.x - 1);
              expect(geometry.video!.y).toBeGreaterThanOrEqual(geometry.stage.y - 1);
              expect(geometry.video!.x + geometry.video!.width).toBeLessThanOrEqual(
                geometry.stage.x + geometry.stage.width + 1,
              );
              expect(geometry.video!.y + geometry.video!.height).toBeLessThanOrEqual(
                geometry.stage.y + geometry.stage.height + 1,
              );
              await publicPage.screenshot({
                path: testInfo.outputPath(`issue-742-${mode}-${viewport.name}.png`),
                fullPage: false,
              });
            });
          }

          await controls.getByRole('button', { name: 'Disable camera view' }).click();
          await expect(stage.getByTestId('camera-status')).toContainText('Camera is off.');
        }

        await test.step('background: export route', async () => {
          await gotoPublicPiece(publicPage, background.publicId, 'background export route');
        });
        const fullZip = await downloadZip(publicPage, 'Download Full ZIP');
        const fullHtml = await fullZip.files['index.html'].async('string');
        const fullCss = await fullZip.files['styles/piece.css'].async('string');
        expect(fullHtml).toContain('data-action="camera"');
        expect(fullHtml).toContain('navigator.mediaDevices.getUserMedia');
        expect(fullCss).toContain('background: transparent');
        expect(fullCss).toContain('z-index: 1');

        const nonCameraZip = await downloadZip(publicPage, 'Download Non-Camera ZIP');
        const nonCameraHtml = await nonCameraZip.files['index.html'].async('string');
        expect(nonCameraHtml).not.toContain('data-action="camera"');
        expect(nonCameraHtml).toContain('guardedGetUserMedia');
        expect(nonCameraHtml).not.toContain('zIndex = 0');
        expect(nonCameraHtml).not.toContain('camera-controls-host');
      } finally {
        await publicContext.close();
      }
    } finally {
      await fakeBrowser.close();
    }
  });
});
