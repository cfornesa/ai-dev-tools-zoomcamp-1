import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { ArtPieceCapabilitySet, ArtPieceLibrary, CameraPlacement } from '../api/artPieces';
import type { SonicDefaults } from '../audio/sonicContract';
import {
  ART_PIECE_BRIDGE_VERSION,
  isValidArtPieceSoundCommand,
} from '../generative/artPieceSandbox';
import {
  generateArtPieceBundle,
  triggerArtPieceBundleDownload,
} from '../generative/artPieceBundle';
import { downloadBlob } from '../export/downloadBlob';
import { screenshotFilename } from '../export/captureLiveScreenshot';
import { categorizeProviderError } from '../components/cameraFailure';
import {
  readSoundSettings,
  resetSoundSettings,
  writeSoundSettings,
  type SoundSettings,
  soundSettingsFromSonic,
} from '../audio/soundSettings';
import { createHandSignalExtractor, type HandSignals } from '../tracking/handSignals';
import { createMediaPipeTrackingProvider } from '../tracking/mediapipeProvider';
import type { TrackingProvider, TrackingProviderError } from '../tracking/types';
import PieceStageIcon from '../components/PieceStageIcon';
import PieceStageToolbar from '../components/PieceStageToolbar';
import type { PieceStageCapabilities } from '../components/pieceStageCapabilities';
import { useFullscreenToggle } from './useFullscreenToggle';
import {
  visitorStrokeIntersects,
  type VisitorPoint,
  type VisitorStroke,
  type VisitorTool,
} from './visitorDrawing';
import {
  commitVisitorHistory,
  createVisitorHistory,
  redoVisitorHistory,
  undoVisitorHistory,
  type VisitorHistory,
} from './visitorDrawingHistory';

// Issue #479: real camera capture and hand-tracking now run entirely in
// this trusted parent frame (never inside the sandboxed iframe --
// getUserMedia unconditionally throws SecurityError from an opaque
// origin). This reuses the exact same MediaPipe GestureRecognizer stack
// (`mediapipeProvider.ts`) and EMA-smoothed hand signals (`handSignals.ts`)
// Scene3DPreview.tsx's own "Steer the piece" already uses -- not a second,
// independently-built tracking pipeline. Sensitivity constants match the
// values #455's own (now-removed) in-sandbox implementation used.
const HAND_PAN_SENSITIVITY = 6;
const HAND_ZOOM_SENSITIVITY = 20;

type Props = {
  stageRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  capabilities: ArtPieceCapabilitySet;
  immersiveHref: string;
  library: ArtPieceLibrary;
  source: string;
  /** #776: the owner's ink layer, carried into the ZIP export. */
  ink?: unknown;
  cameraPlacement?: CameraPlacement | null;
  pieceId: string;
  title: string;
  /** Regular public viewers render the toolbar above the stage, then move it
   * into the fullscreen host while the stage owns native fullscreen. */
  toolbarPortalTarget?: HTMLElement | null;
  fullscreenToolbarPortalTarget?: HTMLElement | null;
  /** Issue #448: which downloadable ZIP shape `downloadPiece` below
   * builds -- `PublicArtPieceViewer.tsx` never passes this (defaulting
   * to the regular small-stage export), `ImmersiveArtPieceViewer.tsx`
   * passes `'immersive'` so its own download buttons produce the
   * full-viewport walkable export instead of the regular one. */
  presentation?: 'regular' | 'immersive';
  /** Normalized creator-authored defaults; visitor local settings override them. */
  authoredSonic?: SonicDefaults;
};

const VISITOR_SWATCHES = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
] as const;
function contrastingVisitorColor(background: string): string {
  const channels = background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!channels) return '#ffffff';
  const [red, green, blue] = channels.slice(1, 4).map(Number);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

function PieceStageControls({
  stageRef,
  iframeRef,
  capabilities,
  immersiveHref,
  library,
  source,
  ink,
  cameraPlacement,
  pieceId,
  title,
  toolbarPortalTarget,
  fullscreenToolbarPortalTarget,
  presentation = 'regular',
  authoredSonic,
}: Props) {
  const resolvedCameraPlacement: CameraPlacement = cameraPlacement ?? 'overlay';
  const authoredSoundSettings = useMemo(
    () => soundSettingsFromSonic(authoredSonic),
    [authoredSonic],
  );
  const initialSoundSettingsRef = useRef<SoundSettings>(
    readSoundSettings(pieceId, undefined, authoredSoundSettings),
  );
  const initialSoundSettings = initialSoundSettingsRef.current;
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(initialSoundSettings.soundVolume);
  const [ambientBpm, setAmbientBpm] = useState(initialSoundSettings.ambientBpm);
  const [ambientVolume, setAmbientVolume] = useState(initialSoundSettings.ambientVolume);
  const [ambientMuted, setAmbientMuted] = useState(initialSoundSettings.ambientMuted);
  const [ambientScale, setAmbientScale] = useState(initialSoundSettings.ambientScale);
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [keyboardVolume, setKeyboardVolume] = useState(initialSoundSettings.keyboardVolume);
  const [keyboardOscillator, setKeyboardOscillator] = useState(
    initialSoundSettings.keyboardOscillator,
  );
  const [keyboardFilterType, setKeyboardFilterType] = useState(
    initialSoundSettings.keyboardFilterType,
  );
  const [keyboardFilterCutoff, setKeyboardFilterCutoff] = useState(
    initialSoundSettings.keyboardFilterCutoff,
  );
  const [keyboardFilterResonance, setKeyboardFilterResonance] = useState(
    initialSoundSettings.keyboardFilterResonance,
  );
  const [keyboardAttack, setKeyboardAttack] = useState(initialSoundSettings.keyboardAttack);
  const [keyboardDecay, setKeyboardDecay] = useState(initialSoundSettings.keyboardDecay);
  const [keyboardSustain, setKeyboardSustain] = useState(initialSoundSettings.keyboardSustain);
  const [keyboardRelease, setKeyboardRelease] = useState(initialSoundSettings.keyboardRelease);
  const [keyboardOctave, setKeyboardOctave] = useState(initialSoundSettings.keyboardOctave);
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
  const [visitorDrawOn, setVisitorDrawOn] = useState(false);
  const [visitorTool, setVisitorTool] = useState<VisitorTool>('pencil');
  const [visitorSize, setVisitorSize] = useState(4);
  const [visitorColor, setVisitorColor] = useState('#ffffff');
  const [visitorStrokes, setVisitorStrokes] = useState<VisitorStroke[]>([]);
  const [visitorHistory, setVisitorHistory] = useState<VisitorHistory<VisitorStroke>>(() =>
    createVisitorHistory(),
  );
  const [eraserPoint, setEraserPoint] = useState<VisitorPoint | null>(null);
  // Issue #479: model preparation status is now derived directly from the
  // local `TrackingProvider`'s own onFrame/onError channels -- no longer
  // reported through the sandbox at all, since hand-tracking never runs
  // there anymore.
  const [handTrackingModelState, setHandTrackingModelState] = useState<
    'idle' | 'loading' | 'ready' | 'failed'
  >('idle');
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(stageRef);

  // Issue #479: real camera capture + hand-tracking state. `command`
  // (defined below) is used inside these closures before its own
  // declaration is reached in source order, so it's captured via a ref
  // exactly like `cameraOpacity`/`cameraState`/`steeringState` below --
  // every one of these is read from the `onFrame`/`onStream`/`onError`
  // closures created once inside `getTrackingProvider`, which must never
  // see a stale value captured at that one-time construction.
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const trackingProviderRef = useRef<TrackingProvider | null>(null);
  const handSignalExtractorRef = useRef(createHandSignalExtractor());
  const prevHandSignalsRef = useRef<HandSignals | null>(null);
  const hasStreamedRef = useRef(false);
  const cameraOpacityRef = useRef(0.5);
  const cameraStateRef = useRef<'off' | 'active' | 'denied' | 'unavailable' | 'ended'>('off');
  const steeringActiveRef = useRef(false);
  const commandRef = useRef<(type: string, extra?: Record<string, unknown>) => void>(() => {});
  const resetSoundSettingsRef = useRef(false);
  const visitorOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const visitorStrokesRef = useRef<VisitorStroke[]>([]);
  const visitorPointerIdRef = useRef<number | null>(null);
  const activeTouchPointerIdsRef = useRef(new Set<number>());
  const touchStrokeIndexRef = useRef<number | null>(null);
  const compositeAndDownloadScreenshotRef = useRef<
    (artworkDataUrl: string, filename: string) => Promise<void>
  >(async () => {});
  const micStreamRef = useRef<MediaStream | null>(null);
  cameraOpacityRef.current = cameraOpacity;
  cameraStateRef.current = cameraState;
  steeringActiveRef.current = steeringState === 'active';
  visitorStrokesRef.current = visitorStrokes;

  function visitorStrokeWidth(stroke: VisitorStroke, scale: number) {
    return stroke.size * scale * (stroke.tool === 'brush' ? 1.75 : 1);
  }

  function drawVisitorStroke(
    context: CanvasRenderingContext2D,
    stroke: VisitorStroke,
    width: number,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    if (stroke.points.length === 0) return;
    const first = stroke.points[0];
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = width;
    context.lineCap = stroke.tool === 'brush' ? 'round' : 'butt';
    context.lineJoin = stroke.tool === 'brush' ? 'round' : 'miter';
    if (stroke.points.length === 1) {
      context.beginPath();
      if (stroke.tool === 'brush') {
        context.arc(first.x * canvasWidth, first.y * canvasHeight, width / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(
          first.x * canvasWidth - width / 2,
          first.y * canvasHeight - width / 2,
          width,
          width,
        );
      }
      return;
    }
    context.beginPath();
    context.moveTo(first.x * canvasWidth, first.y * canvasHeight);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x * canvasWidth, point.y * canvasHeight);
    }
    context.stroke();
  }

  const drawVisitorOverlay = useCallback(() => {
    const canvas = visitorOverlayRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of visitorStrokesRef.current) {
      drawVisitorStroke(
        context,
        stroke,
        visitorStrokeWidth(stroke, canvas.width / 320),
        canvas.width,
        canvas.height,
      );
    }
  }, []);

  const updateVisitorOverlaySize = useCallback(() => {
    const canvas = visitorOverlayRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(stage.clientWidth * scale));
    const height = Math.max(1, Math.floor(stage.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawVisitorOverlay();
  }, [drawVisitorOverlay, stageRef]);

  useEffect(() => {
    if (library !== 'c2js-interactive') return;
    const stage = stageRef.current;
    if (stage) {
      setVisitorColor(contrastingVisitorColor(getComputedStyle(stage).backgroundColor));
    }
    updateVisitorOverlaySize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateVisitorOverlaySize);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [library, stageRef, updateVisitorOverlaySize]);

  useEffect(() => {
    drawVisitorOverlay();
  }, [drawVisitorOverlay, visitorStrokes]);

  function visitorPoint(event: React.PointerEvent<HTMLCanvasElement>): VisitorPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function visitorEraseRadius(stroke?: VisitorStroke): number {
    const stageWidth = stageRef.current?.clientWidth || 320;
    const eraserRadius = visitorSize / (2 * stageWidth);
    if (!stroke) return eraserRadius;
    return eraserRadius + visitorStrokeWidth(stroke, stageWidth / 320) / (2 * stageWidth);
  }

  function commitVisitorStrokes(next: VisitorStroke[]) {
    setVisitorHistory((history) => commitVisitorHistory(history, next));
    visitorStrokesRef.current = next;
    setVisitorStrokes(next);
  }

  function applyVisitorHistory(nextHistory: VisitorHistory<VisitorStroke>) {
    setVisitorHistory(nextHistory);
    visitorStrokesRef.current = nextHistory.present;
    setVisitorStrokes(nextHistory.present);
  }

  function undoVisitorStrokes() {
    applyVisitorHistory(undoVisitorHistory(visitorHistory));
  }

  function redoVisitorStrokes() {
    applyVisitorHistory(redoVisitorHistory(visitorHistory));
  }

  function startVisitorStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!visitorDrawOn) return;
    if (event.pointerType === 'touch') {
      if (activeTouchPointerIdsRef.current.size > 0) {
        if (touchStrokeIndexRef.current !== null) {
          const next = visitorStrokesRef.current.filter(
            (_, index) => index !== touchStrokeIndexRef.current,
          );
          visitorStrokesRef.current = next;
          setVisitorHistory((history) => ({ ...history, present: next }));
          setVisitorStrokes(next);
        }
        touchStrokeIndexRef.current = null;
        visitorPointerIdRef.current = null;
        activeTouchPointerIdsRef.current.add(event.pointerId);
        return;
      }
      activeTouchPointerIdsRef.current.add(event.pointerId);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    visitorPointerIdRef.current = event.pointerId;
    const point = visitorPoint(event);
    if (visitorTool === 'eraser') {
      const remaining = visitorStrokesRef.current.filter(
        (stroke) => !visitorStrokeIntersects(stroke, point, visitorEraseRadius(stroke)),
      );
      if (remaining.length !== visitorStrokesRef.current.length) commitVisitorStrokes(remaining);
      setEraserPoint(point);
      return;
    }
    const stroke = {
      points: [point],
      tool: visitorTool,
      size: visitorSize * (event.pressure > 0 ? 0.5 + event.pressure : 1),
      color: visitorColor,
    };
    commitVisitorStrokes([...visitorStrokesRef.current, stroke]);
    if (event.pointerType === 'touch') {
      touchStrokeIndexRef.current = visitorStrokesRef.current.length - 1;
    }
  }

  function continueVisitorStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!visitorDrawOn || visitorPointerIdRef.current !== event.pointerId) return;
    const point = visitorPoint(event);
    if (visitorTool === 'eraser') {
      const remaining = visitorStrokesRef.current.filter(
        (stroke) => !visitorStrokeIntersects(stroke, point, visitorEraseRadius(stroke)),
      );
      if (remaining.length !== visitorStrokesRef.current.length) commitVisitorStrokes(remaining);
      setEraserPoint(point);
      return;
    }
    const strokes = visitorStrokesRef.current;
    const current = strokes[strokes.length - 1]?.points;
    if (!current) return;
    current.push(point);
    setVisitorStrokes([...strokes]);
  }

  function clearVisitorStrokes() {
    if (visitorStrokesRef.current.length > 0) commitVisitorStrokes([]);
  }

  function handleVisitorKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) redoVisitorStrokes();
    else undoVisitorStrokes();
  }

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
        pose?: { x: number; y: number; z: number };
      } | null;
      if (data?.source !== 'art-piece-sandbox') return;
      if (data.status === 'error') {
        setScreenshotError(data.message || 'The art piece could not complete that action.');
      }
      if (data.status === 'screenshot' && data.data) {
        void compositeAndDownloadScreenshotRef
          .current(data.data, data.filename || 'art-piece-screenshot.png')
          .catch(() => {
            setScreenshotError('Screenshot failed: the captured artwork was not a valid image.');
          });
      }
      // Issue #430: these reflect the sandbox's *acknowledged* runtime
      // state (posted only after the AudioContext/getUserMedia call
      // actually succeeded or failed), never an optimistic update made
      // just because a command was sent.
      if (data.status === 'sound') {
        if (typeof data.enabled === 'boolean') setSoundOn(data.enabled);
        if (data.enabled) {
          // The sandbox reports its built-in 20% startup gain in the same
          // acknowledgement that turns Sound on. Re-apply the authored (or
          // visitor-local) baseline after that acknowledgement so activation
          // cannot overwrite the creator's default volume.
          const settings = readSoundSettings(pieceId, undefined, authoredSoundSettings);
          setVolume(settings.soundVolume);
          window.setTimeout(() => {
            commandRef.current('set-volume', { value: settings.soundVolume });
          }, 0);
        } else if (typeof data.volume === 'number') {
          setVolume(data.volume);
        }
      }
      if (data.status === 'keyboard') {
        if (typeof data.enabled === 'boolean') setKeyboardEnabled(data.enabled);
      }
      if (data.status === 'note' && typeof data.key === 'string') {
        setLastNote(data.key);
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
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [authoredSoundSettings, iframeRef, pieceId]);

  function command(type: string, extra?: Record<string, unknown>) {
    if (
      type === 'toggle-sound' ||
      type === 'set-volume' ||
      type === 'set-tempo' ||
      type === 'set-scale' ||
      type === 'set-voice-volume' ||
      type === 'set-voice-muted' ||
      type === 'set-filter' ||
      type === 'set-oscillator' ||
      type === 'set-envelope' ||
      type === 'set-octave' ||
      type === 'set-keyboard-enabled'
    ) {
      if (!isValidArtPieceSoundCommand(type, extra)) return;
      if (type !== 'toggle-sound') resetSoundSettingsRef.current = false;
    }
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
  commandRef.current = command;

  const applySoundSettings = useCallback((settings: SoundSettings, applyRuntime: boolean) => {
    setVolume(settings.soundVolume);
    setAmbientBpm(settings.ambientBpm);
    setAmbientVolume(settings.ambientVolume);
    setAmbientMuted(settings.ambientMuted);
    setAmbientScale(settings.ambientScale);
    setKeyboardVolume(settings.keyboardVolume);
    setKeyboardOscillator(settings.keyboardOscillator);
    setKeyboardFilterType(settings.keyboardFilterType);
    setKeyboardFilterCutoff(settings.keyboardFilterCutoff);
    setKeyboardFilterResonance(settings.keyboardFilterResonance);
    setKeyboardAttack(settings.keyboardAttack);
    setKeyboardDecay(settings.keyboardDecay);
    setKeyboardSustain(settings.keyboardSustain);
    setKeyboardRelease(settings.keyboardRelease);
    setKeyboardOctave(settings.keyboardOctave);
    setKeyboardEnabled(applyRuntime ? settings.keyboardEnabled : false);
    if (!applyRuntime) return;
    commandRef.current('set-volume', { value: settings.soundVolume });
    commandRef.current('set-tempo', { value: settings.ambientBpm });
    commandRef.current('set-voice-volume', { voice: 'ambient', value: settings.ambientVolume });
    commandRef.current('set-voice-muted', { voice: 'ambient', enabled: settings.ambientMuted });
    commandRef.current('set-scale', { value: settings.ambientScale });
    commandRef.current('set-voice-volume', { voice: 'melodic', value: settings.keyboardVolume });
    commandRef.current('set-oscillator', { value: settings.keyboardOscillator });
    commandRef.current('set-filter', {
      filterType: settings.keyboardFilterType,
      cutoff: settings.keyboardFilterCutoff,
      resonance: settings.keyboardFilterResonance,
    });
    commandRef.current('set-envelope', {
      attack: settings.keyboardAttack,
      decay: settings.keyboardDecay,
      sustain: settings.keyboardSustain,
      release: settings.keyboardRelease,
    });
    commandRef.current('set-octave', { value: settings.keyboardOctave });
    commandRef.current('set-keyboard-enabled', { enabled: settings.keyboardEnabled });
  }, []);

  function resetVisitorSoundSettings() {
    applySoundSettings(resetSoundSettings(pieceId, undefined, authoredSoundSettings), soundOn);
    resetSoundSettingsRef.current = true;
    // React's persistence effect may already be queued by the same gesture;
    // remove the key once the reset state has committed so that reset remains
    // a true clear operation rather than a write of the default snapshot.
    window.setTimeout(() => resetSoundSettings(pieceId), 0);
  }

  useEffect(() => {
    // The sandbox reports the acknowledged Sound state asynchronously. Read
    // the current validated snapshot here so a setting saved before a mute,
    // reset, or route revisit is applied only after activation succeeds.
    if (soundOn && !resetSoundSettingsRef.current) {
      applySoundSettings(readSoundSettings(pieceId, undefined, authoredSoundSettings), true);
    }
  }, [applySoundSettings, authoredSoundSettings, pieceId, soundOn]);

  useEffect(() => {
    // Do not let the initial runtime-off state overwrite a visitor's saved
    // keyboard preference before the user has activated Sound.
    if (!soundOn) return;
    if (resetSoundSettingsRef.current) return;
    writeSoundSettings(pieceId, {
      version: 1,
      soundVolume: volume,
      ambientBpm,
      ambientVolume,
      ambientMuted,
      ambientScale: ambientScale as SoundSettings['ambientScale'],
      keyboardEnabled,
      keyboardVolume,
      keyboardOscillator: keyboardOscillator as SoundSettings['keyboardOscillator'],
      keyboardFilterType: keyboardFilterType as SoundSettings['keyboardFilterType'],
      keyboardFilterCutoff,
      keyboardFilterResonance,
      keyboardAttack,
      keyboardDecay,
      keyboardSustain,
      keyboardRelease,
      keyboardOctave,
      voiceInstruments: { ambient: 'synth', movement: 'synth', melodic: 'synth' },
    });
  }, [
    ambientBpm,
    ambientMuted,
    ambientScale,
    ambientVolume,
    keyboardAttack,
    keyboardDecay,
    keyboardEnabled,
    keyboardFilterCutoff,
    keyboardFilterResonance,
    keyboardFilterType,
    keyboardOctave,
    keyboardOscillator,
    keyboardRelease,
    keyboardSustain,
    keyboardVolume,
    pieceId,
    soundOn,
    volume,
  ]);

  // Issue #479: the sandbox now reports the artwork alone, uncomposited --
  // this composites the parent's own live camera frame on top (at the
  // same opacity the live overlay uses) before downloading, matching
  // #431's original "visibly composites overlay/background" criterion.
  // With no active camera, the artwork downloads unchanged.
  const compositeAndDownloadScreenshot = useCallback(
    async (artworkDataUrl: string, filename: string): Promise<void> => {
      if (
        library !== 'c2js-interactive' &&
        (cameraStateRef.current !== 'active' || !cameraVideoRef.current)
      ) {
        const [header, encoded] = artworkDataUrl.split(',', 2);
        const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
        const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png';
        downloadBlob(new Blob([bytes], { type: mime }), filename);
        return;
      }
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('The captured artwork was not a valid image.'));
        image.src = artworkDataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create a canvas context to composite the camera.');
      context.drawImage(image, 0, 0);
      if (library === 'c2js-interactive') {
        for (const stroke of visitorStrokesRef.current) {
          drawVisitorStroke(
            context,
            stroke,
            visitorStrokeWidth(stroke, image.width / 320),
            image.width,
            image.height,
          );
        }
      }
      if (cameraStateRef.current === 'active' && cameraVideoRef.current) {
        context.save();
        context.globalAlpha = cameraOpacityRef.current;
        context.drawImage(cameraVideoRef.current, 0, 0, canvas.width, canvas.height);
        context.restore();
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode the composited screenshot.');
      downloadBlob(blob, filename);
    },
    [library],
  );
  compositeAndDownloadScreenshotRef.current = compositeAndDownloadScreenshot;

  // Issue #479: creates the shared MediaPipe tracking provider at most
  // once per mount (mirroring `CameraControl.tsx`'s own `getProvider`
  // pattern) -- "Enable camera view" and "Steer the piece" both drive
  // this same provider/stream rather than requesting a second
  // `getUserMedia` stream for either capability.
  function getTrackingProvider(): TrackingProvider {
    if (!trackingProviderRef.current) {
      const provider = createMediaPipeTrackingProvider();
      provider.onFrame((frame) => {
        setHandTrackingModelState('ready');
        const { signals } = handSignalExtractorRef.current.processFrame(frame);
        const previous = prevHandSignalsRef.current;
        if (
          steeringActiveRef.current &&
          previous?.handPresence &&
          signals.handPresence &&
          signals.palmX !== null &&
          signals.palmY !== null &&
          previous.palmX !== null &&
          previous.palmY !== null
        ) {
          const dx = (signals.palmX - previous.palmX) * HAND_PAN_SENSITIVITY;
          const dy = (signals.palmY - previous.palmY) * HAND_PAN_SENSITIVITY;
          const dz =
            signals.pinchStrength !== null && previous.pinchStrength !== null
              ? (previous.pinchStrength - signals.pinchStrength) * HAND_ZOOM_SENSITIVITY
              : 0;
          commandRef.current('steer-signal', { dx, dy, dz });
        }
        prevHandSignalsRef.current = signals;
      });
      provider.onError((error: TrackingProviderError) => {
        const category = categorizeProviderError(error);
        if (!hasStreamedRef.current) {
          setCameraState(category === 'missing-device' ? 'unavailable' : 'denied');
        } else {
          // The camera itself already succeeded (a stream was acquired) --
          // a later failure here is the MediaPipe model/tracking pipeline,
          // not the camera, so it's reported as a model failure instead
          // of clobbering an already-active camera state.
          setHandTrackingModelState('failed');
        }
      });
      provider.onStream?.((stream) => {
        hasStreamedRef.current = !!stream;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
        if (stream) {
          setCameraState('active');
          setHandTrackingModelState('loading');
          command('set-camera-active', { active: true });
        } else {
          setCameraState((current) => (current === 'active' ? 'ended' : current));
          setHandTrackingModelState('idle');
          command('set-camera-active', { active: false });
        }
      });
      trackingProviderRef.current = provider;
    }
    return trackingProviderRef.current;
  }

  function handleEnableCamera() {
    // Issue #479: if this browser has no getUserMedia at all, report the
    // specific "unavailable" state before attempting the camera/tracking
    // pipeline. Without this guard, the provider's generic unsupported-
    // browser error would be categorized as "denied" in the UI.
    if (
      typeof navigator.mediaDevices === 'undefined' ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraState('unavailable');
      return;
    }
    handSignalExtractorRef.current = createHandSignalExtractor();
    prevHandSignalsRef.current = null;
    getTrackingProvider().start();
  }

  function handleDisableCamera() {
    trackingProviderRef.current?.stop();
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraState('off');
    setHandTrackingModelState('idle');
    command('set-camera-active', { active: false });
  }

  // Issue #479: real microphone capture runs in the trusted parent frame
  // for the same opaque-origin SecurityError reason camera does -- the
  // sandboxed iframe can never call getUserMedia itself.
  function handleEnableMicrophone() {
    if (
      typeof navigator.mediaDevices === 'undefined' ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setMicrophoneState('unavailable');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        micStreamRef.current = stream;
        setMicrophoneState('active');
      })
      .catch(() => {
        setMicrophoneState('denied');
      });
  }

  function handleDisableMicrophone() {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    setMicrophoneState('off');
  }

  // Releases the camera/tracking provider and microphone stream if this
  // control (or its owning route) unmounts while active, e.g. navigating
  // away mid-session -- mirrors `CameraControl.tsx`'s identical unmount
  // cleanup.
  useEffect(() => {
    return () => {
      trackingProviderRef.current?.stop();
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function downloadPiece(label: string) {
    setDownloadError(null);
    try {
      const mode = label === 'non-camera' ? 'non-camera' : 'full';
      const blob = await generateArtPieceBundle(library, source, {
        capabilities,
        mode,
        presentation,
        cameraPlacement: resolvedCameraPlacement,
        ink,
        sonic: authoredSonic,
      });
      triggerArtPieceBundleDownload(blob, `${title || 'art-piece'}-${label}.zip`);
      setOpen(false);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed.');
    }
  }
  const toolbarCapabilities: PieceStageCapabilities = {
    screenshot: capabilities.screenshot !== false,
    download: capabilities.download === true ? ('zip' as const) : false,
    // The immersive surface is already the immersive view: no self-link (matrix row 3, #753).
    immersive: capabilities.immersive === true && presentation !== 'immersive',
    sound: capabilities.sound === true,
    // Matrix (#766): the single Piece controls popover exists whenever any of its
    // contents (sound, mic, keyboard, camera view, Steer) is offered. Steer lives
    // inside that popover, never as its own toolbar button.
    pieceControls:
      capabilities.sound === true ||
      capabilities.camera_view === true ||
      capabilities.microphone === true ||
      capabilities.keyboard === true ||
      capabilities.hand_steering === true ||
      // Reset view lives in the popover, and a walkable immersive piece must always be able to
      // return home, so the popover exists on immersive surfaces regardless of capabilities.
      presentation === 'immersive',
    gesture: false,
    gestureGuide: capabilities.hand_steering === true,
    fullscreen: capabilities.fullscreen !== false,
  };
  const toolbar = (
    <PieceStageToolbar
      onScreenshot={() => command('screenshot')}
      onDownload={(variant) => void downloadPiece(variant === 'non-camera' ? 'non-camera' : 'full')}
      immersiveHref={immersiveHref}
      immersiveLabel={presentation === 'immersive' ? 'VR' : 'Immersive'}
      isFullscreen={isFullscreen}
      onToggleFullscreen={() => void toggleFullscreen()}
      downloadFormat="zip"
      capabilities={toolbarCapabilities}
      toolbarMode="inline"
      soundControl={
        toolbarCapabilities.sound ? (
          <button
            type="button"
            className="piece-stage-icon-button"
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            onClick={() => command('toggle-sound')}
          >
            <PieceStageIcon name="sound" />
            <span className="piece-stage-action-label">Sound</span>
          </button>
        ) : undefined
      }
      controlsControl={
        toolbarCapabilities.pieceControls ? (
          <button
            type="button"
            className="piece-stage-icon-button"
            aria-expanded={open}
            aria-label="Piece controls"
            onClick={() => setOpen((value) => !value)}
          >
            <PieceStageIcon name="controls" />
            <span className="piece-stage-action-label">Piece controls</span>
          </button>
        ) : undefined
      }
      gestureControl={
        toolbarCapabilities.gesture ? (
          <button
            type="button"
            className="piece-stage-icon-button"
            aria-pressed={steeringState === 'active'}
            aria-label={steeringState === 'active' ? 'Stop hand tracking' : 'Hand tracking'}
            onClick={() =>
              command(steeringState === 'active' ? 'disable-hand-steering' : 'enable-hand-steering')
            }
          >
            <PieceStageIcon name="steer" />
            <span className="piece-stage-action-label">Hand tracking</span>
          </button>
        ) : undefined
      }
      gestureGuide={
        toolbarCapabilities.gestureGuide ? (
          <button
            type="button"
            className="piece-stage-icon-button"
            aria-label="Show hand gesture guide"
            onClick={() => setGuide(true)}
          >
            <PieceStageIcon name="guide" />
            <span className="piece-stage-action-label">Guide</span>
          </button>
        ) : undefined
      }
      visitorDrawControl={
        library === 'c2js-interactive' ? (
          <div
            className="piece-stage-visitor-draw-controls"
            role="group"
            aria-label="Visitor drawing"
          >
            <div
              className="piece-stage-visitor-color-group"
              role="radiogroup"
              aria-label="Stroke color"
            >
              {VISITOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  role="radio"
                  aria-checked={visitorColor === swatch.value}
                  aria-label={swatch.name}
                  className="piece-stage-color-swatch"
                  style={{ backgroundColor: swatch.value }}
                  onClick={() => setVisitorColor(swatch.value)}
                />
              ))}
            </div>
            <label className="piece-stage-custom-color-control" htmlFor="visitor-stroke-color">
              Custom color
              <input
                id="visitor-stroke-color"
                type="color"
                value={visitorColor}
                onChange={(event) => setVisitorColor(event.target.value)}
                aria-label="Custom stroke color"
              />
            </label>
            <div
              className="piece-stage-visitor-tool-group"
              role="radiogroup"
              aria-label="Drawing tool"
            >
              {(['pencil', 'brush', 'eraser'] as const).map((tool) => (
                <button
                  key={tool}
                  type="button"
                  role="radio"
                  aria-checked={visitorTool === tool}
                  className="piece-stage-icon-button"
                  onClick={() => setVisitorTool(tool)}
                >
                  <span className="piece-stage-action-label">
                    {tool === 'pencil' ? 'Pencil' : tool === 'brush' ? 'Brush' : 'Eraser'}
                  </span>
                </button>
              ))}
            </div>
            {visitorTool === 'eraser' && (
              <span className="piece-stage-visitor-eraser-help">
                Eraser removes touched strokes.
              </span>
            )}
            <label className="piece-stage-visitor-size-control" htmlFor="visitor-drawing-size">
              Size <output htmlFor="visitor-drawing-size">{visitorSize}px</output>
              <input
                id="visitor-drawing-size"
                type="range"
                min="1"
                max="40"
                step="1"
                value={visitorSize}
                onChange={(event) => setVisitorSize(Number(event.target.value))}
                aria-label="Drawing size"
              />
            </label>
            <button
              type="button"
              className="piece-stage-icon-button"
              aria-pressed={visitorDrawOn}
              aria-label={visitorDrawOn ? 'Stop drawing' : 'Draw on piece'}
              onClick={() => setVisitorDrawOn((current) => !current)}
            >
              <span className="piece-stage-action-label">
                {visitorDrawOn ? 'Stop drawing' : 'Draw'}
              </span>
            </button>
            <button
              type="button"
              className="piece-stage-icon-button"
              aria-label="Clear visitor drawing"
              onClick={clearVisitorStrokes}
              disabled={visitorStrokes.length === 0}
            >
              <span className="piece-stage-action-label">Clear</span>
            </button>
            <button
              type="button"
              className="piece-stage-icon-button"
              aria-label="Undo visitor drawing"
              onClick={undoVisitorStrokes}
              disabled={visitorHistory.past.length === 0}
            >
              <span className="piece-stage-action-label">Undo</span>
            </button>
            <button
              type="button"
              className="piece-stage-icon-button"
              aria-label="Redo visitor drawing"
              onClick={redoVisitorStrokes}
              disabled={visitorHistory.future.length === 0}
            >
              <span className="piece-stage-action-label">Redo</span>
            </button>
          </div>
        ) : undefined
      }
    />
  );
  const toolbarTarget =
    presentation === 'regular'
      ? isFullscreen
        ? fullscreenToolbarPortalTarget
        : toolbarPortalTarget
      : undefined;
  return (
    <>
      {capabilities.camera_view && (
        // Issue #479: the real live camera feed, composited visually here
        // in the parent (never inside the sandboxed iframe, which can
        // never itself acquire one -- see artPieceSandbox.ts's own
        // getUserMedia SecurityError doc comment). Kept mounted even
        // while off so `cameraVideoRef` is always attached by the time
        // `getTrackingProvider`'s onStream fires.
        <video
          ref={cameraVideoRef}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: resolvedCameraPlacement === 'background' ? 0 : 2,
            opacity: cameraState === 'active' ? cameraOpacity : 0,
          }}
        />
      )}
      {toolbarTarget
        ? createPortal(toolbar, toolbarTarget)
        : presentation !== 'regular'
          ? toolbar
          : null}
      {library === 'c2js-interactive' && (
        <canvas
          ref={visitorOverlayRef}
          aria-label="Temporary visitor drawing overlay"
          onPointerDown={startVisitorStroke}
          onPointerMove={continueVisitorStroke}
          tabIndex={0}
          onKeyDown={handleVisitorKeyDown}
          onPointerEnter={(event) => {
            if (visitorTool === 'eraser') setEraserPoint(visitorPoint(event));
          }}
          onPointerLeave={() => setEraserPoint(null)}
          onPointerUp={(event) => {
            visitorPointerIdRef.current = null;
            activeTouchPointerIdsRef.current.delete(event.pointerId);
            if (activeTouchPointerIdsRef.current.size === 0) touchStrokeIndexRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={(event) => {
            visitorPointerIdRef.current = null;
            activeTouchPointerIdsRef.current.delete(event.pointerId);
            if (activeTouchPointerIdsRef.current.size === 0) touchStrokeIndexRef.current = null;
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            width: '100%',
            height: '100%',
            pointerEvents: visitorDrawOn ? 'auto' : 'none',
            touchAction: visitorDrawOn ? 'none' : 'auto',
          }}
        />
      )}
      {library === 'c2js-interactive' &&
        visitorDrawOn &&
        visitorTool === 'eraser' &&
        eraserPoint && (
          <span
            className="piece-stage-visitor-eraser-cursor"
            aria-hidden="true"
            style={{
              left: `${eraserPoint.x * 100}%`,
              top: `${eraserPoint.y * 100}%`,
              width: `${visitorSize}px`,
              height: `${visitorSize}px`,
            }}
          />
        )}
      {open && (
        <div role="region" aria-label="Piece controls">
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
              <button type="button" onClick={resetVisitorSoundSettings}>
                Reset sound settings
              </button>
              <label htmlFor="art-piece-ambient-bpm">Ambient BPM: {ambientBpm}</label>
              <input
                id="art-piece-ambient-bpm"
                type="range"
                min={40}
                max={220}
                value={ambientBpm}
                disabled={!soundOn}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAmbientBpm(value);
                  command('set-tempo', { value });
                }}
              />
              <label htmlFor="art-piece-ambient-volume">Ambient volume: {ambientVolume}%</label>
              <input
                id="art-piece-ambient-volume"
                type="range"
                min={0}
                max={100}
                value={ambientVolume}
                disabled={!soundOn}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAmbientVolume(value);
                  command('set-voice-volume', { voice: 'ambient', value });
                }}
              />
              <label htmlFor="art-piece-ambient-muted">
                <input
                  id="art-piece-ambient-muted"
                  type="checkbox"
                  checked={ambientMuted}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setAmbientMuted(enabled);
                    command('set-voice-muted', { voice: 'ambient', enabled });
                  }}
                />
                Mute ambient
              </label>
              <label htmlFor="art-piece-ambient-scale">Scale: {ambientScale}</label>
              <select
                id="art-piece-ambient-scale"
                value={ambientScale}
                disabled={!soundOn}
                onChange={(event) => {
                  const value = event.target.value;
                  setAmbientScale(value as SoundSettings['ambientScale']);
                  command('set-scale', { value });
                }}
              >
                {[
                  'major',
                  'minor',
                  'pentatonic',
                  'chromatic',
                  'dorian',
                  'phrygian',
                  'lydian',
                  'mixolydian',
                  'wholetone',
                ].map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}
                  </option>
                ))}
              </select>
              <fieldset>
                <legend>Keyboard synth</legend>
                <button
                  type="button"
                  aria-pressed={keyboardEnabled}
                  disabled={!soundOn}
                  onClick={() => {
                    const enabled = !keyboardEnabled;
                    setKeyboardEnabled(enabled);
                    command('set-keyboard-enabled', { enabled });
                  }}
                >
                  {keyboardEnabled ? 'Stop keyboard notes' : 'Keyboard notes'}
                </button>
                <label htmlFor="art-piece-keyboard-volume">Volume: {keyboardVolume}%</label>
                <input
                  id="art-piece-keyboard-volume"
                  type="range"
                  min={0}
                  max={100}
                  value={keyboardVolume}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setKeyboardVolume(value);
                    command('set-voice-volume', { voice: 'melodic', value });
                  }}
                />
                <label htmlFor="art-piece-keyboard-oscillator">Oscillator</label>
                <select
                  id="art-piece-keyboard-oscillator"
                  value={keyboardOscillator}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const value = event.target.value;
                    setKeyboardOscillator(value as SoundSettings['keyboardOscillator']);
                    command('set-oscillator', { value });
                  }}
                >
                  {['sine', 'square', 'sawtooth', 'triangle'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <label htmlFor="art-piece-keyboard-filter-type">Filter type</label>
                <select
                  id="art-piece-keyboard-filter-type"
                  value={keyboardFilterType}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const value = event.target.value;
                    setKeyboardFilterType(value as SoundSettings['keyboardFilterType']);
                    command('set-filter', {
                      filterType: value,
                      cutoff: keyboardFilterCutoff,
                      resonance: keyboardFilterResonance,
                    });
                  }}
                >
                  {['lowpass', 'highpass', 'bandpass'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <label htmlFor="art-piece-keyboard-filter-cutoff">
                  Cutoff: {keyboardFilterCutoff}
                </label>
                <input
                  id="art-piece-keyboard-filter-cutoff"
                  type="range"
                  min={20}
                  max={20000}
                  step={20}
                  value={keyboardFilterCutoff}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setKeyboardFilterCutoff(value);
                    command('set-filter', {
                      filterType: keyboardFilterType,
                      cutoff: value,
                      resonance: keyboardFilterResonance,
                    });
                  }}
                />
                <label htmlFor="art-piece-keyboard-filter-resonance">
                  Resonance: {keyboardFilterResonance}
                </label>
                <input
                  id="art-piece-keyboard-filter-resonance"
                  type="range"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={keyboardFilterResonance}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setKeyboardFilterResonance(value);
                    command('set-filter', {
                      filterType: keyboardFilterType,
                      cutoff: keyboardFilterCutoff,
                      resonance: value,
                    });
                  }}
                />
                {(
                  [
                    ['attack', keyboardAttack, setKeyboardAttack],
                    ['decay', keyboardDecay, setKeyboardDecay],
                    ['sustain', keyboardSustain, setKeyboardSustain],
                    ['release', keyboardRelease, setKeyboardRelease],
                  ] as const
                ).map(([field, value, setter]) => (
                  <label key={field} htmlFor={`art-piece-keyboard-${field}`}>
                    {field}: {value}
                    <input
                      id={`art-piece-keyboard-${field}`}
                      type="range"
                      min={field === 'sustain' ? 0 : 0.001}
                      max={field === 'sustain' ? 1 : 10}
                      step={field === 'sustain' ? 0.01 : 0.001}
                      value={value}
                      disabled={!soundOn}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setter(next);
                        command('set-envelope', {
                          attack: field === 'attack' ? next : keyboardAttack,
                          decay: field === 'decay' ? next : keyboardDecay,
                          sustain: field === 'sustain' ? next : keyboardSustain,
                          release: field === 'release' ? next : keyboardRelease,
                        });
                      }}
                    />
                  </label>
                ))}
                <label htmlFor="art-piece-keyboard-octave">Octave: {keyboardOctave}</label>
                <input
                  id="art-piece-keyboard-octave"
                  type="range"
                  min={-2}
                  max={2}
                  value={keyboardOctave}
                  disabled={!soundOn}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setKeyboardOctave(value);
                    command('set-octave', { value });
                  }}
                />
              </fieldset>
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
                onClick={
                  microphoneState === 'active' ? handleDisableMicrophone : handleEnableMicrophone
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
                onClick={cameraState === 'active' ? handleDisableCamera : handleEnableCamera}
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
                onChange={(event) => setCameraOpacity(Number(event.target.value))}
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
