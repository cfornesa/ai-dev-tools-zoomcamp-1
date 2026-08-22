import { useId, useState, type ReactNode } from 'react';

/**
 * Task 94 (issue #94): an independently expandable/collapsible disclosure
 * region — a button with `aria-expanded`/`aria-controls` toggling a
 * conditionally-rendered content region, the exact same pattern
 * `EditorWorkspace.tsx`'s pre-existing "Show logic" toggle already used.
 * Each instance owns its own open/closed boolean (`useState`, not lifted
 * anywhere shared), so multiple sections rendered side by side are never
 * coupled into a single-open-at-a-time accordion — expanding one never
 * closes another.
 *
 * Issue #95, point 6: every section defaults to **closed** — Task 94 left
 * every section defaulting open to preserve existing tests' assumptions at
 * the time; this review flips that so the user opens only what they need.
 */
function CollapsibleSection({
  heading,
  defaultOpen = false,
  children,
}: {
  heading: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="editor-collapsible-section">
      <h4 className="editor-collapsible-section-heading">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          className="editor-collapsible-section-toggle"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? '▾' : '▸'} {heading}
        </button>
      </h4>
      {open && (
        <div id={contentId} className="editor-collapsible-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
