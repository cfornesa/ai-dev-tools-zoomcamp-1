import { describe, expect, it } from 'vitest';

import { downloadBlob } from './downloadBlob';

describe('downloadBlob', () => {
  it('creates and clicks a synthetic <a download> anchor, then revokes the object URL', () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (() => {
      const url = `blob:fake-${created.length}`;
      created.push(url);
      return url;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      revoked.push(url);
    }) as typeof URL.revokeObjectURL;

    let clicked = false;
    let downloadAttr = '';
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = (tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        el.addEventListener('click', () => {
          clicked = true;
        });
        Object.defineProperty(el, 'download', {
          set(value: string) {
            downloadAttr = value;
          },
          get() {
            return downloadAttr;
          },
        });
      }
      return el;
    };
    document.createElement = createElementSpy as typeof document.createElement;

    try {
      downloadBlob(new Blob(['x']), 'my-file.png');
    } finally {
      document.createElement = originalCreateElement;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    expect(clicked).toBe(true);
    expect(downloadAttr).toBe('my-file.png');
    expect(created).toHaveLength(1);
    expect(revoked).toEqual(created);
  });
});
