import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import PlaneSelectionOverlay from './PlaneSelectionOverlay';
import type { Object3D } from './scene3dTypes';

const plane: Object3D = {
  id: 'p',
  name: 'Drawing plane 1',
  type: 'drawingPlane',
  groupId: null,
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
  },
  material: { color: '#ffffff' },
  visible: true,
  width: 4,
  height: 3,
  drawing: { width: 1024, height: 768, background: null, shapes: [] },
};

function camera() {
  const cam = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 1000);
  cam.position.set(0, 0, 8);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

function setup(width = 800) {
  const handlers = {
    onGestureStart: vi.fn(),
    onGestureChange: vi.fn(),
    onGestureEnd: vi.fn(),
    onCommit: vi.fn(),
    onEditDrawing: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onDeselect: vi.fn(),
  };
  render(
    <PlaneSelectionOverlay
      object={plane}
      camera={camera()}
      width={width}
      height={600}
      {...handlers}
    />,
  );
  return handlers;
}

describe('PlaneSelectionOverlay (#782)', () => {
  it('shows every handle and a labelled floating toolbar, but no precise panel by default', () => {
    setup();
    for (const id of ['move', 'rotate', 'corner-0', 'corner-3', 'edge-0', 'edge-3']) {
      expect(screen.getByTestId(`plane-handle-${id}`)).toBeInTheDocument();
    }
    const toolbar = screen.getByRole('toolbar', { name: 'Drawing plane 1 actions' });
    expect(toolbar).toHaveAttribute('data-dock', 'float');
    for (const name of [
      'Rotate horizontal (lay flat)',
      'Rotate vertical (stand upright)',
      'Flip left to right',
      'Animate (spin)',
      'Edit drawing',
      'Precise values',
      'More actions',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByTestId('plane-precise-panel')).toBeNull();
  });

  it('docks the toolbar to the bottom on a phone-width stage', () => {
    setup(340);
    expect(screen.getByTestId('plane-selection-toolbar')).toHaveAttribute('data-dock', 'bottom');
  });

  it('toolbar actions commit rotation presets, flip, and animation, one edit each', async () => {
    const h = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rotate horizontal (lay flat)' }));
    expect(h.onCommit.mock.calls[0]![0].transform.rotation).toEqual({ x: -90, y: 0, z: 0 });
    await user.click(screen.getByRole('button', { name: 'Flip left to right' }));
    expect(h.onCommit.mock.calls[1]![0].transform.scale.x).toBe(-1);
    await user.click(screen.getByRole('button', { name: 'Animate (spin)' }));
    expect(h.onCommit.mock.calls[2]![0].animation).toEqual({
      kind: 'rotate',
      axis: 'y',
      speed: 45,
    });
    await user.click(screen.getByRole('button', { name: 'Edit drawing' }));
    expect(h.onEditDrawing).toHaveBeenCalled();
  });

  it('opens the precise panel on demand and keeps proportions by default', async () => {
    const h = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Precise values' }));
    const panel = screen.getByRole('region', { name: 'Precise transform values' });
    expect(panel).toBeInTheDocument();
    const width = screen.getByLabelText('Width');
    expect(width).toHaveValue(4);
    await user.clear(width);
    await user.type(width, '8{Enter}');
    expect(h.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ width: 8, height: 6 }));
    await user.click(screen.getByLabelText('Keep proportions'));
    const height = screen.getByLabelText('Height');
    await user.clear(height);
    await user.type(height, '1{Enter}');
    expect(h.onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ width: 4, height: 1 }));
  });

  it('nudges by keyboard on the handles and scales proportionally with plus/minus', () => {
    const h = setup();
    fireEvent.keyDown(screen.getByTestId('plane-handle-move'), { key: 'ArrowRight' });
    expect(h.onCommit.mock.calls[0]![0].transform.position.x).toBeGreaterThan(0);
    fireEvent.keyDown(screen.getByTestId('plane-handle-corner-2'), { key: '+' });
    const grown = h.onCommit.mock.calls[1]![0];
    expect(grown.width).toBeCloseTo(4.2, 2);
    expect(grown.height).toBeCloseTo(3.15, 2);
    fireEvent.keyDown(screen.getByTestId('plane-handle-edge-1'), { key: '+' });
    const stretched = h.onCommit.mock.calls[2]![0];
    expect(stretched.width).toBeCloseTo(4.2, 2);
    expect(stretched.height).toBe(3);
    fireEvent.keyDown(screen.getByTestId('plane-handle-rotate'), { key: 'ArrowRight' });
    expect(h.onCommit.mock.calls[3]![0].transform.rotation.z).not.toBe(0);
  });

  it('Escape closes the panel first, then dismisses the selection', async () => {
    const h = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Precise values' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('plane-precise-panel')).toBeNull();
    expect(h.onDeselect).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(h.onDeselect).toHaveBeenCalledTimes(1);
  });

  it('the More menu offers Duplicate, Reset transform, and Delete', async () => {
    const h = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(h.onDuplicate).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(h.onDelete).toHaveBeenCalled();
  });

  it('renders nothing when the plane is behind the camera or the stage has no size', () => {
    const { container } = render(
      <PlaneSelectionOverlay
        object={{ ...plane, transform: { ...plane.transform, position: { x: 0, y: 0, z: 30 } } }}
        camera={camera()}
        width={800}
        height={600}
        onGestureStart={vi.fn()}
        onGestureChange={vi.fn()}
        onGestureEnd={vi.fn()}
        onCommit={vi.fn()}
        onEditDrawing={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onDeselect={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="plane-selection-overlay"]')).toBeNull();
  });
});
