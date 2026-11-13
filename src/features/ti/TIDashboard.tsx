import { useState, useMemo, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useInvitationStore } from '../../store/useInvitationStore';
import { useTeamStore, generateTeamCode } from '../../store/useTeamStore';
import { sendInviteWebhook, buildActivationUrl } from '../../services/n8nWebhookService';
import { saveInvitationToFirestore } from '../../services/invitations';
import { useAuditStore } from '../../store/useAuditStore';
import { RBAC_MATRIX, getAllowedRolesToInvite, normalizeRole } from '../../services/rbac';
import { SupervisorDashboard } from '../manager/SupervisorDashboard';
import { UserPermissionsTable } from './UserPermissionsTable';
import { ExecutiveAuditLogView } from '../audit/ExecutiveAuditLogView';
import { AuditHierarchyView } from '../hierarchy/AuditHierarchyView';
import { normalizeCorporateDatabase } from '../../services/dataNormalizationService';
import { executeCleanSlateAdministrativeReset } from '../../services/adminResetService';
import { Send, Loader2, X, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

export interface TIDashboardProps {
  initialTab?: 'invitations' | 'users_permissions' | 'audit_accounts' | 'rbac_matrix' | 'supervisor_view' | 'audit_logs';
}

export function TIDashboard({ initialTab = 'users_permissions' }: TIDashboardProps) {
  const {
    user,
    addToast,
  } = useCheckinStore();
  const { teamMembers, tasks, clients, projects } = useRayonerStore();
  const {
    invitations,
    createInvitations,
    revokeInvitation,
    resendInvitation,
    deleteInvitation,
  } = useInvitationStore();
  const { teams, fetchTeams, createTeam } = useTeamStore();

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Carga global de todos los equipos activos (TI no pertenece a un equipo operativo)
  const activeTeams = useMemo(() => teams.filter((t) => t.status !== 'inactive'), [teams]);

  const [activeTab, setActiveTab] = useState<'invitations' | 'users_permissions' | 'audit_accounts' | 'rbac_matrix' | 'supervisor_view' | 'audit_logs'>(initialTab);

  // Formulario para invitar a nuevos usuarios (filtrado dinámicamente según rol)
  const allowedRoles = useMemo(() => {
    return getAllowedRolesToInvite(user?.role);
  }, [user?.role]);

  const [emailsInput, setEmailsInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<'colaborador' | 'supervisor' | 'gerente' | 'socio'>('supervisor');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(48);

  // Estados para el Modal Rápido de "+ Crear Equipo"
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickTeamName, setQuickTeamName] = useState('');
  const [quickLeaderId, setQuickLeaderId] = useState('');
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  // Líderes disponibles para el modal rápido
  const eligibleLeaders = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    teamMembers.forEach((m) => {
      const r = normalizeRole(m.role);
      if (r === 'Supervisor' || r === 'Gerente' || r === 'Socio') {
        map.set(m.id, { id: m.id, name: m.name, role: r });
      }
    });
    return Array.from(map.values());
  }, [teamMembers]);

  // Manejador del Modal Rápido de "+ Crear Equipo"
  const handleQuickCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTeamName.trim()) {
      addToast('Ingresa un nombre para el nuevo equipo.', 'error');
      return;
    }

    setIsQuickSubmitting(true);
    try {
      const leaderObj = eligibleLeaders.find((l) => l.id === quickLeaderId);
      const newTeam = await createTeam({
        name: quickTeamName.trim(),
        code: generateTeamCode(quickTeamName.trim(), teams.length + 1),
        leaderId: quickLeaderId || 'admin-99',
        leaderName: leaderObj ? leaderObj.name : 'Supervisor Asignado',
        leaderRole: leaderObj ? leaderObj.role : 'Supervisor',
        memberIds: [],
        status: 'active',
        description: `Equipo creado desde el acceso rápido de invitaciones TI`,
      });

      // Seleccionar automáticamente el equipo recién creado
      setSelectedTeamId(newTeam.id);
      setIsQuickCreateOpen(false);
      setQuickTeamName('');
      setQuickLeaderId('');
      addToast(`Equipo "${newTeam.name}" creado y seleccionado correctamente.`, 'success');
    } catch (err) {
      console.error('Error al crear equipo rápido:', err);
      addToast('Ocurrió un error al crear el equipo.', 'error');
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const [isNormalizing, setIsNormalizing] = useState(false);

  const handleNormalizeDatabase = async () => {
    setIsNormalizing(true);
    try {
      const res = await normalizeCorporateDatabase();
      await fetchTeams();
      addToast(
        `Normalización completada: "Equipo Prueba" activo (${res.usersUpdated} usuarios sincronizados en Firestore).`,
        'success'
      );
    } catch (err) {
      console.error('Error al normalizar base de datos:', err);
      addToast('Error al normalizar la base de datos.', 'error');
    } finally {
      setIsNormalizing(false);
    }
  };

  const [isCleanSlateModalOpen, setIsCleanSlateModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleExecuteCleanSlate = async () => {
    setIsResetting(true);
    try {
      const res = await executeCleanSlateAdministrativeReset();
      await fetchTeams();
      if (res.success) {
        addToast(
          `Reinicio Limpio exitoso: Base de datos purgada. "Equipo Prueba" activo y 5 cuentas base configuradas.`,
          'success'
        );
        setIsCleanSlateModalOpen(false);
      } else {
        addToast(`Error en el reinicio administrativo: ${res.error || 'Fallo general'}`, 'error');
      }
    } catch (err: any) {
      console.error('Error al ejecutar Clean Slate:', err);
      addToast(`Error al ejecutar el reinicio: ${err?.message || 'Error desconocido'}`, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Preselección por defecto: si existe "Equipo Prueba", se selecciona prioritariamente
  useEffect(() => {
    if (activeTeams.length > 0) {
      const pruebaTeam = activeTeams.find(
        (t) => t.id === 'team-prueba-01' || t.name.trim().toLowerCase() === 'equipo prueba'
      );
      if (pruebaTeam) {
        setSelectedTeamId(pruebaTeam.id);
      } else if (!selectedTeamId || !activeTeams.some((t) => t.id === selectedTeamId)) {
        setSelectedTeamId(activeTeams[0].id);
      }
    }
  }, [activeTeams, selectedTeamId]);

  const tiSupervisorInvitations = useMemo(() => {
    return invitations.filter((inv) => inv.issuerRole === 'TI' && inv.targetRole === 'Supervisor');
  }, [invitations]);

  const hierarchyAudit = useMemo(() => {
    const supervisors = teamMembers.filter((m) => m.role === 'Supervisor');
    const employees = teamMembers.filter((m) => m.role === 'Empleado' || !m.role);
    const rhUsers = teamMembers.filter((m) => m.role === 'RH');

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;

    return {
      supervisors,
      employees,
      rhUsers,
      totalTasks,
      completedTasks,
      totalClients: clients.length,
      totalProjects: projects.length,
    };
  }, [teamMembers, tasks, clients, projects]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerateSupervisorInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailsInput.trim()) {
      addToast('Ingresa el correo electrónico a invitar.', 'error');
      return;
    }

    const emailsList = emailsInput
      .split(/[\n,; ]+/)
      .map((em) => em.trim().toLowerCase())
      .filter((em) => em.length > 3 && em.includes('@'));

    if (emailsList.length === 0) {
      addToast('Ingresa al menos un correo electrónico válido.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const issuerName = `${user?.name || 'Administrador'} ${user?.lastName || 'TI'}`.trim();
      const roleTitle = allowedRoles.find((r) => r.value === selectedRole)?.label || 'Supervisor';

      // Resolver equipo seleccionado asegurando teamId y teamName no nulos
      const chosenTeam = activeTeams.find((t) => t.id === selectedTeamId) || activeTeams[0];
      const targetTeamId = chosenTeam?.id || selectedTeamId || 'team-default';
      const targetTeamName = chosenTeam?.name || 'Equipo Corporativo';

      const created = createInvitations({
        emails: emailsList,
        supervisorId: user?.id || 'ti-root-01',
        supervisorName: issuerName,
        supervisorEmail: user?.email || 'ti.root@russellbedford.mx',
        created_by_ti_id: user?.id || 'ti-root-01',
        issuerRole: 'TI',
        targetRole: selectedRole,
        team: targetTeamName,
        teamId: targetTeamId,
        teamName: targetTeamName,
        roleTitle,
        expiresInHours,
        notes: `Alta de ${roleTitle} autorizada por TI (Root)`,
      });

      if (created.length === 0) {
        addToast('No se pudieron generar las invitaciones.', 'error');
        return;
      }

      setEmailsInput('');

      // Despachar cada invitación a Firestore, Auditoría y Webhook n8n
      for (const inv of created) {
        // 1. Guardar en Firestore en segundo plano con timeout protegido
        saveInvitationToFirestore(inv).catch(console.warn);

        // 2. Registrar en Bitácora de Auditoría
        useAuditStore.getState().logAuditEvent({
          eventType: 'INVITATION_CREATED',
          actorId: user?.id || 'ti-root-01',
          actorName: issuerName,
          actorEmail: user?.email || 'ti.root@russellbedford.mx',
          actorRole: 'TI',
          targetResource: `Invitación: ${inv.email}`,
          details: `Emisión de invitación con rol ${roleTitle} en equipo ${inv.teamName || inv.team}`,
        });

        // 3. Generar activationUrl exacta (/activar-cuenta?token=XYZ&email=...)
        const activationUrl = buildActivationUrl(inv.token, inv.email);

        // 4. Despachar al servicio Webhook n8n con teamId y teamName garantizados
        const webhookRes = await sendInviteWebhook({
          event: 'invite_created',
          recipientEmail: inv.email,
          supervisorName: inv.supervisorName,
          teamId: inv.teamId || targetTeamId,
          teamName: inv.teamName || targetTeamName,
          roleName: inv.roleTitle,
          activationUrl,
          expiresAt: new Date(inv.expiresAt).toISOString(),
        });

        if (webhookRes.success) {
          addToast(`Invitación enviada por correo correctamente vía n8n a ${inv.email}`, 'success');
        } else {
          addToast(
            `Fallo en el envío por n8n a ${inv.email}: ${webhookRes.error || 'Error de conexión'}.`,
            'error'
          );
        }
      }
    } catch (err: unknown) {
      console.error('[TIDashboard] Error al procesar invitaciones:', err);
      addToast('Ocurrió un error al procesar la emisión de invitaciones.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async (invId: string) => {
    const res = resendInvitation(invId);
    if (res.success && res.invitation) {
      const inv = res.invitation;
      const activationUrl = buildActivationUrl(inv.token, inv.email);
      addToast(`Reenviando invitación por correo a ${inv.email}...`, 'info');
      const webhookRes = await sendInviteWebhook({
        event: 'invite_created',
        recipientEmail: inv.email,
        supervisorName: inv.supervisorName,
        teamName: inv.team,
        roleName: inv.roleTitle,
        activationUrl,
        expiresAt: new Date(inv.expiresAt).toISOString(),
      });
      if (webhookRes.success) {
        addToast(`Invitación reenviada correctamente vía n8n a ${inv.email}`, 'success');
      } else {
        addToast(`Fallo al reenviar por n8n a ${inv.email}: ${webhookRes.error || 'Error'}`, 'error');
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* 1. Encabezado y Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Consola de Administración TI y Accesos
            </h1>
            <button
              type="button"
              onClick={handleNormalizeDatabase}
              disabled={isNormalizing || isResetting}
              className="px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Normaliza la colección 'teams' dejando únicamente 'Equipo Prueba' y sincroniza a todos los usuarios"
            >
              <RefreshCw className={`w-3 h-3 ${isNormalizing ? 'animate-spin' : ''}`} />
              <span>{isNormalizing ? 'Normalizando...' : 'Sincronizar y Normalizar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCleanSlateModalOpen(true)}
              disabled={isResetting || isNormalizing}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Reinicio Limpio (Clean Slate): Vacía colecciones operativas y deja solo 5 cuentas oficiales y Equipo Prueba"
            >
              <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              <span>Reinicio Limpio (Clean Slate)</span>
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Control jerárquico, matriz RBAC y asignación granular de permisos a nivel organizacional.
          </p>
        </div>

        {/* Pestañas Pills */}
        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
          <button
            type="button"
            data-tour="nav-users-tab"
            onClick={() => setActiveTab('users_permissions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'users_permissions'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Permisos y Equipos
          </button>
          <button
            type="button"
            data-tour="ti-invite-tab"
            onClick={() => setActiveTab('invitations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'invitations'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Invitar Supervisores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit_logs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bitácora de Movimientos
          </button>
          <button
            type="button"
            data-tour="nav-audit-hierarchy"
            onClick={() => setActiveTab('audit_accounts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'audit_accounts'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Auditar Jerarquía
          </button>
          <button
            type="button"
            data-tour="nav-rbac-matrix"
            onClick={() => setActiveTab('rbac_matrix')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'rbac_matrix'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Matriz RBAC
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supervisor_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'supervisor_view'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Proyectos y Tareas
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Métricas (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Supervisores
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {hierarchyAudit.supervisors.length}
          </div>
          <span className="text-[11px] text-slate-500">Dados de alta por TI</span>
        </div>

        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Colaboradores Operativos
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {hierarchyAudit.employees.length}
          </div>
          <span className="text-[11px] text-slate-500">Vinculados por equipo</span>
        </div>

        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tareas Asignadas
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {hierarchyAudit.completedTasks} / {hierarchyAudit.totalTasks}
          </div>
          <span className="text-[11px] text-slate-500">Completadas / Totales</span>
        </div>

        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Proyectos y Clientes
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {hierarchyAudit.totalClients} / {hierarchyAudit.totalProjects}
          </div>
          <span className="text-[11px] text-slate-500">Gestión de carteras</span>
        </div>
      </div>

      {/* PESTAÑA 0: MATRIZ EJECUTIVA Y TABLA DE PERMISOS */}
      {activeTab === 'users_permissions' && (
        <UserPermissionsTable onNewUser={() => setActiveTab('invitations')} />
      )}

      {/* PESTAÑA 1: GENERACIÓN DE ENLACES DE INVITACIÓN PARA SUPERVISORES */}
      {activeTab === 'invitations' && (
        <div className="space-y-6 animate-fade-in">
          {/* Formulario de Emisión Rápida de Supervisor */}
          <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-xs">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Emitir Enlace de Invitación Corporativa (TI Root)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                TI puede autorizar invitaciones directas para cualquier nivel jerárquico de la organización.
              </p>
            </div>

            <form data-tour="ti-invite-form" onSubmit={handleGenerateSupervisorInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Correo(s) Electrónico(s) a Invitar
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    placeholder="usuario@russellbedford.mx, colega@russellbedford.mx"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Perfil / Rol
                  </label>
                  <select
                    data-tour="ti-invite-role-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'colaborador' | 'supervisor' | 'gerente' | 'socio')}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-600 font-semibold cursor-pointer"
                  >
                    {allowedRoles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Equipo o Práctica
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickCreateOpen(true)}
                      className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      + Crear Equipo
                    </button>
                  </div>

                  {activeTeams.length === 1 ? (
                    <div className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium flex items-center justify-between">
                      <span className="truncate">{activeTeams[0].name} ({activeTeams[0].code})</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400 shrink-0">
                        Único Equipo
                      </span>
                    </div>
                  ) : (
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {activeTeams.length === 0 ? (
                        <option value="" disabled>
                          Sin equipos disponibles
                        </option>
                      ) : (
                        activeTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.code})
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Vigencia del Token
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value={24}>24 Horas</option>
                    <option value={48}>48 Horas (Recomendado)</option>
                    <option value={72}>72 Horas</option>
                    <option value={168}>7 Días</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  El colaborador recibirá un correo de activación para establecer su contraseña.
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando vía n8n...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Emitir Invitación
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Tabla Ejecutiva de Invitaciones Emitidas */}
          <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Historial de Invitaciones Emitidas por TI ({tiSupervisorInvitations.length})
              </h3>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Correo del Invitado</th>
                    <th className="py-3 px-4">Área y Cargo</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {tiSupervisorInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No hay invitaciones emitidas aún.
                      </td>
                    </tr>
                  ) : (
                    tiSupervisorInvitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 dark:text-white block">{inv.email}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">Canal: Correo n8n</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200 block">{inv.team}</span>
                          <span className="text-[11px] text-slate-400">{inv.roleTitle} ({inv.role})</span>
                        </td>
                        <td className="py-3 px-4">
                          {inv.status === 'confirmed' || inv.status === 'accepted' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Aceptada / Confirmada
                            </span>
                          ) : inv.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente
                            </span>
                          ) : (
                            <span className="text-slate-400">{inv.status}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleResendInvite(inv.id)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                            >
                              Reenviar Correo
                            </button>
                            {inv.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => revokeInvitation(inv.id)}
                                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Revocar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteInvitation(inv.id)}
                              className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: BITÁCORA DE AUDITORÍA EJECUTIVA */}
      {activeTab === 'audit_logs' && <ExecutiveAuditLogView />}

      {/* PESTAÑA 2: AUDITORÍA DE JERARQUÍA */}
      {activeTab === 'audit_accounts' && (
        <div className="animate-fade-in">
          <AuditHierarchyView onNavigateToInvitations={() => setActiveTab('invitations')} />
        </div>
      )}

      {/* PESTAÑA 3: MATRIZ DE ACCESO RBAC */}
      {activeTab === 'rbac_matrix' && (
        <div data-tour="rbac-save-btn" className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Política de Control de Acceso Basada en Roles (RBAC)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Matriz organizacional de permisos por módulo y nivel jerárquico.
            </p>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Recurso / Entidad</th>
                  <th className="py-3 px-4">TI (Root)</th>
                  <th className="py-3 px-4">Socio</th>
                  <th className="py-3 px-4">Gerente</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">RH</th>
                  <th className="py-3 px-4">Colaborador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(Object.keys(RBAC_MATRIX) as Array<keyof typeof RBAC_MATRIX>).map((resource) => (
                  <tr key={resource} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {resource}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {RBAC_MATRIX[resource].TI.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Socio.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Gerente.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Supervisor.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].RH.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Colaborador.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: PROYECTOS Y TAREAS (SUPERVISOR DASHBOARD AUDITABLE) */}
      {activeTab === 'supervisor_view' && <SupervisorDashboard />}

      {/* MODAL RÁPIDO: CREAR NUEVO EQUIPO */}
      {isQuickCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                + Nuevo Equipo de Práctica
              </h4>
              <button
                type="button"
                onClick={() => setIsQuickCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nombre del Equipo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickTeamName}
                  onChange={(e) => setQuickTeamName(e.target.value)}
                  placeholder="Ej. Auditoría Fiscal Norte"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Líder / Responsable (Opcional)
                </label>
                <select
                  value={quickLeaderId}
                  onChange={(e) => setQuickLeaderId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-blue-700 cursor-pointer"
                >
                  <option value="">-- Sin líder asignado (Asignar después) --</option>
                  {eligibleLeaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name} ({leader.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isQuickSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isQuickSubmitting ? 'Guardando...' : 'Crear y Seleccionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Reinicio Limpio (Clean Slate) */}
      {isCleanSlateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reinicio Limpio de Base de Datos (Clean Slate)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Esta acción purga todos los datos ficticios y reinicia el sistema a su estado puro inicial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isResetting && setIsCleanSlateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Operaciones que se ejecutarán:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                <li>
                  <strong>Vaciar colecciones operativas:</strong> tasks, projects, clients, checkins, attendance, time_logs, invitations, audit_logs y active_timers.
                </li>
                <li>
                  <strong>Colección teams:</strong> Preservar exclusivamente el documento <code>team-prueba-01</code> ("Equipo Prueba").
                </li>
                <li>
                  <strong>Colección users:</strong> Configurar únicamente las 5 cuentas oficiales (TI, Gerente, Supervisor, Colaborador y RH) eliminando cualquier usuario residual.
                </li>
                <li>
                  <strong>Almacenamiento local:</strong> Limpiar cachés y cronómetros de tareas en el navegador.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCleanSlateModalOpen(false)}
                disabled={isResetting}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanSlate}
                disabled={isResetting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purgando Base de Datos...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Reinicio Limpio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
