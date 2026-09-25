import { useEffect, useId, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';

import type { AITargetOption } from './aiTargeting';

type MentionPromptFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AITargetOption[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  disabled?: boolean;
};

function HighlightedLabel({ label, query }: { label: string; query: string | null }) {
  if (!query) return <>{label}</>;
  const start = label.toLowerCase().indexOf(query.toLowerCase());
  if (start < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, start)}
      <mark>{label.slice(start, start + query.length)}</mark>
      {label.slice(start + query.length)}
    </>
  );
}

export default function MentionPromptField({
  id,
  label,
  value,
  onChange,
  options,
  selectedIds,
  onSelectedIdsChange,
  disabled,
}: MentionPromptFieldProps) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const query = value.match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null;
  const filtered = useMemo(
    () =>
      options
        .map((option, index) => ({ option, index }))
        .filter(({ option }) => {
          if (selectedIds.includes(option.id)) return false;
          return query === null || option.label.toLowerCase().includes(query.toLowerCase());
        })
        .sort((left, right) => {
          if (query === null || query.length === 0) return left.index - right.index;
          const normalized = query.toLowerCase();
          const leftPrefix = left.option.label.toLowerCase().startsWith(normalized);
          const rightPrefix = right.option.label.toLowerCase().startsWith(normalized);
          return Number(rightPrefix) - Number(leftPrefix) || left.index - right.index;
        })
        .map(({ option }) => option)
        .slice(0, 8),
    [options, query, selectedIds],
  );
  const listOpen = open && query !== null;

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  function choose(option: AITargetOption) {
    if (option.disabled) return;
    const next = value.replace(/(?:^|\s)@([^\s@]*)$/, '').trimEnd();
    onChange(next ? `${next} ` : '');
    onSelectedIdsChange([...selectedIds, option.id]);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!listOpen) {
      if (event.key === '@') setOpen(true);
      if (event.key === 'Backspace' && !value && selectedIds.length > 0) {
        event.preventDefault();
        onSelectedIdsChange(selectedIds.slice(0, -1));
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
    } else if ((event.key === 'Enter' || event.key === 'Tab') && filtered.length > 0) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === ' ' && filtered.length === 0) {
      setOpen(false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    setOpen(event.target.value.match(/(?:^|\s)@([^\s@]*)$/) !== null);
  }

  return (
    <div className="mention-prompt-field">
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      {selected.length > 0 && (
        <div className="ai-target-chips" aria-label="Selected AI targets">
          {selected.map((option) => (
            <span
              className="ai-target-chip"
              key={option.id}
              data-testid={`ai-target-chip-${option.id}`}
            >
              <span>{option.label}</span>
              <small>{option.mentionKind ?? option.type}</small>
              <button
                type="button"
                aria-label={`Remove ${option.label} target`}
                disabled={disabled}
                onClick={() =>
                  onSelectedIdsChange(selectedIds.filter((idValue) => idValue !== option.id))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div
        role="combobox"
        aria-label="AI target suggestions"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={listOpen}
      >
        <textarea
          id={id}
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && filtered.length > 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          value={value}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(value.match(/(?:^|\s)@([^\s@]*)$/) !== null)}
        />
      </div>
      {listOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="AI target suggestions"
          className="ai-target-listbox"
        >
          {filtered.length === 0 ? (
            <div role="option" aria-disabled="true" className="ai-target-no-matches">
              No matches
            </div>
          ) : (
            filtered.map((option, index) => (
              <div key={option.id}>
                {(index === 0 || filtered[index - 1].category !== option.category) &&
                  option.category && (
                    <div role="presentation" className="ai-target-category">
                      {option.category}
                    </div>
                  )}
                <button
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-disabled={option.disabled}
                  className={index === activeIndex ? 'is-active' : undefined}
                  key={option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span>
                    <HighlightedLabel label={option.label} query={query} />
                  </span>{' '}
                  <small>{option.mentionKind ?? option.type}</small>
                  {option.disabledReason && <em> — {option.disabledReason}</em>}
                </button>
              </div>
            ))
          )}
        </div>
      )}
      {listOpen && (
        <span className="visually-hidden" aria-live="polite">
          {filtered.length} matching AI targets
        </span>
      )}
    </div>
  );
}
