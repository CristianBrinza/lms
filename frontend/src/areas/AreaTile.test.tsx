import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { TrainingIcon } from '@/components/ui/icons';
import { AreaGrid } from './AreaTile';
import { AREAS, type Area } from './registry';

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui', () => ({ toast: { info: toastInfo } }));
// Medication's tile asks for its summary; nothing answers here.
vi.mock('@/medication/api', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  medicationApi: { summary: () => new Promise(() => undefined) },
}));

const renderGrid = (areas: readonly Area[]) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AreaGrid areas={areas} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('dashboard area tiles', () => {
  it('shows every area in the registry', () => {
    renderGrid(AREAS);
    for (const area of AREAS)
      expect(
        screen.getByRole(area.to ? 'link' : 'button', { name: new RegExp(area.name) }),
      ).toBeInTheDocument();
  });

  it('says an area without a screen is being built', async () => {
    renderGrid([
      {
        id: 'sleep',
        name: 'Sleep',
        summary: 'Nights and naps.',
        icon: TrainingIcon,
        tone: 'white',
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: /Sleep/ }));
    expect(toastInfo).toHaveBeenCalledWith('Sleep is being built', expect.anything());
  });

  it('links an area once it has a screen', () => {
    renderGrid([
      {
        id: 'sleep',
        name: 'Sleep',
        summary: 'Nights and naps.',
        icon: TrainingIcon,
        tone: 'white',
        to: '/sleep',
      },
    ]);
    expect(screen.getByRole('link', { name: /Sleep/ })).toHaveAttribute('href', '/sleep');
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });
});
