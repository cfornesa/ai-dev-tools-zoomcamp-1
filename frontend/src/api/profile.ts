import { apiFetch } from './client';
import type { ArtPiece } from './artPieces';
import type { PublicProject } from './projects';
import type { PublicProject3D } from './projects3d';
import type { PresentationOptions } from './adminSettings';
import type { ThemePalettes } from './adminSettings';

export type PublicProfile = {
  handle: string | null;
  style_key?: string | null;
  presentation?: PresentationOptions;
  available_styles?: Array<{
    key: string;
    label: string;
    description?: string;
    tokens: Record<string, string>;
    presentation: PresentationOptions;
  }>;
  display_name: string;
  bio: string;
  website_url: string;
  social_links: Record<string, string>;
  profile_image_url: string;
  is_public: boolean;
  revision: number;
  theme_config: Record<string, string>;
  theme_palettes?: ThemePalettes;
};

export async function fetchProfile(): Promise<PublicProfile> {
  return apiFetch<PublicProfile>('/api/account/profile/');
}

export async function updateProfile(profile: PublicProfile): Promise<PublicProfile> {
  return apiFetch<PublicProfile>('/api/account/profile/', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
}

export type PublicProfilePage = {
  profile: PublicProfile;
  collections: Array<{
    id: string;
    title: string;
    slug: string;
    viewer_url: string;
    thumbnail_url: string | null;
    item_count: number;
  }>;
  pieces: Array<{
    id: string;
    slug?: string;
    title: string;
    description?: string;
    type: string;
    engine?: string;
    published_at?: string;
    regular_url?: string;
    thumbnail_url: string;
    thumbnail_is_fallback?: boolean;
  }>;
};

export async function fetchPublicProfile(handle: string): Promise<PublicProfilePage> {
  return apiFetch<PublicProfilePage>(`/api/users/@${encodeURIComponent(handle)}/`);
}

export type CanonicalPublicPiece = {
  canonical_url: string;
  viewer_url: string;
  type: '2d' | '3d' | 'generated';
  edit_url?: string;
  piece?: ArtPiece | PublicProject | PublicProject3D;
};

export async function fetchCanonicalPublicPiece(
  handle: string,
  pieceSlug: string,
): Promise<CanonicalPublicPiece> {
  return apiFetch<CanonicalPublicPiece>(
    `/api/users/@${encodeURIComponent(handle)}/pieces/${encodeURIComponent(pieceSlug)}/`,
  );
}

export async function fetchOwnerArtPiece(
  handle: string,
  pieceSlug: string,
): Promise<{ canonical_url: string; piece: ArtPiece }> {
  return apiFetch<{ canonical_url: string; piece: ArtPiece }>(
    `/api/users/@${encodeURIComponent(handle)}/edit/${encodeURIComponent(pieceSlug)}/`,
  );
}
