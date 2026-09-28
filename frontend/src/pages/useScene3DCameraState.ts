import { useRef, useState } from 'react';

import { createHandSignalExtractor, type HandSignals } from '../tracking/handSignals';
import type { CameraStatus } from '../components/CameraControl';

export function useScene3DCameraState() {
  const [gestureControlEnabled, setGestureControlEnabled] = useState(false);
  const gestureControlEnabledRef = useRef(gestureControlEnabled);
  gestureControlEnabledRef.current = gestureControlEnabled;
  const handSignalExtractorRef = useRef(createHandSignalExtractor());
  const latestHandSignalsRef = useRef<HandSignals | null>(null);
  const previousHandSignalsRef = useRef<HandSignals | null>(null);
  const gestureStartRef = useRef<number | null>(null);

  const [thereminEnabled, setThereminEnabled] = useState(false);
  const thereminEnabledRef = useRef(thereminEnabled);
  thereminEnabledRef.current = thereminEnabled;

  const [gestureCameraStatus, setGestureCameraStatus] = useState<CameraStatus>('idle');
  const [gestureCameraStream, setGestureCameraStream] = useState<MediaStream | null>(null);
  const gestureCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraPreviewEnabled, setCameraPreviewEnabled] = useState(false);
  const [cameraPreviewStatus, setCameraPreviewStatus] = useState<CameraStatus>('idle');
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
  const cameraPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  function resetGestureSignals() {
    previousHandSignalsRef.current = null;
    latestHandSignalsRef.current = null;
    gestureStartRef.current = null;
    handSignalExtractorRef.current = createHandSignalExtractor();
  }

  return {
    gestureControlEnabled,
    setGestureControlEnabled,
    gestureControlEnabledRef,
    handSignalExtractorRef,
    latestHandSignalsRef,
    previousHandSignalsRef,
    gestureStartRef,
    thereminEnabled,
    setThereminEnabled,
    thereminEnabledRef,
    gestureCameraStatus,
    setGestureCameraStatus,
    gestureCameraStream,
    setGestureCameraStream,
    gestureCameraVideoRef,
    cameraPreviewEnabled,
    setCameraPreviewEnabled,
    cameraPreviewStatus,
    setCameraPreviewStatus,
    cameraPreviewStream,
    setCameraPreviewStream,
    cameraPreviewVideoRef,
    resetGestureSignals,
  };
}
