/** Format the public authorship convention used across piece surfaces. */
export function formatPublicAttribution(
  displayName: string | null | undefined,
  handle: string | null | undefined,
  fallback = 'Public artist',
): string {
  const name = displayName?.trim() || fallback;
  const normalizedHandle = handle?.trim().replace(/^@+/, '');
  return normalizedHandle ? `By ${name} (@${normalizedHandle})` : `By ${name}`;
}
