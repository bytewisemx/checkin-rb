import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  X,
  Check,
  Building,
  Sliders,
} from 'lucide-react';
import { useCheckinStore, type ManagedUserPermissionEntry } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useTeamStore } from '../../store/useTeamStore';
import { UserAvatar } from '../../components/common/UserAvatar';
import {
  normalizeRole,
  getRoleDisplayName,
  getDefaultPermissionsForRole,
  getEffectivePermissions,
  type CanonicalRole,
  type UserGranularPermissions,
} from '../../services/rbac';

export interface UserPermissionsTableProps {
  onNewUser?: () => void;
}

export const GRANULAR_PERMISSION_DEFINITIONS: Array<{
  key: keyof UserGranularPermissions;
  label: string;
  category: 'operativo' | 'gestion' | 'ejecutivo';
  description: string;
}> = [
  {
    key: 'canCheckIn',
    label: 'Check-in y Cronómetro',
    category: 'operativo',
    description: 'Permite registrar entradas, salidas y cronometrar jornadas.',
  },
  {
    key: 'canCreateTasks',
    label: 'Crear Tareas en Proyecto',
    category: 'operativo',
    description: 'Crear nuevas tareas dentro de proyectos asignados.',
  },
  {
    key: 'canAdjustTeamTimes',
    label: 'Supervisar y Ajustar Tiempos',
    category: 'gestion',
    description: 'Supervisar cronómetros y ajustar registros de su equipo.',
  },
  {
    key: 'canManageClientsAndProjects',
    label: 'Alta de Clientes y Proyectos',
    category: 'gestion',
    description: 'Creación y configuración de clientes y proyectos.',
  },
  {
    key: 'canAssignProjectMembers',
    label: 'Asignar Personal a Proyectos',
    category: 'gestion',
    description: 'Vincular y desvincular colaboradores de los proyectos.',
  },
  {
    key: 'canViewFinancials',
    label: 'Costos y Presupuestos',
    category: 'gestion',
    description: 'Visualizar finanzas, tarifas por hora y costos acumulados.',
  },
  {
    key: 'canExportReports',
    label: 'Descargar Informes (Excel/PDF)',
    category: 'gestion',
    description: 'Exportar Kardex laboral, sábana y reportes ejecutivos.',
  },
  {
    key: 'canInviteUsers',
    label: 'Emitir Invitaciones',
    category: 'gestion',
    description: 'Generar enlaces y correos de invitación a nuevos usuarios.',
  },
  {
    key: 'canAdjustAttendanceRH',
    label: 'Ajuste de Asistencias e Incidencias',
    category: 'ejecutivo',
    description: 'Modificar retardos, justificar faltas y ajustar checadas RH.',
  },
  {
    key: 'canViewExecutiveAuditLogs',
    label: 'Bitácora de Auditoría Ejecutiva',
    category: 'ejecutivo',
    description: 'Ver historial de movimientos, descargas de reportes y presupuestos.',
  },
  {
    key: 'canManageSystemRBAC',
    label: 'Consola Central TI (Root)',
    category: 'ejecutivo',
    description: 'Administración total de roles, switches y políticas de acceso.',
  },
];

export function UserPermissionsTable({ onNewUser }: UserPermissionsTableProps) {
  const {
    userPermissionsDirectory,
    mockEmployeesData,
    updateUserPermissions,
    updateUserAssignedTeams,
    assignUserTeam,
    changeUserRole,
    toggleUserAccessRevoked,
    addToast,
  } = useCheckinStore();
  const { teamMembers } = useRayonerStore();
  const { teams, fetchTeams } = useTeamStore();

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const activeTeams = useMemo(() => teams.filter((t) => t.status !== 'inactive'), [teams]);
  const availableTeamNames = useMemo(() => activeTeams.map((t) => t.name), [activeTeams]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | CanonicalRole>('ALL');
  const [editingUser, setEditingUser] = useState<ManagedUserPermissionEntry | null>(null);
  const [draftRole, setDraftRole] = useState<CanonicalRole>('Colaborador');
  const [draftPermissions, setDraftPermissions] = useState<UserGranularPermissions>(
    getDefaultPermissionsForRole('Colaborador')
  );
  const [draftAssignedTeams, setDraftAssignedTeams] = useState<string[]>([]);
  const [draftTeam, setDraftTeam] = useState<string>('');

  // Unificación de usuarios
  const mergedUsers = useMemo<ManagedUserPermissionEntry[]>(() => {
    const map = new Map<string, ManagedUserPermissionEntry>();

    Object.values(userPermissionsDirectory).forEach((entry) => {
      const role = normalizeRole(entry.role);
      const effectivePerms = getEffectivePermissions(entry);
      map.set(entry.id, {
        ...entry,
        role,
        permissions: effectivePerms,
        assignedTeams: entry.assignedTeams || (role === 'RH' ? availableTeamNames : undefined),
      });
    });

    teamMembers.forEach((tm) => {
      const existing = map.get(tm.id);
      const role = normalizeRole(tm.role);
      if (existing) {
        map.set(tm.id, {
          ...existing,
          name: tm.name || existing.name,
          email: tm.email || existing.email,
          role,
          team: tm.team || existing.team,
        });
      } else {
        const perms = getDefaultPermissionsForRole(role);
        map.set(tm.id, {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          role,
          team: tm.team,
          permissions: perms,
          modules: {
            checkIn: perms.canCheckIn,
            facialCheckIn: false,
            tasks: perms.canCreateTasks,
            reports: perms.canExportReports,
            clients: perms.canManageClientsAndProjects,
          },
        });
      }
    });

    mockEmployeesData.forEach((emp) => {
      const existing = map.get(emp.id);
      const role = normalizeRole(emp.role);
      if (!existing) {
        const perms = getDefaultPermissionsForRole(role);
        map.set(emp.id, {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role,
          team: emp.team,
          supervisor_id: emp.supervisor_id || 'admin-99',
          permissions: perms,
          modules: {
            checkIn: perms.canCheckIn,
            facialCheckIn: false,
            tasks: perms.canCreateTasks,
            reports: perms.canExportReports,
            clients: perms.canManageClientsAndProjects,
          },
        });
      }
    });

    return Array.from(map.values());
  }, [userPermissionsDirectory, teamMembers, mockEmployeesData]);

  // Filtro por rol y búsqueda en tiempo real
  const filteredUsers = useMemo(() => {
    return mergedUsers.filter((u) => {
      const uRole = normalizeRole(u.role);
      if (roleFilter !== 'ALL' && uRole !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          (u.team || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mergedUsers, roleFilter, search]);

  // Conmutación rápida de un permiso individual desde la tabla
  const handleQuickTogglePermission = (
    userEntry: ManagedUserPermissionEntry,
    permKey: keyof UserGranularPermissions
  ) => {
    if (normalizeRole(userEntry.role) === 'TI' && permKey === 'canManageSystemRBAC') {
      addToast('El permiso maestro RBAC no puede desactivarse para TI Root.', 'info');
      return;
    }

    const currentPerms = userEntry.permissions || getDefaultPermissionsForRole(userEntry.role);
    const updatedValue = !currentPerms[permKey];

    updateUserPermissions(userEntry.id, {
      [permKey]: updatedValue,
    });

    addToast(
      `Permiso "${permKey}" ${updatedValue ? 'habilitado' : 'deshabilitado'} para ${userEntry.name}.`,
      'success'
    );
  };

  // Abrir modal de personalización avanzada
  const handleOpenEditModal = (userEntry: ManagedUserPermissionEntry) => {
    const norm = normalizeRole(userEntry.role);
    setEditingUser(userEntry);
    setDraftRole(norm);
    setDraftPermissions(userEntry.permissions || getDefaultPermissionsForRole(norm));
    setDraftAssignedTeams(userEntry.assignedTeams || availableTeamNames);
    setDraftTeam(
      userEntry.team && userEntry.team !== 'Sin equipo asignado' ? userEntry.team : ''
    );
  };

  // Cambio de rol en el modal: preselecciona los permisos por defecto del nuevo rol
  const handleModalRoleChange = (newRole: CanonicalRole) => {
    setDraftRole(newRole);
    setDraftPermissions(getDefaultPermissionsForRole(newRole));
    if (newRole === 'RH' && draftAssignedTeams.length === 0) {
      setDraftAssignedTeams(availableTeamNames);
    }
  };

  // Guardar cambios del modal
  const handleSaveModal = () => {
    if (!editingUser) return;

    // 1. Si cambió el rol
    if (normalizeRole(editingUser.role) !== draftRole) {
      changeUserRole(editingUser.id, draftRole);
    }

    // 2. Aplicar overrides de permisos
    updateUserPermissions(editingUser.id, draftPermissions);

    // 3. Si es RH o Gerente, guardar los equipos autorizados
    if (draftRole === 'RH' || draftRole === 'Gerente') {
      updateUserAssignedTeams(editingUser.id, draftAssignedTeams);
    }

    // 4. Si no es RH ni TI, actualizar o asignar equipo
    if (draftRole !== 'RH' && draftRole !== 'TI') {
      const selectedTeamObj = activeTeams.find((t) => t.name === draftTeam);
      assignUserTeam(editingUser.id, draftTeam, selectedTeamObj?.id);
    }

    addToast(`Perfil y permisos actualizados para ${editingUser.name}.`, 'success');
    setEditingUser(null);
  };

  // Restablecer a defaults del rol actual
  const handleResetToRoleDefaults = () => {
    setDraftPermissions(getDefaultPermissionsForRole(draftRole));
    addToast(`Permisos restablecidos a los valores base de ${getRoleDisplayName(draftRole)}.`, 'info');
  };

  // Conmutar equipo en la lista de asignados para RH
  const handleToggleAssignedTeam = (teamName: string) => {
    setDraftAssignedTeams((prev) => {
      if (prev.includes(teamName)) {
        return prev.filter((t) => t !== teamName);
      } else {
        return [...prev, teamName];
      }
    });
  };

  // Revocación / suspensión de acceso
  const handleToggleRevoke = (u: ManagedUserPermissionEntry) => {
    if (normalizeRole(u.role) === 'TI') {
      addToast('No es posible suspender la cuenta TI Root maestra.', 'error');
      return;
    }
    const isRevoked = Boolean(u.accessRevoked);
    toggleUserAccessRevoked(u.id);
    addToast(
      isRevoked
        ? `Acceso restaurado para ${u.name}.`
        : `Acceso REVOCADO para ${u.name}.`,
      isRevoked ? 'success' : 'error'
    );
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* 1. Barra de Búsqueda, Filtros y Acciones */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaborador, correo, rol o ID..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Filtro por los 6 Roles */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50 dark:bg-slate-900/60 text-xs">
            {(
              [
                ['ALL', 'Todos'],
                ['Colaborador', 'Colaborador'],
                ['Supervisor', 'Supervisor'],
                ['Gerente', 'Gerente'],
                ['Socio', 'Socio'],
                ['RH', 'RH'],
                ['TI', 'TI Root'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRoleFilter(val as 'ALL' | CanonicalRole)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  roleFilter === val
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {onNewUser && (
            <button
              type="button"
              onClick={onNewUser}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs transition cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Alta / Invitar Usuario
            </button>
          )}
        </div>
      </div>

      {/* 2. Tabla de Usuarios y Permisos Personalizables */}
      <div className="w-full bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Usuario / Correo</th>
                <th className="py-3.5 px-4">Rol Asignado</th>
                <th className="py-3.5 px-4">Equipo / Visibilidad</th>
                <th className="py-3.5 px-4">Switches Clave de Acceso</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-right">Personalizar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No se encontraron usuarios bajo los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const normRole = normalizeRole(u.role);
                  const isRevoked = Boolean(u.accessRevoked);
                  const perms = u.permissions || getDefaultPermissionsForRole(normRole);

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                        isRevoked ? 'opacity-60 bg-slate-50/30 dark:bg-slate-900/20' : ''
                      }`}
                    >
                      {/* Usuario */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            photoURL={u.photoURL}
                            name={u.name}
                            size="md"
                            shape="rounded"
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              className={`font-semibold text-slate-900 dark:text-slate-100 text-sm truncate ${
                                isRevoked ? 'line-through text-slate-400' : ''
                              }`}
                            >
                              {u.name}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px] truncate">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            normRole === 'TI'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : normRole === 'Socio'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : normRole === 'Gerente'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : normRole === 'Supervisor'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : normRole === 'RH'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {getRoleDisplayName(normRole)}
                        </span>
                      </td>

                      {/* Equipo / Visibilidad Aislada */}
                      <td className="py-3.5 px-4">
                        {normRole === 'RH' ? (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Equipos Autorizados ({u.assignedTeams?.length || 0}):
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {u.assignedTeams && u.assignedTeams.length > 0 ? (
                                u.assignedTeams.map((t) => (
                                  <span
                                    key={t}
                                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-100 dark:border-rose-900"
                                  >
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Sin equipo
                                </span>
                              )}
                            </div>
                          </div>
                        ) : normRole === 'TI' ? (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {u.team || 'TI Root'}
                          </span>
                        ) : !u.team ||
                          u.team.trim() === '' ||
                          u.team === 'Sin equipo asignado' ||
                          u.team === 'Sin equipo' ||
                          u.team === 'Sin equipo disponible' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Sin equipo
                          </span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {u.team}
                          </span>
                        )}
                      </td>

                      {/* Switches de Acceso Rápido */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Crear Tareas */}
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(u, 'canCreateTasks')}
                            title={`Crear Tareas: ${perms.canCreateTasks ? 'Habilitado' : 'Deshabilitado'}`}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                              perms.canCreateTasks
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                            }`}
                          >
                            Tareas
                          </button>

                          {/* Ajustar Tiempos */}
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(u, 'canAdjustTeamTimes')}
                            title={`Ajustar Tiempos: ${perms.canAdjustTeamTimes ? 'Habilitado' : 'Deshabilitado'}`}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                              perms.canAdjustTeamTimes
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
                                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                            }`}
                          >
                            Ajustar Horas
                          </button>

                          {/* Clientes y Proyectos */}
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(u, 'canManageClientsAndProjects')}
                            title={`Clientes/Proyectos: ${perms.canManageClientsAndProjects ? 'Habilitado' : 'Deshabilitado'}`}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                              perms.canManageClientsAndProjects
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                            }`}
                          >
                            Proyectos
                          </button>

                          {/* Descargar Informes */}
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(u, 'canExportReports')}
                            title={`Descargar Informes: ${perms.canExportReports ? 'Habilitado' : 'Deshabilitado'}`}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                              perms.canExportReports
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                            }`}
                          >
                            Informes
                          </button>

                          {/* Emitir Invitaciones */}
                          <button
                            type="button"
                            onClick={() => handleQuickTogglePermission(u, 'canInviteUsers')}
                            title={`Invitar Usuarios: ${perms.canInviteUsers ? 'Habilitado' : 'Deshabilitado'}`}
                            className={`px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer ${
                              perms.canInviteUsers
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                            }`}
                          >
                            Invitar
                          </button>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {(() => {
                          const isTiRoot = normRole === 'TI';
                          const hasNoTeam =
                            normRole === 'RH'
                              ? (!u.assignedTeams || u.assignedTeams.length === 0) &&
                                (!u.team || u.team === 'Sin equipo asignado' || u.team === 'Sin equipo')
                              : !u.team ||
                                u.team.trim() === '' ||
                                u.team === 'Sin equipo asignado' ||
                                u.team === 'Sin equipo' ||
                                u.team === 'Sin equipo disponible';

                          const isInactiveByPolicy =
                            !isTiRoot &&
                            ((u as any).status === 'inactive' ||
                              (u as any).isActive === false ||
                              hasNoTeam);

                          if (isInactiveByPolicy) {
                            return (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shadow-xs"
                                title="Inhabilitado: Requiere asignación de equipo para operar"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                                • Inhabilitado
                              </span>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={() => handleToggleRevoke(u)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                                isRevoked
                                  ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isRevoked ? 'bg-red-500' : 'bg-emerald-500'
                                }`}
                              />
                              {isRevoked ? 'Suspendido' : 'Activo'}
                            </button>
                          );
                        })()}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Permisos RBAC
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Modal de Personalización de Permisos y Rol */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#101726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <UserAvatar
                  photoURL={editingUser.photoURL}
                  name={editingUser.name}
                  size="md"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Configuración de Permisos: {editingUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingUser.email} • ID: {editingUser.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo con Scroll */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Selector de Rol */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Rol Jerárquico Corporativo</span>
                  <button
                    type="button"
                    onClick={handleResetToRoleDefaults}
                    className="text-blue-600 hover:underline cursor-pointer lowercase first-letter:uppercase text-[11px] font-normal"
                  >
                    Restablecer a plantilla base
                  </button>
                </label>
                <select
                  value={draftRole}
                  onChange={(e) => handleModalRoleChange(e.target.value as CanonicalRole)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="Colaborador">1. Colaborador (Operativo)</option>
                  <option value="Supervisor">2. Supervisor (Gestión de Equipo)</option>
                  <option value="Gerente">3. Gerente (Clientes, Proyectos, Invitaciones e Informes)</option>
                  <option value="Socio">4. Socio / Jefatura (Acceso Total, Ajuste RH y Bitácora)</option>
                  <option value="RH">5. Recursos Humanos (Control y Ajuste de Jornadas)</option>
                  <option value="TI">6. Administrador TI Root (Máxima Autoridad Técnica)</option>
                </select>
              </div>

              {/* Selector de Equipo Operativo para Roles No-RH / No-TI */}
              {draftRole !== 'RH' && draftRole !== 'TI' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Equipo Operativo Asignado
                  </label>
                  <select
                    value={draftTeam}
                    onChange={(e) => setDraftTeam(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="">-- Sin equipo asignado (Inhabilitado) --</option>
                    {activeTeams.map((team) => (
                      <option key={team.id} value={team.name}>
                        {team.name} ({team.code})
                      </option>
                    ))}
                  </select>
                  {!draftTeam && (
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg border border-blue-200 dark:border-blue-900">
                      • Nota: Un usuario sin equipo asignado permanece en estado inhabilitado hasta ser vinculado a un equipo activo.
                    </p>
                  )}
                </div>
              )}

              {/* Selector de Equipos para RH */}
              {draftRole === 'RH' && (
                <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-bold">
                    <Building className="w-4 h-4" />
                    <span>Equipos Autorizados a Visualizar (Aislamiento RH):</span>
                  </div>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Este usuario de RH únicamente tendrá visibilidad y permiso de ajuste sobre las asistencias y colaboradores de los equipos seleccionados.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {availableTeamNames.length === 0 ? (
                      <p className="text-xs text-rose-800/80 italic col-span-2">
                        Sin equipos registrados en la base de datos. Da de alta equipos en la pestaña Auditar Jerarquía.
                      </p>
                    ) : (
                      availableTeamNames.map((team) => {
                        const isSelected = draftAssignedTeams.includes(team);
                        return (
                          <button
                            key={team}
                            type="button"
                            onClick={() => handleToggleAssignedTeam(team)}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium border transition cursor-pointer text-left ${
                              isSelected
                                ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span>{team}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Switches Granulares de Permisos */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Matriz de Permisos Individuales (Overrides de TI)
                </label>
                <div className="space-y-2">
                  {GRANULAR_PERMISSION_DEFINITIONS.map((def) => {
                    const isChecked = Boolean(draftPermissions[def.key]);
                    return (
                      <label
                        key={def.key}
                        className="flex items-start justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer"
                      >
                        <div className="pr-4">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {def.label}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {def.description}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setDraftPermissions((prev) => ({
                              ...prev,
                              [def.key]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 mt-0.5 text-blue-600 rounded-sm border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Guardar Permisos Personalizados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
