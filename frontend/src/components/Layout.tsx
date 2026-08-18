import { Outlet } from 'react-router-dom';

import ReducedMotionControl from './ReducedMotionControl';

function Layout() {
  return (
    <div>
      <header>
        <h1>Gesture-Reactive Web Animation Studio</h1>
        <ReducedMotionControl />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
