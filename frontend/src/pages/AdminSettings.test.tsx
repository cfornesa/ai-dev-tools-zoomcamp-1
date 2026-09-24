import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as adminApi from '../api/adminSettings';
import AdminSettings from './AdminSettings';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    status: 'signed-in',
    user: { is_application_admin: true },
  }),
}));

vi.mock('../api/adminSettings', async () => {
  const actual =
    await vi.importActual<typeof import('../api/adminSettings')>('../api/adminSettings');
  return {
    ...actual,
    fetchSiteSettings: vi.fn(),
    fetchPlans: vi.fn(),
    fetchRoles: vi.fn(),
    fetchGlobalCapabilities: vi.fn(),
    fetchCloudRetentionPolicy: vi.fn(),
    fetchAIProviderModels: vi.fn(),
    updateAIProviderModel: vi.fn(),
    fetchProfileStyles: vi.fn(),
    fetchThemeGenerationAttempts: vi.fn(),
    generateThemeDraft: vi.fn(),
    actOnThemeGeneration: vi.fn(),
    updateProfileStyle: vi.fn(),
  };
});

const presentation = {
  font_family: 'system' as const,
  density: 'comfortable' as const,
  radius: 'soft' as const,
  border_style: 'solid' as const,
  shadow: 'none' as const,
  backdrop: 'plain' as const,
};

beforeEach(() => {
  vi.mocked(adminApi.fetchSiteSettings).mockResolvedValue({
    site_title: 'Test site',
    site_description: '',
    metadata_tags: [],
    revision: 1,
    cloud_sync_enabled: false,
    theme_config: {},
    style_key: 'default',
    presentation,
  });
  vi.mocked(adminApi.fetchPlans).mockResolvedValue([]);
  vi.mocked(adminApi.fetchRoles).mockResolvedValue([]);
  vi.mocked(adminApi.fetchGlobalCapabilities).mockResolvedValue({});
  vi.mocked(adminApi.fetchCloudRetentionPolicy).mockResolvedValue({
    deleted_grace_days: 30,
    entitlement_grace_days: 30,
    disabled_sync_grace_days: 30,
    revision: 1,
    updated_at: '2026-01-01T00:00:00Z',
  });
  vi.mocked(adminApi.fetchAIProviderModels).mockResolvedValue([
    {
      id: 1,
      vendor: 'gemini',
      model_slug: 'gemini-test',
      display_label: 'Gemini test',
      task_kinds: ['one_shot_2d'],
      agentic_supported: false,
      native_schema: true,
      active: true,
      revision: 1,
    },
  ]);
  vi.mocked(adminApi.updateAIProviderModel).mockImplementation(async (_id, fields) => ({
    id: 1,
    vendor: 'gemini',
    model_slug: 'gemini-test',
    display_label: 'Gemini test',
    task_kinds: ['one_shot_2d'],
    agentic_supported: false,
    native_schema: fields.native_schema ?? true,
    active: true,
    revision: 2,
  }));
  vi.mocked(adminApi.fetchThemeGenerationAttempts).mockResolvedValue([]);
  vi.mocked(adminApi.fetchProfileStyles).mockResolvedValue([
    {
      id: 1,
      key: 'default',
      label: 'Default',
      description: 'Default style',
      tokens: { accent: '#c084fc' },
      presentation,
      enabled: true,
      revision: 1,
    },
    {
      id: 2,
      key: 'pareto',
      label: 'Pareto',
      description: 'Hard bordered indigo style',
      tokens: {
        light: { background: '#f4f5ff', accent: '#4f46e5' },
        dark: { background: '#101226', accent: '#818cf8' },
      },
      presentation: { ...presentation, radius: 'sharp', shadow: 'offset' },
      enabled: true,
      revision: 1,
    },
    {
      id: 3,
      key: 'celestial',
      label: 'Celestial',
      description: 'Cosmic script-heading style',
      tokens: {
        light: { background: '#f4ead3', accent: '#b8892e' },
        dark: { background: '#071b2a', accent: '#e4b95c' },
      },
      presentation: { ...presentation, font_family: 'script', shadow: 'soft', backdrop: 'cosmic' },
      enabled: true,
      revision: 1,
    },
  ]);
  vi.mocked(adminApi.updateProfileStyle).mockImplementation(async (style) => style);
});

describe('AdminSettings presentation choices (#643)', () => {
  it('exposes finite font, shadow, and backdrop choices and saves them accessibly', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminSettings />
      </MemoryRouter>,
    );

    const font = await screen.findByRole('combobox', { name: 'Default font family' });
    const shadow = screen.getByRole('combobox', { name: 'Default shadow' });
    const backdrop = screen.getByRole('combobox', { name: 'Default backdrop' });
    expect(screen.getAllByRole('option', { name: 'Script' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Offset' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Cosmic' }).length).toBeGreaterThan(0);

    await user.selectOptions(font, 'script');
    await user.selectOptions(shadow, 'offset');
    await user.selectOptions(backdrop, 'cosmic');

    expect(adminApi.updateProfileStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        presentation: expect.objectContaining({
          font_family: 'script',
        }),
      }),
    );
    expect(adminApi.updateProfileStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        presentation: expect.objectContaining({ shadow: 'offset' }),
      }),
    );
    expect(adminApi.updateProfileStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        presentation: expect.objectContaining({ backdrop: 'cosmic' }),
      }),
    );
  });

  it('lists the built-in Pareto style with its paired presentation contract', async () => {
    render(
      <MemoryRouter>
        <AdminSettings />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Pareto')).length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Pareto shadow' })).toHaveValue('offset');
  });

  it('lists the built-in Celestial style with script and cosmic presentation', async () => {
    render(
      <MemoryRouter>
        <AdminSettings />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText('Celestial')).length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Celestial font family' })).toHaveValue('script');
    expect(screen.getByRole('combobox', { name: 'Celestial backdrop' })).toHaveValue('cosmic');
  });
});

describe('AI model native schema capability (#817)', () => {
  it('round-trips the labelled native JSON schema checkbox', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminSettings />
      </MemoryRouter>,
    );

    const [checkbox] = await screen.findAllByRole('checkbox', {
      name: 'Supports native JSON schema output',
    });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    await user.click(
      within(checkbox.closest('form') as HTMLElement).getByRole('button', { name: 'Save' }),
    );

    expect(adminApi.updateAIProviderModel).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ native_schema: false }),
    );
  });
});
