import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vite.config.ts runs tests with `globals: false`, so @testing-library/react's
// own auto-cleanup (which relies on a global `afterEach`) never registers —
// without this, each render() in a multi-test file piles onto the previous
// one's leftover DOM instead of replacing it.
afterEach(() => {
  cleanup();
});
