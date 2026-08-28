import { describe, expect, it } from 'vitest';

import {
  ART_PIECE_IFRAME_SANDBOX,
  ART_PIECE_SANDBOX_MESSAGE_SOURCE,
  buildArtPieceSandboxDocument,
  parseArtPieceSandboxMessage,
} from './artPieceSandbox';

const SNIPPET = '<canvas id="art-piece-canvas"></canvas><script>document.title = "hi";</script>';

describe('ART_PIECE_IFRAME_SANDBOX', () => {
  it('never includes allow-same-origin or any other capability beyond allow-scripts', () => {
    expect(ART_PIECE_IFRAME_SANDBOX).toBe('allow-scripts');
    expect(ART_PIECE_IFRAME_SANDBOX).not.toMatch(/allow-same-origin/);
    expect(ART_PIECE_IFRAME_SANDBOX.split(' ')).toEqual(['allow-scripts']);
  });
});

describe('buildArtPieceSandboxDocument', () => {
  it('embeds a strict, network-blocking Content-Security-Policy meta tag', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("default-src 'none'");
  });

  it('places the error/ready listener script before the untrusted snippet in document order', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    const listenerIndex = doc.indexOf('addEventListener');
    const snippetIndex = doc.indexOf(SNIPPET);
    expect(listenerIndex).toBeGreaterThan(-1);
    expect(snippetIndex).toBeGreaterThan(-1);
    expect(listenerIndex).toBeLessThan(snippetIndex);
  });

  it('embeds the snippet verbatim, unmodified', () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).toContain(SNIPPET);
  });

  it("never references this app's own API/session surface", () => {
    const doc = buildArtPieceSandboxDocument(SNIPPET);
    expect(doc).not.toMatch(/\/api\//);
    expect(doc).not.toMatch(/document\.cookie/);
  });
});

describe('parseArtPieceSandboxMessage', () => {
  it('parses a ready message', () => {
    expect(
      parseArtPieceSandboxMessage({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' }),
    ).toEqual({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' });
  });

  it('parses an error message with its text', () => {
    expect(
      parseArtPieceSandboxMessage({
        source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
        status: 'error',
        message: 'boom',
      }),
    ).toEqual({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'error', message: 'boom' });
  });

  it('falls back to a generic message when an error carries no string message', () => {
    expect(
      parseArtPieceSandboxMessage({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'error' }),
    ).toEqual({
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'error',
      message: 'Unknown error.',
    });
  });

  it('rejects messages from a different source, unknown status, or non-object data', () => {
    expect(parseArtPieceSandboxMessage({ source: 'something-else', status: 'ready' })).toBeNull();
    expect(
      parseArtPieceSandboxMessage({ source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'other' }),
    ).toBeNull();
    expect(parseArtPieceSandboxMessage('not an object')).toBeNull();
    expect(parseArtPieceSandboxMessage(null)).toBeNull();
    expect(parseArtPieceSandboxMessage(undefined)).toBeNull();
  });
});
