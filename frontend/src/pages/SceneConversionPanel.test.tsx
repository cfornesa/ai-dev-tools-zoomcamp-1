import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SceneConversionRun } from '../api/sceneConversion';
import SceneConversionPanel from './SceneConversionPanel';
import type { UseSceneConversionResult } from './useSceneConversion';

vi.mock('./Scene3DPreview', () => ({
  default: () => <div data-testid="fake-scene3d-preview" />,
}));

function makeRun(overrides: Partial<SceneConversionRun> = {}): SceneConversionRun {
  return {
    id: 1,
    status: 'running',
    source_project_id: 'p1',
    source_version_id: 1,
    attempts: 1,
    repairs: 0,
    candidate_scene: null,
    unsupported_shape_types: [],
    plan_summary: '',
    validation_summary: '',
    error_reason: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 },
    accepted_project3d_id: null,
    accepted_version_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deadline_at: '2026-01-01T00:02:00Z',
    cancelled_at: null,
    ...overrides,
  };
}

function makeHook(overrides: Partial<UseSceneConversionResult> = {}): UseSceneConversionResult {
  return {
    prompt: '',
    setPrompt: vi.fn(),
    vendor: 'mistral',
    setVendor: vi.fn(),
    model: '',
    setModel: vi.fn(),
    run: null,
    starting: false,
    startError: null,
    advanceError: null,
    accepting: false,
    acceptError: null,
    reconnecting: false,
    start: vi.fn(),
    stop: vi.fn(),
    accept: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
}

describe('SceneConversionPanel', () => {
  it('shows the entry form and starts a conversion', () => {
    const start = vi.fn();
    render(<SceneConversionPanel sceneConversion={makeHook({ start })} onAccepted={vi.fn()} />);

    expect(screen.getByTestId('scene-conversion-form')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scene-conversion-start'));
    expect(start).toHaveBeenCalled();
  });

  it('shows a reconnecting message while reconnecting', () => {
    render(
      <SceneConversionPanel
        sceneConversion={makeHook({ reconnecting: true })}
        onAccepted={vi.fn()}
      />,
    );
    expect(screen.getByTestId('scene-conversion-reconnecting')).toBeInTheDocument();
  });

  it('shows running progress with attempt/repair counts', () => {
    render(
      <SceneConversionPanel
        sceneConversion={makeHook({ run: makeRun({ status: 'running', attempts: 2, repairs: 1 }) })}
        onAccepted={vi.fn()}
      />,
    );
    expect(screen.getByTestId('scene-conversion-status')).toHaveTextContent('attempt 2 of 3');
    expect(screen.getByTestId('scene-conversion-status')).toHaveTextContent('repair 1 of 2');
  });

  it('warns about unsupported shape types', () => {
    render(
      <SceneConversionPanel
        sceneConversion={makeHook({
          run: makeRun({
            status: 'awaiting_review',
            candidate_scene: { schemaVersion: 1 },
            unsupported_shape_types: ['line', 'image'],
          }),
        })}
        onAccepted={vi.fn()}
      />,
    );
    const warning = screen.getByTestId('scene-conversion-unsupported-shapes');
    expect(warning).toHaveTextContent('2 shape types');
    expect(warning).toHaveTextContent('lines, images');
  });

  it('renders the candidate preview and accepts, navigating to the new 3D project', async () => {
    const accept = vi.fn().mockResolvedValue('proj3d-9');
    const onAccepted = vi.fn();
    render(
      <SceneConversionPanel
        sceneConversion={makeHook({
          run: makeRun({ status: 'awaiting_review', candidate_scene: { schemaVersion: 1 } }),
          accept,
        })}
        onAccepted={onAccepted}
      />,
    );

    expect(screen.getByTestId('fake-scene3d-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scene-conversion-accept'));

    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledWith('proj3d-9'));
  });

  it('rejects (stops) an awaiting_review run without accepting', () => {
    const stop = vi.fn();
    render(
      <SceneConversionPanel
        sceneConversion={makeHook({
          run: makeRun({ status: 'awaiting_review', candidate_scene: { schemaVersion: 1 } }),
          stop,
        })}
        onAccepted={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('scene-conversion-reject'));
    expect(stop).toHaveBeenCalled();
  });

  it('shows a stale-base rebase-and-retry action, and a generic start-new otherwise', () => {
    const dismiss = vi.fn();
    const { rerender } = render(
      <SceneConversionPanel
        sceneConversion={makeHook({
          run: makeRun({ status: 'failed', error_reason: 'stale_base' }),
          dismiss,
        })}
        onAccepted={vi.fn()}
      />,
    );
    expect(screen.getByTestId('scene-conversion-stale-base')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scene-conversion-rebase-retry'));
    expect(dismiss).toHaveBeenCalled();

    rerender(
      <SceneConversionPanel
        sceneConversion={makeHook({
          run: makeRun({ status: 'failed', error_reason: 'timeout' }),
          dismiss,
        })}
        onAccepted={vi.fn()}
      />,
    );
    expect(screen.getByTestId('scene-conversion-start-new')).toBeInTheDocument();
  });
});
