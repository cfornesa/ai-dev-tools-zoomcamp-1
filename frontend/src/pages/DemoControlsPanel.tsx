import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../a11y/reducedMotion';
import { useRovingRadioGroup } from '../a11y/useRovingRadioGroup';
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
  // Task 29 (issue #28): the scripted-playback auto-advance timer below is
  // the one continuous, non-essential effect that exists in this codebase
  // today (particle emission/trails/physics — the other candidates
  // `_docs/plan.md` names — aren't implemented yet). In reduced motion, it
  // is replaced by its documented "stepped" equivalent: auto-advance turns
  // off and only the manual Step button remains, which still exposes every
  // scripted frame/event (the interaction's meaning is fully preserved,
  // just requires a press per step instead of a fixed cadence).
  const reducedMotion = useReducedMotion();

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
  // Reduced motion (system or manual override — see `reducedMotion.ts`)
  // takes effect immediately, including mid-playback: this effect re-runs
  // the instant `reducedMotion.effective` flips, tearing down any pending
  // interval and stopping the gesture (`setIsPlaying(false)`) rather than
  // silently continuing to auto-advance or leaving the Play/Pause button
  // showing "Pause" for a timer that no longer exists. Scene/playback
  // state itself (`remaining`, `lastFrame`) is untouched either way, so no
  // progress is lost — Step and Reset keep working exactly as before.
  useEffect(() => {
    if (!isPlaying || mode !== 'playback') return;
    if (reducedMotion.effective) {
      setIsPlaying(false);
      return;
    }
    const controller = controllerRef.current;
    const interval = window.setInterval(() => {
      const emitted = controller.advancePlayback();
      if (!emitted) setIsPlaying(false);
    }, PLAYBACK_STEP_MS);
    return () => window.clearInterval(interval);
  }, [isPlaying, mode, reducedMotion.effective]);

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

  const modeRoving = useRovingRadioGroup(
    [{ value: 'manual' as const }, { value: 'playback' as const }],
    mode,
    handleSetMode,
  );
  const gestureRoving = useRovingRadioGroup(
    GESTURE_OPTIONS.map((option) => ({ value: option.value, disabled: !manualState.present })),
    manualState.gesture,
    handleSelectGesture,
  );

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
          className="demo-radio-option"
          aria-checked={mode === 'manual'}
          onClick={() => handleSetMode('manual')}
          {...modeRoving.getRadioProps('manual')}
        >
          Manual controls
        </button>
        <button
          type="button"
          role="radio"
          className="demo-radio-option"
          aria-checked={mode === 'playback'}
          onClick={() => handleSetMode('playback')}
          {...modeRoving.getRadioProps('playback')}
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
                className="demo-radio-option"
                aria-checked={manualState.gesture === option.value}
                disabled={!manualState.present}
                onClick={() => handleSelectGesture(option.value)}
                {...gestureRoving.getRadioProps(option.value)}
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
          {reducedMotion.effective ? (
            <p className="reduced-motion-note">
              Auto-advance is off while motion is reduced. Use Step to advance manually.
            </p>
          ) : (
            <button type="button" onClick={handlePlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          )}
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
