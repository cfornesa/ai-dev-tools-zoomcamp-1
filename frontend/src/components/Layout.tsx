import { Link, Outlet } from 'react-router-dom';

import ReducedMotionControl from './ReducedMotionControl';

function Layout() {
  return (
    <div>
      <header>
        <h1>Gesture-Reactive Web Animation Studio</h1>
        <nav>
          <Link to="/gallery">Public gallery</Link>
        </nav>
        <ReducedMotionControl />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
