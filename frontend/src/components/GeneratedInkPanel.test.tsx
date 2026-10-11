import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArtPiece } from '../api/artPieces';
import GeneratedInkPanel, { InkPreviewModeToggle, type InkRequest } from './GeneratedInkPanel';

describe('InkPreviewModeToggle', () => {
  it('exposes explicit preview and draw modes with a direct draw entry point', () => {
    const onModeChange = vi.fn();
    const onRequestDraw = vi.fn();
    render(
      <InkPreviewModeToggle
        mode="preview"
        drawDisabled={false}
        onRequestDraw={onRequestDraw}
        onModeChange={onModeChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Preview animation' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const draw = screen.getByRole('button', { name: 'Draw ink' });
    expect(draw).toBeEnabled();

    fireEvent.click(draw);
    expect(onRequestDraw).toHaveBeenCalledTimes(1);
  });

  it('marks draw mode active once an ink session exists', () => {
    const onModeChange = vi.fn();
    render(<InkPreviewModeToggle mode="draw" drawDisabled={false} onModeChange={onModeChange} />);

    expect(screen.getByRole('button', { name: 'Draw ink' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview animation' }));
    expect(onModeChange).toHaveBeenCalledWith('preview');
  });

  it('returns to an existing draw session without requesting a new snapshot', () => {
    const onModeChange = vi.fn();
    const onRequestDraw = vi.fn();
    render(
      <InkPreviewModeToggle
        mode="preview"
        drawDisabled={false}
        hasSession
        onRequestDraw={onRequestDraw}
        onModeChange={onModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Draw ink' }));
    expect(onModeChange).toHaveBeenCalledWith('draw');
    expect(onRequestDraw).not.toHaveBeenCalled();
  });
});

const freezeTestPiece: ArtPiece = {
  public_id: 'freeze-test-piece',
  title: 'Freeze test piece',
  description: '',
  engine: 'p5js',
  status: 'draft',
  created_at: '2026-10-10T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
  current_version: {
    id: 1,
    sequence: 1,
    source: 'window.sketch = (p) => { p.setup = () => p.createCanvas(320, 240); };',
    capabilities: {},
    thumbnail_url: '',
    thumbnail_is_fallback: true,
    created_at: '2026-10-10T00:00:00Z',
    ink: null,
  },
};

const freezeRequest: InkRequest = { tool: 'pen', nonce: 1 };
const freezeFailureMessage =
  'Could not freeze this piece to draw on it. Try again once it has rendered.';
const screenshotMessage = (source: MessageEventSource | null, data: unknown) =>
  new MessageEvent('message', {
    source,
    data: { source: 'art-piece-sandbox', status: 'screenshot', data },
  });

function renderFreezePanel(request: InkRequest | null = freezeRequest) {
  return render(<GeneratedInkPanel piece={freezeTestPiece} request={request} onSaved={vi.fn()} />);
}

function freezeFrame(): HTMLIFrameElement {
  return screen.getByTestId('art-piece-ink-preview') as HTMLIFrameElement;
}

function dispatchFreezeMessage(event: MessageEvent) {
  act(() => window.dispatchEvent(event));
}

function trackSnapshotTimeouts() {
  const ids: Array<ReturnType<typeof window.setTimeout>> = [];
  const schedule = window.setTimeout.bind(window);
  const setTimeoutSpy = vi
    .spyOn(window, 'setTimeout')
    .mockImplementation((handler, delay, ...args) => {
      const id = schedule(handler, delay, ...args) as unknown as ReturnType<
        typeof window.setTimeout
      >;
      if (delay === 8000) ids.push(id);
      return id;
    });
  const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
  return { ids, setTimeoutSpy, clearTimeoutSpy };
}

describe('GeneratedInkPanel screenshot freeze handshake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fails at exactly 8000 ms without a screenshot and clears the timer and message listener', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { ids: freezeTimeouts, clearTimeoutSpy } = trackSnapshotTimeouts();
    const view = renderFreezePanel();
    const messageHandler = addListener.mock.calls.find(([type]) => type === 'message')?.[1];
    const [freezeTimeout] = freezeTimeouts;

    expect(messageHandler).toBeDefined();
    expect(freezeTimeout).toBeDefined();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(freezeFailureMessage);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(freezeTimeout);
    expect(removeListener).toHaveBeenCalledWith('message', messageHandler);
    view.unmount();
  });

  it('fails immediately on an error reply from the preview iframe', () => {
    const { ids: freezeTimeouts, clearTimeoutSpy } = trackSnapshotTimeouts();
    const view = renderFreezePanel();
    const [freezeTimeout] = freezeTimeouts;
    const target = freezeFrame().contentWindow;
    dispatchFreezeMessage(
      new MessageEvent('message', {
        source: target,
        data: { source: 'art-piece-sandbox', status: 'error', message: 'runtime error' },
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(freezeFailureMessage);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(freezeTimeout);
    view.unmount();
  });

  it('starts an ink session when the preview replies with a string screenshot', () => {
    class ImmediateImage {
      naturalWidth = 320;
      naturalHeight = 240;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      set src(_value: string) {
        this.onload?.(new Event('load'));
      }
    }
    vi.stubGlobal('Image', ImmediateImage);
    const { ids: freezeTimeouts, clearTimeoutSpy } = trackSnapshotTimeouts();

    const view = renderFreezePanel();
    const [freezeTimeout] = freezeTimeouts;
    const target = freezeFrame().contentWindow;
    dispatchFreezeMessage(screenshotMessage(target, 'mock screenshot payload'));

    expect(screen.getByTestId('ink-editor')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(freezeTimeout);
    view.unmount();
  });

  it('ignores a screenshot message from another window and then times out', async () => {
    const view = renderFreezePanel();
    const target = freezeFrame().contentWindow;
    const otherFrame = document.createElement('iframe');
    document.body.append(otherFrame);
    dispatchFreezeMessage(screenshotMessage(otherFrame.contentWindow, 'mock screenshot payload'));

    expect(screen.queryByTestId('ink-editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(freezeFailureMessage);
    expect(target).not.toBeNull();
    otherFrame.remove();
    view.unmount();
  });

  it('ignores a non-string screenshot payload and then times out', async () => {
    const view = renderFreezePanel();
    const target = freezeFrame().contentWindow;
    dispatchFreezeMessage(screenshotMessage(target, { kind: 'not-a-string' }));

    expect(screen.queryByTestId('ink-editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(freezeFailureMessage);
    view.unmount();
  });

  it('cancels its pending timeout and removes the listener when unmounted', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { ids: freezeTimeouts, clearTimeoutSpy } = trackSnapshotTimeouts();
    const view = renderFreezePanel();
    const messageHandler = addListener.mock.calls.find(([type]) => type === 'message')?.[1];
    const [freezeTimeout] = freezeTimeouts;

    expect(messageHandler).toBeDefined();
    expect(freezeTimeout).toBeDefined();
    view.unmount();

    expect(removeListener).toHaveBeenCalledWith('message', messageHandler);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(freezeTimeout);
  });

  it('replaces the prior request timeout and listener when a new request arrives', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { ids: freezeTimeouts, clearTimeoutSpy } = trackSnapshotTimeouts();
    const view = renderFreezePanel();
    const firstHandler = addListener.mock.calls.find(([type]) => type === 'message')?.[1];
    const [firstTimeout] = freezeTimeouts;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    view.rerender(
      <GeneratedInkPanel
        piece={freezeTestPiece}
        request={{ tool: 'rect', nonce: 2 }}
        onSaved={vi.fn()}
      />,
    );
    const messageHandlers = addListener.mock.calls
      .filter(([type]) => type === 'message')
      .map(([, listener]) => listener);
    const secondHandler = messageHandlers.at(-1);
    const secondTimeout = freezeTimeouts.at(-1);

    expect(messageHandlers).toHaveLength(2);
    expect(removeListener).toHaveBeenCalledWith('message', firstHandler);
    expect(freezeTimeouts).toHaveLength(2);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimeout);
    expect(secondTimeout).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(freezeFailureMessage);
    expect(removeListener).toHaveBeenCalledWith('message', secondHandler);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(secondTimeout);
    view.unmount();
  });
});
