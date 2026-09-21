import { useEffect, useMemo, useState } from 'react';

import type { ArtPieceLibrary } from '../api/artPieces';
import {
  defaultGenerated3DTransform,
  listGenerated3DObjects,
  type Generated3DPrimitive,
  type Generated3DTransform,
} from '../pages/generated3dManualTools';

const FIELDS: Array<{ key: keyof Generated3DTransform; label: string; step: string }> = [
  { key: 'x', label: 'X', step: '0.1' },
  { key: 'y', label: 'Y', step: '0.1' },
  { key: 'z', label: 'Z', step: '0.1' },
  { key: 'rotationX', label: 'Rotation X (degrees)', step: '1' },
  { key: 'rotationY', label: 'Rotation Y (degrees)', step: '1' },
  { key: 'rotationZ', label: 'Rotation Z (degrees)', step: '1' },
  { key: 'scaleX', label: 'Scale X', step: '0.1' },
  { key: 'scaleY', label: 'Scale Y', step: '0.1' },
  { key: 'scaleZ', label: 'Scale Z', step: '0.1' },
];

export default function Generated3DManualTools({
  engine,
  source,
  selectedId,
  onSelect,
  onAdd,
  onTransform,
}: {
  engine: Extract<ArtPieceLibrary, 'threejs' | 'aframe'>;
  source: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (primitive: Generated3DPrimitive) => void;
  onTransform: (transform: Generated3DTransform) => void;
}) {
  const objects = useMemo(() => listGenerated3DObjects(source, engine), [source, engine]);
  const [transform, setTransform] = useState(() => ({
    ...defaultGenerated3DTransform(),
    y: engine === 'aframe' ? 1.6 : 0,
  }));

  useEffect(() => {
    if (!selectedId && objects[0]) onSelect(objects[0].id);
  }, [objects, onSelect, selectedId]);

  function updateField(key: keyof Generated3DTransform, value: string) {
    const numeric = Number(value);
    setTransform((current) => ({ ...current, [key]: Number.isFinite(numeric) ? numeric : 0 }));
  }

  return (
    <section className="behavior-card-field" data-testid="art-piece-editor-3d-manual-tools">
      <h3>3D manual tools</h3>
      <p>Add a primitive, select it, then apply numeric translation, rotation, or scale.</p>
      <div className="editor-tool-availability-grid">
        <button
          type="button"
          onClick={() => onAdd('add-box')}
          data-testid="art-piece-editor-add-box"
        >
          Add box
        </button>
        <button
          type="button"
          onClick={() => onAdd('add-sphere')}
          data-testid="art-piece-editor-add-sphere"
        >
          Add sphere
        </button>
        <button
          type="button"
          onClick={() => onAdd('add-plane')}
          data-testid="art-piece-editor-add-plane"
        >
          Add plane
        </button>
      </div>
      <label htmlFor="art-piece-editor-3d-selection">Selected object (outlined in preview)</label>
      <select
        id="art-piece-editor-3d-selection"
        value={selectedId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        disabled={objects.length === 0}
      >
        {objects.length === 0 && <option value="">Add a primitive to begin</option>}
        {objects.map((object) => (
          <option key={object.id} value={object.id}>
            {object.label}
          </option>
        ))}
      </select>
      <fieldset>
        <legend>Transform selected object</legend>
        <div className="editor-tool-availability-grid">
          {FIELDS.map(({ key, label, step }) => (
            <label key={key} htmlFor={`art-piece-editor-3d-${key}`}>
              {label}
              <input
                id={`art-piece-editor-3d-${key}`}
                type="number"
                step={step}
                value={transform[key]}
                onChange={(event) => updateField(key, event.target.value)}
                disabled={!selectedId}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onTransform(transform)}
          disabled={!selectedId}
          data-testid="art-piece-editor-apply-3d-transform"
        >
          Apply transform
        </button>
      </fieldset>
    </section>
  );
}
