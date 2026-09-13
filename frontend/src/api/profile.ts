import { apiFetch } from './client';

export type PublicProfile = {
  handle: string | null;
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
    title: string;
    type: string;
    engine?: string;
    thumbnail_url: string;
  }>;
};

export async function fetchPublicProfile(handle: string): Promise<PublicProfilePage> {
  return apiFetch<PublicProfilePage>(`/api/users/@${encodeURIComponent(handle)}/`);
}
