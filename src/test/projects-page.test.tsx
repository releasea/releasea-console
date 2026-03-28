import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectsPage from '@/pages/projects/ProjectsPage';

const fetchProjects = vi.fn();
const fetchServices = vi.fn();
const fetchTeams = vi.fn();

vi.mock('@/lib/data', () => ({
  fetchProjects: (...args: unknown[]) => fetchProjects(...args),
  fetchServices: (...args: unknown[]) => fetchServices(...args),
  fetchTeams: (...args: unknown[]) => fetchTeams(...args),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/ListPageHeader', () => ({
  ListPageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock('@/components/layout/TableFiltersBar', () => ({
  TableFiltersBar: () => <div>filters</div>,
}));

vi.mock('@/components/modals/CreateProjectModal', () => ({
  CreateProjectModal: ({ open }: { open: boolean }) => (open ? <div>Create project modal</div> : null),
}));

describe('ProjectsPage deep links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProjects.mockResolvedValue([]);
    fetchServices.mockResolvedValue([]);
    fetchTeams.mockResolvedValue([]);
  });

  it('opens the create-project modal when action=create is present', async () => {
    render(
      <MemoryRouter initialEntries={['/projects?action=create']}>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Create project modal')).toBeInTheDocument();
  });
});
