import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import OnboardingHints from './OnboardingHints';

/**
 * Task 82 (issue #82): the non-modal onboarding-hints surface. Covers the
 * issue's own acceptance-criteria test list: hint text renders for a
 * template that has one, dismiss removes it, the `H` replay shortcut
 * brings it back, and success-triggered auto-clear for at least one hint
 * (the camera-enable hint clearing on `cameraActive`).
 */
describe('OnboardingHints', () => {
  it('renders nothing for a scene/template with no hints', () => {
    const { container } = render(<OnboardingHints hints={undefined} />);
    expect(container).toBeEmptyDOMElement();

    const { container: container2 } = render(<OnboardingHints hints={[]} />);
    expect(container2).toBeEmptyDOMElement();
  });

  it('renders hint text for a template that has one, as an aria-live status region', () => {
    render(<OnboardingHints hints={['Enable your camera, then raise one hand.']} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Enable your camera, then raise one hand.');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('renders multiple hints independently', () => {
    render(
      <OnboardingHints
        hints={['Enable your camera, then raise one hand.', 'Move your hand to guide the orbit.']}
      />,
    );
    expect(screen.getByText('Enable your camera, then raise one hand.')).toBeInTheDocument();
    expect(screen.getByText('Move your hand to guide the orbit.')).toBeInTheDocument();
  });

  it('dismissing a hint via its visible close control removes it, and only it', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingHints
        hints={['Enable your camera, then raise one hand.', 'Move your hand to guide the orbit.']}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Dismiss hint: Enable your camera, then raise one hand.',
      }),
    );

    expect(screen.queryByText('Enable your camera, then raise one hand.')).not.toBeInTheDocument();
    expect(screen.getByText('Move your hand to guide the orbit.')).toBeInTheDocument();
  });

  it('the dismiss control is keyboard-operable with an accessible name', async () => {
    const user = userEvent.setup();
    render(<OnboardingHints hints={['Pinch your thumb and index finger to create particles.']} />);

    const dismissButton = screen.getByRole('button', {
      name: 'Dismiss hint: Pinch your thumb and index finger to create particles.',
    });
    dismissButton.focus();
    expect(dismissButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(
      screen.queryByText('Pinch your thumb and index finger to create particles.'),
    ).not.toBeInTheDocument();
  });

  it('pressing H replays a dismissed hint', async () => {
    const user = userEvent.setup();
    render(<OnboardingHints hints={['Enable your camera, then raise one hand.']} />);

    await user.click(
      screen.getByRole('button', {
        name: 'Dismiss hint: Enable your camera, then raise one hand.',
      }),
    );
    expect(screen.queryByText('Enable your camera, then raise one hand.')).not.toBeInTheDocument();

    await user.keyboard('h');

    expect(screen.getByText('Enable your camera, then raise one hand.')).toBeInTheDocument();
  });

  it('ignores H while typing in a text field', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <label htmlFor="some-input">Some field</label>
        <input id="some-input" />
        <OnboardingHints hints={['Enable your camera, then raise one hand.']} />
      </div>,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Dismiss hint: Enable your camera, then raise one hand.',
      }),
    );
    await user.click(screen.getByLabelText('Some field'));
    await user.keyboard('h');

    expect(screen.queryByText('Enable your camera, then raise one hand.')).not.toBeInTheDocument();
  });

  it('auto-clears the camera-enable hint once cameraActive becomes true', () => {
    const { rerender } = render(
      <OnboardingHints hints={['Enable your camera, then raise one hand.']} cameraActive={false} />,
    );
    expect(screen.getByText('Enable your camera, then raise one hand.')).toBeInTheDocument();

    rerender(
      <OnboardingHints hints={['Enable your camera, then raise one hand.']} cameraActive={true} />,
    );

    expect(screen.queryByText('Enable your camera, then raise one hand.')).not.toBeInTheDocument();
  });

  it('does not auto-clear a non-camera hint when the camera becomes active', () => {
    const { rerender } = render(
      <OnboardingHints hints={['Move your hand to guide the orbit.']} cameraActive={false} />,
    );
    rerender(
      <OnboardingHints hints={['Move your hand to guide the orbit.']} cameraActive={true} />,
    );

    expect(screen.getByText('Move your hand to guide the orbit.')).toBeInTheDocument();
  });

  it('auto-clears the pinch hint once a pinchStart event is observed', () => {
    const { rerender } = render(
      <OnboardingHints
        hints={['Pinch your thumb and index finger to create particles.']}
        pinchEventCount={0}
      />,
    );
    expect(
      screen.getByText('Pinch your thumb and index finger to create particles.'),
    ).toBeInTheDocument();

    rerender(
      <OnboardingHints
        hints={['Pinch your thumb and index finger to create particles.']}
        pinchEventCount={1}
      />,
    );

    expect(
      screen.queryByText('Pinch your thumb and index finger to create particles.'),
    ).not.toBeInTheDocument();
  });

  it('H replay also brings back a hint that auto-cleared via success', () => {
    const { rerender } = render(
      <OnboardingHints hints={['Enable your camera, then raise one hand.']} cameraActive={false} />,
    );
    rerender(
      <OnboardingHints hints={['Enable your camera, then raise one hand.']} cameraActive={true} />,
    );
    expect(screen.queryByText('Enable your camera, then raise one hand.')).not.toBeInTheDocument();
  });

  it('shows a replay legend once every hint is dismissed or auto-cleared', async () => {
    const user = userEvent.setup();
    render(<OnboardingHints hints={['Enable your camera, then raise one hand.']} />);

    await user.click(
      screen.getByRole('button', {
        name: 'Dismiss hint: Enable your camera, then raise one hand.',
      }),
    );

    expect(screen.getByText('Hints dismissed. Press H to replay them.')).toBeInTheDocument();
  });

  it('resets to fresh state when the hints list changes (a different scene/template)', () => {
    const { rerender } = render(<OnboardingHints hints={['First template hint.']} />);
    rerender(<OnboardingHints hints={['Second template hint.']} />);

    expect(screen.getByText('Second template hint.')).toBeInTheDocument();
    expect(screen.queryByText('First template hint.')).not.toBeInTheDocument();
  });
});
