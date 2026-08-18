import { NODE_TYPE_CATALOG } from './graphEditing';

/**
 * Task 36: the param-editing form fields for one graph node, shared by
 * `GraphView.tsx`'s inline "Configure node" panel and `GraphListView.tsx`'s
 * per-row configure form, so both surfaces edit the exact same fields the
 * exact same way (`NODE_TYPE_CATALOG[type].paramFields`).
 */
function NodeParamFields({
  type,
  params,
  idPrefix,
  onChange,
}: {
  type: string;
  params: Record<string, unknown>;
  idPrefix: string;
  onChange: (key: string, value: string) => void;
}) {
  const info = NODE_TYPE_CATALOG[type];
  if (!info || info.paramFields.length === 0) {
    return <p>This node type has no configurable parameters.</p>;
  }
  return (
    <>
      {info.paramFields.map((field) => {
        const fieldId = `${idPrefix}-${field.key}`;
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
