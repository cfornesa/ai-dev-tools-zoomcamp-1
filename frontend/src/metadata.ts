import type { SeoConfig } from './api/adminPages';

export function applyContentMetadata(
  config: SeoConfig | undefined,
  fallbackTitle: string,
  fallbackDescription: string,
  canonicalUrl: string,
) {
  const value = config ?? ({} as SeoConfig);
  document.title = value.title || fallbackTitle;
  const meta = (name: string, content: string, property = false) => {
    const attr = property ? 'property' : 'name';
    let node = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
    if (!content) {
      if (node?.dataset.serverMetadata === 'true') return;
      node?.remove();
      return;
    }
    node ??= document.createElement('meta');
    node.setAttribute(attr, name);
    node.content = content;
    node.dataset.contentMetadata = 'true';
    if (!node.parentElement) document.head.appendChild(node);
  };
  meta('description', value.description || fallbackDescription);
  meta('robots', value.indexing === 'noindex' ? 'noindex' : 'index');
  meta('og:title', value.og_title || value.title || fallbackTitle, true);
  meta('og:description', value.og_description || value.description || fallbackDescription, true);
  meta('og:image', value.og_image_url, true);
  meta('twitter:card', value.twitter_card || 'summary');
  document.head.querySelectorAll('[data-content-canonical]').forEach((node) => node.remove());
  if (value.canonical_policy !== 'none') {
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalUrl;
    link.dataset.contentCanonical = 'true';
    document.head.appendChild(link);
  }
  document.head.querySelectorAll('[data-content-structured-data]').forEach((node) => node.remove());
  if (value.structured_data && Object.keys(value.structured_data).length) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(value.structured_data);
    script.dataset.contentStructuredData = 'true';
    document.head.appendChild(script);
  }
}
