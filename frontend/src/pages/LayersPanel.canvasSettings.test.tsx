import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { CanvasSettingsPanel } from './LayersPanel';
import type { SceneEditor } from './useSceneEditor';

const scene = {
  canvas: { width: 800, height: 600, backgroundColor: '#123456' },
} as SceneDocument;

function renderPanel() {
  return render(
    <CanvasSettingsPanel
      sceneEditor={
        {
          workingCopy: scene,
          updateCanvasBackgroundColor: vi.fn(() => ({ ok: true as const })),
          updateCanvasOpacity: vi.fn(() => ({ ok: true as const })),
        } as unknown as SceneEditor
      }
    />,
  );
}

describe('CanvasSettingsPanel', () => {
  it('exposes a semantic heading, square swatch, and adjacent value', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Canvas', level: 4 })).toBeInTheDocument();
    expect(screen.getByLabelText('Canvas background color')).toHaveClass(
      'editor-canvas-color-swatch',
    );
    expect(screen.getByLabelText('Canvas background color value')).toHaveTextContent('#123456');
    expect(screen.getByText('Background color')).toBeInTheDocument();
    expect(screen.getByText('Canvas opacity')).toBeInTheDocument();
  });
});
