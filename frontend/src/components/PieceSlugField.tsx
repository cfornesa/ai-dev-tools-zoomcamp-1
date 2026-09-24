/**
 * Issue #750: the piece's URL slug as its own explicit, separately saved field -- renaming a piece never
 * changes it. Saving a new slug changes the piece's public/editor URLs; the previous URLs stop working
 * (owner decision: no redirects), so the field says so and the owner confirms by pressing Save.
 */
import { useEffect, useId, useState } from 'react';

import { ApiError } from '../api/client';

export type SlugSaveResult = { public_slug?: string; editor_url?: string | null };

export default function PieceSlugField({
  current,
  save,
  onSaved,
}: {
  current: string | undefined;
  save: (slug: string) => Promise<SlugSaveResult>;
  /** Called with the server's response so the caller can update its project and move to the new URL. */
  onSaved: (result: SlugSaveResult) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(current ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(current ?? ''), [current]);

  const unchanged = draft.trim() === (current ?? '');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (unchanged || state === 'saving') return;
    setState('saving');
    setError(null);
    try {
      const result = await save(draft);
      setState('saved');
      onSaved(result);
    } catch (caught) {
      setState('idle');
      const detail = caught instanceof ApiError ? JSON.stringify(caught.body ?? '') : '';
      setError(
        /already in use/i.test(detail)
          ? 'That slug is already in use. Choose another.'
          : /letter or number/i.test(detail)
            ? 'The slug must contain a letter or number.'
            : 'Could not save the slug. Please try again.',
      );
    }
  }

  return (
    <form
      className="piece-slug-field"
      data-testid="piece-slug-field"
      onSubmit={(e) => void submit(e)}
    >
      <label htmlFor={inputId}>Public URL slug</label>
      <div className="piece-slug-row">
        <input
          id={inputId}
          value={draft}
          maxLength={220}
          onChange={(event) => {
            setDraft(event.target.value);
            setState('idle');
          }}
          aria-describedby={`${inputId}-hint`}
        />
        <button type="submit" disabled={unchanged || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Save slug'}
        </button>
      </div>
      <p id={`${inputId}-hint`} className="piece-slug-hint">
        Changing the slug changes this piece's web address. Links to the old address will stop
        working.
      </p>
      {error && (
        <p role="alert" data-testid="piece-slug-error">
          {error}
        </p>
      )}
      {state === 'saved' && <p role="status">Slug saved.</p>}
    </form>
  );
}
