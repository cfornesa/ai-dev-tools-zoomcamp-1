import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { apiFetch } from '../api/client';
import type { SeoConfig } from '../api/adminPages';

type PublicCmsPageData = {
  title: string;
  slug: string;
  description: string;
  seo_config: SeoConfig;
};

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    element?.remove();
    return;
  }
  element ??= document.createElement('meta');
  element.setAttribute(property ? 'property' : 'name', name);
  element.dataset.cmsMetadata = 'true';
  if (!element.parentElement) document.head.appendChild(element);
  element.content = content;
}

function PublicCmsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PublicCmsPageData | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    apiFetch<PublicCmsPageData>(`/api/pages/${encodeURIComponent(slug)}/`)
      .then(setPage)
      .catch(() => setMissing(true));
  }, [slug]);
  useEffect(() => {
    if (!page) return;
    const config = page.seo_config;
    document.title = config.title || page.title;
    setMeta('description', config.description || page.description);
    setMeta('robots', config.indexing === 'noindex' ? 'noindex' : 'index');
    setMeta('og:title', config.og_title || config.title || page.title, true);
    setMeta(
      'og:description',
      config.og_description || config.description || page.description,
      true,
    );
    setMeta('og:image', config.og_image_url, true);
    setMeta('twitter:card', config.twitter_card);
    document.head.querySelectorAll('[data-cms-canonical]').forEach((node) => node.remove());
    if (config.canonical_policy === 'self') {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = window.location.href;
      link.dataset.cmsCanonical = 'true';
      document.head.appendChild(link);
    }
    document.head.querySelectorAll('[data-cms-structured-data]').forEach((node) => node.remove());
    if (Object.keys(config.structured_data).length) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(config.structured_data);
      script.dataset.cmsStructuredData = 'true';
      document.head.appendChild(script);
    }
  }, [page]);
  if (missing) return <Navigate to="/gallery" replace />;
  if (!page) return <p role="status">Loading page…</p>;
  return (
    <article className="content-panel" aria-labelledby="cms-page-heading">
      <h2 id="cms-page-heading">{page.title}</h2>
      <p>{page.description}</p>
      <Link to="/gallery">Return to gallery</Link>
    </article>
  );
}

export default PublicCmsPage;
