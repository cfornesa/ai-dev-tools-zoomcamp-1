import { apiFetch } from './client';
import type { ArtPiece } from './artPieces';
import type { PresentationOptions } from './adminSettings';

export type PublicProfile = {
  handle: string | null;
  style_key?: string | null;
  presentation?: PresentationOptions;
  available_styles?: Array<{
    key: string;
    label: string;
    description: string;
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
  pieces: Array<{
    id: string;
    slug?: string;
    title: string;
    type: string;
    engine?: string;
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
  piece?: ArtPiece;
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
