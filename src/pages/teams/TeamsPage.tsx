import { useEffect, useMemo, useState } from 'react';
import { Plus, MoreVertical, Settings, Shield, Crown, Code, Eye, Users as UsersIcon, Pencil, Trash2, KeyRound, UserPlus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { TableFiltersBar } from '@/components/layout/TableFiltersBar';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CreateTeamModal } from '@/components/modals/CreateTeamModal';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTablePagination } from '@/hooks/use-table-pagination';
import { TablePagination } from '@/components/layout/TablePagination';
import { Project, Team } from '@/types/releasea';
import { toast } from '@/hooks/use-toast';
import { fetchProjects, fetchTeams, performAction } from '@/lib/data';
import { ChevronDown } from 'lucide-react';

type IdpFilter = 'all' | 'linked' | 'none';

const Teams = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'viewer'>('developer');
  const [searchQuery, setSearchQuery] = useState('');
  const [idpFilter, setIdpFilter] = useState<IdpFilter>('all');
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');

  const loadData = async () => {
    const [teamsData, projectsData] = await Promise.all([fetchTeams(), fetchProjects()]);
    setTeams(teamsData);
    setProjects(projectsData);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [teamsData, projectsData] = await Promise.all([fetchTeams(), fetchProjects()]);
      if (!active) return;
      setTeams(teamsData);
      setProjects(projectsData);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const projectCountsByTeam = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((project) => {
      counts[project.teamId] = (counts[project.teamId] ?? 0) + 1;
    });
    return counts;
  }, [projects]);

  const memberStatsByTeam = useMemo(() => {
    const counts: Record<string, { total: number; idpLinked: number }> = {};
    teams.forEach((team) => {
      const total = team.members.length;
      const idpLinked = team.members.filter((member) => member.idpProvider).length;
      counts[team.id] = { total, idpLinked };
    });
    return counts;
  }, [teams]);

  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return teams.filter((team) => {
      const stats = memberStatsByTeam[team.id] ?? { total: 0, idpLinked: 0 };
      const hasIdp = stats.idpLinked > 0;
      const matchesQuery =
        !query ||
        team.name.toLowerCase().includes(query) ||
        team.slug.toLowerCase().includes(query) ||
        team.members.some((member) => {
          const provider = member.idpProvider ?? '';
          return (
            member.name.toLowerCase().includes(query) ||
            member.email.toLowerCase().includes(query) ||
            provider.toLowerCase().includes(query)
          );
        });
      const matchesIdp =
        idpFilter === 'all' ||
        (idpFilter === 'linked' ? hasIdp : !hasIdp);
      return matchesQuery && matchesIdp;
    });
  }, [teams, searchQuery, idpFilter, memberStatsByTeam]);

  useEffect(() => {
    if (!expandedTeamId) return;
    if (!filteredTeams.some((team) => team.id === expandedTeamId)) {
      setExpandedTeamId(null);
    }
  }, [filteredTeams, expandedTeamId]);

  const expandedTeam = useMemo(
    () => teams.find((team) => team.id === expandedTeamId) ?? null,
    [teams, expandedTeamId]
  );

  const filteredMembers = useMemo(() => {
    if (!expandedTeam) return [];
    const query = memberQuery.trim().toLowerCase();
    if (!query) return expandedTeam.members;
    return expandedTeam.members.filter((member) => {
      const roleLabel = member.role.toLowerCase();
      return (
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        roleLabel.includes(query) ||
        (member.idpProvider ?? '').toLowerCase().includes(query)
      );
    });
  }, [expandedTeam, memberQuery]);

  const teamsPagination = useTablePagination(filteredTeams.length);
  const membersPagination = useTablePagination(filteredMembers.length);

  const visibleTeams = teamsPagination.slice(filteredTeams);
  const visibleMembers = membersPagination.slice(filteredMembers);
  const isFiltering = searchQuery.trim().length > 0 || idpFilter !== 'all';
  const emptyTitle = isFiltering ? 'No teams found' : 'No teams yet';
  const emptyDescription = isFiltering
    ? 'Try adjusting your search or filters.'
    : 'Create a team to organize members and projects.';

  useEffect(() => {
    if (!expandedTeamId) return;
    const index = filteredTeams.findIndex((team) => team.id === expandedTeamId);
    if (index === -1) return;
    const page = Math.floor(index / teamsPagination.pageSize) + 1;
    if (page !== teamsPagination.page) {
      teamsPagination.setPage(page);
    }
  }, [expandedTeamId, filteredTeams, teamsPagination.page, teamsPagination.pageSize, teamsPagination.setPage]);

  useEffect(() => {
    membersPagination.setPage(1);
  }, [expandedTeamId, memberQuery, membersPagination.setPage]);

  useEffect(() => {
    setMemberQuery('');
  }, [expandedTeamId]);

  useEffect(() => {
    teamsPagination.setPage(1);
  }, [searchQuery, idpFilter, teamsPagination.setPage]);

  const getIdpLabel = (provider?: string) => {
    switch (provider) {
      case 'keycloak':
        return 'OIDC';
      case 'adfs':
        return 'SAML';
      case 'azure-ad':
        return 'SAML';
      case 'okta':
        return 'OIDC';
      default:
        return 'IdP';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3" />;
      case 'admin':
        return <Shield className="w-3 h-3" />;
      case 'developer':
        return <Code className="w-3 h-3" />;
      case 'viewer':
        return <Eye className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'admin': return 'Admin';
      case 'developer': return 'Developer';
      case 'viewer': return 'Viewer';
      default: return role;
    }
  };

  const roleColors: Record<string, string> = {
    owner: 'bg-primary/10 text-primary border-primary/20',
    admin: 'bg-warning/10 text-warning border-warning/20',
    developer: 'bg-info/10 text-info border-info/20',
    viewer: 'bg-muted text-muted-foreground border-border',
  };

  const handleDeleteOpenChange = (open: boolean) => {
    setDeleteModalOpen(open);
    if (!open) {
      setSelectedTeam(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTeam) return;
    await performAction({
      endpoint: `/teams/${selectedTeam.id}`,
      method: 'DELETE',
      label: 'deleteTeam',
    });
    setTeams((prev) => prev.filter((team) => team.id !== selectedTeam.id));
    toast({
      title: 'Team deleted',
      description: `Team "${selectedTeam.name}" was deleted.`,
    });
  };

  const handleToggleTeam = (teamId: string) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <ListPageHeader
          title="Teams"
          description="Manage teams and members across the platform"
          actions={
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              New Team
            </Button>
          }
        />

        <TableFiltersBar
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Search teams...',
          }}
          selects={[
            {
              id: 'idp',
              value: idpFilter,
              onValueChange: (value) => setIdpFilter(value as IdpFilter),
              icon: <KeyRound className="h-4 w-4 text-muted-foreground" />,
              options: [
                { value: 'all', label: 'All IdP states' },
                { value: 'linked', label: 'With IdP' },
                { value: 'none', label: 'No IdP' },
              ],
            },
          ]}
        />

        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 bg-muted/30">
            <span>Team</span>
            <span className="text-center">Members</span>
            <span className="text-center">Projects</span>
            <span className="text-center">IdP Linked</span>
            <span className="w-10" />
          </div>

          {filteredTeams.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<UsersIcon className="h-5 w-5 text-muted-foreground" />}
                title={emptyTitle}
                description={emptyDescription}
                tone="muted"
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/40">
                {visibleTeams.map((team) => {
                  const teamProjects = projectCountsByTeam[team.id] ?? 0;
                  const memberStats = memberStatsByTeam[team.id] ?? { total: 0, idpLinked: 0 };
                  const isExpanded = expandedTeamId === team.id;
                  const membersToShow = isExpanded ? visibleMembers : [];
                  const hasMembers = isExpanded && filteredMembers.length > 0;

                  return (
                    <Collapsible
                      key={team.id}
                      open={isExpanded}
                      onOpenChange={() => handleToggleTeam(team.id)}
                    >
                      {/* Team Row */}
                      <div className="grid grid-cols-[1fr_auto] md:grid-cols-[2.5fr_1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-3 text-left min-w-0 w-full">
                            <ChevronDown
                              className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                                isExpanded ? 'rotate-0' : '-rotate-90'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{team.name}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">{team.slug}</p>
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        {/* Mobile Stats */}
                        <div className="md:hidden flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{memberStats.total}</span>
                          <span>•</span>
                          <span>{teamProjects}</span>
                          {memberStats.idpLinked > 0 && (
                            <>
                              <span>•</span>
                              <KeyRound className="w-3 h-3" />
                            </>
                          )}
                        </div>

                        {/* Desktop Stats */}
                        <div className="hidden md:flex justify-center">
                          <span className="text-sm font-medium text-foreground">{memberStats.total}</span>
                        </div>
                        <div className="hidden md:flex justify-center">
                          <span className="text-sm font-medium text-foreground">{teamProjects}</span>
                        </div>
                        <div className="hidden md:flex justify-center">
                          {memberStats.idpLinked > 0 ? (
                            <Badge variant="outline" className="gap-1 text-xs border-info/30 bg-info/10 text-info">
                              <KeyRound className="w-3 h-3" />
                              {memberStats.idpLinked}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTeam(team);
                                  setInviteModalOpen(true);
                                }}
                              >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Invite member
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  toast({ title: 'Edit team', description: `Opening editor for "${team.name}"...` });
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit team
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  toast({ title: 'Team settings', description: `Opening settings for "${team.name}"...` });
                                }}
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                Team settings
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={() => {
                                  setSelectedTeam(team);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Expanded Members Section */}
                      <CollapsibleContent>
                        <div className="mx-4 mb-4 rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
                          {/* Members Header */}
                          <div className="flex flex-col gap-2 px-4 py-3 border-b border-border/40 bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">Team Members</p>
                              <p className="text-xs text-muted-foreground">{memberStats.total} members</p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                                value={memberQuery}
                                onChange={(event) => setMemberQuery(event.target.value)}
                                placeholder="Search members..."
                                className="h-8 text-sm sm:w-56"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTeam(team);
                                  setInviteModalOpen(true);
                                }}
                              >
                                <UserPlus className="w-4 h-4" />
                                Invite
                              </Button>
                            </div>
                          </div>

                          {/* Members List */}
                          <div className="divide-y divide-border/30">
                            {!hasMembers ? (
                              <div className="py-8">
                                <EmptyState
                                  icon={<UsersIcon className="h-5 w-5 text-muted-foreground" />}
                                  title={memberQuery ? 'No members found' : 'No members yet'}
                                  description={
                                    memberQuery
                                      ? 'Try adjusting your search terms.'
                                      : 'Invite teammates to collaborate.'
                                  }
                                  tone="muted"
                                />
                              </div>
                            ) : (
                              membersToShow.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/20"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                        {member.name
                                          .split(' ')
                                          .map((n) => n[0])
                                          .join('')
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {member.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {member.email}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {member.idpProvider && (
                                      <Badge
                                        variant="outline"
                                        className="gap-1 text-[10px] border-info/30 bg-info/10 text-info"
                                      >
                                        <KeyRound className="w-3 h-3" />
                                        {getIdpLabel(member.idpProvider)}
                                      </Badge>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className={`gap-1 text-[10px] ${roleColors[member.role]}`}
                                    >
                                      {getRoleIcon(member.role)}
                                      {getRoleLabel(member.role)}
                                    </Badge>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Members Pagination */}
                          {filteredMembers.length > 0 && (
                            <TablePagination
                              page={membersPagination.page}
                              pageSize={membersPagination.pageSize}
                              totalItems={filteredMembers.length}
                              totalPages={membersPagination.totalPages}
                              onPageChange={membersPagination.setPage}
                            />
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>

              {/* Teams Pagination */}
              <TablePagination
                page={teamsPagination.page}
                pageSize={teamsPagination.pageSize}
                totalItems={filteredTeams.length}
                totalPages={teamsPagination.totalPages}
                onPageChange={teamsPagination.setPage}
              />
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTeamModal open={createModalOpen} onOpenChange={setCreateModalOpen} onCreated={loadData} />

      <ConfirmDeleteModal
        open={deleteModalOpen}
        onOpenChange={handleDeleteOpenChange}
        title="Delete team"
        description={
          selectedTeam
            ? `You are about to delete the team "${selectedTeam.name}". This action cannot be undone.`
            : 'This action cannot be undone.'
        }
        onConfirm={handleDeleteConfirm}
        confirmPhrase="delete"
        confirmLabel="Delete team"
      />

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base">Invite to {selectedTeam?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v: 'admin' | 'developer' | 'viewer') => setInviteRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!inviteEmail || !selectedTeam) return;
                  await performAction({
                    endpoint: `/teams/${selectedTeam.id}/invite`,
                    method: 'POST',
                    payload: { email: inviteEmail, role: inviteRole },
                    label: 'inviteTeamMember',
                  });
                  toast({
                    title: 'Invitation sent',
                    description: `Invited ${inviteEmail} as ${inviteRole}.`,
                  });
                  setInviteModalOpen(false);
                  setInviteEmail('');
                  setInviteRole('developer');
                }}
              >
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Teams;
