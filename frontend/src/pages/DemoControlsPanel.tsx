import { useEffect, useRef, useState } from 'react';

import { createDemoTrackingController, type DemoMode } from '../tracking/demoController';
import { MANUAL_SIGNAL_RANGES, type ManualSignalName } from '../tracking/manualProvider';
import type { GestureName, TrackingFrame } from '../tracking/types';

const GESTURE_OPTIONS: Array<{ value: GestureName | null; label: string }> = [
  { value: null, label: 'None' },
  { value: 'openPalm', label: 'Open palm' },
  { value: 'closedFist', label: 'Closed fist' },
  { value: 'pointingUp', label: 'Pointing up' },
  { value: 'thumbsUp', label: 'Thumbs up' },
  { value: 'victory', label: 'Victory' },
];

const SIGNAL_ORDER: ManualSignalName[] = ['indexTipX', 'indexTipY', 'handDepth', 'confidence'];

/** Playback auto-advance cadence in milliseconds. Purely a UI pacing
 * choice — the script's own timestamps (`demoPlaybackScript.ts`) are fixed
 * and independent of how fast (or whether) a caller advances through
 * them, so this constant has no bearing on determinism. */
const PLAYBACK_STEP_MS = 400;

function describeFrame(frame: TrackingFrame | null): string {
  if (!frame) return 'No frame emitted yet.';
  const handSummary =
    frame.hands.length === 0
      ? 'no hands'
      : frame.hands
          .map((hand) => `${hand.handedness} hand (confidence ${hand.confidence.toFixed(2)})`)
          .join(', ');
  const eventSummary =
    frame.events.length === 0 ? 'no events' : frame.events.map((event) => event.type).join(', ');
  return `t=${frame.timestamp}: ${handSummary}; events: ${eventSummary}`;
}

/**
 * Task 28: the demo signal control panel. Exposes sliders, toggles, and
 * event buttons for every manual signal/state/event `manualProvider.ts`
 * supports, plus a deterministic synthetic playback sequence
 * (`demoPlaybackScript.ts`), both driven through one
 * `DemoTrackingController` (`demoController.ts`) — the same
 * `TrackingProvider` contract live input will use.
 *
 * Self-contained: owns its controller instance for its own mounted
 * lifetime (created once via `useRef`, started on mount, stopped on
 * unmount) and needs no scene/project state, so it can be dropped into
 * any panel. No camera API or MediaPipe import anywhere in this file or
 * the tracking modules it uses, so it renders and works identically
 * whether or not either is available in the browser.
 */
function DemoControlsPanel() {
  const controllerRef = useRef(createDemoTrackingController());
  const [mode, setMode] = useState<DemoMode>(controllerRef.current.getMode());
  const [manualState, setManualState] = useState(controllerRef.current.getManualState());
  const [lastFrame, setLastFrame] = useState<TrackingFrame | null>(null);
  const [remaining, setRemaining] = useState(controllerRef.current.remainingPlayback());
  const [isPlaying, setIsPlaying] = useState(false);
  const total = controllerRef.current.totalPlaybackEntries();

  useEffect(() => {
    const controller = controllerRef.current;
    controller.start();
    const unsubscribe = controller.onFrame((frame) => {
      setLastFrame(frame);
      setRemaining(controller.remainingPlayback());
    });
    return () => {
      unsubscribe();
      controller.stop();
    };
  }, []);

  // Auto-advances scripted playback at a fixed cadence while `isPlaying`
  // and in playback mode; stops itself once the script is exhausted.
  useEffect(() => {
    if (!isPlaying || mode !== 'playback') return;
    const controller = controllerRef.current;
    const interval = window.setInterval(() => {
      const emitted = controller.advancePlayback();
      if (!emitted) setIsPlaying(false);
    }, PLAYBACK_STEP_MS);
    return () => window.clearInterval(interval);
  }, [isPlaying, mode]);

  function syncManualState() {
    setManualState(controllerRef.current.getManualState());
  }

  function handleSetMode(next: DemoMode) {
    if (next === mode) return;
    setIsPlaying(false);
    controllerRef.current.setMode(next);
    setMode(next);
    syncManualState();
    setRemaining(controllerRef.current.remainingPlayback());
  }

  function handleSlider(name: ManualSignalName, value: number) {
    controllerRef.current.setSignal(name, value);
    syncManualState();
  }

  function handleTogglePresent() {
    controllerRef.current.setPresent(!manualState.present);
    syncManualState();
  }

  function handleSelectGesture(gesture: GestureName | null) {
    controllerRef.current.setGesture(gesture);
    syncManualState();
  }

  function handlePinch(kind: 'start' | 'end') {
    if (kind === 'start') controllerRef.current.emitPinchStart();
    else controllerRef.current.emitPinchEnd();
  }

  function handlePlayPause() {
    setIsPlaying((playing) => !playing);
  }

  function handleStep() {
    setIsPlaying(false);
    controllerRef.current.advancePlayback();
  }

  function handleReset() {
    setIsPlaying(false);
    controllerRef.current.resetPlayback();
    setRemaining(controllerRef.current.remainingPlayback());
  }

  return (
    <div className="demo-controls-panel">
      <h4>Demo signal controls</h4>
      <p>
        Exercise gesture signals without a camera — for testing bindings and previewing
        interactions.
      </p>

      <div role="radiogroup" aria-label="Demo input mode" className="editor-tool-group">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'manual'}
          onClick={() => handleSetMode('manual')}
        >
          Manual controls
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'playback'}
          onClick={() => handleSetMode('playback')}
        >
          Synthetic playback
        </button>
      </div>

      {mode === 'manual' && (
        <div data-testid="demo-manual-controls">
          <div role="group" aria-label="Hand presence" className="editor-tool-group">
            <button type="button" aria-pressed={manualState.present} onClick={handleTogglePresent}>
              {manualState.present ? 'Hand present' : 'Hand absent'}
            </button>
          </div>

          <div role="group" aria-label="Continuous signals" className="editor-tool-group">
            {SIGNAL_ORDER.map((name) => {
              const range = MANUAL_SIGNAL_RANGES[name];
              const value = manualState[name];
              return (
                <div key={name} className="demo-signal-slider">
                  <label htmlFor={`demo-signal-${name}`}>
                    {range.label} ({range.min} to {range.max})
                  </label>
                  <input
                    id={`demo-signal-${name}`}
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={value}
                    aria-valuetext={value.toFixed(2)}
                    onChange={(event) => handleSlider(name, Number(event.target.value))}
                  />
                  <output htmlFor={`demo-signal-${name}`}>{value.toFixed(2)}</output>
                </div>
              );
            })}
          </div>

          <div role="radiogroup" aria-label="Gesture state" className="editor-tool-group">
            {GESTURE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={manualState.gesture === option.value}
                disabled={!manualState.present}
                onClick={() => handleSelectGesture(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div role="group" aria-label="Gesture events" className="editor-tool-group">
            <button
              type="button"
              disabled={!manualState.present}
              onClick={() => handlePinch('start')}
            >
              Pinch start
            </button>
            <button
              type="button"
              disabled={!manualState.present}
              onClick={() => handlePinch('end')}
            >
              Pinch end
            </button>
          </div>
        </div>
      )}

      {mode === 'playback' && (
        <div data-testid="demo-playback-controls" role="group" aria-label="Synthetic playback">
          <button type="button" onClick={handlePlayPause}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={handleStep} disabled={remaining === 0}>
            Step
          </button>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
          <p role="status" aria-live="polite">
            {total - remaining} of {total} events played
          </p>
        </div>
      )}

      <p role="status" aria-live="polite" className="demo-last-frame">
        {describeFrame(lastFrame)}
      </p>
    </div>
  );
}

export default DemoControlsPanel;
