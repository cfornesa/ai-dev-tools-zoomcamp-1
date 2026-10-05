import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AmbientSampleUnsupportedType } from '../audio/ambientSampleAsset';
import * as ambientSampleAsset from '../audio/ambientSampleAsset';
import { normalizeSonic } from '../audio/sonicContract';
import SonicDefaultsPanel from './SonicDefaultsPanel';

vi.mock('../audio/ambientSampleAsset', async () => {
  const actual = await vi.importActual<typeof import('../audio/ambientSampleAsset')>(
    '../audio/ambientSampleAsset',
  );
  return { ...actual, uploadAmbientSample: vi.fn() };
});

const mockedUpload = vi.mocked(ambientSampleAsset.uploadAmbientSample);

function makeFile(name: string, type: string) {
  return new File(['bytes'], name, { type });
}

describe('SonicDefaultsPanel ambient sample (#847)', () => {
  it('hides the ambient-sample control when no pieceId is supplied', () => {
    render(<SonicDefaultsPanel value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/Ambient sample/)).not.toBeInTheDocument();
  });

  it('uploads a selected audio file and stores the returned asset id', async () => {
    mockedUpload.mockResolvedValue('asset-123');
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SonicDefaultsPanel value={undefined} onChange={onChange} pieceId="piece-1" />);

    const input = screen.getByLabelText(
      'Ambient sample (replaces the synthesized ambient walk when set)',
    ) as HTMLInputElement;
    await user.upload(input, makeFile('loop.mp3', 'audio/mpeg'));

    expect(mockedUpload).toHaveBeenCalledWith('piece-1', expect.any(File));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extras: expect.objectContaining({ ambient_sample: 'asset-123' }) }),
    );
  });

  it('shows the current sample filename and a Clear button once one is selected', () => {
    const current = normalizeSonic({ extras: { ambient_sample: 'asset-123' } })!;
    render(
      <SonicDefaultsPanel
        value={current}
        onChange={vi.fn()}
        pieceId="piece-1"
        ambientSampleFilename="loop.mp3"
      />,
    );

    expect(screen.getByText('loop.mp3')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear ambient sample' })).toBeVisible();
  });

  it('clears the sample when Clear is clicked', async () => {
    const current = normalizeSonic({ extras: { ambient_sample: 'asset-123' } })!;
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SonicDefaultsPanel value={current} onChange={onChange} pieceId="piece-1" />);

    await user.click(screen.getByRole('button', { name: 'Clear ambient sample' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extras: expect.objectContaining({ ambient_sample: undefined }) }),
    );
  });

  it('shows an inline error when the upload is rejected as an unsupported type, without mutating the scene', async () => {
    // `accept="audio/*"` already keeps a real browser's file picker to
    // audio files; the type-allowlist check itself lives inside
    // `uploadAmbientSample` (see its own focused tests) -- this asserts
    // the panel surfaces that rejection rather than silently swallowing it.
    mockedUpload.mockRejectedValue(new AmbientSampleUnsupportedType('video/mp4'));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SonicDefaultsPanel value={undefined} onChange={onChange} pieceId="piece-1" />);

    const input = screen.getByLabelText(
      'Ambient sample (replaces the synthesized ambient walk when set)',
    ) as HTMLInputElement;
    await user.upload(input, makeFile('loop.mp3', 'audio/mpeg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a supported audio type/);
    expect(onChange).not.toHaveBeenCalled();
  });
});
