import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { type PieceStageCapabilities, TWO_D_STAGE_CAPABILITIES } from './pieceStageCapabilities';
import PieceStageIcon from './PieceStageIcon';

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

function StageActionLabel({ children }: { children: string }) {
  return <span className="piece-stage-action-label">{children}</span>;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const menuTitleId = `${menuId}-title`;

  function closeMenu() {
    setMenuOpen(false);
    setDownloadOpen(false);
  }

  useEffect(() => {
    if (menuOpen) {
      menuWasOpen.current = true;
      menuCloseRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    if (menuWasOpen.current) {
      menuWasOpen.current = false;
      menuTriggerRef.current?.focus();
    }
  }, [menuOpen]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

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
      <button
        ref={menuTriggerRef}
        type="button"
        className="piece-stage-menu-trigger"
        aria-label={menuOpen ? 'Close piece controls menu' : 'Open piece controls menu'}
        aria-controls={menuId}
        aria-expanded={menuOpen}
        title={menuOpen ? 'Close piece controls menu' : 'Open piece controls menu'}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div
        id={menuId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={menuTitleId}
        className="piece-stage-command-overlay"
        hidden={!menuOpen}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <section className="piece-stage-command-card">
          <header className="piece-stage-command-header" onKeyDown={handleMenuKeyDown}>
            <h2 id={menuTitleId}>{ariaLabel}</h2>
            <button
              ref={menuCloseRef}
              type="button"
              className="piece-stage-command-close"
              aria-label="Close piece controls menu"
              title="Close piece controls menu"
              onClick={closeMenu}
            >
              ×
            </button>
          </header>
          <div
            onKeyDown={handleMenuKeyDown}
            role="group"
            aria-label={ariaLabel}
            className={className ?? 'piece-stage-toolbar-group'}
          >
            {capabilities.screenshot && onScreenshot && (
              <button
                type="button"
                className="piece-stage-icon-button"
                aria-label="Take screenshot"
                title="Take screenshot"
                onClick={() => void onScreenshot()}
              >
                <PieceStageIcon name="screenshot" />
                <StageActionLabel>Screenshot</StageActionLabel>
                <span className="piece-stage-tooltip" role="tooltip">
                  Take screenshot
                </span>
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
                  <PieceStageIcon name="download" />
                  <StageActionLabel>Download</StageActionLabel>
                  <span className="piece-stage-tooltip" role="tooltip">
                    Open download menu
                  </span>
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
                    className="piece-stage-submenu-close"
                    aria-label="Close download menu"
                    onClick={() => setDownloadOpen(false)}
                  >
                    × Close
                  </button>
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
                <PieceStageIcon name="immersive" />
                <StageActionLabel>Immersive</StageActionLabel>
                <span className="piece-stage-tooltip" role="tooltip">
                  View immersive piece
                </span>
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
                <PieceStageIcon name="fullscreen" />
                <StageActionLabel>
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </StageActionLabel>
                <span className="piece-stage-tooltip" role="tooltip">
                  {isFullscreen ? 'Exit fullscreen' : 'Expand piece to fullscreen'}
                </span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
