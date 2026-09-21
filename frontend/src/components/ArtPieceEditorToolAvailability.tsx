import {
  ART_PIECE_EDITOR_TOOL_KEYS,
  getArtPieceEditorCapabilities,
  type ArtPieceEditorToolKey,
} from './artPieceEditorCapabilities';
import type { ArtPieceLibrary } from '../api/artPieces';

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
                aria-describedby={!capability.enabled ? reasonId : undefined}
                data-testid={`art-piece-editor-tool-${tool}`}
              >
                {LABELS[tool]}
              </button>
              {!capability.enabled && (
                <span id={reasonId} className="editor-tool-availability-reason">
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
