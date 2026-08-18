import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import RandomnessIndicator from './RandomnessIndicator';
import { baseScene } from '../render/testSceneFixtures';

describe('RandomnessIndicator (Task 40: read-only "Randomness enabled" indicator)', () => {
  it('renders nothing when scene is null', () => {
    const { container } = render(<RandomnessIndicator scene={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when randomness.enabled is false and no random graph nodes exist', () => {
    const scene = baseScene({ randomness: { seed: 0, enabled: false } });
    const { container } = render(<RandomnessIndicator scene={scene} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Randomness enabled" and the seed when randomness.enabled is true', () => {
    render(
      <RandomnessIndicator scene={baseScene({ randomness: { seed: 483920, enabled: true } })} />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Randomness enabled');
    expect(status).toHaveTextContent('483920');
  });

  it('shows the indicator when a random graph node exists, even if randomness.enabled is false', () => {
    const scene = baseScene({
      randomness: { seed: 7, enabled: false },
      graph: {
        nodes: [
          {
            id: 'r1',
            family: 'input',
            type: 'randomRange',
            params: { min: 0, max: 1 },
            position: { x: 0, y: 0 },
          },
        ],
        connections: [],
      },
    });
    render(<RandomnessIndicator scene={scene} />);
    expect(screen.getByRole('status')).toHaveTextContent('Randomness enabled');
  });

  it('has no interactive controls (no button/input/select) — read-only, never rerolls a seed', () => {
    render(<RandomnessIndicator scene={baseScene({ randomness: { seed: 1, enabled: true } })} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
