import { NavLink } from 'react-router-dom';
import { useState, type KeyboardEvent } from 'react';

export default function AdminConsoleNav({
  current,
}: {
  current: 'pages' | 'content' | 'settings';
}) {
  const [open, setOpen] = useState(false);

  function closeMenuOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <nav className="admin-console-nav" aria-label="Admin console" onKeyDown={closeMenuOnEscape}>
      <h2 className="admin-console-heading">Admin console</h2>
      <button
        className="admin-console-menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="admin-console-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Close menu' : 'Open menu'}
      </button>
      <div id="admin-console-menu" className="admin-console-menu" hidden={!open}>
        <NavLink
          to="/admin/pages"
          aria-current={current === 'pages' ? 'page' : undefined}
          onClick={() => setOpen(false)}
        >
          Pages
        </NavLink>
        <NavLink
          to="/admin/content"
          aria-current={current === 'content' ? 'page' : undefined}
          onClick={() => setOpen(false)}
        >
          Content
        </NavLink>
        <NavLink
          to="/admin/settings"
          aria-current={current === 'settings' ? 'page' : undefined}
          onClick={() => setOpen(false)}
        >
          Settings and plans
        </NavLink>
        <NavLink to="/gallery" onClick={() => setOpen(false)}>
          Return to public site
        </NavLink>
      </div>
    </nav>
  );
}
