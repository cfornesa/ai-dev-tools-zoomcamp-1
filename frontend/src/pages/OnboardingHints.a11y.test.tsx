import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import OnboardingHints from './OnboardingHints';

/**
 * Task 82 (issue #82): automated accessibility checks (axe-core, via
 * `jest-axe`) for the onboarding-hints surface, matching the codebase's
 * existing convention (e.g. `CameraControl.a11y.test.tsx`) of exercising
 * every meaningfully distinct rendered state.
 */
describe('OnboardingHints accessibility', () => {
  it('empty (no hints) state has no axe violations', async () => {
    const { container } = render(<OnboardingHints hints={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('single-hint state has no axe violations', async () => {
    const { container } = render(
      <OnboardingHints hints={['Enable your camera, then raise one hand.']} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('multiple-hint state has no axe violations', async () => {
    const { container } = render(
      <OnboardingHints
        hints={[
          'Enable your camera, then raise one hand.',
          'Pinch your thumb and index finger to create particles.',
          'Press H to replay these hints.',
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('the all-dismissed replay-legend state has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <OnboardingHints hints={['Enable your camera, then raise one hand.']} />,
    );
    await user.click(
      container.querySelector('button.onboarding-hint-dismiss') as HTMLButtonElement,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
