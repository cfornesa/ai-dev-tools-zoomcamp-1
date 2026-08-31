import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import Outline3DInspector from './Outline3DInspector';
import type { Scene3DDocument } from './scene3dTypes';

function baseScene(overrides: Partial<Scene3DDocument> = {}): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene3d-1',
    scene: { backgroundColor: '#000000' },
    camera: {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [
      { id: 'l1', type: 'ambient', color: '#ffffff', intensity: 1 },
      {
        id: 'l2',
        type: 'point',
        color: '#ffddaa',
        intensity: 2,
        position: { x: 1, y: 2, z: 3 },
      },
    ],
    groups: [
      {
        id: 'g1',
        name: 'Furniture',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        visible: true,
        locked: false,
      },
    ],
    objects: [
      {
        id: 'o1',
        type: 'box',
        groupId: 'g1',
        transform: {
          position: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#8b5a2b' },
        visible: true,
        width: 1,
        height: 1,
        depth: 1,
      },
      {
        id: 'o2',
        type: 'sphere',
        groupId: null,
        transform: {
          position: { x: 2, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ff0000' },
        visible: true,
        radius: 0.5,
      },
    ],
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

/** Stateful wrapper so onChange edits are actually reflected -- matches
 * how Project3DWorkspace.tsx wires this component. */
function ControlledOutline({ initial }: { initial: Scene3DDocument }) {
  const [scene, setScene] = useState(initial);
  return <Outline3DInspector scene={scene} onChange={setScene} />;
}

describe('Outline3DInspector', () => {
  it('lists camera, groups, objects, and lights in the outline', () => {
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    const list = screen.getByTestId('outline3d-list');
    expect(list).toHaveTextContent('Camera');
    expect(list).toHaveTextContent('Group: Furniture');
    expect(list).toHaveTextContent('Box 1');
    expect(list).toHaveTextContent('Sphere 1');
    expect(list).toHaveTextContent('Ambient light 1');
    expect(list).toHaveTextContent('Point light 1');
  });

  it('shows a read-only camera summary on selection', async () => {
    const user = userEvent.setup();
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Camera' }));

    expect(screen.getByTestId('camera-summary')).toHaveTextContent('FOV: 50°');
  });

  it('edits an object transform field and reflects it back through onChange', async () => {
    const user = userEvent.setup();
    render(<ControlledOutline initial={baseScene()} />);

    await user.click(screen.getByRole('button', { name: 'Box 1' }));
    expect(screen.getByTestId('object-inspector')).toBeInTheDocument();

    const positionX = screen.getByLabelText('Position X');
    fireEvent.change(positionX, { target: { value: '5' } });

    expect(positionX).toHaveValue(5);
  });

  it('edits a group name and it is reflected in the outline list', async () => {
    const user = userEvent.setup();
    render(<ControlledOutline initial={baseScene()} />);

    await user.click(screen.getByRole('button', { name: 'Group: Furniture' }));
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Living room' } });

    expect(screen.getByTestId('outline3d-list')).toHaveTextContent('Group: Living room');
  });

  it("shows an object's material and type-specific dimension fields", async () => {
    const user = userEvent.setup();
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Sphere 1' }));

    expect(screen.getByLabelText('radius')).toHaveValue(0.5);
    expect(screen.getByLabelText('Color')).toHaveValue('#ff0000');
  });

  it("shows a light's position field only for point lights", async () => {
    const user = userEvent.setup();
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Ambient light 1' }));
    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Point light 1' }));
    expect(screen.getByLabelText('Position X')).toHaveValue(1);
  });

  // Issue #281: the outline reads as a Layers-panel-style list -- reuses
  // `LayersPanel.tsx`'s own row/list CSS classes and visually nests a
  // grouped object beneath its group.
  it('reuses the Layers-panel CSS classes on every outline row', () => {
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveClass('editor-outline-row');
    }
  });

  it('indents an object that belongs to a group beneath it, and does not indent a top-level object', () => {
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    const groupedRow = screen.getByRole('button', { name: 'Box 1' }).closest('li')!;
    const topLevelRow = screen.getByRole('button', { name: 'Sphere 1' }).closest('li')!;
    expect(groupedRow).toHaveAttribute('data-nested', 'true');
    expect(groupedRow.style.paddingLeft).not.toBe('');
    expect(topLevelRow).not.toHaveAttribute('data-nested');
  });

  it('marks the selected row with data-selected and aria-current for both directions of selection state', async () => {
    const user = userEvent.setup();
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    const groupButton = screen.getByRole('button', { name: 'Group: Furniture' });
    await user.click(groupButton);

    expect(groupButton).toHaveAttribute('aria-current', 'true');
    expect(groupButton.closest('li')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: 'Camera' }).closest('li')).not.toHaveAttribute(
      'data-selected',
    );
  });

  it('every row stays keyboard-operable (a native <button>, reachable and activatable via keyboard alone)', async () => {
    const user = userEvent.setup();
    render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

    const sphereButton = screen.getByRole('button', { name: 'Sphere 1' });
    sphereButton.focus();
    expect(sphereButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('object-inspector')).toBeInTheDocument();
  });

  it('reassigns an object to a different group via the group select', async () => {
    const user = userEvent.setup();
    render(<ControlledOutline initial={baseScene()} />);

    await user.click(screen.getByRole('button', { name: 'Sphere 1' }));
    const groupSelect = screen.getByLabelText('Group') as HTMLSelectElement;
    expect(groupSelect.value).toBe('');

    await user.selectOptions(groupSelect, 'g1');
    expect(groupSelect.value).toBe('g1');
  });
});
