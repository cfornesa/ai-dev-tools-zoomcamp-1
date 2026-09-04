import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

  // Issue #396: same-target toggle-off, an explicit Clear selection action,
  // and no stale selection surviving a delete -- the 3D outline's parity
  // with the 2D Layers panel's #395 fix.
  describe('clearable selection (issue #396)', () => {
    it('toggles a selected row off on a second activation, without mutating the scene', async () => {
      const user = userEvent.setup();
      const scene = baseScene();
      const onChange = vi.fn();
      render(<Outline3DInspector scene={scene} onChange={onChange} />);

      const groupButton = screen.getByRole('button', { name: 'Group: Furniture' });
      await user.click(groupButton);
      expect(screen.getByTestId('group-inspector')).toBeInTheDocument();

      await user.click(groupButton);
      expect(screen.queryByTestId('group-inspector')).not.toBeInTheDocument();
      expect(groupButton).not.toHaveAttribute('aria-current');
      expect(groupButton.closest('li')).not.toHaveAttribute('data-selected');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('offers an explicit Clear selection action that returns to the no-selection state', async () => {
      const user = userEvent.setup();
      render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);

      await user.click(screen.getByRole('button', { name: 'Sphere 1' }));
      expect(screen.getByTestId('object-inspector')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Clear selection' }));
      expect(screen.queryByTestId('object-inspector')).not.toBeInTheDocument();
      expect(
        screen.getByText('Select an item from the outline to edit its properties.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
    });

    it('has no Clear selection action when nothing is selected', () => {
      render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);
      expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
    });

    it('clears a stale selection when the selected object is deleted from the scene', () => {
      const scene = baseScene();
      const { rerender } = render(<Outline3DInspector scene={scene} onChange={() => {}} />);

      fireEvent.click(screen.getByRole('button', { name: 'Sphere 1' }));
      expect(screen.getByTestId('object-inspector')).toBeInTheDocument();

      const withoutSphere = {
        ...scene,
        objects: scene.objects.filter((o) => o.id !== 'o2'),
      };
      rerender(<Outline3DInspector scene={withoutSphere} onChange={() => {}} />);

      expect(screen.queryByTestId('object-inspector')).not.toBeInTheDocument();
      expect(
        screen.getByText('Select an item from the outline to edit its properties.'),
      ).toBeInTheDocument();
    });

    it('reports the cleared selection to onSelectionChange after a delete', () => {
      const scene = baseScene();
      const onSelectionChange = vi.fn();
      const { rerender } = render(
        <Outline3DInspector
          scene={scene}
          onChange={() => {}}
          onSelectionChange={onSelectionChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Sphere 1' }));
      onSelectionChange.mockClear();

      const withoutSphere = { ...scene, objects: scene.objects.filter((o) => o.id !== 'o2') };
      rerender(
        <Outline3DInspector
          scene={withoutSphere}
          onChange={() => {}}
          onSelectionChange={onSelectionChange}
        />,
      );

      expect(onSelectionChange).toHaveBeenCalledWith(null);
    });
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

  // Issue #284: "Ask AI to change this" on each group/object/light row.
  describe('"Ask AI to change this" (issue #284)', () => {
    it('is absent from every row when onAskAiChange is not provided', () => {
      render(<Outline3DInspector scene={baseScene()} onChange={() => {}} />);
      expect(screen.queryByRole('button', { name: /ask ai to change/i })).not.toBeInTheDocument();
    });

    it("offers the action on group, object, and light rows, seeded with each one's own name/label", async () => {
      const onAskAiChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Outline3DInspector
          scene={baseScene()}
          onChange={() => {}}
          onAskAiChange={onAskAiChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Ask AI to change Furniture' }));
      expect(onAskAiChange).toHaveBeenLastCalledWith('Furniture');

      await user.click(screen.getByRole('button', { name: 'Ask AI to change Box 1' }));
      expect(onAskAiChange).toHaveBeenLastCalledWith('Box 1');

      await user.click(screen.getByRole('button', { name: 'Ask AI to change Ambient light 1' }));
      expect(onAskAiChange).toHaveBeenLastCalledWith('Ambient light 1');
    });

    it('offers no such action on the camera row (no name field to reference)', () => {
      render(
        <Outline3DInspector scene={baseScene()} onChange={() => {}} onAskAiChange={vi.fn()} />,
      );
      expect(
        screen.queryByRole('button', { name: /ask ai to change camera/i }),
      ).not.toBeInTheDocument();
    });
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
