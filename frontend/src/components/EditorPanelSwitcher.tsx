export type EditorPanelName = 'details' | 'tools' | 'preview' | 'inspector' | 'layers';

// Issue #93: Preview is never a switchable tab — the workspace always keeps
// it rendered (see EditorWorkspace.tsx's `panelHidden`), since the hard
// requirement is that live Preview stays reachable alongside whichever of
// Details/Tools/Inspector/Layers is active, at every viewport width. Issue
// #94 adds Details (project metadata, folded in from the old standalone
// `/projects/:id/settings` page) as a third switchable tab alongside
// Tools/Inspector. Issue #127 adds Layers as a fourth: the dedicated Layers
// panel (`LayersPanel.tsx`) is mutually exclusive with Details/Tools/
// Inspector below the breakpoint exactly like the other three. Task 129
// (issue #154) reorders this array so Layers is the first (leftmost) tab
// — layer management is one of the most important things a user does
// here, so it should be positioned first, not buried third. This is a tab
// *order* change only: `EditorWorkspace.tsx`'s default active tab stays
// `'tools'` (see `EditorWorkspace.test.tsx`'s "Tools by default" test),
// so existing narrow-viewport behavior for a first-time visit is
// unchanged — a user reaches Layers with one switcher click, same as
// every other non-default tab already required before this change.
const PANELS: Array<{ name: Exclude<EditorPanelName, 'preview'>; label: string }> = [
  { name: 'layers', label: 'Layers' },
  { name: 'details', label: 'Details' },
  { name: 'tools', label: 'Tools' },
  { name: 'inspector', label: 'Inspector' },
];

/** Task 21 (reworked by issue #93, extended by issue #94/#127): the
 * narrow-layout (<1024px) panel switcher — a keyboard-operable tab list for
 * moving between the Details, Tools, Layers, and Inspector panels when they
 * can't be shown side by side with Preview. Preview itself is never one of
 * these tabs; it stays visible regardless of which tab is active (see the
 * module comment above). Each tab is an independently tabbable button, so
 * it participates in the normal Tab/Shift+Tab order without a
 * roving-tabindex pattern. */
function EditorPanelSwitcher({
  activePanel,
  onSelect,
}: {
  activePanel: EditorPanelName;
  onSelect: (panel: EditorPanelName) => void;
}) {
  return (
    <div role="tablist" aria-label="Editor panels" className="editor-panel-switcher">
      {PANELS.map(({ name, label }) => (
        <button
          key={name}
          type="button"
          role="tab"
          id={`editor-panel-tab-${name}`}
          aria-selected={activePanel === name}
          aria-controls={`editor-panel-${name}`}
          className="editor-panel-tab"
          onClick={() => onSelect(name)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default EditorPanelSwitcher;
