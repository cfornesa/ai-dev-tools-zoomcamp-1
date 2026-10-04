/** Build the production fallback matcher directly from App.tsx's Route table. */
export function routeMatchersFromAppSource(source: string): RegExp[] {
  const routePaths = Array.from(source.matchAll(/\bpath=["']([^"']+)["']/g), (match) => match[1]);
  return routePaths.flatMap((routePath) => {
    if (routePath === '*') return [];
    const segments = routePath.split('/').filter(Boolean);
    const pattern = segments
      .map((segment) => {
        if (segment === '*') return '.+';
        if (segment.startsWith(':')) return '[^/]+';
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return [new RegExp(pattern ? `^/${pattern}/?$` : '^/?$', 'i')];
  });
}

export function isKnownClientRoute(pathname: string, matchers: RegExp[]): boolean {
  return matchers.some((matcher) => matcher.test(pathname));
}
