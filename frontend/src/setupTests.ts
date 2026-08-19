import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

// vite.config.ts runs tests with `globals: false`, so @testing-library/react's
// own auto-cleanup (which relies on a global `afterEach`) never registers —
// without this, each render() in a multi-test file piles onto the previous
// one's leftover DOM instead of replacing it.
afterEach(() => {
  cleanup();
});

// Task 64 (issue #64): registers jest-axe's `toHaveNoViolations` matcher
// globally (rather than per a11y test file) so any test file — not just
// the dedicated `*.a11y.test.tsx` suites — can assert
// `expect(await axe(container)).toHaveNoViolations()` with no extra setup.
// `globals: false` (see the comment above) means this file must still
// import `expect` from `vitest` explicitly rather than relying on a global.
expect.extend(toHaveNoViolations);
