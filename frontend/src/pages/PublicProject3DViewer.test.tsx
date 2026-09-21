import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import * as projects3dApi from '../api/projects3d';
import type { PublicProject3D } from '../api/projects3d';
import type { SeoConfig } from '../api/adminPages';
import PublicProject3DViewer from './PublicProject3DViewer';

/**
 * Issue #296: the Project3D counterpart of `PublicProjectViewer.test.tsx`,
 * scoped to this page's smaller feature set (no fork, no camera/demo
 * controls -- see the component's own doc comment).
 */

vi.mock('../api/projects3d');

const mockedGetPublicProject3D = vi.mocked(projects3dApi.getPublicProject3D);

function basePublicProject3D(overrides: Partial<PublicProject3D> = {}): PublicProject3D {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Rotating Cube',
    thumbnail_url: '/api/public/projects3d/p1/thumbnail.png',
    current_version: {
      id: 1,
      sequence: 1,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: {
        schemaVersion: 1,
        documentType: 'scene3d',
        id: 'scene3d-1',
        scene: { backgroundColor: '#000000' },
        camera: {
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          fov: 50,
          near: 0.1,
          far: 1000,
        },
        lights: [],
        groups: [],
        objects: [],
        randomness: { seed: 0, enabled: false },
      },
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderViewer(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/p3d/${id}`]}>
      <Routes>
        <Route path="/gallery" element={<p>Gallery placeholder</p>} />
        <Route path="/p3d/:id" element={<PublicProject3DViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublicProject3DViewer load states', () => {
  it('shows an accessible loading state while the fetch is in flight', () => {
    mockedGetPublicProject3D.mockReturnValue(new Promise(() => {}));
    renderViewer();
    expect(screen.getByRole('status')).toHaveTextContent(/loading project/i);
  });

  it('renders the title, attribution, and 3D preview once loaded', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    renderViewer();

    expect(await screen.findByRole('heading', { name: 'Rotating Cube' })).toBeInTheDocument();
    expect(screen.getByText('By alice')).toBeInTheDocument();
    expect(mockedGetPublicProject3D).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('toolbar', { name: 'Preview actions' })).toBeInTheDocument();
    await screen.findByTestId('scene3d-preview-unavailable');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    expect(screen.getByRole('button', { name: 'Open download menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View in immersive mode' })).toBeInTheDocument();
  });

  it('applies configured SEO/AEO metadata to the public 3D viewer', async () => {
    const seoConfig = {
      title: '3D search title',
      description: '3D search description',
      canonical_policy: 'self',
      indexing: 'index',
      og_title: '3D social title',
      og_description: '3D social description',
      og_image_url: '',
      twitter_card: 'summary_large_image',
      answer_summary: '3D agent answer summary',
      structured_data: { '@type': 'VisualArtwork' },
    } as SeoConfig;
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D({ seo_config: seoConfig }));

    renderViewer();

    await screen.findByRole('heading', { name: 'Rotating Cube' });
    await waitFor(() => expect(document.title).toBe('3D search title'));
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      '3D search description',
    );
    expect(document.head.querySelector('meta[property="og:description"]')).toHaveAttribute(
      'content',
      '3D social description',
    );
    expect(document.head.querySelector('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    expect(document.head.querySelector('link[data-content-canonical]')).toBeInTheDocument();
    expect(document.head.querySelector('script[data-content-structured-data]')).toHaveTextContent(
      'VisualArtwork',
    );
  });

  it('shows a safe, undifferentiated message for a 404 (never-existed or not public)', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new ApiError(404, null));
    renderViewer();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/isn't available/i);
    expect(screen.getByRole('link', { name: /back to the public gallery/i })).toBeInTheDocument();
  });

  it('shows a generic error state (distinct from "unavailable") for a network/server failure', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new Error('network down'));
    renderViewer();

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});

describe('PublicProject3DViewer embed snippet', () => {
  it('offers a copyable embed snippet targeting the chrome-less /embed/p3d/:id route', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    const user = userEvent.setup();
    // `userEvent.setup()` installs its own Clipboard API emulation on
    // `navigator.clipboard` -- spying on it after `setup()` (once it
    // already exists, real or emulated) is the reliable order, matching
    // `PublicProjectViewer.test.tsx`'s identical #293 fix.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    renderViewer();
    await screen.findByRole('heading', { name: 'Rotating Cube' });

    await user.click(screen.getByTestId('toggle-embed-snippet'));
    const panel = screen.getByTestId('embed-snippet-panel');
    const textarea = within(panel).getByLabelText(/embed this piece/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('/embed/p3d/p1');
    expect(textarea.value).toMatch(/^<iframe /);

    await user.click(within(panel).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(textarea.value);
    expect(await within(panel).findByText('Copied!')).toBeInTheDocument();
  });

  it('never offers the affordance for an unavailable project', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new ApiError(404, null));
    renderViewer();

    await screen.findByText(/isn't available/i);
    expect(screen.queryByTestId('toggle-embed-snippet')).not.toBeInTheDocument();
  });
});

describe('PublicProject3DViewer immersive-view entry point (issue #311)', () => {
  it('links to the immersive route, opened in a new tab', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    renderViewer();
    await screen.findByRole('heading', { name: 'Rotating Cube' });

    const link = screen.getByRole('link', { name: 'View in immersive mode' });
    expect(link).toHaveAttribute('href', '/immersive/p3d/p1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('never offers the link for an unavailable project', async () => {
    mockedGetPublicProject3D.mockRejectedValue(new ApiError(404, null));
    renderViewer();

    await screen.findByText(/isn't available/i);
    expect(screen.queryByRole('link', { name: /immersive mode/i })).not.toBeInTheDocument();
  });

  it('uses the canonical profile-nested immersive route when supplied by a canonical viewer', async () => {
    mockedGetPublicProject3D.mockResolvedValue(basePublicProject3D());
    render(
      <MemoryRouter initialEntries={['/users/@alice/pieces/rotating-cube']}>
        <Routes>
          <Route
            path="/users/:handle/pieces/:pieceSlug"
            element={
              <PublicProject3DViewer
                initialProject={basePublicProject3D()}
                immersiveHref="/users/@alice/immersive/rotating-cube"
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Rotating Cube' });
    expect(screen.getByRole('link', { name: 'View in immersive mode' })).toHaveAttribute(
      'href',
      '/users/@alice/immersive/rotating-cube',
    );
  });
});
