import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as artPiecesApi from '../api/artPieces';
import * as aiPreferencesApi from '../api/aiPreferences';
import { ApiError } from '../api/client';
import * as authModule from '../auth/useAuth';
import { downloadBlob } from '../export/downloadBlob';
import * as artPieceBundleModule from '../generative/artPieceBundle';
import * as thumbnailCaptureModule from '../generative/artPieceThumbnailCapture';
import {
  ART_PIECE_ENGINE_CAPABILITIES,
  type ArtPiece,
  type ArtPieceLibrary,
} from '../api/artPieces';
import { getArtPieceStarter } from '../generative/artPieceStarters';
import pilotSource from '../generative/__fixtures__/canvas2d-runtime-error.txt?raw';
import { ART_PIECE_SANDBOX_MESSAGE_SOURCE } from '../generative/artPieceSandbox';
import ArtPieceStudio from './ArtPieceStudio';

vi.mock('../api/artPieces');
vi.mock('../api/aiPreferences');
vi.mock('../auth/useAuth');
vi.mock('../export/downloadBlob');
vi.mock('../generative/artPieceBundle');
vi.mock('../generative/artPieceThumbnailCapture');

const mockedGenerateArtPiece = vi.mocked(artPiecesApi.generateArtPiece);
const mockedCreateArtPiece = vi.mocked(artPiecesApi.createArtPiece);
const mockedFetchAIPersonas = vi.mocked(aiPreferencesApi.fetchAIPersonas);
const mockedUseAuth = vi.mocked(authModule.useAuth);
const mockedDownloadBlob = vi.mocked(downloadBlob);
const mockedGenerateArtPieceBundle = vi.mocked(artPieceBundleModule.generateArtPieceBundle);
const mockedTriggerArtPieceBundleDownload = vi.mocked(
  artPieceBundleModule.triggerArtPieceBundleDownload,
);
const mockedCaptureThumbnail = vi.mocked(thumbnailCaptureModule.captureAndUploadArtPieceThumbnail);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedUseAuth.mockReturnValue({
    status: 'signed-in',
    user: { username: 'alice', email: 'a@example.com', is_application_admin: false },
  });
  mockedFetchAIPersonas.mockResolvedValue([]);
  window.history.replaceState({}, '', '/art-pieces');
  mockedCaptureThumbnail.mockResolvedValue(true);
});

function dispatchSandboxMessage(iframe: HTMLIFrameElement, data: Record<string, unknown>): void {
  const embeddedPreviewId = iframe.srcdoc.match(/previewId: "([^"]+)"/)?.[1];
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...data, previewId: data.previewId ?? embeddedPreviewId },
        source: iframe.contentWindow as Window,
      }),
    );
  });
}

describe('ArtPieceStudio (issue #199)', () => {
  it.each(Object.keys(ART_PIECE_ENGINE_CAPABILITIES) as ArtPieceLibrary[])(
    'opens the %s starter without an AI request and saves it as a server-backed art piece',
    async (library) => {
      const savedPiece = {
        public_id: `piece-${library}`,
        title: `Untitled ${ART_PIECE_ENGINE_CAPABILITIES[library].label} piece`,
        description: '',
        engine: library,
        status: 'draft',
        current_version: {
          id: 42,
          sequence: 1,
          source: getArtPieceStarter(library),
          capabilities: {},
          thumbnail_url: '',
          thumbnail_is_fallback: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } as ArtPiece;
      mockedCreateArtPiece.mockResolvedValue(savedPiece);
      window.history.replaceState({}, '', `/art-pieces?mode=blank&engine=${library}`);

      render(<ArtPieceStudio />);

      expect(await screen.findByTestId('art-piece-starter-mode')).toHaveTextContent(
        'No AI request is made.',
      );
      const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
      expect(iframe.srcdoc).toContain(getArtPieceStarter(library));
      dispatchSandboxMessage(iframe, { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' });
      await userEvent.click(await screen.findByTestId('art-piece-save'));

      expect(mockedGenerateArtPiece).not.toHaveBeenCalled();
      expect(mockedCreateArtPiece).toHaveBeenCalledWith({
        title: `Untitled ${ART_PIECE_ENGINE_CAPABILITIES[library].label} piece`,
        description: '',
        prompt: `Blank ${library} starter`,
        engine: library,
        source: getArtPieceStarter(library),
        capabilities: {},
        camera_placement: 'overlay',
      });
      expect(mockedCaptureThumbnail).toHaveBeenCalledWith(iframe, savedPiece.public_id, 42);
    },
  );

  it('prompts sign-in when signed out, and never calls the API', async () => {
    mockedUseAuth.mockReturnValue({ status: 'signed-out', user: null });
    render(<ArtPieceStudio />);

    expect(screen.getByText(/sign in to generate/i)).toBeInTheDocument();
    expect(mockedGenerateArtPiece).not.toHaveBeenCalled();
  });

  it('disables Generate until a prompt is entered, and calls the API with the trimmed prompt', async () => {
    mockedGenerateArtPiece.mockReturnValue(new Promise(() => {}));
    render(<ArtPieceStudio />);

    const button = screen.getByRole('button', { name: /generate/i });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), '  a red spiral  ');
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(mockedGenerateArtPiece).toHaveBeenCalledWith(
      'canvas2d',
      'a red spiral',
      expect.anything(),
      undefined,
    );
    expect(screen.getByTestId('art-piece-pending-status')).toBeInTheDocument();
  });

  it('selecting SVG sends library: "svg" to the API', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'svg',
      code: '<svg id="art-piece-svg"></svg>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'svg');
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a pulsing circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(mockedGenerateArtPiece).toHaveBeenCalledWith(
      'svg',
      'a pulsing circle',
      expect.anything(),
      undefined,
    );
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    expect(iframe.srcdoc).toContain('<svg id="art-piece-svg">');
  });

  it('selects an owner Persona and sends its id with the prompt', async () => {
    mockedFetchAIPersonas.mockResolvedValue([
      { id: 17, name: 'Solarist', prompt_text: 'Use bright solar colors.', created_at: '' },
    ]);
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'svg',
      code: '<svg id="art-piece-svg"></svg>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.selectOptions(await screen.findByLabelText(/persona/i), '17');
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a solar halo');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(mockedGenerateArtPiece).toHaveBeenCalledWith(
      'canvas2d',
      'a solar halo',
      expect.anything(),
      undefined,
      17,
    );
  });

  it('selecting p5.js sends its stable engine ID and renders the instance-mode wrapper', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'p5js',
      code: 'window.sketch = function (p) { p.setup = function () { p.createCanvas(10, 10); }; };',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'p5js');
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a field');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(mockedGenerateArtPiece).toHaveBeenCalledWith(
      'p5js',
      'a field',
      expect.anything(),
      undefined,
    );
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    expect(iframe.srcdoc).toContain('new window.p5(window.sketch, mount)');
  });

  it('selecting Three.js sends library: "threejs" and renders the wrapped snippet in a provided container', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'threejs',
      code: "THREE.foo(); document.getElementById('art-piece-container');",
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'threejs');
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a rotating cube');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(mockedGenerateArtPiece).toHaveBeenCalledWith(
      'threejs',
      'a rotating cube',
      expect.anything(),
      undefined,
    );
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    expect(iframe.srcdoc).toContain('cdn.jsdelivr.net/npm/three@');
    expect(iframe.srcdoc).toContain('id="art-piece-container"');
  });

  it('a library switch after a result arrives does not mismatch the previewed code with the new selection', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'svg',
      code: '<svg id="art-piece-svg"></svg>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'svg');
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    expect(iframe.srcdoc).toContain('<svg id="art-piece-svg">');

    // Changing the dropdown after a result exists must not retroactively
    // rebuild the sandbox for the new (unrelated) library against the
    // old code -- the previewed SVG markup must not gain Three.js's CDN
    // <script> tag. (Every library's CSP now allows the jsdelivr origin
    // unconditionally, for hand-steering's MediaPipe module -- see #455 --
    // so a bare "no cdn.jsdelivr.net anywhere" check no longer
    // distinguishes a stale svg srcdoc from a rebuilt threejs one; the
    // absence of Three.js's own CDN <script> tag still does.)
    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'threejs');
    expect(iframe.srcdoc).toContain('<svg id="art-piece-svg">');
    expect(iframe.srcdoc).not.toContain('<script src="https://cdn.jsdelivr.net/npm/three');
  });

  it('sends a typed model id and persists it across a fresh mount', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'canvas2d',
      code: '<canvas id="art-piece-canvas"></canvas><script></script>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const { unmount } = render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.type(screen.getByLabelText(/mistral model/i), 'codestral-2405');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(mockedGenerateArtPiece).toHaveBeenCalledWith(
      'canvas2d',
      'a circle',
      expect.anything(),
      'codestral-2405',
    );

    unmount();
    render(<ArtPieceStudio />);
    expect(screen.getByLabelText(/mistral model/i)).toHaveValue('codestral-2405');
  });

  it('renders the sandboxed preview with the exact allow-scripts-only sandbox attribute, and shows Download only once ready', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'canvas2d',
      code: '<canvas id="art-piece-canvas"></canvas><script></script>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.srcdoc).toContain('<canvas id="art-piece-canvas">');
    expect(screen.queryByTestId('art-piece-download')).toBeNull();

    dispatchSandboxMessage(iframe, { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' });
    expect(await screen.findByTestId('art-piece-download')).toBeInTheDocument();
  });

  it("Download builds the portable bundle for the result's own library and triggers a .zip download (issue #200)", async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'canvas2d',
      code: '<canvas id="art-piece-canvas"></canvas><script></script>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const fakeZip = new Blob(['fake zip bytes']);
    mockedGenerateArtPieceBundle.mockResolvedValue(fakeZip);
    render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    dispatchSandboxMessage(iframe, { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' });

    await userEvent.click(await screen.findByTestId('art-piece-download'));

    expect(mockedGenerateArtPieceBundle).toHaveBeenCalledWith(
      'canvas2d',
      '<canvas id="art-piece-canvas"></canvas><script></script>',
    );
    expect(mockedTriggerArtPieceBundleDownload).toHaveBeenCalledWith(fakeZip, 'art-piece.zip');
  });

  it('shows an actionable error, and never calls triggerArtPieceBundleDownload, if building the bundle fails', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'threejs',
      code: 'THREE.foo();',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    mockedGenerateArtPieceBundle.mockRejectedValue(new Error('network down'));
    render(<ArtPieceStudio />);

    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'threejs');
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a cube');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    dispatchSandboxMessage(iframe, { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' });

    await userEvent.click(await screen.findByTestId('art-piece-download'));

    expect(await screen.findByTestId('art-piece-download-error')).toHaveTextContent('network down');
    expect(mockedTriggerArtPieceBundleDownload).not.toHaveBeenCalled();
  });

  it('shows a crashed state (and no Download) when the sandbox reports an error', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'canvas2d',
      code: '<canvas id="art-piece-canvas"></canvas><script>throw new Error("boom");</script>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    dispatchSandboxMessage(iframe, {
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'error',
      message: 'boom',
    });

    expect(await screen.findByTestId('art-piece-crashed')).toHaveTextContent('boom');
    expect(screen.queryByTestId('art-piece-download')).toBeNull();
  });

  it('#1340 retains, identifies, maps, copies, and downloads the exact failed Canvas2D source', async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'canvas2d',
      code: pilotSource,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    try {
      render(<ArtPieceStudio />);
      await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'greenhouse');
      await userEvent.click(screen.getByRole('button', { name: /generate/i }));
      const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
      const sourceStart = iframe.srcdoc.indexOf(pilotSource);
      const sourceStartLine = iframe.srcdoc.slice(0, sourceStart).split('\n').length;
      dispatchSandboxMessage(iframe, {
        source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
        status: 'error',
        message: 'ReferenceError: glassX is not defined',
        line: sourceStartLine + 100,
        column: 18,
      });

      const crashed = await screen.findByTestId('art-piece-crashed');
      expect(crashed).toHaveTextContent(
        'The generated piece could not render: ReferenceError: glassX is not defined',
      );
      expect(await screen.findByTestId('failed-source-sha256')).toHaveTextContent(
        '204d4ea23daa718e9097b2b017b95741c1d558fe1b73c44530b5e620ec026f4c',
      );
      expect(screen.getByTestId('failed-source-location')).toHaveTextContent(
        'Preview source location: line 101, column 18',
      );
      expect(screen.getByLabelText('Failed source used by this preview')).toHaveValue(pilotSource);
      expect(screen.getByLabelText('Piece title')).toBeInTheDocument();
      expect(screen.queryByTestId('art-piece-save')).toBeNull();
      expect(screen.queryByTestId('art-piece-download')).toBeNull();
      expect(screen.queryByTestId('art-piece-capabilities')).toBeNull();

      await userEvent.click(screen.getByTestId('copy-failed-source'));
      expect(clipboard.writeText).toHaveBeenCalledWith(pilotSource);
      await userEvent.click(screen.getByTestId('download-failed-source'));
      expect(mockedDownloadBlob).toHaveBeenCalledOnce();
      const [failedSourceBlob, filename] = mockedDownloadBlob.mock.calls[0];
      expect(failedSourceBlob.type).toBe('text/plain;charset=utf-8');
      await expect(failedSourceBlob.text()).resolves.toBe(pilotSource);
      expect(filename).toBe('failed-art-piece-source.txt');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('#1340 ignores a stale preview error delivered through the current iframe window', async () => {
    const usage = {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
      estimated_cost_usd: 0,
    };
    mockedGenerateArtPiece
      .mockResolvedValueOnce({
        library: 'canvas2d',
        code: '<canvas></canvas><script></script>',
        usage,
      })
      .mockResolvedValueOnce({
        library: 'canvas2d',
        code: '<canvas id="new"></canvas><script></script>',
        usage,
      });
    render(<ArtPieceStudio />);
    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'first preview');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    const iframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    const oldPreviewId = iframe.srcdoc.match(/previewId: "([^"]+)"/)?.[1];
    expect(oldPreviewId).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    const nextIframe = (await screen.findByTestId('art-piece-preview')) as HTMLIFrameElement;
    await waitFor(() => expect(nextIframe.srcdoc).toContain('<canvas id="new">'));
    const currentPreviewId = nextIframe.srcdoc.match(/previewId: "([^"]+)"/)?.[1];
    expect(currentPreviewId).not.toBe(oldPreviewId);
    dispatchSandboxMessage(nextIframe, {
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'error',
      previewId: oldPreviewId,
      message: 'stale error',
    });
    expect(screen.queryByTestId('art-piece-crashed')).toBeNull();
    expect(screen.queryByTestId('art-piece-save')).toBeNull();

    dispatchSandboxMessage(nextIframe, {
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'ready',
      previewId: currentPreviewId,
    });
    expect(await screen.findByTestId('art-piece-save')).toBeInTheDocument();
  });

  it("ignores a message whose source is not this iframe's own contentWindow", async () => {
    mockedGenerateArtPiece.mockResolvedValue({
      library: 'canvas2d',
      code: '<canvas id="art-piece-canvas"></canvas><script></script>',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, estimated_cost_usd: 0 },
    });
    render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    await screen.findByTestId('art-piece-preview');

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' },
          source: null,
        }),
      );
    });

    expect(screen.queryByTestId('art-piece-download')).toBeNull();
  });

  it('shows an actionable error when the account has no personal Mistral key', async () => {
    mockedGenerateArtPiece.mockRejectedValue(
      new ApiError(424, {
        error: 'personal_key_required',
        detail: 'Configure your personal Mistral API key.',
      }),
    );
    render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(await screen.findByTestId('art-piece-error')).toHaveTextContent(/account settings/i);
  });

  it('shows additive retry guidance while retaining the structured-output reason', async () => {
    mockedGenerateArtPiece.mockRejectedValue(
      new ApiError(422, {
        error: 'invalid_structured_output',
        detail: 'missing_canvas_root',
        guidance: 'No automatic repair was run; revise the prompt or submit again.',
      }),
    );
    render(<ArtPieceStudio />);

    await userEvent.type(screen.getByLabelText(/describe the art piece/i), 'a circle');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    const alert = await screen.findByTestId('art-piece-error');
    expect(alert).toHaveTextContent('missing_canvas_root');
    expect(alert).toHaveTextContent('No automatic repair was run');
  });
});
