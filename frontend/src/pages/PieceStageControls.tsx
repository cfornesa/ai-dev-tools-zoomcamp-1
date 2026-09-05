import { useEffect, useState, type RefObject } from 'react';

import type { ArtPieceCapabilitySet, ArtPieceLibrary } from '../api/artPieces';
import { ART_PIECE_BRIDGE_VERSION } from '../generative/artPieceSandbox';
import {
  generateArtPieceBundle,
  triggerArtPieceBundleDownload,
} from '../generative/artPieceBundle';
import { downloadBlob } from '../export/downloadBlob';
import { screenshotFilename } from '../export/captureLiveScreenshot';
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
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(0.2);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [microphoneState, setMicrophoneState] = useState<
    'off' | 'active' | 'denied' | 'unavailable'
  >('off');
  const [cameraState, setCameraState] = useState<
    'off' | 'active' | 'denied' | 'unavailable' | 'ended'
  >('off');
  const [cameraOpacity, setCameraOpacity] = useState(0.5);
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(stageRef);
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        source?: string;
        status?: string;
        message?: string;
        data?: string;
        filename?: string;
        enabled?: boolean;
        volume?: number;
        active?: boolean;
        error?: string;
        key?: string;
        frequency?: number;
        opacity?: number;
      } | null;
      if (data?.source !== 'art-piece-sandbox') return;
      if (data.status === 'error') {
        setScreenshotError(data.message || 'The art piece could not complete that action.');
      }
      if (data.status === 'screenshot' && data.data) {
        try {
          const [header, encoded] = data.data.split(',', 2);
          const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
          const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
          downloadBlob(
            new Blob([bytes], { type: mime }),
            data.filename || 'art-piece-screenshot.png',
          );
        } catch {
          setScreenshotError('Screenshot failed: the captured artwork was not a valid image.');
        }
      }
      // Issue #430: these reflect the sandbox's *acknowledged* runtime
      // state (posted only after the AudioContext/getUserMedia call
      // actually succeeded or failed), never an optimistic update made
      // just because a command was sent.
      if (data.status === 'sound') {
        if (typeof data.enabled === 'boolean') setSoundOn(data.enabled);
        if (typeof data.volume === 'number') setVolume(data.volume);
      }
      if (data.status === 'microphone') {
        if (data.active) setMicrophoneState('active');
        else if (data.error === 'denied') setMicrophoneState('denied');
        else if (data.error === 'unavailable') setMicrophoneState('unavailable');
        else setMicrophoneState('off');
      }
      if (data.status === 'note' && typeof data.key === 'string') {
        setLastNote(data.key);
      }
      // Issue #431: same acknowledged-state convention as sound/
      // microphone -- 'ended' covers a real device disconnect/stream
      // termination mid-session, distinct from an explicit disable.
      if (data.status === 'camera') {
        if (data.active) setCameraState('active');
        else if (data.error === 'denied') setCameraState('denied');
        else if (data.error === 'unavailable') setCameraState('unavailable');
        else if (data.error === 'ended') setCameraState('ended');
        else setCameraState('off');
        if (typeof data.opacity === 'number') setCameraOpacity(data.opacity);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [iframeRef]);
  function command(type: string, extra?: Record<string, unknown>) {
    if (type === 'screenshot') setScreenshotError(null);
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'art-piece-parent',
        version: ART_PIECE_BRIDGE_VERSION,
        type,
        filename: screenshotFilename(title || 'art-piece'),
        ...extra,
      },
      '*',
    );
  }
  async function downloadPiece(label: string) {
    setDownloadError(null);
    try {
      const mode = label === 'non-camera' ? 'non-camera' : 'full';
      const blob = await generateArtPieceBundle(library, source, { capabilities, mode });
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
          <button
            type="button"
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            onClick={() => command('toggle-sound')}
          >
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
          {capabilities.sound && (
            <div role="group" aria-label="Sound">
              <p data-testid="sound-status">
                {soundOn ? `Sound is on at ${Math.round(volume * 100)}% volume.` : 'Sound is off.'}
              </p>
              <label htmlFor="art-piece-volume">Sound volume</label>
              <input
                id="art-piece-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                disabled={!soundOn}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setVolume(value);
                  command('set-volume', { value });
                }}
              />
            </div>
          )}
          {capabilities.keyboard && (
            <p data-testid="keyboard-note-status">
              {soundOn
                ? lastNote
                  ? `Last note played: ${lastNote}.`
                  : 'Keyboard notes available. Press A-K over the piece to play a note.'
                : 'Turn on Sound to play keyboard notes.'}
            </p>
          )}
          {capabilities.microphone && (
            <div role="group" aria-label="Microphone">
              <button
                type="button"
                aria-pressed={microphoneState === 'active'}
                onClick={() =>
                  command(microphoneState === 'active' ? 'disable-microphone' : 'enable-microphone')
                }
              >
                {microphoneState === 'active' ? 'Disable microphone' : 'Enable microphone'}
              </button>
              <p data-testid="microphone-status">
                {microphoneState === 'active' && 'Microphone is active.'}
                {microphoneState === 'denied' && 'Microphone access was denied.'}
                {microphoneState === 'unavailable' && 'Microphone is unavailable in this browser.'}
                {microphoneState === 'off' && 'Microphone is off.'}
              </p>
            </div>
          )}
          {capabilities.camera_view && (
            <div role="group" aria-label="Camera view">
              <button
                type="button"
                aria-pressed={cameraState === 'active'}
                onClick={() =>
                  command(cameraState === 'active' ? 'disable-camera' : 'enable-camera')
                }
              >
                {cameraState === 'active' ? 'Disable camera view' : 'Enable camera view'}
              </button>
              <p data-testid="camera-status">
                {cameraState === 'active' && 'Camera is active.'}
                {cameraState === 'denied' && 'Camera access was denied.'}
                {cameraState === 'unavailable' && 'Camera is unavailable in this browser.'}
                {cameraState === 'ended' && 'Camera stream ended unexpectedly.'}
                {cameraState === 'off' && 'Camera is off.'}
              </p>
              <label htmlFor="art-piece-camera-opacity">Camera overlay opacity</label>
              <input
                id="art-piece-camera-opacity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={cameraOpacity}
                disabled={cameraState !== 'active'}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setCameraOpacity(value);
                  command('set-camera-opacity', { value });
                }}
              />
            </div>
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
      {screenshotError && <p role="alert">{screenshotError}</p>}
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
