import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ART_PIECE_ENGINE_CAPABILITIES, type ArtPieceLibrary } from '../api/artPieces';
import { useAuth } from '../auth/useAuth';
import {
  createChooser2DProject,
  createChooser3DProject,
  getGeneratedArtPieceStartPath,
  type CreationMode,
  type NewProjectRenderer,
} from './galleryCreateActions';

type PieceKind = '2d' | '3d' | 'generated';

const RENDERER_OPTIONS: Array<{ value: NewProjectRenderer; label: string }> = [
  { value: 'p5', label: 'p5.js' },
  { value: 'canvas2d', label: 'Canvas2D' },
  { value: 'svg', label: 'SVG' },
];

function CreateChooser() {
  const navigate = useNavigate();
  const auth = useAuth();
  const ownerId = auth.status === 'signed-in' ? auth.user.username : '';
  const [kind, setKind] = useState<PieceKind>('2d');
  const [renderer, setRenderer] = useState<NewProjectRenderer>('p5');
  const [library, setLibrary] = useState<ArtPieceLibrary>('canvas2d');
  const [creatingMode, setCreatingMode] = useState<CreationMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(mode: CreationMode) {
    setCreatingMode(mode);
    setError(null);
    try {
      if (kind === '2d') navigate(await createChooser2DProject(ownerId, renderer, mode));
      else if (kind === '3d') navigate(await createChooser3DProject(ownerId, mode));
      else navigate(getGeneratedArtPieceStartPath(library, mode));
    } catch {
      setError(`Could not create a project. Please try again.`);
      setCreatingMode(null);
    }
  }

  return (
    <section className="page-shell create-chooser" aria-labelledby="create-chooser-heading">
      <h2 id="create-chooser-heading">Create</h2>
      <p>Choose a piece type and how you want to start.</p>

      {error && (
        <p role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <fieldset className="create-chooser-kind">
        <legend>What do you want to create?</legend>
        <label>
          <input
            type="radio"
            name="piece-kind"
            value="2d"
            checked={kind === '2d'}
            onChange={() => setKind('2d')}
          />
          Structured 2D scene
        </label>
        <label>
          <input
            type="radio"
            name="piece-kind"
            value="3d"
            checked={kind === '3d'}
            onChange={() => setKind('3d')}
          />
          Structured 3D scene
        </label>
        <label>
          <input
            type="radio"
            name="piece-kind"
            value="generated"
            checked={kind === 'generated'}
            onChange={() => setKind('generated')}
          />
          Generated art piece
        </label>
      </fieldset>

      {kind === '2d' && (
        <label htmlFor="create-chooser-renderer">
          2D renderer
          <select
            id="create-chooser-renderer"
            value={renderer}
            onChange={(event) => setRenderer(event.target.value as NewProjectRenderer)}
          >
            {RENDERER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {kind === 'generated' && (
        <label htmlFor="create-chooser-library">
          Generated library
          <select
            id="create-chooser-library"
            value={library}
            onChange={(event) => setLibrary(event.target.value as ArtPieceLibrary)}
          >
            {Object.entries(ART_PIECE_ENGINE_CAPABILITIES).map(([value, capability]) => (
              <option key={value} value={value}>
                {capability.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="create-chooser-actions" aria-label="Choose how to start">
        <button
          className="shell-action"
          type="button"
          onClick={() => void handleChoose('blank')}
          disabled={creatingMode !== null}
        >
          {creatingMode === 'blank' ? 'Opening blank editor…' : 'Start blank'}
        </button>
        <button
          className="shell-action"
          type="button"
          onClick={() => void handleChoose('ai')}
          disabled={creatingMode !== null}
        >
          {creatingMode === 'ai' ? 'Opening AI tools…' : 'Start with AI'}
        </button>
      </div>

      <p>
        Want a prebuilt 2D scene? <Link to="/templates">Browse templates</Link>.
      </p>
    </section>
  );
}

export default CreateChooser;
