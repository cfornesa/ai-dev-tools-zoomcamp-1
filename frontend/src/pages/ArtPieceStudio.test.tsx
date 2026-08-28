import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as artPiecesApi from '../api/artPieces';
import { ApiError } from '../api/client';
import * as authModule from '../auth/useAuth';
import { ART_PIECE_SANDBOX_MESSAGE_SOURCE } from '../generative/artPieceSandbox';
import ArtPieceStudio from './ArtPieceStudio';

vi.mock('../api/artPieces');
vi.mock('../auth/useAuth');

const mockedGenerateArtPiece = vi.mocked(artPiecesApi.generateArtPiece);
const mockedUseAuth = vi.mocked(authModule.useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedUseAuth.mockReturnValue({
    status: 'signed-in',
    user: { username: 'alice', email: 'a@example.com' },
  });
});

function dispatchSandboxMessage(iframe: HTMLIFrameElement, data: Record<string, unknown>): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, source: iframe.contentWindow as Window }),
    );
  });
}

describe('ArtPieceStudio (issue #199)', () => {
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
    // old code -- the previewed SVG markup must not gain a CDN script.
    await userEvent.selectOptions(screen.getByLabelText(/library/i), 'threejs');
    expect(iframe.srcdoc).toContain('<svg id="art-piece-svg">');
    expect(iframe.srcdoc).not.toContain('cdn.jsdelivr.net');
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
});
