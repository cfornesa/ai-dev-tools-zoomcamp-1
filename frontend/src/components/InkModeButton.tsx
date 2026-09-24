import PieceStageIcon from './PieceStageIcon';
import { usePieceStageMenu } from './PieceStageToolbar';

/**
 * Issues #775/#781: the stage-toolbar action that starts Ink/Draw mode. It sits with the engine tools
 * (icon-only with a hover/focus label like every toolbar action) and dismisses the piece-controls menu
 * before taking over the stage.
 */
export default function InkModeButton({
  label,
  active,
  disabled = false,
  testId = 'ink-mode-button',
  onBegin,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  testId?: string;
  onBegin: () => void;
}) {
  const { closeMenu } = usePieceStageMenu();
  return (
    <button
      type="button"
      className="piece-stage-icon-button"
      data-testid={testId}
      aria-label={label}
      aria-pressed={active}
      disabled={active || disabled}
      onClick={() => {
        closeMenu();
        onBegin();
      }}
    >
      <PieceStageIcon name="ink" />
      <span className="piece-stage-action-label">{label}</span>
      <span className="piece-stage-tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}
