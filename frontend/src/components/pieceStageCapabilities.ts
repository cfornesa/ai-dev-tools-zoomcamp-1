export type PieceStageCapabilities = {
  screenshot: boolean;
  download: false | 'html' | 'zip';
  immersive: boolean;
  sound: boolean;
  pieceControls: boolean;
  gesture: boolean;
  gestureGuide: boolean;
  fullscreen: boolean;
};

/** Capabilities currently implemented by the structured 2D runtime. */
export const TWO_D_STAGE_CAPABILITIES: PieceStageCapabilities = {
  screenshot: true,
  download: 'html',
  immersive: false,
  sound: false,
  pieceControls: false,
  gesture: false,
  gestureGuide: false,
  fullscreen: true,
};

/** Capabilities currently implemented by the structured Three.js runtime. */
export const THREE_D_STAGE_CAPABILITIES: PieceStageCapabilities = {
  screenshot: true,
  download: 'zip',
  immersive: true,
  sound: true,
  pieceControls: true,
  gesture: true,
  gestureGuide: true,
  fullscreen: true,
};
