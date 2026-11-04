import { useState, useMemo, useEffect, Fragment } from 'react';
import { Search } from 'lucide-react';
import { useCheckinStore, type ManagedUserPermissionEntry } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import {
  normalizeRole,
  getDefaultModulesForRole,
  type UserModules,
  type UserRole,
} from '../../services/rbac';

const MODULE_COLUMNS: Array<{
  key: keyof UserModules;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    key: 'checkIn',
    label: 'Reloj Checador',
    shortLabel: 'Reloj Checador',
    hint: 'Habilita el reloj de entrada/salida (Check-In / Check-Out)',
  },
  {
    key: 'tasks',
    label: 'Tareas (Kanban)',
    shortLabel: 'Tareas (Kanban)',
    hint: 'Habilita el tablero Kanban y la ejecución de tareas asignadas',
  },
  {
    key: 'clients',
    label: 'Clientes / Empresas',
    shortLabel: 'Clientes / Empresas',
    hint: 'Permite visualizar empresas y proyectos en el árbol C/P/T',
  },
  {
    key: 'reports',
    label: 'Reportes / Auditoría',
    shortLabel: 'Reportes / Auditoría',
    hint: 'Acceso a métricas operativas y reportes de horas',
  },
  {
    key: 'facialCheckIn',
    label: 'Check-In Facial',
    shortLabel: 'Check-In Facial',
    hint: 'Fuerza la verificación biométrica facial (128D) incluso en Supervisores',
  },
];

export function UserPermissionsTable() {
  const {
    userPermissionsDirectory,
    mockEmployeesData,
    updateUserModules,
    toggleUserAccessRevoked,
    updateRHAllowedTeams,
    reassignEmployeeSupervisor,
    addToast,
  } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [groupByHierarchy, setGroupByHierarchy] = useState<boolean>(true);

  const mergedUsers = useMemo<ManagedUserPermissionEntry[]>(() => {
    const map = new Map<string, ManagedUserPermissionEntry>();

    Object.values(userPermissionsDirectory).forEach((entry) => {
      map.set(entry.id, {
        ...entry,
        role: normalizeRole(entry.role),
        modules: { ...entry.modules },
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
          supervisor_id: tm.supervisor_id || tm.supervisorId || existing.supervisor_id,
        });
      } else {
        map.set(tm.id, {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          role,
          team: tm.team,
          supervisor_id: tm.supervisor_id || tm.supervisorId,
          modules: getDefaultModulesForRole(role),
        });
      }
    });

    mockEmployeesData.forEach((emp) => {
      const existing = map.get(emp.id);
      const role = normalizeRole(emp.role);
      if (!existing) {
        map.set(emp.id, {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role,
          team: emp.team,
          supervisor_id: emp.supervisor_id || 'admin-99',
          modules: getDefaultModulesForRole(role),
        });
      }
    });

    return Array.from(map.values());
  }, [userPermissionsDirectory, teamMembers, mockEmployeesData]);

  const [drafts, setDrafts] = useState<Record<string, UserModules>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    const initial: Record<string, UserModules> = {};
    mergedUsers.forEach((u) => {
      initial[u.id] = { ...u.modules };
    });
    setDrafts(initial);
  }, [mergedUsers]);

  const filteredUsers = useMemo(() => {
    return mergedUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
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

  const hierarchyGroups = useMemo(() => {
    const tiUsers = filteredUsers.filter((u) => u.role === 'TI');
    const rhUsers = filteredUsers.filter((u) => u.role === 'RH');
    const allSupervisors = mergedUsers.filter((u) => u.role === 'Supervisor');
    const visibleSupervisors = filteredUsers.filter((u) => u.role === 'Supervisor');
    const visibleEmployees = filteredUsers.filter((u) => u.role === 'Empleado');

    const teams = allSupervisors
      .map((sup, index) => {
        const teamEmployees = visibleEmployees.filter(
          (emp) => (emp.supervisor_id || 'admin-99') === sup.id
        );
        const isSupVisible = visibleSupervisors.some((s) => s.id === sup.id);
        return {
          teamNumber: index + 1,
          supervisor: sup,
          employees: teamEmployees,
          shouldRender: isSupVisible || teamEmployees.length > 0,
        };
      })
      .filter((t) => t.shouldRender);

    return {
      tiUsers,
      rhUsers,
      allSupervisors,
      teams,
    };
  }, [filteredUsers, mergedUsers]);

  const hasUnsavedChanges = (userId: string, original: UserModules): boolean => {
    const draft = drafts[userId];
    if (!draft) return false;
    return (
      draft.checkIn !== original.checkIn ||
      draft.tasks !== original.tasks ||
      draft.clients !== original.clients ||
      draft.reports !== original.reports ||
      draft.facialCheckIn !== original.facialCheckIn
    );
  };

  const handleToggleModule = (userEntry: ManagedUserPermissionEntry, key: keyof UserModules) => {
    if (userEntry.role === 'TI') {
      addToast('Las cuentas TI (Root) conservan todos los módulos activos por seguridad.', 'info');
      return;
    }

    if (userEntry.role === 'RH' && (key === 'tasks' || key === 'clients')) {
      addToast('Política RBAC 403: Recursos Humanos tiene bloqueado el acceso a Tareas y Clientes.', 'error');
      return;
    }

    setDrafts((prev) => {
      const current = prev[userEntry.id] || userEntry.modules;
      return {
        ...prev,
        [userEntry.id]: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  };

  const handleApplyPreset = (
    userEntry: ManagedUserPermissionEntry,
    preset: 'entry_exit_only' | 'full_role'
  ) => {
    if (userEntry.role === 'TI') return;

    const nextModules: UserModules =
      preset === 'entry_exit_only'
        ? {
            checkIn: true,
            tasks: false,
            clients: false,
            reports: false,
            facialCheckIn: true,
          }
        : getDefaultModulesForRole(userEntry.role);

    setDrafts((prev) => ({
      ...prev,
      [userEntry.id]: nextModules,
    }));
  };

  const handleSaveUserPermissions = async (userEntry: ManagedUserPermissionEntry) => {
    const nextModules = drafts[userEntry.id] || userEntry.modules;
    setSavingUserId(userEntry.id);

    await new Promise((resolve) => setTimeout(resolve, 150));

    updateUserModules(userEntry.id, nextModules);
    setSavingUserId(null);

    addToast(
      `Permisos guardados para ${userEntry.name} (${userEntry.role}).`,
      'success'
    );
  };

  const handleRevokeEntireTeam = (
    supervisor: ManagedUserPermissionEntry,
    employees: ManagedUserPermissionEntry[],
    shouldRevoke: boolean
  ) => {
    if (Boolean(supervisor.accessRevoked) !== shouldRevoke) {
      toggleUserAccessRevoked(supervisor.id);
    }
    employees.forEach((emp) => {
      if (Boolean(emp.accessRevoked) !== shouldRevoke) {
        toggleUserAccessRevoked(emp.id);
      }
    });
    addToast(
      shouldRevoke
        ? `TI revocó el acceso completo al Equipo de ${supervisor.name} (${employees.length + 1} cuentas).`
        : `TI restauró el acceso completo al Equipo de ${supervisor.name} (${employees.length + 1} cuentas).`,
      shouldRevoke ? 'error' : 'success'
    );
  };

  const renderUserMatrixRow = (
    u: ManagedUserPermissionEntry,
    options?: {
      isSubordinate?: boolean;
      isLastSubordinate?: boolean;
      teamNumber?: number;
      supervisorName?: string;
    }
  ) => {
    const draft = drafts[u.id] || u.modules;
    const isTI = u.role === 'TI';
    const isRH = u.role === 'RH';
    const isRevoked = Boolean(u.accessRevoked);
    const dirty = hasUnsavedChanges(u.id, u.modules);

    const supIndex = hierarchyGroups.allSupervisors.findIndex(
      (s) => s.id === (u.role === 'Supervisor' ? u.id : u.supervisor_id || 'admin-99')
    );
    const resolvedTeamNumber = options?.teamNumber ?? (supIndex >= 0 ? supIndex + 1 : 1);
    const resolvedSupName =
      options?.supervisorName ??
      (supIndex >= 0 ? hierarchyGroups.allSupervisors[supIndex].name : 'Supervisor Prueba');

    const allowedSupsForRH =
      u.allowedSupervisorIds ?? hierarchyGroups.allSupervisors.map((s) => s.id);

    const toggleTeamForRH = (supId: string, supName: string) => {
      const exists = allowedSupsForRH.includes(supId);
      const next = exists
        ? allowedSupsForRH.filter((id) => id !== supId)
        : [...allowedSupsForRH, supId];
      updateRHAllowedTeams(u.id, next);
      addToast(
        exists
          ? `TI retiró a ${u.name} la visualización de checadas del equipo de ${supName}.`
          : `TI autorizó a ${u.name} visualizar las checadas del equipo de ${supName}.`,
        exists ? 'info' : 'success'
      );
    };

    return (
      <tr
        key={u.id}
        className={`bg-white dark:bg-[#101726] hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors ${
          isRevoked ? 'opacity-65' : ''
        }`}
      >
        {/* Columna 1: Usuario y Correo */}
        <td className="py-4 px-4 align-top">
          <div className={options?.isSubordinate ? 'pl-5 border-l-2 border-slate-300 dark:border-slate-700' : ''}>
            <div className="flex items-center flex-wrap gap-2">
              {options?.isSubordinate && (
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {options.isLastSubordinate ? '└─' : '├─'}
                </span>
              )}
              <span
                className={`font-semibold text-sm ${
                  isRevoked
                    ? 'line-through text-slate-500 dark:text-slate-400'
                    : 'text-slate-900 dark:text-slate-200'
                }`}
              >
                {u.name}
              </span>
              <span className="text-[11px] font-medium text-blue-700 dark:text-sky-400">
                ({u.role})
              </span>
              {isRevoked && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  [REVOCADO]
                </span>
              )}
            </div>
            <div className={`text-xs text-slate-600 dark:text-slate-400 mt-0.5 ${options?.isSubordinate ? 'pl-5' : ''}`}>
              {u.email} • <span className="font-mono text-[11px]">ID: {u.id}</span>
            </div>
          </div>
        </td>

        {/* Columna 2: Jerarquía, Equipo y Relación de Reporte */}
        <td className="py-4 px-4 align-top text-xs text-slate-600 dark:text-slate-400">
          {u.role === 'TI' && (
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-200 block">
                Nivel 1 • Puesto Más Alto (Root)
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                Autoridad global sobre toda la estructura
              </span>
            </div>
          )}

          {u.role === 'RH' && (
            <div className="space-y-2">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-200 block">
                  Nivel 2 • Reporta a TI Root
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Equipos autorizados para ver checadas:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                {hierarchyGroups.allSupervisors.map((sup, idx) => {
                  const checked = allowedSupsForRH.includes(sup.id);
                  return (
                    <label
                      key={sup.id}
                      className="inline-flex items-center space-x-1.5 text-[11px] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isRevoked}
                        onChange={() => toggleTeamForRH(sup.id, sup.name)}
                        className="w-4 h-4 rounded-sm bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-blue-600 accent-blue-600 cursor-pointer"
                      />
                      <span className={checked ? 'font-semibold text-slate-900 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}>
                        Equipo #{idx + 1} ({sup.name})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {u.role === 'Supervisor' && (
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-200 block">
                Cabeza de Equipo #{resolvedTeamNumber} ({u.team || 'Equipo Prueba'})
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                Socio / Supervisor • Código: <code className="font-mono text-slate-700 dark:text-slate-200">SUP-RB-990{resolvedTeamNumber}</code>
              </span>
            </div>
          )}

          {u.role === 'Empleado' && (
            <div className="space-y-1">
              <span className="block text-slate-600 dark:text-slate-400">
                Integrante de <strong className="text-slate-900 dark:text-slate-200">Equipo #{resolvedTeamNumber}</strong>
              </span>
              <span className="text-[11px] block text-slate-600 dark:text-slate-400">
                Reporta a: <strong className="text-slate-900 dark:text-slate-200">{resolvedSupName}</strong>
              </span>
              {hierarchyGroups.allSupervisors.length > 1 && (
                <select
                  value={u.supervisor_id || 'admin-99'}
                  onChange={(e) => {
                    reassignEmployeeSupervisor(u.id, e.target.value);
                    addToast(`TI reasignó a ${u.name} de equipo.`, 'info');
                  }}
                  className="bg-white dark:bg-[#0B111E] border border-slate-300 dark:border-slate-700 focus:border-sky-400 rounded px-2 py-0.5 text-[11px] text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  {hierarchyGroups.allSupervisors.map((s, sIdx) => (
                    <option key={s.id} value={s.id} className="bg-white dark:bg-[#101726]">
                      Mover a Equipo #{sIdx + 1}: {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </td>

        {/* Columnas 3 a 7: Casillas de Verificación (Checkboxes) por Módulo */}
        {MODULE_COLUMNS.map((col) => {
          const checked = Boolean(draft[col.key]);
          const lockedByPolicy =
            isTI || (isRH && (col.key === 'tasks' || col.key === 'clients'));

          return (
            <td key={col.key} className="py-4 px-3 text-center align-middle">
              <label className="inline-flex flex-col items-center justify-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={lockedByPolicy || isRevoked}
                  onChange={() => handleToggleModule(u, col.key)}
                  title={col.hint}
                  className="w-4 h-4 rounded-sm bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-blue-600 accent-blue-600 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                />
                {isRH && (col.key === 'tasks' || col.key === 'clients') && (
                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    403
                  </span>
                )}
              </label>
            </td>
          );
        })}

        {/* Columna 8: Revocación y Guardado */}
        <td className="py-4 px-4 text-right align-middle">
          {isTI ? (
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-blue-700 dark:text-sky-400">
              Root Activo
            </span>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {!isRevoked && u.role === 'Empleado' && (
                <button
                  type="button"
                  onClick={() => handleApplyPreset(u, 'entry_exit_only')}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:underline cursor-pointer"
                  title="Palomear únicamente Reloj Checador y Biometría"
                >
                  Solo Checador
                </button>
              )}

              {dirty && (
                <button
                  type="button"
                  disabled={savingUserId === u.id}
                  onClick={() => handleSaveUserPermissions(u)}
                  className="px-3 py-1 rounded bg-[#1D4ED8] hover:bg-[#1E40AF] text-slate-100 text-xs font-heading font-semibold cursor-pointer transition-colors"
                >
                  {savingUserId === u.id ? 'Guardando...' : 'Guardar'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  toggleUserAccessRevoked(u.id);
                  addToast(
                    isRevoked
                      ? `Permisos restaurados por TI para ${u.name}.`
                      : `Permisos REVOCADOS por TI para ${u.name}.`,
                    isRevoked ? 'success' : 'error'
                  );
                }}
                className={`px-3 py-1 rounded text-xs font-heading font-semibold transition-colors cursor-pointer ${
                  isRevoked
                    ? 'bg-[#1D4ED8] hover:bg-[#1E40AF] text-slate-100'
                    : 'bg-slate-100 dark:bg-[#1E2B45] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-sky-400'
                }`}
              >
                {isRevoked ? 'Restaurar' : 'Revocar'}
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Búsqueda y Filtros de la Matriz */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario por nombre, correo, equipo o ID..."
            className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-[#0B111E] border border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-sky-400 rounded-md text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-6">
          {/* Filtro por Rol */}
          <div className="flex items-center space-x-4 text-xs font-heading">
            {(['ALL', 'TI', 'RH', 'Supervisor', 'Empleado'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`pb-1 transition-colors cursor-pointer uppercase tracking-wider ${
                  roleFilter === r
                    ? 'font-bold text-slate-900 dark:text-slate-100 border-b-2 border-[#1D4ED8] dark:border-sky-400'
                    : 'font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {r === 'ALL' ? 'Todos' : r}
              </button>
            ))}
          </div>

          {/* Agrupar filas por Equipos y Jerarquía dentro de la Tabla Matricial */}
          <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={groupByHierarchy}
              onChange={(e) => setGroupByHierarchy(e.target.checked)}
              className="w-4 h-4 rounded-sm bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-600 text-blue-600 accent-blue-600 cursor-pointer"
            />
            <span className="font-medium text-slate-900 dark:text-slate-200">
              Separar por Niveles y Equipos
            </span>
          </label>
        </div>
      </div>

      {/* TABLA MATRICIAL DE PERMISOS (PANEL TI) CON ELEVACIÓN #101726 */}
      <div className="overflow-x-auto bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 rounded-md">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 dark:bg-[#0B111E] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr className="text-[11px] font-heading font-semibold uppercase tracking-widest">
              <th className="py-3.5 px-4 min-w-[230px] text-slate-600 dark:text-slate-400">Usuario / Cuenta</th>
              <th className="py-3.5 px-4 min-w-[250px] text-slate-600 dark:text-slate-400">Jerarquía / Equipo</th>
              {MODULE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="py-3.5 px-3 text-center min-w-[115px] text-slate-600 dark:text-slate-400"
                  title={col.hint}
                >
                  {col.shortLabel}
                </th>
              ))}
              <th className="py-3.5 px-4 text-right min-w-[170px] text-slate-600 dark:text-slate-400">Acciones TI</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
            {groupByHierarchy ? (
              <>
                {/* SECCIÓN 1: NIVEL MÁS ALTO — TI (ROOT) */}
                {hierarchyGroups.tiUsers.length > 0 && (
                  <>
                    <tr className="bg-slate-50 dark:bg-[#0B111E]">
                      <td
                        colSpan={8}
                        className="py-2.5 px-4 text-[11px] font-heading font-bold uppercase tracking-widest text-blue-700 dark:text-sky-400"
                      >
                        NIVEL 1 — PUESTO MÁS ALTO • ADMINISTRACIÓN TI (ROOT)
                      </td>
                    </tr>
                    {hierarchyGroups.tiUsers.map((tiUser) => renderUserMatrixRow(tiUser))}
                  </>
                )}

                {/* SECCIÓN 2: RECURSOS HUMANOS (RH) */}
                {hierarchyGroups.rhUsers.length > 0 && (
                  <>
                    <tr className="bg-slate-50 dark:bg-[#0B111E]">
                      <td
                        colSpan={8}
                        className="py-2.5 px-4 text-[11px] font-heading font-bold uppercase tracking-widest text-slate-700 dark:text-slate-400"
                      >
                        NIVEL 2 — RECURSOS HUMANOS (VISUALIZACIÓN DE CHECADAS POR EQUIPO)
                      </td>
                    </tr>
                    {hierarchyGroups.rhUsers.map((rhUser) => renderUserMatrixRow(rhUser))}
                  </>
                )}

                {/* SECCIÓN 3: EQUIPOS OPERATIVOS */}
                {hierarchyGroups.teams.map(({ teamNumber, supervisor, employees }) => {
                  const isSupRevoked = Boolean(supervisor.accessRevoked);
                  const allTeamRevoked =
                    isSupRevoked && employees.every((emp) => Boolean(emp.accessRevoked));

                  return (
                    <Fragment key={supervisor.id}>
                      <tr className="bg-slate-50 dark:bg-[#0B111E]">
                        <td colSpan={7} className="py-2.5 px-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[11px] font-heading font-bold uppercase tracking-widest text-blue-700 dark:text-sky-400">
                              NIVEL 3 — EQUIPO #{teamNumber} • {(supervisor.team || 'EQUIPO PRUEBA').toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">
                              Código: <code className="font-mono text-slate-800 dark:text-slate-200">SUP-RB-990{teamNumber}</code> • Líder: <strong className="text-slate-900 dark:text-slate-200">{supervisor.name}</strong> ({employees.length} {employees.length === 1 ? 'subordinado' : 'subordinados'})
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleRevokeEntireTeam(supervisor, employees, !allTeamRevoked)
                            }
                            className="text-[11px] font-heading font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            {allTeamRevoked
                              ? `Restaurar Equipo #${teamNumber}`
                              : `Revocar Equipo #${teamNumber}`}
                          </button>
                        </td>
                      </tr>

                      {/* Fila del Socio / Supervisor (Cabeza del Equipo) */}
                      {renderUserMatrixRow(supervisor, {
                        isSubordinate: false,
                        teamNumber,
                        supervisorName: supervisor.name,
                      })}

                      {/* Filas indentadas de los Empleados Subordinados a este Equipo */}
                      {employees.map((emp, empIdx) =>
                        renderUserMatrixRow(emp, {
                          isSubordinate: true,
                          isLastSubordinate: empIdx === employees.length - 1,
                          teamNumber,
                          supervisorName: supervisor.name,
                        })
                      )}
                    </Fragment>
                  );
                })}
              </>
            ) : (
              filteredUsers.map((u) => renderUserMatrixRow(u))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
