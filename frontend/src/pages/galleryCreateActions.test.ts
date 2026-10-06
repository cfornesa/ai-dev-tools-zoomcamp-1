import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ART_PIECE_ENGINE_CAPABILITIES, type ArtPieceLibrary } from '../api/artPieces';
import { getArtPieceStarter } from '../generative/artPieceStarters';
import * as repository from '../storage/localProjectRepository';
import { createLocalGeneratedPiece } from './galleryCreateActions';

vi.mock('../api/templates');
vi.mock('../storage/localProjectRepository');

const mockedOpen = vi.mocked(repository.openLocalProjectDatabase);
const mockedCreateGenerated = vi.mocked(repository.createLocalGeneratedProject);
const db = { close: vi.fn() } as unknown as IDBDatabase;

beforeEach(() => {
  vi.clearAllMocks();
  mockedOpen.mockResolvedValue(db);
  mockedCreateGenerated.mockResolvedValue({ project: { id: 'local-piece' } } as never);
});

describe('createLocalGeneratedPiece starters', () => {
  it.each(Object.keys(ART_PIECE_ENGINE_CAPABILITIES) as ArtPieceLibrary[])(
    'creates a local %s piece from its matching starter source',
    async (library) => {
      await expect(createLocalGeneratedPiece('e2e_split', library)).resolves.toBe(
        '/local-generated/local-piece',
      );
      expect(mockedCreateGenerated).toHaveBeenCalledWith(db, {
        ownerId: 'e2e_split',
        title:
          library === 'svg'
            ? 'Local generated SVG'
            : `Local ${ART_PIECE_ENGINE_CAPABILITIES[library].label} starter`,
        description: `A local-only ${ART_PIECE_ENGINE_CAPABILITIES[library].label} starter. Edit the source and save versions without server transfer.`,
        engine: library,
        source: getArtPieceStarter(library),
      });
      expect(db.close).toHaveBeenCalled();
    },
  );
});
