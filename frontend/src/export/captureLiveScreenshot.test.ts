import { describe, expect, it } from 'vitest';

import {
  captureLiveScreenshot,
  LiveScreenshotError,
  screenshotFilename,
} from './captureLiveScreenshot';

function fakeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('captureLiveScreenshot', () => {
  it('rejects with LiveScreenshotError when no canvas is given', async () => {
    await expect(captureLiveScreenshot(null)).rejects.toBeInstanceOf(LiveScreenshotError);
  });

  it('rejects with LiveScreenshotError for a zero-size canvas', async () => {
    await expect(captureLiveScreenshot(fakeCanvas(0, 0))).rejects.toThrow(/no preview canvas/i);
  });

  it('resolves a PNG Blob for a real canvas', async () => {
    const canvas = fakeCanvas(10, 10);
    const blob = await captureLiveScreenshot(canvas);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('never mutates the canvas element itself', async () => {
    const canvas = fakeCanvas(10, 10);
    const before = { width: canvas.width, height: canvas.height };
    await captureLiveScreenshot(canvas);
    expect(canvas.width).toBe(before.width);
    expect(canvas.height).toBe(before.height);
  });
});

describe('screenshotFilename', () => {
  it('builds a lowercase, dash-separated, .png filename from a title', () => {
    const filename = screenshotFilename('My Cool Scene!!');
    expect(filename).toMatch(/^my-cool-scene-screenshot-\d+\.png$/);
  });

  it('falls back to "scene" for an empty/unusable base', () => {
    const filename = screenshotFilename('   ');
    expect(filename).toMatch(/^scene-screenshot-\d+\.png$/);
  });

  it('produces distinct filenames for repeated captures over time', async () => {
    const first = screenshotFilename('Same title');
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = screenshotFilename('Same title');
    expect(first).not.toBe(second);
  });
});
