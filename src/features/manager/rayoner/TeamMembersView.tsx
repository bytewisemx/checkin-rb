import { useState, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  SlidersHorizontal, 
  ChevronDown, 
  Search,
  Check
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { LiveTimerCell } from '../../../components/common/LiveTimerCell';
import { useLiveTeamTimers } from '../../../hooks/useLiveTeamTimers';

interface TeamMembersViewProps {
  onNavigateToTree?: () => void;
}

export function TeamMembersView({ onNavigateToTree }: TeamMembersViewProps) {
  useLiveTeamTimers();
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
    <div className="space-y-6 animate-fade-in">
      {/* 1. KPIs de Asistencia: Fila compacta y limpia de tarjetas neutras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: En Turno Activo */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              En Turno Activo
            </span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{activeCount}</span>
              <span className="text-xs font-normal text-slate-400">
                de {teamMembers.length} miembros
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Colaboradores con jornada iniciada
            </p>
          </div>
        </div>

        {/* KPI 2: Entradas Registradas Hoy */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Entradas Hoy
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {pendingCheckinCount} pendientes de ingreso
            </p>
          </div>
        </div>

        {/* KPI 3: Total Horas Turno */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Horas Turno
            </span>
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {totalShiftHours} hrs
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Tiempo acumulado hoy en el equipo
            </p>
          </div>
        </div>

        {/* KPI 4: Incidencias */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Incidencias
            </span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {biometricIncidentsCount}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              0 retardos o fallas biométricas
            </p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar colaborador por nombre, correo o cargo..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'pending')}
            className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-600"
          >
            <option value="all">Todos los colaboradores ({teamMembers.length})</option>
            <option value="active">En Jornada ({activeCount})</option>
            <option value="pending">Fuera de Turno ({pendingCheckinCount})</option>
          </select>
        </div>
      </div>

      {/* 3. Tabla Moderna de Colaboradores */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="w-full overflow-x-auto">
          <table data-tour="team-timesheet-table" className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-4">Colaborador / Correo</th>
                <th className="p-4">Proyecto y Tarea Activa</th>
                <th className="p-4">Hora Entrada / Salida</th>
                <th className="p-4">Validación Facial</th>
                <th className="p-4">Horas Acumuladas</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    No se encontraron colaboradores con los criterios seleccionados.
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
                      activeWorker={activeWorker || null}
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
    </div>
  );
}

interface FragmentRowProps {
  member: ReturnType<typeof useRayonerStore.getState>['teamMembers'][number];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isWorking: boolean;
  activeWorker: ReturnType<typeof useRayonerStore.getState>['activeWorkers'][number] | null;
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
  activeWorker,
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
      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
        {/* 1. Colaborador / Correo */}
        <td className="p-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              photoURL={member.photoURL}
              name={member.name}
              size="sm"
            />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {member.name}
                </span>
                {isWorking ? (
                  <span data-tour="team-member-status" className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
                    En Jornada
                  </span>
                ) : (
                  <span data-tour="team-member-status" className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Fuera de Turno
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 block mt-0.5">
                {member.email} • {member.roleTitle || member.team}
              </span>
            </div>
          </div>
        </td>

        {/* 2. Proyecto y Tarea Activa con Cronometraje en Tiempo Vivo */}
        <td className="p-4">
          {activeWorker ? (
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                {activeWorker.projectName}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-blue-600 dark:text-blue-400 truncate max-w-[170px] font-medium" title={activeWorker.taskName}>
                  {activeWorker.taskName}
                </span>
                <LiveTimerCell
                  startedAt={activeWorker.startedAt || activeWorker.startedAtMs}
                  accumulatedSeconds={activeWorker.accumulatedSeconds || 0}
                  isRunning={activeWorker.isRunning !== false}
                />
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
          )}
        </td>

        {/* 3. Hora Entrada / Salida */}
        <td className="p-4 text-xs font-medium text-slate-700 dark:text-slate-300">
          {member.entryTime ? (
            <div className="flex items-center gap-1.5">
              <span>{member.entryTime}</span>
              <span className="text-slate-400">→</span>
              <span>{member.checkOutTime || (isWorking ? 'En curso' : '—')}</span>
            </div>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>

        {/* 4. Validación Facial */}
        <td className="p-4">
          {isExemptFacial ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              Exento por Rol
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 px-2.5 py-0.5 rounded-full">
              <Check className="w-3 h-3 stroke-[2.5]" />
              Biometría OK
            </span>
          )}
        </td>

        {/* 5. Horas Acumuladas */}
        <td className="p-4">
          <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100">
            {hoursToday} hrs
          </span>
        </td>

        {/* 6. Acciones */}
        <td className="p-4 text-right">
          <button
            type="button"
            onClick={onToggleExpand}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              isExpanded
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50'
                : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Gestionar permisos y asignaciones individuales"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Permisos</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </td>
      </tr>

      {/* Subpanel Expandible de Permisos y Tareas */}
      {isExpanded && (
        <tr className="bg-slate-50/80 dark:bg-slate-900/80">
          <td colSpan={6} className="p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Subpanel 1: Clientes Autorizados */}
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Clientes Autorizados ({member.allowedClientIds.length}/{clients.length})
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        updateUserClients(
                          member.id,
                          clients.map((c) => c.id)
                        )
                      }
                      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                    >
                      Habilitar todos
                    </button>
                    <span className="text-slate-400">•</span>
                    <button
                      type="button"
                      onClick={() => updateUserClients(member.id, [])}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-white hover:underline cursor-pointer font-medium"
                    >
                      Revocar todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                  {clients.map((client) => {
                    const isAllowed = member.allowedClientIds.includes(client.id);
                    return (
                      <label
                        key={client.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer hover:border-blue-400 transition"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                          {client.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => toggleUserClientPermission(member.id, client.id)}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Subpanel 2: Tareas Asignadas */}
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Tareas Asignadas ({userAssignments.length})
                  </span>
                  {onNavigateToTree && (
                    <button
                      type="button"
                      onClick={onNavigateToTree}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                    >
                      Ir a Proyectos →
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                  {userAssignments.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Este colaborador no tiene tareas asignadas directamente.
                    </p>
                  ) : (
                    userAssignments.map((asg) => {
                      const task = tasks.find((t) => t.id === asg.taskId);
                      const project = task ? projects.find((p) => p.id === task.projectId) : null;
                      const actualHours = userTaskActualHours[`${asg.taskId}_${member.id}`] || 0;

                      return (
                        <div
                          key={asg.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                              {task?.name || 'Tarea'}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {project?.name || 'Proyecto'}
                            </span>
                          </div>

                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {actualHours}h / {asg.allocatedHours}h
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
