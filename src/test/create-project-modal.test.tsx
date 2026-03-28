import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProjectModal } from '@/components/modals/CreateProjectModal';

const createProject = vi.fn();
const fetchRegistryCredentials = vi.fn();
const fetchScmCredentials = vi.fn();
const fetchTeams = vi.fn();
const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/lib/data', () => ({
  createProject: (...args: unknown[]) => createProject(...args),
  fetchRegistryCredentials: (...args: unknown[]) => fetchRegistryCredentials(...args),
  fetchScmCredentials: (...args: unknown[]) => fetchScmCredentials(...args),
  fetchTeams: (...args: unknown[]) => fetchTeams(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('CreateProjectModal bootstrap wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTeams.mockResolvedValue([{ id: 'team-1', name: 'Platform Team', slug: 'platform', members: [], createdAt: '2026-03-28T00:00:00Z' }]);
    fetchScmCredentials.mockResolvedValue([{ id: 'scm-1', name: 'GitHub Platform', provider: 'github', scope: 'platform' }]);
    fetchRegistryCredentials.mockResolvedValue([{ id: 'reg-1', name: 'GHCR Platform', provider: 'ghcr', scope: 'platform', registryUrl: 'ghcr.io' }]);
    createProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Payments Platform',
      slug: 'payments-platform',
      description: 'Owns payment flows',
      teamId: 'team-1',
      createdAt: '2026-03-28T00:00:00Z',
      updatedAt: '2026-03-28T00:00:00Z',
      services: [],
    });
  });

  it('creates a project with bootstrap defaults and continues to service creation', async () => {
    render(
      <MemoryRouter>
        <CreateProjectModal open onOpenChange={() => undefined} />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Project Name'), { target: { value: 'Payments Platform' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Owns payment flows' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const teamTrigger = screen.getAllByRole('combobox')[0];
    fireEvent.click(teamTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Platform Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.change(screen.getByLabelText('Runbook URL'), {
      target: { value: 'https://internal.example/runbooks/payments' },
    });
    fireEvent.change(screen.getByLabelText('Alert channel'), {
      target: { value: '#payments-alerts' },
    });
    fireEvent.change(screen.getByLabelText('Cost center'), {
      target: { value: 'finops-001' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create & continue' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Payments Platform',
          slug: 'payments-platform',
          teamId: 'team-1',
          defaultEnvironment: 'dev',
          serviceTier: 'standard',
          dataClassification: 'internal',
          runbookUrl: 'https://internal.example/runbooks/payments',
          alertChannel: '#payments-alerts',
          costCenter: 'finops-001',
        }),
      );
    });

    expect(navigate).toHaveBeenCalledWith('/services/new?project=proj-1');
  });
});
