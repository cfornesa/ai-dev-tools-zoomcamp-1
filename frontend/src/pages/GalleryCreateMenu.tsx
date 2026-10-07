import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useMenuButton } from '../a11y/useMenuButton';
import { useAuth } from '../auth/useAuth';
import {
  createLocalGeneratedPiece,
  createNew3DProject,
  createNewAnimation,
} from './galleryCreateActions';

type GalleryCreateMenuProps = {
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
  onError: (message: string | null) => void;
  onImport: (file: File) => Promise<void>;
};

type MenuAction = { id: string; label: string; run: () => Promise<string> };

/**
 * Issue #268/#1276: the plus opens the unified `/create` chooser, where a
 * user selects a piece kind/library and starts blank or with AI. The
 * adjacent accessible menu keeps the pre-existing quick-create actions,
 * template link and package import entry point working for compatibility.
 */
function GalleryCreateMenu({
  creating,
  onCreatingChange,
  onError,
  onImport,
}: GalleryCreateMenuProps) {
  const navigate = useNavigate();
  const auth = useAuth();
  const ownerId = auth.status === 'signed-in' ? auth.user.username : '';
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const actions: MenuAction[] = [
    {
      id: 'create-2d-p5',
      label: 'Create a new 2D project with p5.js',
      run: () => createNewAnimation(ownerId, 'p5'),
    },
    {
      id: 'create-2d-canvas2d',
      label: 'Create a new 2D project with Canvas2D',
      run: () => createNewAnimation(ownerId, 'canvas2d'),
    },
    {
      id: 'create-2d-svg',
      label: 'Create a new 2D project with SVG',
      run: () => createNewAnimation(ownerId, 'svg'),
    },
    { id: 'create-3d', label: 'Create a new 3D project', run: () => createNew3DProject(ownerId) },
    {
      id: 'create-generated-local',
      label: 'Create a local generated piece',
      run: () => createLocalGeneratedPiece(ownerId),
    },
  ];

  const { isOpen, toggle, close, triggerRef, onTriggerKeyDown, onMenuKeyDown, getItemRef } =
    useMenuButton(actions.length + 2);

  async function handleSelect(action: MenuAction) {
    close();
    onCreatingChange(true);
    onError(null);
    try {
      navigate(await action.run());
    } catch {
      onError('Could not create a new project. Please try again.');
      onCreatingChange(false);
    }
  }

  function handleBrowseTemplates() {
    close();
    navigate('/templates');
  }

  return (
    <div className="gallery-create-split">
      <Link
        className="shell-action gallery-create-plus"
        to="/create"
        aria-label="Create a new project"
      >
        +
      </Link>
      <button
        type="button"
        className="shell-action gallery-create-arrow"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More creation options"
        disabled={creating}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        ref={triggerRef}
      >
        ▾
      </button>
      {isOpen && (
        <ul role="menu" aria-label="Create a new project" className="gallery-create-dropdown">
          {actions.map((action, index) => (
            <li role="none" key={action.id}>
              <button
                type="button"
                role="menuitem"
                ref={getItemRef(index)}
                onKeyDown={(event) => onMenuKeyDown(event, index)}
                onClick={() => void handleSelect(action)}
                disabled={creating}
              >
                {action.label}
              </button>
            </li>
          ))}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              ref={getItemRef(actions.length)}
              onKeyDown={(event) => onMenuKeyDown(event, actions.length)}
              onClick={handleBrowseTemplates}
            >
              Browse templates
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              ref={getItemRef(actions.length + 1)}
              onKeyDown={(event) => onMenuKeyDown(event, actions.length + 1)}
              onClick={() => importInputRef.current?.click()}
              disabled={creating}
            >
              Import a piece package
            </button>
          </li>
        </ul>
      )}
      <input
        ref={importInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          close();
          onCreatingChange(true);
          onError(null);
          void onImport(file).finally(() => onCreatingChange(false));
          event.target.value = '';
        }}
      />
    </div>
  );
}

export default GalleryCreateMenu;
