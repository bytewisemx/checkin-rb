import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCheckinStore, type ManagedUserPermissionEntry } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { UserAvatar } from '../../components/common/UserAvatar';
import {
  normalizeRole,
  getDefaultModulesForRole,
  type UserModules,
} from '../../services/rbac';

export interface UserPermissionsTableProps {
  onNewUser?: () => void;
}

const MODULE_LIST: Array<{
  key: keyof UserModules;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    key: 'checkIn',
    label: 'Reloj Checador',
    shortLabel: 'Checador',
    hint: 'Entrada y salida con registro de horas (Check-In / Check-Out)',
  },
  {
    key: 'tasks',
    label: 'Tablero Kanban y Tareas',
    shortLabel: 'Kanban',
    hint: 'Asignación, seguimiento y ejecución de tareas',
  },
  {
    key: 'clients',
    label: 'Cartera de Clientes y Proyectos',
    shortLabel: 'Clientes',
    hint: 'Visualización y gestión de clientes y proyectos asignados',
  },
  {
    key: 'reports',
    label: 'Auditoría y Reportes de Tiempos',
    shortLabel: 'Auditorías',
    hint: 'Reportes ejecutivos de horas, rendimientos y asistencias',
  },
  {
    key: 'facialCheckIn',
    label: 'Validación Facial Biométrica',
    shortLabel: 'Facial',
    hint: 'Verificación facial express obligatoria al iniciar jornada',
  },
];

export function UserPermissionsTable({ onNewUser }: UserPermissionsTableProps) {
  const {
    userPermissionsDirectory,
    mockEmployeesData,
    updateUserModules,
    toggleUserAccessRevoked,
    reassignEmployeeSupervisor,
    addToast,
  } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TI' | 'RH' | 'Supervisor' | 'Empleado'>('ALL');
  const [editingUser, setEditingUser] = useState<ManagedUserPermissionEntry | null>(null);
  const [modalDraftModules, setModalDraftModules] = useState<UserModules | null>(null);

  // Unificación de usuarios desde directorio de permisos, miembros y mocks
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

  // Filtro por rol y búsqueda en tiempo real
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

  const allSupervisors = useMemo(() => {
    return mergedUsers.filter((u) => u.role === 'Supervisor');
  }, [mergedUsers]);

  // Conmutación rápida de módulo con guardado directo
  const handleToggleModuleQuick = (userEntry: ManagedUserPermissionEntry, key: keyof UserModules) => {
    if (userEntry.role === 'TI') {
      addToast('Las cuentas TI (Root) conservan todos los módulos activos por seguridad.', 'info');
      return;
    }

    if (userEntry.role === 'RH' && (key === 'tasks' || key === 'clients')) {
      addToast('Política RBAC 403: Recursos Humanos tiene restringido el acceso a Tareas y Clientes.', 'error');
      return;
    }

    const currentModules = userEntry.modules;
    const nextModules: UserModules = {
      ...currentModules,
      [key]: !currentModules[key],
    };

    updateUserModules(userEntry.id, nextModules);
    addToast(
      `Módulo "${key}" ${nextModules[key] ? 'habilitado' : 'deshabilitado'} para ${userEntry.name}.`,
      'success'
    );
  };

  // Abrir modal de edición
  const handleOpenEditModal = (userEntry: ManagedUserPermissionEntry) => {
    setEditingUser(userEntry);
    setModalDraftModules({ ...userEntry.modules });
  };

  // Guardar desde el modal
  const handleSaveModal = () => {
    if (!editingUser || !modalDraftModules) return;
    updateUserModules(editingUser.id, modalDraftModules);
    addToast(`Permisos actualizados para ${editingUser.name}.`, 'success');
    setEditingUser(null);
    setModalDraftModules(null);
  };

  // Aplicar presets en el modal
  const handleApplyPresetInModal = (preset: 'entry_exit_only' | 'full_role') => {
    if (!editingUser) return;
    if (editingUser.role === 'TI') return;

    const nextModules: UserModules =
      preset === 'entry_exit_only'
        ? {
            checkIn: true,
            tasks: false,
            clients: false,
            reports: false,
            facialCheckIn: true,
          }
        : getDefaultModulesForRole(editingUser.role);

    setModalDraftModules(nextModules);
  };

  // Conmutar revocación de acceso
  const handleToggleRevoke = (u: ManagedUserPermissionEntry) => {
    if (u.role === 'TI') {
      addToast('No es posible revocar la cuenta TI Root principal.', 'error');
      return;
    }
    const isRevoked = Boolean(u.accessRevoked);
    toggleUserAccessRevoked(u.id);
    addToast(
      isRevoked
        ? `Acceso restaurado por TI para ${u.name}.`
        : `Acceso REVOCADO / SUSPENDIDO para ${u.name}.`,
      isRevoked ? 'success' : 'error'
    );
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* 2. Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Input de Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo, rol o ID..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
          />
        </div>

        {/* Filtro Rápido Segmentado por Rol y Botón de Acción Principal */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800/60 text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                roleFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('TI')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                roleFilter === 'TI'
                  ? 'bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              TI Root
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('RH')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                roleFilter === 'RH'
                  ? 'bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              RH
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('Supervisor')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                roleFilter === 'Supervisor'
                  ? 'bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Supervisores
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('Empleado')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                roleFilter === 'Empleado'
                  ? 'bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Operativos
            </button>
          </div>

          {onNewUser && (
            <button
              type="button"
              onClick={onNewUser}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Usuario / Supervisor
            </button>
          )}
        </div>
      </div>

      {/* 3. Tabla Jerárquica y de Permisos (Table Project) */}
      <div className="w-full bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Usuario / Cuenta</th>
                <th className="py-3.5 px-4">Jerarquía y Equipo</th>
                <th className="py-3.5 px-4">Matriz de Permisos / Módulos</th>
                <th className="py-3.5 px-4">Estado de Cuenta</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No se encontraron usuarios con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isRevoked = Boolean(u.accessRevoked);
                  const isTI = u.role === 'TI';
                  const isRH = u.role === 'RH';
                  const isSupervisor = u.role === 'Supervisor';

                  // Resolución del equipo y supervisor a cargo
                  const supervisorUser = allSupervisors.find(
                    (s) => s.id === (isSupervisor ? u.id : u.supervisor_id || 'admin-99')
                  );
                  const supervisorIndex = allSupervisors.findIndex(
                    (s) => s.id === (isSupervisor ? u.id : u.supervisor_id || 'admin-99')
                  );
                  const teamNumber = supervisorIndex >= 0 ? supervisorIndex + 1 : 1;
                  const supervisorName = supervisorUser?.name || 'Supervisor Líder';

                  // Cantidad de colaboradores subordinados a este supervisor
                  const subordinateCount = isSupervisor
                    ? mergedUsers.filter((m) => (m.supervisor_id || 'admin-99') === u.id).length
                    : 0;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                        isRevoked ? 'opacity-60 bg-slate-50/30 dark:bg-slate-900/20' : ''
                      }`}
                    >
                      {/* Columna 1: Usuario / Credenciales */}
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
                              {u.email} • {u.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Columna 2: Jerarquía y Equipo */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {isTI && (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-sky-300 dark:border-blue-800/60">
                                Nivel 1 • TI Root
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5">Control global del sistema</p>
                            </div>
                          )}

                          {isRH && (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60">
                                Nivel 2 • Recursos Humanos
                              </span>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Auditoría de checadas • {u.allowedSupervisorIds?.length ?? allSupervisors.length} equipo(s)
                              </p>
                            </div>
                          )}

                          {isSupervisor && (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                Nivel 3 • Supervisor
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {u.team || `Equipo #${teamNumber}`} • Lidera {subordinateCount} {subordinateCount === 1 ? 'colaborador' : 'colaboradores'}
                              </p>
                            </div>
                          )}

                          {u.role === 'Empleado' && (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200/60 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60">
                                Nivel 4 • Operativo
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Equipo #{teamNumber} • Reporta a {supervisorName}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Columna 3: Matriz de Permisos / Módulos (Badges Interactivos) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {MODULE_LIST.map((mod) => {
                            const isEnabled = Boolean(u.modules[mod.key]);
                            const isPolicyLocked = isTI || (isRH && (mod.key === 'tasks' || mod.key === 'clients'));

                            return (
                              <button
                                key={mod.key}
                                type="button"
                                disabled={isPolicyLocked || isRevoked}
                                onClick={() => handleToggleModuleQuick(u, mod.key)}
                                title={
                                  isPolicyLocked
                                    ? isTI
                                      ? 'TI Root mantiene todos los módulos activos'
                                      : 'Política RBAC 403: No permitido para RH'
                                    : `${isEnabled ? 'Desactivar' : 'Activar'} ${mod.label}`
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                  isPolicyLocked
                                    ? isTI
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-sky-300 cursor-default'
                                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 cursor-not-allowed opacity-60'
                                    : isEnabled
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 cursor-pointer active:scale-95'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200/60 dark:bg-slate-800/60 dark:text-slate-500 dark:border-slate-700/60 cursor-pointer active:scale-95'
                                }`}
                              >
                                {mod.shortLabel}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Columna 4: Estado de Cuenta */}
                      <td className="py-3.5 px-4">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Suspendido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                          </span>
                        )}
                      </td>

                      {/* Columna 5: Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botón Editar Permisos */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Gestionar permisos y equipo"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>

                          {/* Botón Revocar / Restaurar */}
                          {!isTI && (
                            <button
                              type="button"
                              onClick={() => handleToggleRevoke(u)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isRevoked
                                  ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                              title={isRevoked ? 'Restaurar Acceso' : 'Revocar Acceso / Suspender'}
                            >
                              {isRevoked ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal de Edición de Permisos y Estructura */}
      {editingUser && modalDraftModules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-6">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gestionar Permisos y Accesos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingUser.name} • <span className="font-mono">{editingUser.email}</span> ({editingUser.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setModalDraftModules(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Rápidos */}
            {editingUser.role !== 'TI' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Ajuste rápido:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPresetInModal('entry_exit_only')}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                >
                  Solo Checador
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetInModal('full_role')}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                >
                  Perfil Completo de {editingUser.role}
                </button>
              </div>
            )}

            {/* Lista de Módulos con Switches */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {MODULE_LIST.map((mod) => {
                const isEnabled = Boolean(modalDraftModules[mod.key]);
                const isPolicyLocked =
                  editingUser.role === 'TI' ||
                  (editingUser.role === 'RH' && (mod.key === 'tasks' || mod.key === 'clients'));

                return (
                  <div
                    key={mod.key}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {mod.label}
                        </span>
                        {isPolicyLocked && editingUser.role === 'RH' && (
                          <span className="text-[10px] font-mono text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                            RBAC 403
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{mod.hint}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isPolicyLocked}
                      onClick={() =>
                        setModalDraftModules((prev) =>
                          prev ? { ...prev, [mod.key]: !prev[mod.key] } : prev
                        )
                      }
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        isPolicyLocked
                          ? 'opacity-40 cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                          : isEnabled
                          ? 'bg-blue-600 justify-end'
                          : 'bg-slate-200 dark:bg-slate-700 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Reasignación de Equipo para Empleados */}
            {editingUser.role === 'Empleado' && allSupervisors.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Supervisor y Equipo Asignado
                </label>
                <select
                  value={editingUser.supervisor_id || allSupervisors[0]?.id}
                  onChange={(e) => {
                    reassignEmployeeSupervisor(editingUser.id, e.target.value);
                    setEditingUser((prev) => (prev ? { ...prev, supervisor_id: e.target.value } : prev));
                    addToast(`Supervisor reasignado a ${editingUser.name}.`, 'info');
                  }}
                  className="w-full py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600"
                >
                  {allSupervisors.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      Equipo #{idx + 1}: {s.name} ({s.team || 'Equipo Corporativo'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Botones de Acción del Modal */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setModalDraftModules(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Guardar Permisos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
