import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type { CameraStatus } from '../components/CameraControl';
import { useCameraOverlaySettings } from '../editor/cameraOverlaySettings';
import {
  applyCameraOverlayAction,
  clampCameraOverlayGeometry,
  getCameraOverlayLayerOrder,
  setCameraOverlayLayerOrder,
  useCameraOverlayGeometry,
  type CameraOverlayGeometry,
} from '../editor/cameraOverlayGeometry';
import { createPreviewTrackingSource } from './previewTrackingSource';
import type { SceneDocument } from '../api/projects';
import type { TrackingFrame } from '../tracking/types';

type CameraGesture = 'move' | 'resize' | null;

export function useCameraOverlay(
  workingCopy: SceneDocument | null,
  canvasWidth: number,
  canvasHeight: number,
  gridEnabled: boolean,
) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [pinchEventCount, setPinchEventCount] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraLayerOrder, setCameraLayerOrder] = useState<number | null>(null);
  const [cameraOverlayStatus, setCameraOverlayStatus] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraGeometryState = useCameraOverlayGeometry();
  const { setGeometry: setCameraGeometry, ...cameraGeometry } = cameraGeometryState;
  const cameraGeometryRef = useRef<CameraOverlayGeometry>(cameraGeometry);
  cameraGeometryRef.current = cameraGeometry;
  const cameraGestureRef = useRef<CameraGesture>(null);
  const cameraGestureStartRef = useRef({ x: 0, y: 0, geometry: cameraGeometry });
  const cameraTrackingGestureRef = useRef<{
    handId: string;
    x: number;
    y: number;
  } | null>(null);
  const trackingSourceRef = useRef(createPreviewTrackingSource());

  const {
    opacity: cameraOverlayOpacity,
    mirrored: cameraOverlayMirrored,
    setOpacity: setCameraOverlayOpacity,
    setMirrored: setCameraOverlayMirrored,
  } = useCameraOverlaySettings();

  useEffect(() => {
    if (cameraLayerOrder !== null || !workingCopy) return;
    const orders = (Array.isArray(workingCopy.layers) ? workingCopy.layers : [])
      .map((layer) => (layer as { order?: unknown }).order)
      .filter((order): order is number => typeof order === 'number');
    const defaultOrder = Math.max(-1, ...orders) + 1;
    setCameraLayerOrder(getCameraOverlayLayerOrder(defaultOrder));
  }, [cameraLayerOrder, workingCopy]);

  useEffect(() => {
    const videoEl = cameraVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = cameraStream;
    if (cameraStream) {
      void Promise.resolve(videoEl.play()).catch(() => {
        // Autoplay can be rejected; the hidden video remains available to the
        // compositor when the browser permits playback.
      });
    }
  }, [cameraStream, cameraStatus]);

  const updateCameraLayerOrder = (order: number) => {
    setCameraLayerOrder(order);
    setCameraOverlayLayerOrder(order);
  };

  const updateCameraGeometry = (next: CameraOverlayGeometry, status = true) => {
    const clamped = clampCameraOverlayGeometry(next, canvasWidth, canvasHeight);
    cameraGeometryRef.current = clamped;
    setCameraGeometry(clamped);
    if (status) {
      setCameraOverlayStatus(
        `Camera overlay: ${Math.round(clamped.width * canvasWidth)} by ${Math.round(clamped.height * canvasHeight)} pixels.`,
      );
    }
  };

  const handleCameraTrackingFrame = (frame: TrackingFrame) => {
    const handFor = (handId: string) =>
      frame.hands.find((hand) => hand.id === handId) ?? frame.hands[0];
    const indexTip = (hand: (typeof frame.hands)[number] | undefined) => hand?.landmarks[8];

    for (const event of frame.events) {
      if (event.type === 'pinchStart' && !cameraTrackingGestureRef.current) {
        const hand = handFor(event.handId);
        const tip = indexTip(hand);
        if (hand && tip) {
          cameraTrackingGestureRef.current = { handId: hand.id, x: tip.x, y: tip.y };
        }
      } else if (
        (event.type === 'pinchEnd' || event.type === 'handDisappear') &&
        cameraTrackingGestureRef.current?.handId === event.handId
      ) {
        cameraTrackingGestureRef.current = null;
      }
    }

    const gesture = cameraTrackingGestureRef.current;
    if (!gesture) return;
    const hand = handFor(gesture.handId);
    const tip = indexTip(hand);
    if (!tip) return;
    const next = applyCameraOverlayAction(
      cameraGeometryRef.current,
      {
        type: 'move',
        delta: { x: (tip.x - gesture.x) * canvasWidth, y: (tip.y - gesture.y) * canvasHeight },
      },
      canvasWidth,
      canvasHeight,
      gridEnabled,
    );
    updateCameraGeometry(next);
    cameraTrackingGestureRef.current = { handId: hand?.id ?? gesture.handId, x: tip.x, y: tip.y };
  };

  const beginCameraGesture = (event: ReactPointerEvent, kind: Exclude<CameraGesture, null>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    cameraGestureRef.current = kind;
    cameraGestureStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      geometry: cameraGeometryRef.current,
    };
  };

  const moveCameraGesture = (event: ReactPointerEvent) => {
    const kind = cameraGestureRef.current;
    if (!kind) return;
    event.stopPropagation();
    const start = cameraGestureStartRef.current;
    const next =
      kind === 'move'
        ? applyCameraOverlayAction(
            start.geometry,
            { type: 'move', delta: { x: event.clientX - start.x, y: event.clientY - start.y } },
            canvasWidth,
            canvasHeight,
            gridEnabled,
          )
        : applyCameraOverlayAction(
            start.geometry,
            { type: 'resize', deltaX: event.clientX - start.x },
            canvasWidth,
            canvasHeight,
          );
    updateCameraGeometry(next);
  };

  const endCameraGesture = (event: ReactPointerEvent) => {
    if (!cameraGestureRef.current) return;
    event.stopPropagation();
    cameraGestureRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCameraKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.02;
    let next = cameraGeometryRef.current;
    if (event.key === 'ArrowLeft')
      next = applyCameraOverlayAction(
        next,
        { type: 'move', delta: { x: -canvasWidth * step, y: 0 } },
        canvasWidth,
        canvasHeight,
        gridEnabled,
      );
    else if (event.key === 'ArrowRight')
      next = applyCameraOverlayAction(
        next,
        { type: 'move', delta: { x: canvasWidth * step, y: 0 } },
        canvasWidth,
        canvasHeight,
        gridEnabled,
      );
    else if (event.key === 'ArrowUp')
      next = applyCameraOverlayAction(
        next,
        { type: 'move', delta: { x: 0, y: -canvasHeight * step } },
        canvasWidth,
        canvasHeight,
        gridEnabled,
      );
    else if (event.key === 'ArrowDown')
      next = applyCameraOverlayAction(
        next,
        { type: 'move', delta: { x: 0, y: canvasHeight * step } },
        canvasWidth,
        canvasHeight,
        gridEnabled,
      );
    else if (event.key === '+' || event.key === '=')
      next = applyCameraOverlayAction(
        next,
        { type: 'resize', deltaX: canvasWidth * step },
        canvasWidth,
        canvasHeight,
      );
    else if (event.key === '-' || event.key === '_')
      next = applyCameraOverlayAction(
        next,
        { type: 'resize', deltaX: -canvasWidth * step },
        canvasWidth,
        canvasHeight,
      );
    else return;
    event.preventDefault();
    event.stopPropagation();
    updateCameraGeometry(next);
  };

  const handleCameraStatusChange = (status: CameraStatus) => {
    setCameraStatus(status);
    if (status !== 'active') cameraTrackingGestureRef.current = null;
    trackingSourceRef.current.setCameraActive(status === 'active');
  };

  return {
    cameraStatus,
    setCameraStatus,
    pinchEventCount,
    setPinchEventCount,
    cameraStream,
    setCameraStream,
    cameraVideoRef,
    cameraGeometry,
    cameraGeometryRef,
    cameraOverlayOpacity,
    cameraOverlayMirrored,
    setCameraOverlayOpacity,
    setCameraOverlayMirrored,
    cameraLayerOrder,
    effectiveCameraLayerOrder:
      cameraLayerOrder ??
      Math.max(
        0,
        ...(Array.isArray(workingCopy?.layers)
          ? workingCopy.layers.map((layer) => Number((layer as { order?: number }).order) || 0)
          : [0]),
      ) + 1,
    cameraOverlayStatus,
    trackingSourceRef,
    updateCameraLayerOrder,
    updateCameraGeometry,
    handleCameraTrackingFrame,
    beginCameraGesture,
    moveCameraGesture,
    endCameraGesture,
    handleCameraKeyDown,
    handleCameraStatusChange,
  };
}
