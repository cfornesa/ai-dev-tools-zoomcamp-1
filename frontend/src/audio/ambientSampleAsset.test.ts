// See localProjectRepository.test.ts's own comment: fake-indexeddb's
// structured-clone emulation needs Node's Blob, not jsdom's, to round-trip
// through `put()` correctly.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadProject3DAmbientSampleSpy } = vi.hoisted(() => ({
  uploadProject3DAmbientSampleSpy: vi.fn().mockResolvedValue({
    asset_id: 'asset-1',
    mime_type: 'audio/mpeg',
    byte_size: 3,
  }),
}));

vi.mock('../api/projects3d', () => ({
  uploadProject3DAmbientSample: uploadProject3DAmbientSampleSpy,
}));

import {
  AmbientSampleUnsupportedType,
  getAmbientSampleMetadata,
  resolveAmbientSample,
  uploadAmbientSample,
} from './ambientSampleAsset';

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('uploadAmbientSample (#847/#1049)', () => {
  it('imports a supported audio file and returns its asset id', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'loop.mp3', { type: 'audio/mpeg' });

    const assetId = await uploadAmbientSample('piece-1', file);

    expect(typeof assetId).toBe('string');
    const blob = await resolveAmbientSample(assetId);
    expect(blob).not.toBeNull();
  });

  it('rejects a non-audio file before touching IndexedDB', async () => {
    const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

    await expect(uploadAmbientSample('piece-1', file)).rejects.toBeInstanceOf(
      AmbientSampleUnsupportedType,
    );
  });

  it('rejects samples over the shared server limit before local import', async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.mp3', {
      type: 'audio/mpeg',
    });

    await expect(uploadAmbientSample('piece-1', file)).rejects.toThrow('10MB or smaller');
  });

  it('syncs a selected sample to the server when the editor opts in', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'loop.mp3', { type: 'audio/mpeg' });

    const assetId = await uploadAmbientSample('piece-1', file, { syncToServer: true });

    expect(uploadProject3DAmbientSampleSpy).toHaveBeenCalledWith('piece-1', assetId, file);
  });

  it('binds the asset to the given piece id regardless of piece kind -- no schema constraint', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'loop.wav', { type: 'audio/wav' });

    // A server-backed Project3D/ArtPiece's public_id looks nothing like a
    // local 2D project id -- the point of #1049's finding is that this
    // storage layer never cared about the difference.
    const assetId = await uploadAmbientSample('server-project3d-public-id-uuid', file);
    const metadata = await getAmbientSampleMetadata('server-project3d-public-id-uuid', assetId);

    expect(metadata?.filename).toBe('loop.wav');
  });
});

describe('resolveAmbientSample', () => {
  it('returns null for an id that was never imported', async () => {
    const blob = await resolveAmbientSample('nonexistent-asset-id');
    expect(blob).toBeNull();
  });
});

describe('getAmbientSampleMetadata', () => {
  it('returns null when the piece has no media assets at all', async () => {
    const metadata = await getAmbientSampleMetadata('empty-piece', 'any-asset-id');
    expect(metadata).toBeNull();
  });

  it('returns null when the piece has other assets but not this id', async () => {
    const file = new File([new Uint8Array([1])], 'other.mp3', { type: 'audio/mpeg' });
    await uploadAmbientSample('piece-2', file);

    const metadata = await getAmbientSampleMetadata('piece-2', 'a-different-asset-id');
    expect(metadata).toBeNull();
  });
});
