import { Outlet } from 'react-router-dom';

function Layout() {
  return (
    <div>
      <header>
        <h1>Gesture-Reactive Web Animation Studio</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
