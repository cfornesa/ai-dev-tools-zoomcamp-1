/**
 * Issue #761: the standalone HTML/ZIP exports of structured 2D and 3D pieces
 * used a single near-invisible hamburger (☰) opening a modal of glyph+text
 * rows. The live viewers moved to an inline icon-only toolbar (#692/#693) and
 * the owner decided (2026-09-24, DECISIONS.md) that every surface uses the
 * PHP order with Fullscreen last, icon-only buttons, and a contextual label
 * on hover/focus for hover-capable pointers. This module is the single
 * standalone (no React, no external assets) implementation of that toolbar
 * for both exporters, so their markup, CSS, and order cannot drift.
 *
 * Order (docs/piece-toolbar-parity-matrix.md), minus Download and
 * Immersive/VR which a downloaded piece never offers:
 * Screenshot, Sound, Piece controls, Hand gesture guide, Fullscreen.
 */

export type ExportToolbarButtonId =
  'screenshot' | 'sound' | 'controls' | 'guide' | 'reset' | 'fullscreen';

type ExportToolbarButton = {
  id: ExportToolbarButtonId;
  /** DOM id the exporters' runtime scripts already bind to. */
  domId: string;
  label: string;
  /** Present when the control toggles a popover/dialog. */
  toggles?: boolean;
  /** Present when the control is a pressed/unpressed toggle. */
  pressed?: boolean;
  icon: string;
};

const ICONS: Record<ExportToolbarButtonId, string> = {
  screenshot: '<path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v9.8H4z"/><circle cx="12" cy="13.2" r="3.1"/>',
  sound:
    '<path d="M4 10h3l4-3.5v11L7 14H4z"/><path d="M15 9.2a4.2 4.2 0 0 1 0 5.6"/><path d="M17.8 6.7a7.7 7.7 0 0 1 0 10.6"/>',
  controls: '<path d="M5 6h14M5 12h14M5 18h14"/><path d="M9 4v4M15 10v4M11 16v4"/>',
  guide:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4h4"/>',
  fullscreen: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/>',
};

const BUTTONS: Record<ExportToolbarButtonId, ExportToolbarButton> = {
  screenshot: {
    id: 'screenshot',
    domId: 'piece-screenshot',
    label: 'Take screenshot',
    icon: ICONS.screenshot,
  },
  sound: {
    id: 'sound',
    domId: 'piece-sound',
    label: 'Enable sound',
    pressed: true,
    icon: ICONS.sound,
  },
  controls: {
    id: 'controls',
    domId: 'piece-controls-toggle',
    label: 'Piece controls',
    toggles: true,
    icon: ICONS.controls,
  },
  guide: {
    id: 'guide',
    domId: 'piece-hand-guide-toggle',
    label: 'Hand gesture guide',
    toggles: true,
    icon: ICONS.guide,
  },
  reset: {
    id: 'reset',
    domId: 'piece-reset-view',
    label: 'Reset view',
    icon: ICONS.reset,
  },
  fullscreen: {
    id: 'fullscreen',
    domId: 'piece-fullscreen',
    label: 'Enter fullscreen',
    icon: ICONS.fullscreen,
  },
};

/** Canonical left-to-right order; callers pass the subset they support. */
const ORDER: ExportToolbarButtonId[] = [
  'screenshot',
  'sound',
  'controls',
  'guide',
  'reset',
  'fullscreen',
];

export type ExportToolbarOptions = {
  buttons: ExportToolbarButtonId[];
  /** Overrides the DOM id of the `controls` toggle (2D and 3D historically differ). */
  controlsDomId?: string;
  /** `aria-controls` target of the `controls` toggle. */
  controlsPanelId?: string;
  /** Emit `data-action="<id>"` on every button (the generated-art runtime binds by action). */
  dataActions?: boolean;
  /** Per-button accessible-name overrides (e.g. the runtime's 'Unmute sound'). */
  labels?: Partial<Record<ExportToolbarButtonId, string>>;
  /** Explicit DOM ids per button, overriding the defaults. */
  domIds?: Partial<Record<ExportToolbarButtonId, string>>;
};

function renderButton(button: ExportToolbarButton, options: ExportToolbarOptions): string {
  const domId =
    options.domIds?.[button.id] ??
    (button.id === 'controls' && options.controlsDomId ? options.controlsDomId : button.domId);
  const label = options.labels?.[button.id] ?? button.label;
  const aria = [
    `aria-label="${label}"`,
    options.dataActions ? `data-action="${button.id === 'controls' ? 'controls' : button.id}"` : '',
    button.toggles ? 'aria-expanded="false"' : '',
    button.toggles && button.id === 'controls' && options.controlsPanelId
      ? `aria-controls="${options.controlsPanelId}"`
      : '',
    button.pressed ? 'aria-pressed="false"' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<button id="${domId}" type="button" class="piece-stage-icon-button" ${aria}><svg class="piece-stage-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${button.icon}</svg><span class="piece-stage-tooltip" role="presentation" aria-hidden="true">${label}</span></button>`;
}

/** Renders the inline, always-visible icon-only toolbar. */
export function renderExportStageToolbar(options: ExportToolbarOptions): string {
  const wanted = new Set(options.buttons);
  const html = ORDER.filter((id) => wanted.has(id))
    .map((id) => renderButton(BUTTONS[id], options))
    .join('\n  ');
  return `<div id="piece-toolbar" role="toolbar" aria-label="Piece actions">\n  ${html}\n</div>`;
}

/**
 * Shared CSS. The toolbar is fixed top-left with a solid dark backing and a
 * light border so it stays clearly visible on the black export page (owner
 * report: the old ☰ was near-invisible). Labels appear on hover/focus only for
 * hover-capable pointers; touch shows none. Targets are 44px.
 */
export const EXPORT_STAGE_TOOLBAR_CSS = `
#piece-toolbar {
  position: fixed;
  top: .75rem;
  left: .75rem;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  max-width: calc(100vw - 1.5rem);
}
.piece-stage-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  border: 1px solid rgba(255,255,255,.7);
  border-radius: .75rem;
  background: rgba(10,12,20,.94);
  color: #fff;
  cursor: pointer;
}
.piece-stage-icon-button:hover, .piece-stage-icon-button:focus-visible { background: rgba(35,42,66,.98); }
.piece-stage-icon-button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.piece-stage-icon-button[aria-pressed="true"], .piece-stage-icon-button[aria-expanded="true"] { background: rgba(59,74,120,.98); }
.piece-stage-tooltip {
  position: absolute;
  top: calc(100% + .35rem);
  left: 0;
  z-index: 40;
  padding: .3rem .55rem;
  border-radius: .4rem;
  background: #000;
  color: #fff;
  border: 1px solid rgba(255,255,255,.5);
  font: 600 .75rem/1.2 system-ui, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
}
.piece-stage-icon { display: block; width: 1.25rem; height: 1.25rem; pointer-events: none; }
@media (hover: hover) and (pointer: fine) {
  .piece-stage-icon-button:hover > .piece-stage-tooltip,
  .piece-stage-icon-button:focus-visible > .piece-stage-tooltip { opacity: 1; visibility: visible; }
}
`;
