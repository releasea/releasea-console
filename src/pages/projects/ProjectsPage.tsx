import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, FolderKanban, Activity, ArrowUpDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { TableFiltersBar } from '@/components/layout/TableFiltersBar';
import { Button } from '@/components/ui/button';
import { CreateProjectModal } from '@/components/modals/CreateProjectModal';
import { format } from 'date-fns';
import { EmptyState } from '@/components/layout/EmptyState';
import { fetchProjects, fetchServices, fetchTeams } from '@/lib/data';
import type { Project, Service, Team } from '@/types/releasea';

const Projects = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'idle' | 'empty'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'services'>('recent');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [projectsData, teamsData, servicesData] = await Promise.all([
        fetchProjects(),
        fetchTeams(),
        fetchServices(),
      ]);
      if (!active) return;
      setProjects(projectsData);
      setTeams(teamsData);
      setServices(servicesData);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const getTeamName = (teamId: string) => {
    return teams.find((team) => team.id === teamId)?.name || 'N/A';
  };

  const getServiceStats = (projectId: string) => {
    const scoped = services.filter((service) => service.projectId === projectId);
    const running = scoped.filter((service) => service.status === 'running').length;
    return { total: scoped.length, running };
  };

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const enriched = projects.map((project) => ({
      project,
      stats: getServiceStats(project.id),
    }));

    const filtered = enriched.filter(({ project, stats }) => {
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        project.slug.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query);
      const matchesTeam = teamFilter === 'all' || project.teamId === teamFilter;
      const matchesActivity = (() => {
        if (activityFilter === 'active') return stats.running > 0;
        if (activityFilter === 'idle') return stats.running === 0 && stats.total > 0;
        if (activityFilter === 'empty') return stats.total === 0;
        return true;
      })();

      return matchesSearch && matchesTeam && matchesActivity;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.project.name.localeCompare(b.project.name);
      }
      if (sortBy === 'services') {
        return b.stats.total - a.stats.total;
      }
      return new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime();
    });

    return sorted;
  }, [searchQuery, teamFilter, activityFilter, sortBy, projects, services]);


  return (
    <AppLayout>
      <div className="space-y-6">
        <ListPageHeader
          title="Projects"
          description="Manage all projects in the platform"
          actions={
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          }
        />

        <TableFiltersBar
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Search projects...',
          }}
          selects={[
            {
              id: 'team',
              value: teamFilter,
              onValueChange: setTeamFilter,
              icon: <Users className="h-4 w-4 text-muted-foreground" />,
              options: [
                { value: 'all', label: 'All teams' },
                ...teams.map((team) => ({ value: team.id, label: team.name })),
              ],
            },
            {
              id: 'activity',
              value: activityFilter,
              onValueChange: (value) => setActivityFilter(value as typeof activityFilter),
              icon: <Activity className="h-4 w-4 text-muted-foreground" />,
              options: [
                { value: 'all', label: 'All activity' },
                { value: 'active', label: 'Running services' },
                { value: 'idle', label: 'No running' },
                { value: 'empty', label: 'No services' },
              ],
            },
            {
              id: 'sort',
              value: sortBy,
              onValueChange: (value) => setSortBy(value as typeof sortBy),
              icon: <ArrowUpDown className="h-4 w-4 text-muted-foreground" />,
              options: [
                { value: 'recent', label: 'Recently updated' },
                { value: 'name', label: 'Name (A-Z)' },
                { value: 'services', label: 'Most services' },
              ],
            },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-card/60 p-10">
              <EmptyState
                icon={<FolderKanban className="h-5 w-5 text-muted-foreground" />}
                title="Nothing here yet"
                description="You can add new items or adjust your search."
                tone="muted"
              />
            </div>
          ) : (
            filteredProjects.map(({ project, stats }) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/projects/${project.id}`);
                  }
                }}
                className="group flex h-full min-h-[280px] flex-col rounded-xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {getTeamName(project.teamId)}
                      </p>
                      <h3 className="text-base font-semibold text-foreground">{project.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{project.slug}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {stats.total} services
                  </span>
                </div>

                <p className="mt-3 text-sm leading-5 text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {project.description}
                </p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Services</span>
                    <span className="font-medium text-foreground">{stats.total}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Running</span>
                    <span className="font-medium text-foreground">{stats.running}</span>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span>Project overview</span>
                    <span className="text-[10px] text-muted-foreground">
                      Updated {format(new Date(project.updatedAt), 'MMM dd, HH:mm')}
                    </span>
                  </span>
                  <span className="font-medium text-foreground">Open project</span>
                </div>
              </div>
            ))
        )}
        </div>
      </div>

      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={(newProject) => {
          setProjects((prev) => [...prev, newProject]);
        }}
      />
    </AppLayout>
  );
};

export default Projects;
