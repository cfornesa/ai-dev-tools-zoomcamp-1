import { NavLink } from 'react-router-dom';
import { useState } from 'react';

export default function AdminConsoleNav({
  current,
}: {
  current: 'pages' | 'content' | 'settings';
}) {
  const [open, setOpen] = useState(false);
  return (
    <nav className="admin-console-nav" aria-label="Admin console">
      <strong>Admin console</strong>
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
        <NavLink to="/admin/pages" aria-current={current === 'pages' ? 'page' : undefined}>
          Pages
        </NavLink>
        <NavLink to="/admin/content" aria-current={current === 'content' ? 'page' : undefined}>
          Content
        </NavLink>
        <NavLink to="/admin/settings" aria-current={current === 'settings' ? 'page' : undefined}>
          Settings and plans
        </NavLink>
        <NavLink to="/gallery">Return to public site</NavLink>
      </div>
    </nav>
  );
}
