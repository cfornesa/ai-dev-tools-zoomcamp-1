import type { ArtPieceLibrary } from '../api/artPieces';

/** Engines whose generated source can be edited and previewed in the owner editor. */
export const SOURCE_EDITABLE_ART_PIECE_ENGINES: ReadonlySet<ArtPieceLibrary> = new Set([
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
]);

export function supportsGeneratedSourceEditing(engine: ArtPieceLibrary): boolean {
  return SOURCE_EDITABLE_ART_PIECE_ENGINES.has(engine);
}
