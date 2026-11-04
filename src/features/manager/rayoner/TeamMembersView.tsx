import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { formatHoursToSexagesimal } from '../../../utils/timeFormat';

interface TeamMembersViewProps {
  onNavigateToTree?: () => void;
}

export function TeamMembersView({ onNavigateToTree }: TeamMembersViewProps) {
  const user = useCheckinStore((state) => state.user);
  const {
    teamMembers: allTeamMembers,
    getTeamMembersBySupervisor,
    clients,
    projects,
    tasks,
    assignments,
    userTaskActualHours,
    activeWorkers,
    toggleUserClientPermission,
    updateUserClients,
  } = useRayonerStore();

  // Miembros asignados al supervisor actual
  const teamMembers = useMemo(() => {
    return getTeamMembersBySupervisor(user?.id, user?.role);
  }, [allTeamMembers, user?.id, user?.role, getTeamMembersBySupervisor]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((member) => {
      if (statusFilter === 'active' && member.status !== 'active') return false;
      if (statusFilter === 'pending' && member.status === 'active') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        return (
          member.name.toLowerCase().includes(q) ||
          member.email.toLowerCase().includes(q) ||
          member.roleTitle.toLowerCase().includes(q) ||
          member.team.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [teamMembers, searchTerm, statusFilter]);

  // Métricas consolidadas del equipo del supervisor
  const activeCount = useMemo(
    () => teamMembers.filter((m) => m.status === 'active').length,
    [teamMembers]
  );

  const pendingCheckinCount = useMemo(
    () => teamMembers.filter((m) => m.status !== 'active').length,
    [teamMembers]
  );

  const totalShiftHours = useMemo(() => {
    const totalMinutes = teamMembers.reduce((acc, m) => acc + (m.workedMinutesToday || 0), 0);
    return (totalMinutes / 60).toFixed(1);
  }, [teamMembers]);

  const biometricIncidentsCount = 0;

  return (
    <div className="space-y-6 py-4 animate-fade-in">
      {/* 1. Métricas Rápidas en Tipografía Space Grotesk (Minimalistas, sin recuadros pesados) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            En Turno Activo
          </div>
          <div className="text-2xl font-bold font-heading text-slate-900 dark:text-white mt-1">
            {activeCount}{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              / {teamMembers.length} miembros
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Entradas Registradas Hoy
          </div>
          <div className="text-2xl font-bold font-heading text-slate-900 dark:text-slate-200 mt-1">
            {activeCount}{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              ({pendingCheckinCount} pendientes)
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Total Horas Turno
          </div>
          <div className="text-2xl font-bold font-heading text-slate-900 dark:text-slate-200 mt-1">
            {totalShiftHours} hrs
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Incidencias Biométricas
          </div>
          <div className="text-2xl font-bold font-heading text-slate-900 dark:text-slate-200 mt-1">
            {biometricIncidentsCount}
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtro y Búsqueda Sobria */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar miembro del equipo por nombre o correo..."
            className="bg-white dark:bg-[#0B111E] text-slate-900 dark:text-slate-200 text-sm border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded focus:outline-none focus:border-blue-600 dark:focus:border-sky-400 placeholder:text-slate-500 min-w-[260px]"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'pending')}
            className="bg-white dark:bg-[#0B111E] text-slate-700 dark:text-slate-300 text-sm border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded focus:outline-none focus:border-blue-600 dark:focus:border-sky-400"
          >
            <option value="all">Todos los miembros ({teamMembers.length})</option>
            <option value="active">En Jornada ({activeCount})</option>
            <option value="pending">Pendientes de Check-in ({pendingCheckinCount})</option>
          </select>
        </div>

        <span className="text-xs text-slate-600 dark:text-slate-400">
          Haz clic en una fila para gestionar permisos de clientes y tareas asignadas
        </span>
      </div>

      {/* 3. Tabla de Asistencia del Equipo del Supervisor */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <th className="py-3 px-4">Colaborador</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Hora Entrada</th>
              <th className="py-3 px-4">Validación Facial</th>
              <th className="py-3 px-4 text-right">Tiempo Hoy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {filteredMembers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 px-4 text-center text-xs text-slate-600 dark:text-slate-400"
                >
                  No se encontraron colaboradores asignados con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const isExpanded = expandedUserId === member.id;
                const activeWorker = activeWorkers.find((w) => w.userId === member.id);
                const isWorking = member.status === 'active' || Boolean(activeWorker);
                const hoursToday = ((member.workedMinutesToday || 0) / 60).toFixed(1);
                const userAssignments = assignments.filter((a) => a.userId === member.id);
                const isExemptFacial = member.role === 'Supervisor' || member.role === 'TI';

                return (
                  <FragmentRow
                    key={member.id}
                    member={member}
                    isExpanded={isExpanded}
                    onToggleExpand={() =>
                      setExpandedUserId((prev) => (prev === member.id ? null : member.id))
                    }
                    isWorking={isWorking}
                    activeTaskLabel={
                      activeWorker ? `${activeWorker.projectName} • ${activeWorker.taskName}` : null
                    }
                    hoursToday={hoursToday}
                    isExemptFacial={isExemptFacial}
                    clients={clients}
                    projects={projects}
                    tasks={tasks}
                    userAssignments={userAssignments}
                    userTaskActualHours={userTaskActualHours}
                    toggleUserClientPermission={toggleUserClientPermission}
                    updateUserClients={updateUserClients}
                    onNavigateToTree={onNavigateToTree}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FragmentRowProps {
  member: ReturnType<typeof useRayonerStore.getState>['teamMembers'][number];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isWorking: boolean;
  activeTaskLabel: string | null;
  hoursToday: string;
  isExemptFacial: boolean;
  clients: ReturnType<typeof useRayonerStore.getState>['clients'];
  projects: ReturnType<typeof useRayonerStore.getState>['projects'];
  tasks: ReturnType<typeof useRayonerStore.getState>['tasks'];
  userAssignments: ReturnType<typeof useRayonerStore.getState>['assignments'];
  userTaskActualHours: Record<string, number>;
  toggleUserClientPermission: (userId: string, clientId: string) => void;
  updateUserClients: (userId: string, clientIds: string[]) => void;
  onNavigateToTree?: () => void;
}

function FragmentRow({
  member,
  isExpanded,
  onToggleExpand,
  isWorking,
  activeTaskLabel,
  hoursToday,
  isExemptFacial,
  clients,
  projects,
  tasks,
  userAssignments,
  userTaskActualHours,
  toggleUserClientPermission,
  updateUserClients,
  onNavigateToTree,
}: FragmentRowProps) {
  return (
    <>
      <tr
        onClick={onToggleExpand}
        className="hover:bg-slate-100/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
      >
        <td className="py-3.5 px-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">{member.name}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {member.email} • {member.roleTitle}
              </div>
              {activeTaskLabel && (
                <div className="text-[11px] text-[#1D4ED8] dark:text-sky-400 font-mono mt-0.5">
                  En curso: {activeTaskLabel}
                </div>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                isExpanded ? 'rotate-180 text-slate-900 dark:text-white' : ''
              }`}
            />
          </div>
        </td>

        <td className="py-3.5 px-4">
          {isWorking ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#1D4ED8] dark:bg-blue-500" />
              En Jornada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-[#64748B]" />
              Fuera de Turno
            </span>
          )}
        </td>

        <td className="py-3.5 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">
          {member.entryTime ? `${member.entryTime} hrs` : '—'}
          {member.checkOutTime ? ` → ${member.checkOutTime} hrs` : ''}
        </td>

        <td className="py-3.5 px-4 text-xs font-mono">
          {isExemptFacial ? (
            <span className="text-slate-600 dark:text-slate-400">Exento por Rol</span>
          ) : (
            <span className="text-[#1D4ED8] dark:text-sky-400">Biometría OK</span>
          )}
        </td>

        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
          {hoursToday} hrs
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50/80 dark:bg-[#101726]">
          <td colSpan={5} className="p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Subpanel 1: Clientes Autorizados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Clientes Autorizados ({member.allowedClientIds.length}/{clients.length})
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateUserClients(
                          member.id,
                          clients.map((c) => c.id)
                        );
                      }}
                      className="text-[#1D4ED8] dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Habilitar todos
                    </button>
                    <span className="text-slate-400">•</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateUserClients(member.id, []);
                      }}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline cursor-pointer"
                    >
                      Revocar todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {clients.map((client) => {
                    const isAllowed = member.allowedClientIds.includes(client.id);
                    return (
                      <label
                        key={client.id}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between px-3 py-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090E17] cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-medium text-slate-900 dark:text-slate-200 block truncate">
                            {client.name}
                          </span>
                          {client.taxId && (
                            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 block">
                              {client.taxId}
                            </span>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => toggleUserClientPermission(member.id, client.id)}
                          className="w-4 h-4 accent-[#1D4ED8] rounded border-slate-400 dark:border-slate-600 bg-white dark:bg-[#090E17] cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Subpanel 2: Tareas Asignadas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Tareas Asignadas ({userAssignments.length})
                  </span>
                  {onNavigateToTree && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToTree();
                      }}
                      className="text-xs text-[#1D4ED8] dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Gestionar en Árbol C/P/T →
                    </button>
                  )}
                </div>

                {userAssignments.length === 0 ? (
                  <p className="text-xs text-slate-600 dark:text-slate-400 py-2">
                    Sin tareas asignadas actualmente.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-[#090E17]">
                    {userAssignments.map((asg) => {
                      const task = tasks.find((t) => t.id === asg.taskId);
                      const project = projects.find((p) => p.id === task?.projectId);
                      const key = `${asg.taskId}_${member.id}`;
                      const actualHours = userTaskActualHours[key] || 0;
                      const plannedHours = asg.allocatedHours;

                      return (
                        <div
                          key={asg.id}
                          className="px-3 py-2.5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-200 block">
                              {task?.name || 'Tarea asignada'}
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{project?.name || 'Proyecto'}</span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${asg.blockOnLimit ? 'bg-[#1D4ED8] dark:bg-sky-400' : 'bg-slate-400'}`} />
                                <span>{asg.blockOnLimit ? 'Límite Activo' : 'Flexible'}</span>
                              </span>
                            </span>
                          </div>
                          <div className="font-mono text-slate-900 dark:text-slate-200">
                            <span className="font-semibold">{formatHoursToSexagesimal(actualHours)}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {' '}
                              / {formatHoursToSexagesimal(plannedHours)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
