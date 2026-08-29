/** Buckets a `SceneVersion`/`SceneVersion3D` `origin` value down to the
 * two labels the gallery shows next to a project's visibility badge:
 * "AI" for anything the AI provider produced (`ai_create`/`ai_edit`),
 * "Manual" for everything else (`manual`, plus `restore`/`fork` on the
 * 2D side, since those don't change who authored the version's actual
 * content). Returns null when there's no current version yet, so
 * callers can omit the badge entirely rather than show a misleading
 * "Manual" for a project with nothing in it. */
export function originLabel(origin: string | null | undefined): 'AI' | 'Manual' | null {
  if (!origin) return null;
  return origin.startsWith('ai_') ? 'AI' : 'Manual';
}
