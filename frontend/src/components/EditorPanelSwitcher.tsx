export type EditorPanelName = 'tools' | 'preview' | 'inspector';

const PANELS: Array<{ name: EditorPanelName; label: string }> = [
  { name: 'tools', label: 'Tools' },
  { name: 'preview', label: 'Preview' },
  { name: 'inspector', label: 'Inspector' },
];

/** Task 21: the narrow-layout (<1024px) panel switcher — a keyboard-operable
 * tab list for moving between the Tools, Preview, and Inspector panels when
 * they can't all be shown side by side. Each tab is an independently
 * tabbable button, so it participates in the normal Tab/Shift+Tab order
 * without a roving-tabindex pattern. */
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
