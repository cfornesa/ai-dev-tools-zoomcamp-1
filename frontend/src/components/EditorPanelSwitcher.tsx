export type EditorPanelName = 'details' | 'tools' | 'preview' | 'inspector';

// Issue #93: Preview is never a switchable tab — the workspace always keeps
// it rendered (see EditorWorkspace.tsx's `panelHidden`), since the hard
// requirement is that live Preview stays reachable alongside whichever of
// Details/Tools/Inspector is active, at every viewport width. Issue #94
// adds Details (project metadata, folded in from the old standalone
// `/projects/:id/settings` page) as a third switchable tab alongside
// Tools/Inspector.
const PANELS: Array<{ name: Exclude<EditorPanelName, 'preview'>; label: string }> = [
  { name: 'details', label: 'Details' },
  { name: 'tools', label: 'Tools' },
  { name: 'inspector', label: 'Inspector' },
];

/** Task 21 (reworked by issue #93, extended by issue #94): the narrow-layout
 * (<1024px) panel switcher — a keyboard-operable tab list for moving
 * between the Details, Tools, and Inspector panels when they can't be shown
 * side by side with Preview. Preview itself is never one of these tabs; it
 * stays visible regardless of which tab is active (see the module comment
 * above). Each tab is an independently tabbable button, so it participates
 * in the normal Tab/Shift+Tab order without a roving-tabindex pattern. */
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
