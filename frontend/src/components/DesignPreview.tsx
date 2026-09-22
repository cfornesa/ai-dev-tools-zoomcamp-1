import { useMemo, useState } from 'react';

import type {
  DesignPalettes,
  PaletteDefinition,
  PresentationOptions,
  ThemePalette,
} from '../api/adminSettings';

type PreviewMode = 'light' | 'dark';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function bodyFont(font: PresentationOptions['font_family']): string {
  if (font === 'serif' || font === 'script') return "Georgia, 'Times New Roman', serif";
  if (font === 'mono') return 'ui-monospace, SFMono-Regular, Consolas, monospace';
  return "system-ui, -apple-system, 'Segoe UI', sans-serif";
}

function headingFont(font: PresentationOptions['font_family']): string {
  if (font === 'script') return "'Pinyon Script', 'Brush Script MT', cursive";
  return bodyFont(font);
}

function previewDocument(
  label: string,
  mode: PreviewMode,
  palette: ThemePalette,
  presentation: PresentationOptions,
): string {
  const colors = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`--preview-${key.replaceAll('_', '-')}`, value]),
  );
  const vars = Object.entries(colors)
    .map(([key, value]) => `${key}:${escapeHtml(value)}`)
    .join(';');
  const radius =
    presentation.radius === 'sharp' ? '2px' : presentation.radius === 'pill' ? '999px' : '12px';
  const shadow =
    presentation.shadow === 'offset'
      ? '6px 6px 0 color-mix(in srgb, var(--preview-foreground) 30%, transparent)'
      : presentation.shadow === 'soft'
        ? '0 8px 24px color-mix(in srgb, var(--preview-foreground) 18%, transparent)'
        : 'none';
  const density = presentation.density === 'compact' ? '0.75rem' : '1.25rem';
  return `<!doctype html><html data-mode="${mode}"><head><meta charset="utf-8"><style>
    :root{${vars};color-scheme:${mode};font-family:${bodyFont(presentation.font_family)};background:var(--preview-background);color:var(--preview-foreground)}
    *{box-sizing:border-box}body{margin:0;padding:${density};min-height:100vh;background:var(--preview-background);color:var(--preview-foreground);line-height:1.55}
    header{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:${density};background:var(--preview-primary);color:var(--preview-primary-foreground);border-radius:${radius};box-shadow:${shadow}}
    nav{font-size:.75rem;opacity:.85}main{padding:calc(${density} * 1.5) 0}h1{font-family:${headingFont(presentation.font_family)};font-size:clamp(1.35rem,4vw,2rem);margin:0 0 .75rem;color:var(--preview-foreground)}
    p{margin:.5rem 0;color:var(--preview-foreground)}.muted{color:var(--preview-muted-foreground);font-size:.9rem}.card{margin-top:1rem;padding:${density};background:var(--preview-muted);border:1px solid color-mix(in srgb, var(--preview-foreground) 22%, transparent);border-radius:${radius};box-shadow:${shadow}}
    .actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}.button{display:inline-block;padding:.5rem .75rem;border-radius:${radius};font:inherit;font-size:.8rem}.primary{background:var(--preview-primary);color:var(--preview-primary-foreground)}.secondary{background:var(--preview-secondary);color:var(--preview-secondary-foreground)}.accent{background:var(--preview-accent);color:var(--preview-accent-foreground)}
  </style></head><body><header><strong>${escapeHtml(label)}</strong><nav>Profile · Gallery · About</nav></header><main><h1>A simple profile page</h1><p>Readable body text demonstrates the selected design and color palette.</p><p class="muted">Muted text supports secondary information without losing contrast.</p><section class="card"><strong>Featured card</strong><p>Cards inherit the same readable body font and generous padding.</p><div class="actions"><span class="button primary">Primary</span><span class="button secondary">Secondary</span><span class="button accent">Accent</span></div></section></main></body></html>`;
}

export function DesignPreview({
  label,
  presentation,
  palettes,
  availablePalette,
}: {
  label: string;
  presentation: PresentationOptions;
  palettes: DesignPalettes;
  availablePalette?: PaletteDefinition;
}) {
  const [mode, setMode] = useState<PreviewMode>('light');
  const palette = palettes[mode];
  const srcDoc = useMemo(
    () => previewDocument(label, mode, palette, presentation),
    [label, mode, palette, presentation],
  );
  const swatches = ['background', 'foreground', 'primary', 'secondary', 'accent'] as const;
  return (
    <div className="design-preview" aria-label={`${label} design preview`}>
      <div className="design-preview-toolbar">
        <div>
          <strong>{label}</strong>
          <p>{availablePalette?.description ?? 'Custom palette values'}</p>
        </div>
        <div className="design-preview-mode-controls" aria-label="Preview mode">
          <button type="button" aria-pressed={mode === 'light'} onClick={() => setMode('light')}>
            ☀ Light
          </button>
          <button type="button" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}>
            ☾ Dark
          </button>
        </div>
      </div>
      <div className="design-preview-palette" aria-label={`${mode} color scheme`}>
        {swatches.map((key) => (
          <span key={key} title={`${key}: ${palette[key] ?? 'unset'}`}>
            <i aria-hidden="true" style={{ background: palette[key] }} />
            {key}
          </span>
        ))}
      </div>
      <iframe
        className="design-preview-frame"
        title={`${label} ${mode} page preview`}
        sandbox=""
        srcDoc={srcDoc}
      />
    </div>
  );
}

export default DesignPreview;
