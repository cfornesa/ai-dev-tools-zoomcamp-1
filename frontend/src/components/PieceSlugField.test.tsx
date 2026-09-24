import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import PieceSlugField from './PieceSlugField';

describe('PieceSlugField (#750)', () => {
  it('saves only a changed slug and reports the server result', async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ public_slug: 'new-slug', editor_url: '/users/@a/edit/new-slug' });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<PieceSlugField current="old-slug" save={save} onSaved={onSaved} />);
    const button = screen.getByRole('button', { name: 'Save slug' });
    expect(button).toBeDisabled();
    const input = screen.getByLabelText('Public URL slug');
    expect(input).toHaveValue('old-slug');
    await user.clear(input);
    await user.type(input, 'new-slug');
    await user.click(button);
    expect(save).toHaveBeenCalledWith('new-slug');
    expect(onSaved).toHaveBeenCalledWith({
      public_slug: 'new-slug',
      editor_url: '/users/@a/edit/new-slug',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Slug saved.');
  });

  it('warns that old links stop working and explains a collision', async () => {
    const save = vi
      .fn()
      .mockRejectedValue(new ApiError(400, { public_slug: ['This slug is already in use.'] }));
    const user = userEvent.setup();
    render(<PieceSlugField current="a" save={save} onSaved={vi.fn()} />);
    expect(screen.getByText(/links to the old address will stop working/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Public URL slug'), 'b');
    await user.click(screen.getByRole('button', { name: 'Save slug' }));
    expect(await screen.findByTestId('piece-slug-error')).toHaveTextContent('already in use');
  });
});
