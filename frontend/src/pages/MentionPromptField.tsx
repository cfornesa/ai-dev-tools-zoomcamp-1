import { useId, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';

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
      options.filter((option) => {
        if (selectedIds.includes(option.id)) return false;
        return (
          query === null ||
          `${option.label} ${option.type} ${option.id}`.toLowerCase().includes(query.toLowerCase())
        );
      }),
    [options, query, selectedIds],
  );
  const listOpen = open && query !== null && filtered.length > 0;

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
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
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
              <small>{option.type}</small>
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
          {filtered.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={option.disabled}
              className={index === activeIndex ? 'is-active' : undefined}
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span> <small>{option.type}</small>
              {option.disabledReason && <em> — {option.disabledReason}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
