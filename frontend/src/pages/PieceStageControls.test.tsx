import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArtPieceCapabilitySet } from '../api/artPieces';
import PieceStageControls from './PieceStageControls';

vi.mock('./useFullscreenToggle', () => ({
  useFullscreenToggle: () => ({ isFullscreen: false, toggleFullscreen: vi.fn() }),
}));

vi.mock('./useVisitorDrawingOverlay', () => ({
  useVisitorDrawingOverlay: () => ({
    visitorDrawOn: false,
    setVisitorDrawOn: vi.fn(),
    visitorTool: 'pencil',
    setVisitorTool: vi.fn(),
    visitorSize: 4,
    setVisitorSize: vi.fn(),
    visitorColor: '#ffffff',
    setVisitorColor: vi.fn(),
    visitorStrokes: [],
    visitorHistory: { past: [], future: [] },
    eraserPoint: null,
    setEraserPoint: vi.fn(),
    visitorOverlayRef: { current: null },
    visitorStrokesRef: { current: [] },
    visitorPointerIdRef: { current: null },
    activeTouchPointerIdsRef: { current: new Set<number>() },
    touchStrokeIndexRef: { current: null },
    startVisitorStroke: vi.fn(),
    continueVisitorStroke: vi.fn(),
    clearVisitorStrokes: vi.fn(),
    handleVisitorKeyDown: vi.fn(),
    undoVisitorStrokes: vi.fn(),
    redoVisitorStrokes: vi.fn(),
    visitorPoint: vi.fn(() => ({ x: 0, y: 0 })),
  }),
}));

vi.mock('../tracking/handSignals', () => ({
  createHandSignalExtractor: () => ({ processFrame: vi.fn() }),
}));

vi.mock('../tracking/mediapipeProvider', () => ({
  createMediaPipeTrackingProvider: vi.fn(),
}));

vi.mock('../generative/artPieceBundle', () => ({
  generateArtPieceBundle: vi.fn(),
  triggerArtPieceBundleDownload: vi.fn(),
}));

vi.mock('../generative/artPieceSandbox', () => ({
  ART_PIECE_BRIDGE_VERSION: 'test',
  isValidArtPieceSoundCommand: () => true,
}));

vi.mock('../audio/sonicEngine', () => ({
  createSonicEngine: vi.fn(),
}));

vi.mock('../audio/soundSettings', async () => {
  const actual =
    await vi.importActual<typeof import('../audio/soundSettings')>('../audio/soundSettings');
  return {
    ...actual,
    readSoundSettings: () => actual.DEFAULT_SOUND_SETTINGS,
    resetSoundSettings: () => actual.DEFAULT_SOUND_SETTINGS,
    writeSoundSettings: vi.fn(),
    applySoundSettingsToEngine: vi.fn(),
  };
});

vi.mock('../export/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('../export/captureLiveScreenshot', () => ({ screenshotFilename: () => 'test.png' }));
vi.mock('../components/cameraFailure', () => ({
  categorizeProviderError: vi.fn(),
}));

const EMPTY_CAPABILITIES: ArtPieceCapabilitySet = {
  sound: false,
  keyboard: false,
  microphone: false,
  camera_view: false,
  hand_steering: false,
};

function renderControls(capabilities: ArtPieceCapabilitySet = EMPTY_CAPABILITIES) {
  return render(
    <PieceStageControls
      stageRef={{ current: null }}
      iframeRef={{ current: null }}
      toolbarPortalTarget={document.body}
      capabilities={capabilities}
      immersiveHref="/immersive/test"
      library="threejs"
      source=""
      pieceId="piece-test"
      title="Test piece"
    />,
  );
}

describe('PieceStageControls capability gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps unavailable controls visible, disabled, and explained', async () => {
    const user = userEvent.setup();
    renderControls();

    expect(screen.getByRole('button', { name: /unmute sound/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show hand gesture guide' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /unmute sound/i })).toHaveAttribute(
      'aria-describedby',
      'piece-stage-sound-reason',
    );

    await user.click(screen.getByRole('button', { name: 'Piece controls' }));

    expect(screen.getByRole('region', { name: 'Piece controls' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enable camera view' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Steer the piece' })).toBeDisabled();
    expect(screen.getByLabelText('Sound volume')).toBeDisabled();
    expect(
      within(screen.getByRole('region', { name: 'Piece controls' })).getAllByText(
        'Requires the Creator plan.',
      ),
    ).toHaveLength(5);
  });

  it('does not disable capability controls that are available', async () => {
    const user = userEvent.setup();
    renderControls({
      sound: true,
      keyboard: true,
      microphone: true,
      camera_view: true,
      hand_steering: true,
    });

    expect(screen.getByRole('button', { name: /unmute sound/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Show hand gesture guide' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enable camera view' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Steer the piece' })).toBeEnabled();
  });
});
