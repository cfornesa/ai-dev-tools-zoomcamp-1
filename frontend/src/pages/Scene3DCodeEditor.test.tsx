import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as projects3dApi from '../api/projects3d';
import Scene3DCodeEditor from './Scene3DCodeEditor';
import type { Scene3DDocument } from './scene3dTypes';

vi.mock('../api/projects3d');

const mockedSaveSceneVersion3D = vi.mocked(projects3dApi.saveSceneVersion3D);

beforeEach(() => {
  vi.clearAllMocks();
});

function baseScene(): Scene3DDocument {
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
    lights: [],
    groups: [],
    objects: [],
    randomness: { seed: 0, enabled: false },
  };
}

describe('Scene3DCodeEditor', () => {
  it('renders the current scene as pretty-printed JSON', () => {
    const scene = baseScene();
    render(<Scene3DCodeEditor projectId="p1" scene={scene} onSaved={() => {}} />);

    expect(screen.getByTestId('scene3d-code-textarea')).toHaveValue(JSON.stringify(scene, null, 2));
  });

  it('saves a valid edit via the #228 endpoint on blur', async () => {
    const scene = baseScene();
    const edited = { ...scene, scene: { backgroundColor: '#123456' } };
    const savedVersion = {
      id: 2,
      sequence: 2,
      origin: 'manual',
      created_by: 'alice',
      created_at: '2026-01-01T00:00:00Z',
      scene_json: edited,
    };
    mockedSaveSceneVersion3D.mockResolvedValue(savedVersion);
    const onSaved = vi.fn();

    render(<Scene3DCodeEditor projectId="p1" scene={scene} onSaved={onSaved} />);
    const textarea = screen.getByTestId('scene3d-code-textarea');
    fireEvent.change(textarea, { target: { value: JSON.stringify(edited, null, 2) } });
    fireEvent.blur(textarea);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedVersion));
    expect(mockedSaveSceneVersion3D).toHaveBeenCalledWith('p1', edited);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects an invalid edit without saving', async () => {
    const scene = baseScene();
    render(<Scene3DCodeEditor projectId="p1" scene={scene} onSaved={() => {}} />);

    const textarea = screen.getByTestId('scene3d-code-textarea');
    fireEvent.change(textarea, { target: { value: JSON.stringify({ not: 'valid' }, null, 2) } });
    fireEvent.blur(textarea);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
    expect(mockedSaveSceneVersion3D).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without saving', async () => {
    const scene = baseScene();
    render(<Scene3DCodeEditor projectId="p1" scene={scene} onSaved={() => {}} />);

    const textarea = screen.getByTestId('scene3d-code-textarea');
    fireEvent.change(textarea, { target: { value: '{ not valid json' } });
    fireEvent.blur(textarea);

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid json/i);
    expect(mockedSaveSceneVersion3D).not.toHaveBeenCalled();
  });

  it('shows an error and does not call onSaved when the save request fails', async () => {
    const scene = baseScene();
    const edited = { ...scene, scene: { backgroundColor: '#123456' } };
    mockedSaveSceneVersion3D.mockRejectedValue(new Error('network down'));
    const onSaved = vi.fn();

    render(<Scene3DCodeEditor projectId="p1" scene={scene} onSaved={onSaved} />);
    const textarea = screen.getByTestId('scene3d-code-textarea');
    fireEvent.change(textarea, { target: { value: JSON.stringify(edited, null, 2) } });
    fireEvent.blur(textarea);

    expect(await screen.findByRole('alert')).toHaveTextContent(/went wrong saving/i);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
