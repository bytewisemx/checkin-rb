import { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  Search,
  Save,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useCheckinStore, type ManagedUserPermissionEntry } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import {
  normalizeRole,
  getDefaultModulesForRole,
  type UserModules,
  type UserRole,
} from '../../services/rbac';

export function UserPermissionsTable() {
  const {
    userPermissionsDirectory,
    updateUserModules,
    addToast,
  } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [autoSaveReactive, setAutoSaveReactive] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Combinar directorio de permisos con cualquier miembro nuevo dado de alta en RayonerStore
  const mergedUsers = useMemo<ManagedUserPermissionEntry[]>(() => {
    const map = new Map<string, ManagedUserPermissionEntry>();

    Object.values(userPermissionsDirectory).forEach((entry) => {
      map.set(entry.id, entry);
    });

    teamMembers.forEach((tm) => {
      if (!map.has(tm.id)) {
        const normRole = normalizeRole(tm.role || 'Empleado');
        map.set(tm.id, {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          role: normRole,
          team: tm.team,
          modules: getDefaultModulesForRole(normRole),
          biometrics: null,
        });
      }
    });

    return Array.from(map.values());
  }, [userPermissionsDirectory, teamMembers]);

  // Borrador local para soportar tanto guardado reactivo como botón "Guardar Permisos"
  const [draftModules, setDraftModules] = useState<Record<string, UserModules>>({});
  const [dirtyIds, setDirtyIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const nextDrafts: Record<string, UserModules> = {};
    mergedUsers.forEach((u) => {
      nextDrafts[u.id] = { ...u.modules };
    });
    setDraftModules(nextDrafts);
  }, [mergedUsers]);

  const filteredUsers = useMemo(() => {
    return mergedUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          (u.team && u.team.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [mergedUsers, roleFilter, searchTerm]);

  const dirtyCount = Object.keys(dirtyIds).length;

  const handleToggleModule = async (
    targetUser: ManagedUserPermissionEntry,
    moduleKey: keyof UserModules
  ) => {
    const currentMods = draftModules[targetUser.id] || targetUser.modules;
    const nextMods: UserModules = {
      ...currentMods,
      [moduleKey]: !currentMods[moduleKey],
    };

    setDraftModules((prev) => ({
      ...prev,
      [targetUser.id]: nextMods,
    }));

    if (autoSaveReactive) {
      setSavingUserId(targetUser.id);
      await updateUserModules(targetUser.id, nextMods, {
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        team: targetUser.team,
      });
      setSavingUserId(null);
      setDirtyIds((prev) => {
        const copy = { ...prev };
        delete copy[targetUser.id];
        return copy;
      });
      addToast(
        `PUT /api/users/${targetUser.id}/modules → Permisos de ${targetUser.name} actualizados.`,
        'success'
      );
    } else {
      setDirtyIds((prev) => ({
        ...prev,
        [targetUser.id]: true,
      }));
    }
  };

  const handleSaveSingleUser = async (targetUser: ManagedUserPermissionEntry) => {
    const mods = draftModules[targetUser.id] || targetUser.modules;
    setSavingUserId(targetUser.id);
    await updateUserModules(targetUser.id, mods, {
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      team: targetUser.team,
    });
    setSavingUserId(null);
    setDirtyIds((prev) => {
      const copy = { ...prev };
      delete copy[targetUser.id];
      return copy;
    });
    addToast(`Permisos guardados para ${targetUser.name} (PUT /api/users/${targetUser.id}/modules).`, 'success');
  };

  const handleSaveAllPermissions = async () => {
    setIsSavingAll(true);
    const targets = mergedUsers.filter((u) => dirtyIds[u.id] || draftModules[u.id]);
    for (const u of targets) {
      const mods = draftModules[u.id] || u.modules;
      await updateUserModules(u.id, mods, {
        name: u.name,
        email: u.email,
        role: u.role,
        team: u.team,
      });
    }
    setDirtyIds({});
    setIsSavingAll(false);
    addToast('Todos los cambios de permisos han sido guardados en el backend.', 'success');
  };

  const handleResetRoleDefaults = async (targetUser: ManagedUserPermissionEntry) => {
    const defaults = getDefaultModulesForRole(targetUser.role);
    setDraftModules((prev) => ({
      ...prev,
      [targetUser.id]: defaults,
    }));

    if (autoSaveReactive) {
      await updateUserModules(targetUser.id, defaults, {
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        team: targetUser.team,
      });
      setDirtyIds((prev) => {
        const copy = { ...prev };
        delete copy[targetUser.id];
        return copy;
      });
      addToast(`Permisos restaurados a valores por defecto para ${targetUser.name}.`, 'info');
    } else {
      setDirtyIds((prev) => ({
        ...prev,
        [targetUser.id]: true,
      }));
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'TI':
        return 'bg-[#1E40AF]/20 text-[#38BDF8] border-[#1E40AF]/50';
      case 'Supervisor':
        return 'bg-[#0F172A] text-[#38BDF8] border-[#233354]';
      case 'RH':
        return 'bg-[#1A2742] text-[#F59E0B] border-[#F59E0B]/40';
      default:
        return 'bg-[#1A2742] text-[#F8FAFC] border-[#233354]';
    }
  };

  return (
    <div className="bg-[#131D31] rounded-md border border-[#233354] shadow-xs overflow-hidden animate-fade-in text-[#F8FAFC]">
      {/* Cabecera de Gestión Granular de Módulos */}
      <div className="p-5 sm:p-6 border-b border-[#233354] bg-[#0F172A] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-md bg-[#1A2742] text-[#38BDF8] border border-[#233354] flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5 text-[#38BDF8]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase bg-[#1E40AF] text-[#F8FAFC] px-2 py-0.5 rounded-sm">
                /admin/users-permissions
              </span>
              <span className="text-[11px] font-mono text-[#94A3B8]">
                PUT /api/users/:id/modules
              </span>
            </div>
            <h2 className="text-base font-heading font-bold text-[#F8FAFC] mt-1">
              Matriz de Permisos Granulares y Biometría por Usuario
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5 max-w-2xl">
              Habilita o deshabilita módulos específicos por usuario (ej. forzar verificación facial obligatoria a un Supervisor específico, o limitar a un Empleado únicamente a marcar entrada/salida desactivando Tareas).
            </p>
          </div>
        </div>

        {/* Controles de Guardado Reactivo y Botón Guardar Permisos */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label className="flex items-center space-x-2 text-xs font-medium text-[#F8FAFC] bg-[#1A2742] px-3 py-2 rounded-md border border-[#233354] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSaveReactive}
              onChange={(e) => setAutoSaveReactive(e.target.checked)}
              className="w-4 h-4 accent-[#1E40AF] rounded cursor-pointer"
            />
            <span>Guardado Reactivo Instantáneo</span>
          </label>

          <button
            id="btn-save-modules"
            type="button"
            onClick={handleSaveAllPermissions}
            disabled={isSavingAll}
            className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold tracking-wide shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-white" />
            <span>
              {isSavingAll
                ? 'Guardando...'
                : dirtyCount > 0
                ? `Guardar Permisos (${dirtyCount})`
                : 'Guardar Permisos'}
            </span>
          </button>
        </div>
      </div>

      {/* Filtros y Buscador */}
      <div className="p-4 border-b border-[#233354] bg-[#131D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuario por nombre, correo o rol..."
            className="w-full pl-9 pr-3.5 py-2 bg-[#1A2742] border border-[#233354] rounded-md text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8]"
          />
        </div>

        <div className="flex items-center space-x-1.5 bg-[#1A2742] p-1 rounded-md border border-[#233354] text-xs font-heading font-medium">
          {(['ALL', 'Supervisor', 'Empleado', 'RH', 'TI'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-[#1E40AF] text-[#F8FAFC] shadow-2xs font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {r === 'ALL' ? 'Todos' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Asignación de Módulos por Checkboxes con líneas sutiles */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#F8FAFC]">
          <thead className="bg-[#0B111E] text-[#94A3B8] text-[11px] font-heading font-bold uppercase tracking-wider border-b border-[#233354]">
            <tr>
              <th className="py-3.5 px-4">Nombre & Correo</th>
              <th className="py-3.5 px-3">Rol Base</th>
              <th className="py-3.5 px-3">Vector Facial</th>
              <th className="py-3.5 px-3 text-center">Asistencia / Check-in</th>
              <th className="py-3.5 px-3 text-center">Módulo de Tareas</th>
              <th className="py-3.5 px-3 text-center bg-[#0F172A] border-x border-[#233354]">
                Verificación Facial Obligatoria
              </th>
              <th className="py-3.5 px-3 text-center">Clientes / Empresas</th>
              <th className="py-3.5 px-3 text-center">Reportes / Métricas</th>
              <th className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#233354]">
            {filteredUsers.map((u) => {
              const mods = draftModules[u.id] || u.modules;
              const isRH = u.role === 'RH';
              const isTI = u.role === 'TI';
              const hasVector = Boolean(u.biometrics?.faceDescriptor?.length);
              const isDirty = Boolean(dirtyIds[u.id]);

              return (
                <tr
                  key={u.id}
                  className={`user-row-checkboxes hover:bg-[#1A2742]/50 transition-colors ${
                    isDirty ? 'bg-[#1E40AF]/10' : ''
                  }`}
                >
                  {/* Nombre y Correo */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#F8FAFC]">{u.name}</div>
                    <div className="text-[11px] text-[#94A3B8] font-mono">{u.email}</div>
                  </td>

                  {/* Rol */}
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-heading font-bold border ${getRoleBadge(
                        u.role
                      )}`}
                    >
                      {u.role}
                    </span>
                  </td>

                  {/* Estado del Vector Facial */}
                  <td className="py-3.5 px-3">
                    {hasVector ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#38BDF8] bg-[#0F172A] px-2 py-0.5 rounded-md border border-[#233354]">
                        <ShieldCheck className="w-3 h-3 text-[#38BDF8]" />
                        <span>128D Activo</span>
                      </span>
                    ) : mods.facialCheckIn ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#F59E0B] bg-[#1A2742] px-2 py-0.5 rounded-md border border-[#F59E0B]/30">
                        <ScanFace className="w-3 h-3 text-[#F59E0B]" />
                        <span>Requerido</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#64748B]">
                        Exento
                      </span>
                    )}
                  </td>

                  {/* [x] Asistencia / Check-in */}
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(mods.checkIn)}
                      disabled={isTI}
                      onChange={() => handleToggleModule(u, 'checkIn')}
                      className="w-4 h-4 accent-[#1E40AF] rounded cursor-pointer disabled:opacity-50"
                      title="Habilitar / Deshabilitar Asistencia Check-in"
                    />
                  </td>

                  {/* [ ] Módulo de Tareas */}
                  <td className="py-3.5 px-3 text-center">
                    {isRH ? (
                      <span
                        className="inline-flex items-center justify-center text-[#E11D48]"
                        title="Bloqueado por RBAC para RH (403)"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={Boolean(mods.tasks)}
                        disabled={isTI}
                        onChange={() => handleToggleModule(u, 'tasks')}
                        className="w-4 h-4 accent-[#1E40AF] rounded cursor-pointer disabled:opacity-50"
                        title="Habilitar / Deshabilitar Módulo de Tareas"
                      />
                    )}
                  </td>

                  {/* [x] Verificación Facial Obligatoria */}
                  <td className="py-3.5 px-3 text-center bg-[#0F172A] border-x border-[#233354]">
                    <div className="flex flex-col items-center justify-center">
                      <input
                        type="checkbox"
                        checked={Boolean(mods.facialCheckIn)}
                        onChange={() => handleToggleModule(u, 'facialCheckIn')}
                        className="w-4 h-4 accent-[#1E40AF] rounded cursor-pointer"
                        title={
                          u.role === 'Supervisor'
                            ? 'Supervisor exento por defecto. Activa para forzar biometría a este supervisor.'
                            : 'Requerir verificación facial con vector 128D'
                        }
                      />
                      {u.role === 'Supervisor' && mods.facialCheckIn && (
                        <span className="text-[9px] font-bold text-[#38BDF8] mt-0.5">
                          Forzado por TI
                        </span>
                      )}
                    </div>
                  </td>

                  {/* [ ] Clientes / Empresas */}
                  <td className="py-3.5 px-3 text-center">
                    {isRH ? (
                      <span
                        className="inline-flex items-center justify-center text-[#E11D48]"
                        title="Bloqueado por RBAC para RH (403)"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={Boolean(mods.clients)}
                        disabled={isTI}
                        onChange={() => handleToggleModule(u, 'clients')}
                        className="w-4 h-4 accent-[#1E40AF] rounded cursor-pointer disabled:opacity-50"
                        title="Habilitar / Deshabilitar Clientes y Empresas"
                      />
                    )}
                  </td>

                  {/* [ ] Reportes / Métricas */}
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(mods.reports)}
                      disabled={isTI}
                      onChange={() => handleToggleModule(u, 'reports')}
                      className="w-4 h-4 accent-[#1E40AF] rounded cursor-pointer disabled:opacity-50"
                      title="Habilitar / Deshabilitar Acceso a Métricas de Tiempo"
                    />
                  </td>

                  {/* Acciones por fila */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {!autoSaveReactive && isDirty && (
                        <button
                          type="button"
                          onClick={() => handleSaveSingleUser(u)}
                          disabled={savingUserId === u.id}
                          className="px-2.5 py-1 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-[10px] font-heading font-semibold cursor-pointer flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3 h-3 text-[#38BDF8]" />
                          <span>Guardar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleResetRoleDefaults(u)}
                        title="Restaurar permisos predeterminados del rol"
                        className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742] rounded-md transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Nota informativa inferior */}
      <div className="p-4 bg-[#0F172A] border-t border-[#233354] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#94A3B8]">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <span>
            <strong className="text-[#F8FAFC]">Control de Acceso Reactivo:</strong> Desactivar un módulo restringe inmediatamente su acceso en la barra lateral y bloquea el endpoint backend con <code>403 Forbidden</code>.
          </span>
        </div>
      </div>
    </div>
  );
}
