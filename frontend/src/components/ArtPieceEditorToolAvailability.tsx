import {
  ART_PIECE_EDITOR_TOOL_KEYS,
  getArtPieceEditorCapabilities,
  type ArtPieceEditorToolKey,
} from './artPieceEditorCapabilities';
import type { ArtPieceLibrary } from '../api/artPieces';
import './ArtPieceEditorToolAvailability.css';

const LABELS: Record<ArtPieceEditorToolKey, string> = {
  'add-shape': 'Add shape',
  'add-ellipse': 'Add ellipse',
  'add-line': 'Add line',
  'freehand-draw': 'Freehand draw',
  erase: 'Erase',
  transform: 'Transform',
  media: 'Media',
  'ai-edit': 'AI edit',
};

function ToolIcon({ tool }: { tool: ArtPieceEditorToolKey }) {
  const common = {
    'aria-hidden': true,
    className: 'editor-tool-icon',
    'data-editor-tool-icon': tool,
    focusable: false,
    viewBox: '0 0 24 24',
  } as const;

  switch (tool) {
    case 'add-shape':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <circle cx="16.5" cy="7.5" r="3.5" />
          <path d="m5 19 4-4 3 3 3-3 4 4" />
        </svg>
      );
    case 'add-ellipse':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="7.5" ry="5.5" />
        </svg>
      );
    case 'add-line':
      return (
        <svg {...common}>
          <path d="M5 19 19 5" />
          <path d="m5 14 0 5 5 0" />
          <path d="m14 5 5 0 0 5" />
        </svg>
      );
    case 'freehand-draw':
      return (
        <svg {...common}>
          <path d="M5 19c2-5 3-2 5-7s3 3 5-2 3 0 4-5" />
          <path d="m15 5 4 0-1 4" />
        </svg>
      );
    case 'erase':
      return (
        <svg {...common}>
          <path d="m8 5 11 11-5 5H8l-5-5 5-11Z" />
          <path d="m8 5 7 7-7 9" />
        </svg>
      );
    case 'transform':
      return (
        <svg {...common}>
          <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4" />
          <path d="M4 4 9 9M20 4l-5 5M4 20l5-5M20 20l-5-5" />
        </svg>
      );
    case 'media':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m5 17 4-4 3 3 2-2 5 3" />
        </svg>
      );
    case 'ai-edit':
      return (
        <svg {...common}>
          <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
          <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
        </svg>
      );
  }
}

export default function ArtPieceEditorToolAvailability({
  engine,
  onActivate,
}: {
  engine: ArtPieceLibrary;
  onActivate?: (tool: ArtPieceEditorToolKey) => void;
}) {
  const capabilities = getArtPieceEditorCapabilities(engine);
  return (
    <fieldset
      className="behavior-card-field"
      data-testid="art-piece-editor-tool-availability"
      aria-label="Editor tools"
    >
      <legend>Editor tools</legend>
      <div className="editor-tool-availability-grid">
        {ART_PIECE_EDITOR_TOOL_KEYS.map((tool) => {
          const capability = capabilities[tool];
          const reasonId = `art-piece-editor-tool-${tool}-reason`;
          return (
            <div key={tool} className="editor-tool-availability-item">
              <button
                type="button"
                disabled={!capability.enabled}
                onClick={() => onActivate?.(tool)}
                aria-label={LABELS[tool]}
                aria-describedby={`${!capability.enabled ? `${reasonId} ` : ''}${reasonId}-tooltip`}
                className="editor-tool-availability-button"
                data-testid={`art-piece-editor-tool-${tool}`}
              >
                <ToolIcon tool={tool} />
                <span
                  id={`${reasonId}-tooltip`}
                  className="editor-tool-availability-tooltip"
                  role="tooltip"
                >
                  {LABELS[tool]}
                  {!capability.enabled && ` — ${capability.reason}`}
                </span>
              </button>
              {!capability.enabled && (
                <span id={reasonId} className="editor-tool-availability-reason visually-hidden">
                  {capability.reason}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
