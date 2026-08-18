import { useState } from 'react';

import { NODE_TYPE_CATALOG } from './graphEditing';

/**
 * Task 36: the param-editing form fields for one graph node, shared by
 * `GraphView.tsx`'s inline "Configure node" panel and `GraphListView.tsx`'s
 * per-row configure form, so both surfaces edit the exact same fields the
 * exact same way (`NODE_TYPE_CATALOG[type].paramFields`).
 */

/** A `kind: 'number'` field (Task 37) needs its own local draft state,
 * separate from `params[field.key]`: while the user is mid-edit (e.g. the
 * field is momentarily empty after clearing it to retype a value), calling
 * `onChange` with an unparseable value would either write garbage into the
 * scene or (if skipped) cause the controlled `<input>` to snap back to the
 * last-committed numeric value on every keystroke — fighting the user's
 * typing rather than accepting it. The field displays its own draft string
 * and only calls `onChange` once that draft parses to a finite number;
 * `key={fieldId}` on the field's wrapper (below) remounts this component
 * with a fresh draft whenever the caller switches to editing a different
 * node/field, so external param changes (switching nodes, undo) are never
 * shadowed by a stale draft. */
function NumberField({
  fieldId,
  min,
  max,
  step,
  initial,
  onChange,
}: {
  fieldId: string;
  min?: number;
  max?: number;
  step?: number;
  initial: number | '';
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string>(initial === '' ? '' : String(initial));
  return (
    <input
      id={fieldId}
      type="number"
      min={min}
      max={max}
      step={step ?? 'any'}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const parsed = Number(next);
        if (next !== '' && Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
}

function NodeParamFields({
  type,
  params,
  idPrefix,
  onChange,
}: {
  type: string;
  params: Record<string, unknown>;
  idPrefix: string;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  const info = NODE_TYPE_CATALOG[type];
  if (!info || info.paramFields.length === 0) {
    return <p>This node type has no configurable parameters.</p>;
  }
  return (
    <>
      {info.paramFields.map((field) => {
        const fieldId = `${idPrefix}-${field.key}`;
        if (field.kind === 'boolean') {
          const checked = params[field.key] === true;
          return (
            <div className="behavior-card-field" key={field.key}>
              <label htmlFor={fieldId}>{field.label}</label>
              <input
                id={fieldId}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(field.key, event.target.checked)}
              />
            </div>
          );
        }
        if (field.kind === 'number') {
          const initial =
            typeof params[field.key] === 'number' ? (params[field.key] as number) : '';
          return (
            <div className="behavior-card-field" key={fieldId}>
              <label htmlFor={fieldId}>{field.label}</label>
              <NumberField
                fieldId={fieldId}
                min={field.min}
                max={field.max}
                step={field.step}
                initial={initial}
                onChange={(value) => onChange(field.key, value)}
              />
            </div>
          );
        }
        const value = typeof params[field.key] === 'string' ? (params[field.key] as string) : '';
        return (
          <div className="behavior-card-field" key={field.key}>
            <label htmlFor={fieldId}>{field.label}</label>
            {field.kind === 'select' ? (
              <select
                id={fieldId}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={fieldId}
                type="text"
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default NodeParamFields;
