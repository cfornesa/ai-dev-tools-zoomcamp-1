import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { fetchPublicPage, type PublicPage } from '../api/publicPages';
import { fetchSiteTheme, type ThemeTokens } from '../api/siteTheme';
import PublicGallery from './PublicGallery';
import { PublicCmsPageContent } from './PublicCmsPage';

const DEFAULT_EYEBROW = 'AugmentrART';
const DEFAULT_SITE_TITLE = 'AugmentrART';
const DEFAULT_SITE_DESCRIPTION = 'A public gallery for creative work and living ideas.';

function Home() {
  const auth = useAuth();
  const [siteTheme, setSiteTheme] = useState<ThemeTokens | null>(null);
  const [homePage, setHomePage] = useState<PublicPage | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-out') return;
    fetchSiteTheme()
      .then(setSiteTheme)
      .catch(() => setSiteTheme(null));
    fetchPublicPage('home')
      .then(setHomePage)
      .catch(() => setHomePage(null));
  }, [auth.status]);

  if (auth.status === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    );
  }

  if (auth.status === 'signed-in') return <Navigate to="/studio" replace />;

  const siteTitle = siteTheme?.site_title?.trim() || DEFAULT_SITE_TITLE;
  const siteDescription = siteTheme?.site_description?.trim() || DEFAULT_SITE_DESCRIPTION;
  const eyebrow = homePage?.nav_label?.trim() || DEFAULT_EYEBROW;

  return (
    <main className="home-page" aria-labelledby="home-hero-heading">
      <section className="home-hero" aria-labelledby="home-hero-heading">
        <p className="home-hero-eyebrow">{eyebrow}</p>
        <h1 id="home-hero-heading">{siteTitle}</h1>
        <p className="home-hero-tagline">{siteDescription}</p>
        <a className="shell-action home-hero-cta" href="#public-gallery">
          See More
        </a>
      </section>
      {homePage && <PublicCmsPageContent page={homePage} />}
      <section id="public-gallery" aria-labelledby="public-gallery-heading">
        <PublicGallery />
      </section>
    </main>
  );
}

export default Home;
