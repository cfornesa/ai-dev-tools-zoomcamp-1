import { Link, useNavigate } from 'react-router-dom';

import { useMenuButton } from '../a11y/useMenuButton';
import {
  createAiAssisted3DProject,
  createAiAssistedAnimation,
  createNew3DProject,
  createNewAnimation,
  type NewProjectRenderer,
} from './galleryCreateActions';

type GalleryCreateMenuProps = {
  renderer: NewProjectRenderer;
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
  onError: (message: string | null) => void;
};

type MenuAction = { id: string; label: string; run: () => Promise<string> };

/**
 * Issue #268: replaces `Gallery.tsx`'s 4 inline "Create X" buttons + the
 * "Browse templates" link with a single split-button -- a "+" that
 * navigates to the full `/create` chooser page (`CreateChooser.tsx`), and
 * an adjacent arrow that opens an accessible dropdown offering the exact
 * same 5 actions inline, via `useMenuButton`'s WAI-ARIA menu-button
 * behavior. Every action here calls the same shared functions
 * (`galleryCreateActions.ts`) `CreateChooser.tsx` calls, so both paths
 * stay behaviorally identical to each other and to the pre-#268 buttons.
 */
function GalleryCreateMenu({
  renderer,
  creating,
  onCreatingChange,
  onError,
}: GalleryCreateMenuProps) {
  const navigate = useNavigate();

  const actions: MenuAction[] = [
    { id: 'create-2d', label: 'Create a new animation', run: () => createNewAnimation(renderer) },
    {
      id: 'create-2d-ai',
      label: 'Create an AI-assisted animation',
      run: () => createAiAssistedAnimation(renderer),
    },
    { id: 'create-3d', label: 'Create a new 3D project', run: createNew3DProject },
    {
      id: 'create-3d-ai',
      label: 'Create an AI-assisted 3D project',
      run: createAiAssisted3DProject,
    },
  ];

  const { isOpen, toggle, close, triggerRef, onTriggerKeyDown, onMenuKeyDown, getItemRef } =
    useMenuButton(actions.length + 1);

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
        </ul>
      )}
    </div>
  );
}

export default GalleryCreateMenu;
