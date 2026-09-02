import { useState, type RefObject } from 'react';

import type { ArtPieceCapabilitySet } from '../api/artPieces';
import { ART_PIECE_BRIDGE_VERSION } from '../generative/artPieceSandbox';
import {
  generateArtPieceBundle,
  triggerArtPieceBundleDownload,
} from '../generative/artPieceBundle';
import type { ArtPieceLibrary } from '../api/artPieces';
import { useFullscreenToggle } from './useFullscreenToggle';

type Props = {
  stageRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  capabilities: ArtPieceCapabilitySet;
  immersiveHref: string;
  library: ArtPieceLibrary;
  source: string;
  title: string;
};

function PieceStageControls({
  stageRef,
  iframeRef,
  capabilities,
  immersiveHref,
  library,
  source,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(stageRef);
  function command(type: string) {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'art-piece-parent', version: ART_PIECE_BRIDGE_VERSION, type },
      '*',
    );
  }
  async function downloadPiece(label: string) {
    setDownloadError(null);
    try {
      const blob = await generateArtPieceBundle(library, source);
      triggerArtPieceBundleDownload(blob, `${title || 'art-piece'}-${label}.zip`);
      setOpen(false);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed.');
    }
  }
  return (
    <>
      <div className="piece-stage-toolbar" role="toolbar" aria-label="Piece actions">
        {capabilities.screenshot !== false && (
          <button type="button" aria-label="Take screenshot" onClick={() => command('screenshot')}>
            ⌗
          </button>
        )}
        {capabilities.download !== false && (
          <button
            type="button"
            aria-label="Open download menu"
            onClick={() => setOpen((value) => !value)}
          >
            ↓
          </button>
        )}
        {capabilities.sound && (
          <button type="button" aria-label="Mute sound" onClick={() => command('toggle-sound')}>
            ♪
          </button>
        )}
        {capabilities.immersive && (
          <a href={immersiveHref} aria-label="View immersive piece">
            ◈
          </a>
        )}
        {capabilities.fullscreen !== false && (
          <button
            type="button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand fullscreen'}
            onClick={toggleFullscreen}
          >
            ⛶
          </button>
        )}
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Piece controls"
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
        <button type="button" aria-label="Show hand gesture guide" onClick={() => setGuide(true)}>
          ✋
        </button>
      </div>
      {open && (
        <div role="region" aria-label="Piece controls">
          {capabilities.download !== false && (
            <div role="group" aria-label="Download options">
              <button type="button" onClick={() => void downloadPiece('full')}>
                Download full piece
              </button>
              <button type="button" onClick={() => void downloadPiece('non-camera')}>
                Download non-camera piece
              </button>
            </div>
          )}
          {capabilities.sound && <p>Sound controls available.</p>}
          {capabilities.keyboard && <p>Keyboard notes available.</p>}
          {capabilities.microphone && (
            <button type="button" onClick={() => command('enable-microphone')}>
              Enable microphone
            </button>
          )}
          {capabilities.camera_view && (
            <button type="button" onClick={() => command('enable-camera')}>
              Enable camera view
            </button>
          )}
          {capabilities.hand_steering && (
            <button type="button" onClick={() => command('enable-hand-steering')}>
              Steer the piece
            </button>
          )}
          <button type="button" onClick={() => command('reset-view')}>
            Reset view
          </button>
          {downloadError && <p role="alert">{downloadError}</p>}
        </div>
      )}
      {guide && (
        <div role="dialog" aria-label="Hand gesture guide" aria-modal="true">
          <h3>Hand gesture guide</h3>
          <ol>
            <li>Look around with an open hand.</li>
            <li>Move your hand to orbit.</li>
            <li>Pinch to zoom.</li>
            <li>Release to stop.</li>
            <li>Disable steering safely from Piece controls.</li>
          </ol>
          <button type="button" onClick={() => setGuide(false)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}

export default PieceStageControls;
