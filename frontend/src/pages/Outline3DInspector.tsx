import { useId, useState } from 'react';

import {
  object3DLabel,
  light3DLabel,
  type Group3D,
  type Light3D,
  type Object3D,
  type Object3DType,
  type Scene3DDocument,
  type Transform3D,
  type Vec3,
} from './scene3dTypes';

type Selection =
  | { kind: 'object'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'light'; id: string }
  | { kind: 'camera' }
  | null;

type Props = {
  scene: Scene3DDocument;
  onChange: (next: Scene3DDocument) => void;
};

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const id = useId();
  return (
    <div className="behavior-card-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </div>
  );
}

function Vec3Fields({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: Vec3;
  onChange: (next: Vec3) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <NumberField
        label={`${legend} X`}
        value={value.x}
        onChange={(x) => onChange({ ...value, x })}
      />
      <NumberField
        label={`${legend} Y`}
        value={value.y}
        onChange={(y) => onChange({ ...value, y })}
      />
      <NumberField
        label={`${legend} Z`}
        value={value.z}
        onChange={(z) => onChange({ ...value, z })}
      />
    </fieldset>
  );
}

function TransformFields({
  transform,
  onChange,
}: {
  transform: Transform3D;
  onChange: (next: Transform3D) => void;
}) {
  return (
    <>
      <Vec3Fields
        legend="Position"
        value={transform.position}
        onChange={(position) => onChange({ ...transform, position })}
      />
      <Vec3Fields
        legend="Rotation"
        value={transform.rotation}
        onChange={(rotation) => onChange({ ...transform, rotation })}
      />
      <Vec3Fields
        legend="Scale"
        value={transform.scale}
        onChange={(scale) => onChange({ ...transform, scale })}
      />
      <NumberField
        label="Opacity"
        value={transform.opacity}
        onChange={(opacity) => onChange({ ...transform, opacity })}
      />
    </>
  );
}

const OBJECT_TYPE_DIMENSION_FIELDS: Record<Object3DType, (keyof Object3D)[]> = {
  box: ['width', 'height', 'depth'],
  sphere: ['radius'],
  cylinder: ['radiusTop', 'radiusBottom', 'height'],
  plane: ['width', 'height'],
};

/**
 * Issue #227: the 3D-manual equivalent of the 2D editor's Layers panel +
 * shape inspector -- a flat outline (the 3D schema's `groups` don't nest,
 * per `schema/README3d.md`) of objects/groups/lights, a camera summary,
 * and property editing on selection. Works entirely against the `scene`
 * prop in memory -- no server save wiring here (that's a separate follow-
 * on once this UI's shape is concrete, filed alongside this issue).
 */
function Outline3DInspector({ scene, onChange }: Props) {
  const [selection, setSelection] = useState<Selection>(null);

  function updateObject(id: string, patch: Partial<Object3D>) {
    onChange({
      ...scene,
      objects: scene.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  }

  function updateGroup(id: string, patch: Partial<Group3D>) {
    onChange({
      ...scene,
      groups: scene.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    });
  }

  function updateLight(id: string, patch: Partial<Light3D>) {
    onChange({
      ...scene,
      lights: scene.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  const selectedObject =
    selection?.kind === 'object' ? scene.objects.find((o) => o.id === selection.id) : undefined;
  const selectedGroup =
    selection?.kind === 'group' ? scene.groups.find((g) => g.id === selection.id) : undefined;
  const selectedLight =
    selection?.kind === 'light' ? scene.lights.find((l) => l.id === selection.id) : undefined;

  return (
    <div className="outline3d-panel">
      <section aria-label="Outline" role="region" data-panel="outline3d">
        <h4>Scene outline</h4>
        <ul className="outline3d-list" data-testid="outline3d-list">
          <li>
            <button
              type="button"
              aria-pressed={selection?.kind === 'camera'}
              onClick={() => setSelection({ kind: 'camera' })}
            >
              Camera
            </button>
          </li>
          {scene.groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                aria-pressed={selection?.kind === 'group' && selection.id === group.id}
                onClick={() => setSelection({ kind: 'group', id: group.id })}
              >
                Group: {group.name}
              </button>
            </li>
          ))}
          {scene.objects.map((object) => (
            <li key={object.id}>
              <button
                type="button"
                aria-pressed={selection?.kind === 'object' && selection.id === object.id}
                onClick={() => setSelection({ kind: 'object', id: object.id })}
              >
                {object3DLabel(object, scene.objects)}
              </button>
            </li>
          ))}
          {scene.lights.map((light) => (
            <li key={light.id}>
              <button
                type="button"
                aria-pressed={selection?.kind === 'light' && selection.id === light.id}
                onClick={() => setSelection({ kind: 'light', id: light.id })}
              >
                {light3DLabel(light, scene.lights)}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Inspector" role="region" data-panel="inspector3d">
        <h4>Inspector</h4>

        {selection?.kind === 'camera' && (
          <div data-testid="camera-summary">
            <p>
              Position: {scene.camera.position.x}, {scene.camera.position.y},{' '}
              {scene.camera.position.z}
            </p>
            <p>
              Target: {scene.camera.target.x}, {scene.camera.target.y}, {scene.camera.target.z}
            </p>
            <p>FOV: {scene.camera.fov}°</p>
            <p>
              Near/far: {scene.camera.near} / {scene.camera.far}
            </p>
          </div>
        )}

        {selectedGroup && (
          <div data-testid="group-inspector">
            <div className="behavior-card-field">
              <label htmlFor="group-name-input">Name</label>
              <input
                id="group-name-input"
                type="text"
                value={selectedGroup.name}
                onChange={(event) => updateGroup(selectedGroup.id, { name: event.target.value })}
              />
            </div>
            <label>
              <input
                type="checkbox"
                checked={selectedGroup.visible}
                onChange={(event) =>
                  updateGroup(selectedGroup.id, { visible: event.target.checked })
                }
              />
              Visible
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedGroup.locked}
                onChange={(event) =>
                  updateGroup(selectedGroup.id, { locked: event.target.checked })
                }
              />
              Locked
            </label>
            <TransformFields
              transform={selectedGroup.transform}
              onChange={(transform) => updateGroup(selectedGroup.id, { transform })}
            />
          </div>
        )}

        {selectedObject && (
          <div data-testid="object-inspector">
            <div className="behavior-card-field">
              <label htmlFor="object-group-select">Group</label>
              <select
                id="object-group-select"
                value={selectedObject.groupId ?? ''}
                onChange={(event) =>
                  updateObject(selectedObject.id, { groupId: event.target.value || null })
                }
              >
                <option value="">None</option>
                {scene.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <label>
              <input
                type="checkbox"
                checked={selectedObject.visible}
                onChange={(event) =>
                  updateObject(selectedObject.id, { visible: event.target.checked })
                }
              />
              Visible
            </label>
            <TransformFields
              transform={selectedObject.transform}
              onChange={(transform) => updateObject(selectedObject.id, { transform })}
            />
            <fieldset>
              <legend>Material</legend>
              <div className="behavior-card-field">
                <label htmlFor="object-material-color">Color</label>
                <input
                  id="object-material-color"
                  type="text"
                  value={selectedObject.material.color}
                  onChange={(event) =>
                    updateObject(selectedObject.id, {
                      material: { ...selectedObject.material, color: event.target.value },
                    })
                  }
                />
              </div>
              <NumberField
                label="Material opacity"
                value={selectedObject.material.opacity ?? 1}
                onChange={(opacity) =>
                  updateObject(selectedObject.id, {
                    material: { ...selectedObject.material, opacity },
                  })
                }
              />
              <div className="behavior-card-field">
                <label htmlFor="object-material-emissive">Emissive</label>
                <input
                  id="object-material-emissive"
                  type="text"
                  value={selectedObject.material.emissive ?? ''}
                  onChange={(event) =>
                    updateObject(selectedObject.id, {
                      material: { ...selectedObject.material, emissive: event.target.value },
                    })
                  }
                />
              </div>
            </fieldset>
            <fieldset>
              <legend>Dimensions</legend>
              {OBJECT_TYPE_DIMENSION_FIELDS[selectedObject.type].map((field) => (
                <NumberField
                  key={field}
                  label={String(field)}
                  value={Number(selectedObject[field] ?? 0)}
                  onChange={(next) => updateObject(selectedObject.id, { [field]: next })}
                />
              ))}
            </fieldset>
          </div>
        )}

        {selectedLight && (
          <div data-testid="light-inspector">
            <div className="behavior-card-field">
              <label htmlFor="light-color-input">Color</label>
              <input
                id="light-color-input"
                type="text"
                value={selectedLight.color}
                onChange={(event) => updateLight(selectedLight.id, { color: event.target.value })}
              />
            </div>
            <NumberField
              label="Intensity"
              value={selectedLight.intensity}
              onChange={(intensity) => updateLight(selectedLight.id, { intensity })}
            />
            {selectedLight.type === 'point' && selectedLight.position && (
              <Vec3Fields
                legend="Position"
                value={selectedLight.position}
                onChange={(position) => updateLight(selectedLight.id, { position })}
              />
            )}
            {selectedLight.type === 'directional' && selectedLight.direction && (
              <Vec3Fields
                legend="Direction"
                value={selectedLight.direction}
                onChange={(direction) => updateLight(selectedLight.id, { direction })}
              />
            )}
          </div>
        )}

        {!selection && <p>Select an item from the outline to edit its properties.</p>}
      </section>
    </div>
  );
}

export default Outline3DInspector;
