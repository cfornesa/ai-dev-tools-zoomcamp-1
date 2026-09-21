export function truncateExcerpt(value: string, limit = 240): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= limit) return normalized;
  const available = Math.max(1, limit - 1);
  const boundary = normalized.slice(0, available + 1).lastIndexOf(' ');
  const end = boundary > 0 ? boundary : available;
  return `${normalized.slice(0, end).trimEnd()}…`;
}

export function formatPublishedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
