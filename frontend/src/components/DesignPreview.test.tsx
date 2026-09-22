import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import DesignPreview from './DesignPreview';

const presentation = {
  font_family: 'script' as const,
  density: 'comfortable' as const,
  radius: 'soft' as const,
  border_style: 'solid' as const,
  shadow: 'soft' as const,
  backdrop: 'cosmic' as const,
};

const palettes = {
  light: {
    background: '#fff',
    foreground: '#111',
    muted: '#eee',
    muted_foreground: '#555',
    primary: '#123456',
    primary_foreground: '#fff',
    secondary: '#345678',
    secondary_foreground: '#fff',
    accent: '#f59e0b',
    accent_foreground: '#111',
    destructive: '#dc2626',
    destructive_foreground: '#fff',
  },
  dark: {
    background: '#111',
    foreground: '#fff',
    muted: '#222',
    muted_foreground: '#bbb',
    primary: '#abcdef',
    primary_foreground: '#111',
    secondary: '#789abc',
    secondary_foreground: '#111',
    accent: '#fbbf24',
    accent_foreground: '#111',
    destructive: '#f87171',
    destructive_foreground: '#111',
  },
};

describe('DesignPreview', () => {
  it('renders a sandboxed readable iframe and toggles light/dark source documents', async () => {
    const user = userEvent.setup();
    render(<DesignPreview label="Celestial" presentation={presentation} palettes={palettes} />);

    const frame = screen.getByTitle('Celestial light page preview') as HTMLIFrameElement;
    expect(frame).toHaveAttribute('sandbox', '');
    expect(frame.srcdoc).toContain('Georgia');
    expect(frame.srcdoc).toContain('Readable body text');

    await user.click(screen.getByRole('button', { name: /dark/i }));
    expect(screen.getByTitle('Celestial dark page preview')).toHaveAttribute('srcdoc');
    expect(
      (screen.getByTitle('Celestial dark page preview') as HTMLIFrameElement).srcdoc,
    ).toContain('data-mode="dark"');
  });
});
