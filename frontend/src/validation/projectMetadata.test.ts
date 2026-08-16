import { describe, expect, it } from 'vitest';

import {
  validateProjectMetadataForPrivateSave,
  validateProjectMetadataForPublish,
} from './projectMetadata';

describe('validateProjectMetadataForPrivateSave', () => {
  it('accepts the default title and empty description of a brand-new project', () => {
    const errors = validateProjectMetadataForPrivateSave({
      title: 'Untitled animation',
      description: '',
    });

    expect(errors).toEqual({});
  });

  it('rejects a blank title', () => {
    const errors = validateProjectMetadataForPrivateSave({ title: '   ' });

    expect(errors.title).toBeDefined();
  });

  it('rejects more than the tag limit', () => {
    const errors = validateProjectMetadataForPrivateSave({
      tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
    });

    expect(errors.tags).toBeDefined();
  });

  it('rejects an overly long tag', () => {
    const errors = validateProjectMetadataForPrivateSave({ tags: ['x'.repeat(31)] });

    expect(errors.tags).toBeDefined();
  });

  it('accepts tags within limits', () => {
    const errors = validateProjectMetadataForPrivateSave({ tags: ['gesture', 'particles'] });

    expect(errors).toEqual({});
  });
});

describe('validateProjectMetadataForPublish', () => {
  it('rejects the default placeholder title', () => {
    const errors = validateProjectMetadataForPublish({
      title: 'Untitled animation',
      description: 'Something',
    });

    expect(errors.title).toBeDefined();
  });

  it('rejects an empty description', () => {
    const errors = validateProjectMetadataForPublish({ title: 'My cool piece', description: '' });

    expect(errors.description).toBeDefined();
  });

  it('accepts a meaningful title and description', () => {
    const errors = validateProjectMetadataForPublish({
      title: 'Pinch Bloom',
      description: 'A gesture-reactive particle bloom.',
    });

    expect(errors).toEqual({});
  });

  it('is strictly stronger than the private-save validator', () => {
    const lenient = validateProjectMetadataForPrivateSave({ title: 'Untitled animation' });
    const strict = validateProjectMetadataForPublish({ title: 'Untitled animation' });

    expect(lenient.title).toBeUndefined();
    expect(strict.title).toBeDefined();
  });
});
