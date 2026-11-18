import { useState, useMemo, useEffect } from 'react';
import { useTeamStore, generateTeamCode } from '../../store/useTeamStore';
import { useCheckinStore, type ManagedUserPermissionEntry } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { normalizeRole, getExpectedSuperiorRoles } from '../../services/rbac';
import { syncUserTeamAssignment } from '../../services/teamService';
import {
  updateUserHierarchyInFirestore,
  syncUsersDirectoryFromFirestore,
  resolveFixedDemoId,
  buildCleanDisplayName,
} from '../../services/userService';
import type { Team } from '../../types/team';
import { Search, X, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditHierarchyViewProps {
  onNavigateToInvitations?: () => void;
}

export function AuditHierarchyView({ onNavigateToInvitations }: AuditHierarchyViewProps = {}) {
  const { teams, isLoading, fetchTeams, createTeam, updateTeam, deleteTeam } = useTeamStore();
  const { userPermissionsDirectory, mockEmployeesData, updateUserAssignedTeams, addToast } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  // Estados de interfaz
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Estados del formulario modal
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLeaderId, setFormLeaderId] = useState('');
  const [formParentLeaderId, setFormParentLeaderId] = useState('');
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isAutoCode, setIsAutoCode] = useState(true);

  // Carga remota al montar: equipos y usuarios reales desde Firestore
  useEffect(() => {
    fetchTeams();
    void syncUsersDirectoryFromFirestore();
  }, [fetchTeams]);

  // Consolidar usuarios deduplicados estrictamente por correo (priorizando IDs determinísticos `demo_*`)
  const allUsers = useMemo<ManagedUserPermissionEntry[]>(() => {
    const byEmail = new Map<string, ManagedUserPermissionEntry>();

    const upsertUser = (entry: ManagedUserPermissionEntry) => {
      const emailKey = (entry.email || '').trim().toLowerCase();
      if (!emailKey) return;
      const fixedId = resolveFixedDemoId(emailKey);
      const existing = byEmail.get(emailKey);
      const role = normalizeRole(entry.role);
      const cleanName = buildCleanDisplayName(entry.name, (entry as any).lastName);

      // Si ya existe el registro con ID determinístico, solo enriquecer sin reemplazar su ID
      if (existing && fixedId && existing.id === fixedId && entry.id !== fixedId) {
        return;
      }

      byEmail.set(emailKey, {
        ...existing,
        ...entry,
        id: fixedId || entry.id,
        name: cleanName || existing?.name || entry.name,
        email: emailKey,
        role,
        reportsTo: entry.reportsTo !== undefined ? entry.reportsTo : existing?.reportsTo ?? null,
        supervisorId: entry.supervisorId !== undefined ? entry.supervisorId : existing?.supervisorId ?? null,
        supervisor_id: entry.supervisor_id !== undefined ? entry.supervisor_id : existing?.supervisor_id ?? null,
        gerenteId: entry.gerenteId !== undefined ? entry.gerenteId : existing?.gerenteId ?? null,
        managerId: entry.managerId !== undefined ? entry.managerId : existing?.managerId ?? null,
        socioId: entry.socioId !== undefined ? entry.socioId : existing?.socioId ?? null,
        partnerId: entry.partnerId !== undefined ? entry.partnerId : existing?.partnerId ?? null,
        photoURL: entry.photoURL || existing?.photoURL || null,
      });
    };

    Object.values(userPermissionsDirectory).forEach(upsertUser);

    teamMembers.forEach((tm) => {
      upsertUser({
        id: tm.id,
        name: tm.name,
        email: tm.email,
        role: normalizeRole(tm.role),
        team: tm.team,
        teamId: tm.teamId || undefined,
        assignedTeams: tm.assignedTeams,
        supervisorId: tm.supervisorId || tm.supervisor_id || null,
        supervisor_id: tm.supervisor_id || tm.supervisorId || null,
        permissions: {} as any,
        modules: {} as any,
      });
    });

    mockEmployeesData.forEach((emp) => {
      upsertUser({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: normalizeRole(emp.role),
        team: emp.team,
        teamId: emp.teamId || undefined,
        assignedTeams: emp.assignedTeams,
        supervisor_id: emp.supervisor_id || null,
        photoURL: emp.photoURL || null,
        permissions: {} as any,
        modules: {} as any,
      });
    });

    return Array.from(byEmail.values());
  }, [userPermissionsDirectory, teamMembers, mockEmployeesData]);

  // Línea operativa exclusiva del organigrama (TI queda excluido de equipos y del árbol operativo)
  const operationalUsers = useMemo(
    () => allUsers.filter((u) => normalizeRole(u.role) !== 'TI' && !u.accessRevoked),
    [allUsers]
  );

  // Líderes disponibles para dirigir equipos (Socio, Gerente, Supervisor)
  const eligibleLeaders = useMemo(() => {
    return operationalUsers.filter((u) => {
      const r = normalizeRole(u.role);
      return r === 'Socio' || r === 'Gerente' || r === 'Supervisor';
    });
  }, [operationalUsers]);

  // Socios / Directores superiores (Nivel 1 Operativo - sin TI)
  const topDirectors = useMemo<ManagedUserPermissionEntry[]>(() => {
    const socios = operationalUsers.filter((u) => normalizeRole(u.role) === 'Socio');
    return socios.length > 0 ? socios : eligibleLeaders;
  }, [operationalUsers, eligibleLeaders]);

  // Estados para reasignación directa de superior jerárquico
  const [reassigningUserId, setReassigningUserId] = useState<string | null>(null);
  const [selectedSuperiorId, setSelectedSuperiorId] = useState<string>('');
  const [isSavingHierarchy, setIsSavingHierarchy] = useState(false);

  // Clasificación oficial operativa (sin TI):
  // Nivel 1: Socio -> Nivel 2: [Gerencia || Recursos Humanos] -> Nivel 3: Supervisión -> Nivel 4: Operación
  const hierarchyLevels = useMemo(() => {
    const socios = operationalUsers.filter((u) => normalizeRole(u.role) === 'Socio');
    const gerentes = operationalUsers.filter((u) => normalizeRole(u.role) === 'Gerente');
    const rh = operationalUsers.filter((u) => normalizeRole(u.role) === 'RH');
    const supervisores = operationalUsers.filter((u) => normalizeRole(u.role) === 'Supervisor');
    const colaboradores = operationalUsers.filter((u) => normalizeRole(u.role) === 'Colaborador');
    return { socios, gerentes, rh, supervisores, colaboradores };
  }, [operationalUsers]);

  const getSuperiorCandidatesForUser = (target: ManagedUserPermissionEntry) => {
    const allowedSuperiorRoles: string[] = getExpectedSuperiorRoles(target.role).filter((r) => r !== 'TI');
    return operationalUsers.filter(
      (u) => u.id !== target.id && allowedSuperiorRoles.includes(normalizeRole(u.role))
    );
  };

  const resolveCurrentSuperiorName = (u: ManagedUserPermissionEntry): string => {
    const role = normalizeRole(u.role);
    if (role === 'Socio') return 'Nivel máximo operativo';

    const supId =
      u.reportsTo ||
      u.supervisorId ||
      u.supervisor_id ||
      u.gerenteId ||
      u.managerId ||
      u.socioId ||
      u.partnerId;

    if (supId) {
      const found = operationalUsers.find((cand) => cand.id === supId);
      if (found) return found.name;
    }

    // Fallback determinístico por cadena operativa oficial si el caché local aún sincroniza
    if (role === 'Gerente' || role === 'RH') {
      return hierarchyLevels.socios[0]?.name || 'Sin superior asignado';
    }
    if (role === 'Supervisor') {
      return hierarchyLevels.gerentes[0]?.name || 'Sin superior asignado';
    }
    if (role === 'Colaborador') {
      return hierarchyLevels.supervisores[0]?.name || 'Sin superior asignado';
    }
    return 'Sin superior asignado';
  };

  const handleOpenReassign = (target: ManagedUserPermissionEntry) => {
    const currentSup =
      target.reportsTo ||
      target.supervisorId ||
      target.supervisor_id ||
      target.gerenteId ||
      target.managerId ||
      target.socioId ||
      target.partnerId ||
      '';
    setReassigningUserId(target.id);
    setSelectedSuperiorId(currentSup);
  };

  const handleSaveReassignSuperior = async (target: ManagedUserPermissionEntry) => {
    if (!selectedSuperiorId) {
      addToast('Selecciona un superior jerárquico válido.', 'error');
      return;
    }

    const superiorObj = allUsers.find((u) => u.id === selectedSuperiorId);
    if (!superiorObj) return;

    const targetRole = normalizeRole(target.role);
    const superiorRole = normalizeRole(superiorObj.role);

    setIsSavingHierarchy(true);
    try {
      const patch: Parameters<typeof updateUserHierarchyInFirestore>[1] = {
        reportsTo: superiorObj.id,
      };

      if (targetRole === 'Colaborador') {
        if (superiorRole === 'Supervisor') {
          patch.supervisorId = superiorObj.id;
          patch.supervisorName = superiorObj.name;
          patch.gerenteId = superiorObj.gerenteId || superiorObj.managerId || superiorObj.reportsTo || null;
          patch.socioId = superiorObj.socioId || superiorObj.partnerId || null;
        } else if (superiorRole === 'Gerente') {
          patch.supervisorId = superiorObj.id;
          patch.supervisorName = superiorObj.name;
          patch.gerenteId = superiorObj.id;
          patch.socioId = superiorObj.socioId || superiorObj.partnerId || null;
        } else {
          patch.supervisorId = superiorObj.id;
          patch.supervisorName = superiorObj.name;
          patch.socioId = superiorObj.id;
        }
      } else if (targetRole === 'Supervisor') {
        if (superiorRole === 'Gerente') {
          patch.gerenteId = superiorObj.id;
          patch.socioId = superiorObj.socioId || superiorObj.partnerId || null;
        } else {
          patch.socioId = superiorObj.id;
        }
      } else if (targetRole === 'Gerente' || targetRole === 'RH') {
        patch.socioId = superiorObj.id;
      }

      const res = await updateUserHierarchyInFirestore(target.id, patch);
      if (res.success) {
        addToast(
          `Cadena de mando actualizada: ${target.name} ahora reporta a ${superiorObj.name}.`,
          'success'
        );
        setReassigningUserId(null);
      } else {
        addToast(res.error || 'Error al reasignar superior.', 'error');
      }
    } finally {
      setIsSavingHierarchy(false);
    }
  };

  // Miembros disponibles para ser asignados a equipos (Colaboradores y Supervisores)
  const assignableMembers = useMemo(() => {
    return allUsers.filter((u) => {
      const r = normalizeRole(u.role);
      return (r === 'Colaborador' || r === 'Supervisor') && !u.accessRevoked;
    });
  }, [allUsers]);

  // Filtrado de miembros en el buscador del modal
  const filteredAssignableMembers = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return assignableMembers;
    return assignableMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
    );
  }, [assignableMembers, memberSearchQuery]);

  // Manejador para abrir modal en modo nuevo equipo
  const handleOpenCreateModal = () => {
    setEditingTeam(null);
    setFormName('');
    setFormCode(generateTeamCode('Nuevo Equipo', teams.length + 1));
    const defaultLeader = eligibleLeaders[0];
    setFormLeaderId(defaultLeader ? defaultLeader.id : '');
    setFormParentLeaderId(topDirectors[0]?.id || '');
    setFormMemberIds([]);
    setFormStatus('active');
    setIsAutoCode(true);
    setMemberSearchQuery('');
    setIsModalOpen(true);
  };

  // Manejador para abrir modal en modo edición
  const handleOpenEditModal = (team: Team) => {
    setEditingTeam(team);
    setFormName(team.name);
    setFormCode(team.code);
    setFormLeaderId(team.leaderId);
    setFormParentLeaderId(team.parentLeaderId || topDirectors[0]?.id || '');
    setFormMemberIds(team.memberIds || []);
    setFormStatus(team.status);
    setIsAutoCode(false);
    setMemberSearchQuery('');
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (isAutoCode) {
      setFormCode(generateTeamCode(val, editingTeam ? teams.findIndex((t) => t.id === editingTeam.id) + 1 : teams.length + 1));
    }
  };

  const handleToggleMember = (memberId: string) => {
    setFormMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      addToast('Por favor introduce un nombre para el equipo', 'error');
      return;
    }

    const leaderObj = eligibleLeaders.find((l) => l.id === formLeaderId) || allUsers.find((u) => u.id === formLeaderId);
    const leaderName = leaderObj ? leaderObj.name : 'Líder Asignado';
    const leaderRole = leaderObj ? normalizeRole(leaderObj.role) : 'Supervisor';

    if (editingTeam) {
      const targetTeam: Team = {
        ...editingTeam,
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        leaderId: formLeaderId,
        leaderName,
        leaderRole,
        parentLeaderId: formParentLeaderId,
        memberIds: formMemberIds,
        status: formStatus,
      };

      await updateTeam(editingTeam.id, {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        leaderId: formLeaderId,
        leaderName,
        leaderRole,
        parentLeaderId: formParentLeaderId,
        memberIds: formMemberIds,
        status: formStatus,
      });

      // Sincronizar atómicamente perfiles de miembros asignados
      for (const mId of formMemberIds) {
        await syncUserTeamAssignment(mId, targetTeam, teams);
        updateUserAssignedTeams(mId, [formName.trim()]);
      }

      // Sincronizar líder asignado
      if (formLeaderId) {
        await syncUserTeamAssignment(formLeaderId, targetTeam, teams);
      }

      // Desasignar miembros removidos de forma atómica
      const removedMembers = (editingTeam.memberIds || []).filter(
        (id) => !formMemberIds.includes(id) && id !== formLeaderId
      );
      for (const oldId of removedMembers) {
        await syncUserTeamAssignment(oldId, null, teams);
      }

      await fetchTeams();
      addToast(`Equipo "${formName}" actualizado correctamente`, 'success');
    } else {
      const created = await createTeam({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        leaderId: formLeaderId,
        leaderName,
        leaderRole,
        parentLeaderId: formParentLeaderId,
        memberIds: formMemberIds,
        status: formStatus,
      });

      for (const mId of formMemberIds) {
        await syncUserTeamAssignment(mId, created, teams);
        updateUserAssignedTeams(mId, [created.name]);
      }

      if (formLeaderId) {
        await syncUserTeamAssignment(formLeaderId, created, teams);
      }

      await fetchTeams();
      addToast(`Equipo "${created.name}" creado con éxito`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleToggleAll = () => {
    const anyCollapsed = Object.values(collapsedNodes).some(Boolean);
    if (anyCollapsed) {
      setCollapsedNodes({});
    } else {
      const allKeys: Record<string, boolean> = {};
      topDirectors.forEach((d) => {
        allKeys[d.id] = true;
      });
      teams.forEach((t) => {
        allKeys[t.id] = true;
      });
      setCollapsedNodes(allKeys);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6 font-sans">
      {/* Cabecera de Sección (Sin iconos en título) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Estructura Organizacional y Equipos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visualización jerárquica de mando, responsables de área y asignación de miembros.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleAll}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {Object.values(collapsedNodes).some(Boolean) ? 'Expandir Todo' : 'Colapsar Todo'}
          </button>
          <button
            type="button"
            data-tour="btn-new-team"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            + Nuevo Equipo
          </button>
        </div>
      </div>

      {/* Estado si no hay equipos registrados */}
      {teams.length === 0 && !isLoading && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center text-sm">
            EQ
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sin equipos registrados</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Aún no se han configurado equipos en la base de datos central. Crea el primer equipo operativo para asignar líderes y colaboradores.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              + Crear Primer Equipo
            </button>
            {onNavigateToInvitations && (
              <button
                type="button"
                onClick={onNavigateToInvitations}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Ir a Invitaciones
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenedor del Árbol Jerárquico */}
      <div data-tour="hierarchy-tree-view" className="space-y-6">
        {/* 1. Diagrama Visual Jerárquico del Equipo Operativo (Sin TI): Socio -> [Gerencia || RH] -> Supervisión -> Operación */}
        <div className="bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-slate-800 p-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
                Organigrama Operativo · {teams[0]?.name || 'Equipo Prueba'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cadena de mando vinculada en Firestore (TI excluido del organigrama operativo)
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {operationalUsers.length} integrantes operativos en cadena
            </span>
          </div>

          <div className="max-w-3xl mx-auto flex flex-col items-center">
            {/* NIVEL 1 • SOCIO (MÁXIMO NIVEL) */}
            <div className="w-full max-w-md space-y-2">
              {hierarchyLevels.socios.length === 0 ? (
                <div className="border border-dashed border-slate-300 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                  Sin socio asignado en Nivel 1
                </div>
              ) : (
                hierarchyLevels.socios.map((u) => (
                  <div
                    key={u.id}
                    className="bg-slate-50 dark:bg-[#0E1626] border border-slate-300 dark:border-slate-700 border-t-2 border-t-blue-800 dark:border-t-sky-500 px-5 py-3.5 text-center"
                  >
                    <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-blue-800 dark:text-sky-400">
                      NIVEL 1 • SOCIO (MÁXIMO NIVEL)
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {u.email}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Conector de Bifurcación: Socio -> [Gerencia | Recursos Humanos] */}
            <div className="w-full flex flex-col items-center">
              <div className="w-px h-6 bg-slate-300 dark:bg-slate-700" />
              <div className="hidden md:block w-1/2 h-px bg-slate-300 dark:bg-slate-700" />
              <div className="hidden md:grid grid-cols-2 w-full">
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-400 dark:border-t-slate-600" />
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
                  <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-400 dark:border-t-slate-600" />
                </div>
              </div>
            </div>

            {/* NIVEL 2 • GERENCIA  ||  NIVEL 2 • RECURSOS HUMANOS (Lado a lado) */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Columna Izquierda: NIVEL 2 • GERENCIA */}
              <div className="space-y-2">
                {hierarchyLevels.gerentes.length === 0 ? (
                  <div className="border border-dashed border-slate-300 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                    Sin gerente asignado
                  </div>
                ) : (
                  hierarchyLevels.gerentes.map((g) => (
                    <div
                      key={g.id}
                      className="bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 border-t-2 border-t-slate-700 dark:border-t-blue-500 px-4 py-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            NIVEL 2 • GERENCIA
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {g.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Reporta a: <span className="font-medium text-slate-700 dark:text-slate-200">{resolveCurrentSuperiorName(g)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenReassign(g)}
                          className="text-[11px] text-blue-700 dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
                        >
                          Reasignar
                        </button>
                      </div>
                      {reassigningUserId === g.id && (
                        <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-slate-800">
                          <select
                            value={selectedSuperiorId}
                            onChange={(e) => setSelectedSuperiorId(e.target.value)}
                            className="flex-1 min-w-[140px] text-xs bg-white dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-200"
                          >
                            <option value="">Seleccionar superior...</option>
                            {getSuperiorCandidatesForUser(g).map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                {cand.name} ({normalizeRole(cand.role)})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isSavingHierarchy}
                            onClick={() => void handleSaveReassignSuperior(g)}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setReassigningUserId(null)}
                            className="px-1.5 py-1 text-xs text-slate-500 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Columna Derecha: NIVEL 2 • RECURSOS HUMANOS */}
              <div className="space-y-2">
                {hierarchyLevels.rh.length === 0 ? (
                  <div className="border border-dashed border-slate-300 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                    Sin responsable de RH asignado
                  </div>
                ) : (
                  hierarchyLevels.rh.map((rhUser) => (
                    <div
                      key={rhUser.id}
                      className="bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 border-t-2 border-t-slate-500 dark:border-t-slate-400 px-4 py-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            NIVEL 2 • RECURSOS HUMANOS
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {rhUser.name}{' '}
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                              (Par de Gerencia)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Reporta a: <span className="font-medium text-slate-700 dark:text-slate-200">{resolveCurrentSuperiorName(rhUser)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenReassign(rhUser)}
                          className="text-[11px] text-blue-700 dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
                        >
                          Reasignar
                        </button>
                      </div>
                      {reassigningUserId === rhUser.id && (
                        <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-slate-800">
                          <select
                            value={selectedSuperiorId}
                            onChange={(e) => setSelectedSuperiorId(e.target.value)}
                            className="flex-1 min-w-[140px] text-xs bg-white dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-200"
                          >
                            <option value="">Seleccionar superior...</option>
                            {getSuperiorCandidatesForUser(rhUser).map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                {cand.name} ({normalizeRole(cand.role)})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isSavingHierarchy}
                            onClick={() => void handleSaveReassignSuperior(rhUser)}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setReassigningUserId(null)}
                            className="px-1.5 py-1 text-xs text-slate-500 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Conector de Convergencia: [Gerencia | Recursos Humanos] -> Supervisión */}
            <div className="w-full flex flex-col items-center">
              <div className="hidden md:grid grid-cols-2 w-full">
                <div className="flex justify-center">
                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
                </div>
                <div className="flex justify-center">
                  <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
                </div>
              </div>
              <div className="hidden md:block w-1/2 h-px bg-slate-300 dark:bg-slate-700" />
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-400 dark:border-t-slate-600" />
            </div>

            {/* NIVEL 3 • SUPERVISIÓN */}
            <div className="w-full max-w-md space-y-2">
              {hierarchyLevels.supervisores.length === 0 ? (
                <div className="border border-dashed border-slate-300 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                  Sin supervisor asignado en Nivel 3
                </div>
              ) : (
                hierarchyLevels.supervisores.map((sup) => (
                  <div
                    key={sup.id}
                    className="bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 border-t-2 border-t-indigo-700 dark:border-t-indigo-400 px-5 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-800 dark:text-indigo-300">
                          NIVEL 3 • SUPERVISIÓN
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {sup.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Reporta a: <span className="font-medium text-slate-700 dark:text-slate-200">{resolveCurrentSuperiorName(sup)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenReassign(sup)}
                        className="text-[11px] text-blue-700 dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Reasignar
                      </button>
                    </div>
                    {reassigningUserId === sup.id && (
                      <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-slate-800">
                        <select
                          value={selectedSuperiorId}
                          onChange={(e) => setSelectedSuperiorId(e.target.value)}
                          className="flex-1 min-w-[140px] text-xs bg-white dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">Seleccionar superior...</option>
                          {getSuperiorCandidatesForUser(sup).map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              {cand.name} ({normalizeRole(cand.role)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isSavingHierarchy}
                          onClick={() => void handleSaveReassignSuperior(sup)}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setReassigningUserId(null)}
                          className="px-1.5 py-1 text-xs text-slate-500 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Conector Vertical: Supervisión -> Operación */}
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-slate-300 dark:bg-slate-700" />
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-400 dark:border-t-slate-600" />
            </div>

            {/* NIVEL 4 • OPERACIÓN */}
            <div className="w-full max-w-md space-y-2">
              {hierarchyLevels.colaboradores.length === 0 ? (
                <div className="border border-dashed border-slate-300 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                  Sin colaboradores asignados en Nivel 4
                </div>
              ) : (
                hierarchyLevels.colaboradores.map((col) => (
                  <div
                    key={col.id}
                    className="bg-white dark:bg-[#090E17] border border-slate-200 dark:border-slate-800 px-5 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          NIVEL 4 • OPERACIÓN
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {col.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Reporta a: <span className="font-medium text-slate-700 dark:text-slate-200">{resolveCurrentSuperiorName(col)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenReassign(col)}
                        className="text-[11px] text-blue-700 dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Reasignar
                      </button>
                    </div>
                    {reassigningUserId === col.id && (
                      <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-slate-800">
                        <select
                          value={selectedSuperiorId}
                          onChange={(e) => setSelectedSuperiorId(e.target.value)}
                          className="flex-1 min-w-[140px] text-xs bg-white dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">Seleccionar superior...</option>
                          {getSuperiorCandidatesForUser(col).map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              {cand.name} ({normalizeRole(cand.role)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isSavingHierarchy}
                          onClick={() => void handleSaveReassignSuperior(col)}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-700 text-white hover:bg-blue-600 cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setReassigningUserId(null)}
                          className="px-1.5 py-1 text-xs text-slate-500 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 2. Equipos Operativos Registrados en la Colección 'teams' */}
        {teams.map((team) => {
          const isTeamCollapsed = Boolean(collapsedNodes[team.id]);

          // Cruce dinámico con usuarios operativos (TI excluido)
          const memberUsers = operationalUsers.filter((u) => {
            if (u.id === team.leaderId) return false; // El líder se destaca en su propia cabecera

            const isDirectTeam = u.teamId === team.id;
            const isNameMatch =
              (u.team && u.team.trim().toLowerCase() === team.name.trim().toLowerCase()) ||
              ((u as any).teamName &&
                (u as any).teamName.trim().toLowerCase() === team.name.trim().toLowerCase());
            const isInAssigned =
              u.assignedTeams?.includes(team.id) || u.assignedTeams?.includes(team.name);
            const isInMemberIds = team.memberIds?.includes(u.id);

            return isDirectTeam || isNameMatch || isInAssigned || isInMemberIds;
          });

          const leaderObj =
            operationalUsers.find((u) => u.id === team.leaderId) ||
            hierarchyLevels.supervisores[0] || {
              id: team.leaderId || 'demo_supervisor',
              name: team.leaderName || 'Supervisor Prueba',
              role: team.leaderRole || 'Supervisor',
              email: 'supervisor.prueba@russellbedford.mx',
              photoURL: null,
            };

          return (
            <div
              key={team.id}
              className="bg-white dark:bg-[#0B111E] rounded-xl border-l-4 border-l-blue-800 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4"
            >
              {/* Cabecera del Equipo Operativo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                    {team.code.substring(0, 5)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {team.name}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {team.code}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${team.status === 'active'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                      >
                        {team.status === 'active' ? '● Activo' : '○ Inactivo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Equipo Operativo Corporativo • Total integrantes activos: {memberUsers.length + 1} (1 Líder + {memberUsers.length} Colaboradores/RH)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(team)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                  >
                    Editar Equipo y Miembros
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCollapse(team.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    title={isTeamCollapsed ? 'Expandir' : 'Colapsar'}
                  >
                    {isTeamCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isTeamCollapsed && (
                <div className="space-y-4 pt-1">
                  {/* Tarjeta del Líder de Equipo */}
                  <div className="bg-slate-50/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {leaderObj.photoURL ? (
                        <img
                          src={leaderObj.photoURL}
                          alt={leaderObj.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(leaderObj.name)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {leaderObj.name}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded">
                            Líder Responsable ({team.leaderRole || 'Supervisor'})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {leaderObj.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Líder Activo
                    </span>
                  </div>

                  {/* Cuadrícula de Colaboradores y Personal de RH Asignados */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Colaboradores y Personal Vinculado ({memberUsers.length})
                    </h4>
                    {memberUsers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        Sin colaboradores asignados a este equipo.{' '}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(team)}
                          className="text-blue-600 underline font-medium hover:text-blue-800 cursor-pointer"
                        >
                          Asignar miembros ahora
                        </button>
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {memberUsers.map((member) => {
                          const normRole = normalizeRole(member.role);
                          return (
                            <div
                              key={member.id}
                              className="flex items-center justify-between bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {member.photoURL ? (
                                  <img
                                    src={member.photoURL}
                                    alt={member.name}
                                    referrerPolicy="no-referrer"
                                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-blue-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {getInitials(member.name)}
                                  </div>
                                )}
                                <div className="truncate">
                                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {member.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {member.email} • {normRole}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${normRole === 'RH'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                  }`}
                              >
                                {normRole === 'RH' ? 'RH Asignado' : 'Colaborador'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal / Panel de Crear o Editar Equipo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-4 animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingTeam ? 'Editar Equipo y Miembros' : 'Alta de Nuevo Equipo'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4">
              {/* 1. Nombre del Equipo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nombre del Equipo *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej. Auditoría Fiscal Norte"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                />
              </div>

              {/* 2. Código de Identificación */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Código de Identificación
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAutoCode(!isAutoCode)}
                    className="text-[10px] text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {isAutoCode ? 'Editar Manualmente' : 'Generación Automática'}
                  </button>
                </div>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => {
                    setIsAutoCode(false);
                    setFormCode(e.target.value.toUpperCase());
                  }}
                  placeholder="Ej. EQ-AUD-01"
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-700"
                />
              </div>

              {/* 3. Líder / Responsable Directo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Líder / Responsable Directo (Gerente, Socio o Supervisor) *
                </label>
                <select
                  required
                  value={formLeaderId}
                  onChange={(e) => setFormLeaderId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-700 cursor-pointer"
                >
                  <option value="">-- Selecciona un Líder Responsable --</option>
                  {eligibleLeaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name} ({normalizeRole(leader.role)} - {leader.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Socio / Dirección Superior */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Dirección o Socio al que Reporta
                </label>
                <select
                  value={formParentLeaderId}
                  onChange={(e) => setFormParentLeaderId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-700 cursor-pointer"
                >
                  {topDirectors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({normalizeRole(d.role)})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Miembros Asignados (Multi-select) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Miembros Asignados ({formMemberIds.length} seleccionados)
                  </label>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Buscar colaborador o supervisor por nombre o correo..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-700"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-950">
                  {filteredAssignableMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-2">
                      No se encontraron usuarios disponibles.
                    </p>
                  ) : (
                    filteredAssignableMembers.map((member) => {
                      const isSelected = formMemberIds.includes(member.id);
                      return (
                        <div
                          key={member.id}
                          onClick={() => handleToggleMember(member.id)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${isSelected
                            ? 'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-900'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {member.photoURL ? (
                              <img
                                src={member.photoURL}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-800 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                {getInitials(member.name)}
                              </div>
                            )}
                            <div className="truncate">
                              <span className="font-semibold block truncate">{member.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {normalizeRole(member.role)} • {member.email}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'border-slate-300 dark:border-slate-700'
                              }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 5. Estatus del Equipo */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Estatus del Equipo
                </span>
                <button
                  type="button"
                  onClick={() => setFormStatus(formStatus === 'active' ? 'inactive' : 'active')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${formStatus === 'active'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                >
                  {formStatus === 'active' ? '● Activo' : '○ Inactivo'}
                </button>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                {editingTeam && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`¿Seguro que deseas eliminar el equipo "${editingTeam.name}"?`)) {
                        await deleteTeam(editingTeam.id);
                        await fetchTeams();
                        addToast(`Equipo "${editingTeam.name}" eliminado`, 'info');
                        setIsModalOpen(false);
                      }
                    }}
                    className="mr-auto px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Eliminar Equipo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {editingTeam ? 'Guardar Cambios' : 'Crear Equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

