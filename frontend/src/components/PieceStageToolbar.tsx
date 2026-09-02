import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { type PieceStageCapabilities, TWO_D_STAGE_CAPABILITIES } from './pieceStageCapabilities';

export type PieceStageToolbarProps = {
  onScreenshot?: () => void | Promise<void>;
  onDownload?: (variant?: 'full' | 'non-camera') => void | Promise<void>;
  immersiveHref?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void | Promise<void>;
  soundControl?: ReactNode;
  controlsControl?: ReactNode;
  gestureControl?: ReactNode;
  gestureGuide?: ReactNode;
  editorControls?: ReactNode;
  ariaLabel?: string;
  className?: string;
  downloadFormat?: 'html' | 'zip';
  capabilities?: PieceStageCapabilities;
};

/**
 * Shared stage chrome for authored pieces. Surface-specific capabilities are
 * passed in as controls, but the order, labels, icon-only presentation, and
 * download menu are intentionally owned here so editor/public/embed/immersive
 * surfaces cannot drift apart.
 */
export default function PieceStageToolbar({
  onScreenshot,
  onDownload,
  immersiveHref,
  isFullscreen = false,
  onToggleFullscreen,
  soundControl,
  controlsControl,
  gestureControl,
  gestureGuide,
  editorControls,
  ariaLabel = 'Piece actions',
  className,
  downloadFormat = 'html',
  capabilities = TWO_D_STAGE_CAPABILITIES,
}: PieceStageToolbarProps) {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !downloadRef.current?.contains(target)) {
        setDownloadOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [downloadOpen]);

  return (
    <div role="toolbar" aria-label={ariaLabel} className="piece-stage-toolbar">
      <div role="group" aria-label={ariaLabel} className={className ?? 'piece-stage-toolbar-group'}>
        {capabilities.screenshot && onScreenshot && (
          <button
            type="button"
            className="piece-stage-icon-button"
            aria-label="Take screenshot"
            title="Take screenshot"
            onClick={() => void onScreenshot()}
          >
            <span aria-hidden="true">⌗</span>
          </button>
        )}
        {capabilities.download && onDownload && (
          <div ref={downloadRef} className="piece-stage-download">
            <button
              type="button"
              className="piece-stage-icon-button"
              aria-label="Open download menu"
              title="Open download menu"
              aria-haspopup="true"
              aria-expanded={downloadOpen}
              onClick={() => setDownloadOpen((current) => !current)}
            >
              <span aria-hidden="true">↓</span>
            </button>
            <div
              data-piece-stage-download-menu
              role="menu"
              aria-label="Download piece"
              className="piece-stage-download-menu"
              hidden={!downloadOpen}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDownloadOpen(false);
                  void onDownload('full');
                }}
              >
                Download Full{downloadFormat === 'zip' ? ' ZIP' : ''}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDownloadOpen(false);
                  void onDownload('non-camera');
                }}
              >
                Download Non-Camera{downloadFormat === 'zip' ? ' ZIP' : ''}
              </button>
            </div>
          </div>
        )}
        {capabilities.immersive && immersiveHref && (
          <a
            className="piece-stage-icon-button"
            href={immersiveHref}
            target="_blank"
            rel="noreferrer"
            aria-label="View immersive piece"
            title="View immersive piece"
          >
            <span aria-hidden="true">◈</span>
          </a>
        )}
        {capabilities.sound && soundControl}
        {capabilities.pieceControls && controlsControl}
        {capabilities.gesture && gestureControl}
        {capabilities.gestureGuide && gestureGuide}
        {editorControls}
        {capabilities.fullscreen && onToggleFullscreen && (
          <button
            type="button"
            className="piece-stage-icon-button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand piece to fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Expand piece to fullscreen'}
            aria-pressed={isFullscreen}
            onClick={() => void onToggleFullscreen()}
          >
            <span aria-hidden="true">⛶</span>
          </button>
        )}
      </div>
    </div>
  );
}
