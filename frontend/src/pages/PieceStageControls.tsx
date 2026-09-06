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
  /** Issue #448: which downloadable ZIP shape `downloadPiece` below
   * builds -- `PublicArtPieceViewer.tsx` never passes this (defaulting
   * to the regular small-stage export), `ImmersiveArtPieceViewer.tsx`
   * passes `'immersive'` so its own download buttons produce the
   * full-viewport walkable export instead of the regular one. */
  presentation?: 'regular' | 'immersive';
};

function PieceStageControls({
  stageRef,
  iframeRef,
  capabilities,
  immersiveHref,
  library,
  source,
  title,
  presentation = 'regular',
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
  const [steeringState, setSteeringState] = useState<
    'off' | 'active' | 'camera-required' | 'no-camera-registered' | 'unsupported-engine'
  >('off');
  const [steeringPose, setSteeringPose] = useState<{ x: number; y: number; z: number } | null>(
    null,
  );
  // Issue #455: the real hand-tracking model's own preparation status --
  // distinct from `steeringState`, since steering can already be "active"
  // while the model is still downloading (the first frame it can drive
  // arrives once loading finishes).
  const [handTrackingModelState, setHandTrackingModelState] = useState<
    'idle' | 'loading' | 'ready' | 'failed'
  >('idle');
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
        pose?: { x: number; y: number; z: number };
        modelStatus?: string;
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
      // Issue #432: activation is gated (engine/camera/registration) --
      // each rejection reason is its own distinct, actionable state, not
      // a generic "off" that hides why steering never actually started.
      if (data.status === 'steering') {
        if (data.active) setSteeringState('active');
        else if (data.error === 'camera-required') setSteeringState('camera-required');
        else if (data.error === 'no-camera-registered') setSteeringState('no-camera-registered');
        else if (data.error === 'unsupported-engine') setSteeringState('unsupported-engine');
        else if (!data.error) setSteeringState('off');
        if (data.pose) setSteeringPose(data.pose);
      }
      // Issue #455: the real hand-tracking model's own load lifecycle,
      // reported separately from `steeringState` above -- steering can
      // read as "active" (activation succeeded) while the model backing
      // it is still downloading.
      if (data.status === 'hand-tracking-model') {
        if (data.modelStatus === 'loading') setHandTrackingModelState('loading');
        else if (data.modelStatus === 'ready') setHandTrackingModelState('ready');
        else if (data.modelStatus === 'failed') setHandTrackingModelState('failed');
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
      const blob = await generateArtPieceBundle(library, source, {
        capabilities,
        mode,
        presentation,
      });
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
            <div role="group" aria-label="Hand steering">
              <button
                type="button"
                aria-pressed={steeringState === 'active'}
                onClick={() =>
                  command(
                    steeringState === 'active' ? 'disable-hand-steering' : 'enable-hand-steering',
                  )
                }
              >
                {steeringState === 'active' ? 'Stop steering' : 'Steer the piece'}
              </button>
              <p data-testid="steering-status">
                {steeringState === 'active' && 'Steering is active.'}
                {steeringState === 'camera-required' && 'Turn on Camera view before steering.'}
                {steeringState === 'no-camera-registered' &&
                  'This piece has no steerable camera to control yet.'}
                {steeringState === 'unsupported-engine' &&
                  'Hand steering is only available for 3D pieces.'}
                {steeringState === 'off' && 'Steering is off.'}
              </p>
              {steeringState === 'active' && (
                <p data-testid="hand-tracking-model-status">
                  {handTrackingModelState === 'loading' &&
                    'Preparing hand tracking… keep your hand in view once it is ready.'}
                  {handTrackingModelState === 'ready' && 'Hand tracking is ready.'}
                  {handTrackingModelState === 'failed' &&
                    'Hand tracking could not be prepared. Steering will not respond to gestures.'}
                </p>
              )}
              {steeringPose && (
                <p data-testid="steering-pose">
                  {steeringPose.x.toFixed(2)},{steeringPose.y.toFixed(2)},
                  {steeringPose.z.toFixed(2)}
                </p>
              )}
            </div>
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
