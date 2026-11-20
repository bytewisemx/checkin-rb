import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Plus,
  Mail,
  RefreshCw,
  Ban,
  Copy
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { useInvitationStore } from '../../../store/useInvitationStore';
import { useAuditStore } from '../../../store/useAuditStore';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { LiveTimerCell } from '../../../components/common/LiveTimerCell';
import { useLiveTeamTimers } from '../../../hooks/useLiveTeamTimers';
import {
  subscribeAttendanceFromFirestore,
  formatMinutesSexagesimal,
  type AttendanceDocument,
} from '../../../services/attendanceService';
import { dispatchInviteWebhook, buildActivationUrl } from '../../../services/n8nWebhookService';
import { normalizeRole } from '../../../services/rbac';
import { InviteMemberModal } from './InviteMemberModal';
import type { Invitation } from '../../../types/invitation';

interface TeamMembersViewProps {
  onNavigateToTree?: () => void;
}

export function TeamMembersView({ onNavigateToTree }: TeamMembersViewProps) {
  useLiveTeamTimers();
  const { user, addToast } = useCheckinStore();
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

  const { invitations, revokeInvitation } = useInvitationStore();

  // Estados de sub-pestañas y modales
  const [subTab, setSubTab] = useState<'members' | 'invitations'>('members');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Estados de invitaciones
  const [invitationStatusFilter, setInvitationStatusFilter] = useState<
    'all' | 'pending' | 'accepted' | 'expired' | 'revoked'
  >('all');
  const [invitationSearch, setInvitationSearch] = useState('');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Miembros asignados al supervisor actual
  const teamMembers = useMemo(() => {
    return getTeamMembersBySupervisor(user?.id, user?.role);
  }, [allTeamMembers, user?.id, user?.role, getTeamMembersBySupervisor]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [firestoreAttendance, setFirestoreAttendance] = useState<AttendanceDocument[]>([]);

  // Suscripción 100% real-time a `attendance` de Firestore
  useEffect(() => {
    const unsubscribe = subscribeAttendanceFromFirestore(
      (records) => setFirestoreAttendance(records),
      { listenerKey: 'team-members-attendance-realtime' }
    );
    return () => unsubscribe();
  }, []);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayAttendanceByUserId = useMemo(() => {
    const map = new Map<string, AttendanceDocument>();
    firestoreAttendance.forEach((rec) => {
      if (rec.date === todayIso && rec.userId) {
        const prev = map.get(rec.userId);
        if (!prev || (rec.checkIn?.timestampMs || 0) > (prev.checkIn?.timestampMs || 0)) {
          map.set(rec.userId, rec);
        }
      }
    });
    return map;
  }, [firestoreAttendance, todayIso]);

  const isMemberWorkingNow = (memberId: string) => {
    const todayRec = todayAttendanceByUserId.get(memberId);
    const hasOpenAttendance = Boolean(todayRec && todayRec.status === 'active' && !todayRec.checkOut);
    const hasLiveTimer = activeWorkers.some((w) => w.userId === memberId && w.isRunning);
    return hasOpenAttendance || hasLiveTimer;
  };

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((member) => {
      const working = isMemberWorkingNow(member.id);
      if (statusFilter === 'active' && !working) return false;
      if (statusFilter === 'pending' && working) return false;

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
  }, [teamMembers, searchTerm, statusFilter, todayAttendanceByUserId, activeWorkers]);

  // Métricas consolidadas 100% reales desde Firestore (`attendance` hoy + `active_timers`)
  const activeCount = useMemo(
    () => teamMembers.filter((m) => isMemberWorkingNow(m.id)).length,
    [teamMembers, todayAttendanceByUserId, activeWorkers]
  );

  const todayEntriesCount = useMemo(
    () => teamMembers.filter((m) => todayAttendanceByUserId.has(m.id)).length,
    [teamMembers, todayAttendanceByUserId]
  );

  const pendingCheckinCount = useMemo(
    () => Math.max(0, teamMembers.length - todayEntriesCount),
    [teamMembers.length, todayEntriesCount]
  );

  const totalShiftFormatted = useMemo(() => {
    const totalMinutes = teamMembers.reduce((acc, m) => {
      const rec = todayAttendanceByUserId.get(m.id);
      return acc + (rec?.totalMinutes || 0);
    }, 0);
    return formatMinutesSexagesimal(totalMinutes);
  }, [teamMembers, todayAttendanceByUserId]);

  const biometricIncidentsCount = 0;

  // Invitaciones relevantes según jerarquía
  const normRole = normalizeRole(user?.role);
  const relevantInvitations = useMemo(() => {
    if (normRole === 'TI' || normRole === 'Socio') {
      return invitations;
    }
    const userTeams = new Set<string>();
    if (user?.team) userTeams.add(user.team.toLowerCase());
    if (user?.teamId) userTeams.add(user.teamId.toLowerCase());
    (user?.assignedTeams || []).forEach((t) => userTeams.add(t.toLowerCase()));

    return invitations.filter((inv) => {
      if (inv.supervisorId === user?.id) return true;
      if (inv.team && userTeams.has(inv.team.toLowerCase())) return true;
      if (inv.teamId && userTeams.has(inv.teamId.toLowerCase())) return true;
      if (inv.teamName && userTeams.has(inv.teamName.toLowerCase())) return true;
      return false;
    });
  }, [invitations, normRole, user]);

  const pendingInvitationsCount = useMemo(
    () => relevantInvitations.filter((i) => i.status === 'pending').length,
    [relevantInvitations]
  );

  const filteredInvitations = useMemo(() => {
    return relevantInvitations.filter((inv) => {
      if (invitationStatusFilter === 'expired') {
        if (inv.status !== 'expired' && inv.status !== 'revoked') return false;
      } else if (invitationStatusFilter !== 'all' && inv.status !== invitationStatusFilter) {
        return false;
      }

      if (invitationSearch.trim()) {
        const q = invitationSearch.toLowerCase().trim();
        return (
          inv.email.toLowerCase().includes(q) ||
          (inv.roleTitle && inv.roleTitle.toLowerCase().includes(q)) ||
          (inv.team && inv.team.toLowerCase().includes(q)) ||
          (inv.teamName && inv.teamName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [relevantInvitations, invitationStatusFilter, invitationSearch]);

  // Acciones sobre invitaciones
  const handleResend = async (inv: Invitation) => {
    setResendingId(inv.id);
    addToast(`Reenviando invitación por correo a ${inv.email}...`, 'info');
    try {
      const activationUrl = buildActivationUrl(inv.token, inv.email);
      const res = await dispatchInviteWebhook({
        event: 'invite_created',
        recipientEmail: inv.email,
        supervisorName: inv.supervisorName,
        teamId: inv.teamId || inv.assignedTeamId || 'team-default',
        teamName: inv.teamName || inv.team || 'Equipo Corporativo',
        roleName: inv.roleTitle,
        activationUrl,
        expiresAt: new Date(inv.expiresAt).toISOString(),
      });
      if (res.success) {
        addToast(`Invitación reenviada correctamente por correo a ${inv.email}`, 'success');
      } else {
        addToast(`Fallo al reenviar a ${inv.email}: ${res.error || 'Error de conexión'}`, 'error');
      }
    } catch {
      addToast('Error al procesar el reenvío de la invitación.', 'error');
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = (inv: Invitation) => {
    if (window.confirm(`¿Estás seguro de revocar el token de invitación para ${inv.email}?`)) {
      revokeInvitation(inv.id);
      useAuditStore.getState().logAuditEvent({
        eventType: 'INVITATION_REVOKED',
        actorId: user?.id || 'admin',
        actorName: user?.name || 'Administrador',
        actorEmail: user?.email || '',
        actorRole: normRole,
        targetResource: `Invitación: ${inv.email}`,
        details: `Revocación de token de invitación para ${inv.email}`,
      });
      addToast(`Invitación para ${inv.email} revocada correctamente.`, 'info');
    }
  };

  const handleCopyActivationUrl = (inv: Invitation) => {
    const url = buildActivationUrl(inv.token, inv.email);
    navigator.clipboard.writeText(url);
    setCopiedTokenId(inv.id);
    addToast(`Enlace de activación copiado al portapapeles.`, 'success');
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* 1. Cabecera Principal del Módulo: Título y Botones de Acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Asistencia y Equipos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitoreo en tiempo real de colaboradores, control de turnos e invitaciones al equipo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {/* Botón Secundario: Invitaciones Pendientes (N) */}
          <button
            type="button"
            onClick={() => {
              setSubTab('invitations');
              setInvitationStatusFilter('pending');
            }}
            className="h-9 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-semibold rounded-lg cursor-pointer transition-all inline-flex items-center gap-2 shadow-2xs"
          >
            <span>Invitaciones Pendientes</span>
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums">
              {pendingInvitationsCount}
            </span>
          </button>

          {/* Botón Primario: Invitar Miembro al Equipo */}
          <button
            type="button"
            data-tour="btn-invite-member"
            onClick={() => setIsInviteModalOpen(true)}
            className="h-9 px-4 bg-blue-800 hover:bg-blue-900 active:bg-blue-950 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 border border-blue-700/60"
          >
            <Plus className="w-4 h-4 shrink-0 stroke-[2.25]" />
            <span>Invitar Miembro al Equipo</span>
          </button>
        </div>
      </div>

      {/* 2. KPIs de Asistencia: Fila compacta y limpia de tarjetas neutras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: En Turno Activo */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              En Turno Activo
            </span>
            <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
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
              {todayEntriesCount}
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
            <Clock className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {totalShiftFormatted}
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

      {/* 3. Sub-Filtro Limpio: Miembros Activos (N) | Invitaciones Enviadas (N) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('members')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2 ${subTab === 'members'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
              }`}
          >
            <span>Miembros Activos</span>
            <span
              className={`text-[11px] font-bold tabular-nums ${subTab === 'members' ? 'text-blue-100' : 'text-slate-500'
                }`}
            >
              ({teamMembers.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('invitations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2 ${subTab === 'invitations'
              ? 'bg-blue-800 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
              }`}
          >
            <span>Invitaciones Enviadas</span>
            <span
              className={`text-[11px] font-bold tabular-nums ${subTab === 'invitations' ? 'text-blue-100' : 'text-slate-500'
                }`}
            >
              ({relevantInvitations.length})
            </span>
          </button>
        </div>
      </div>

      {/* 4. Barra de Búsqueda y Filtros de Contexto */}
      {subTab === 'members' ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador por nombre, correo o cargo..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-700 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'pending')}
              className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-700"
            >
              <option value="all">Todos los colaboradores ({teamMembers.length})</option>
              <option value="active">En Jornada ({activeCount})</option>
              <option value="pending">Fuera de Turno ({pendingCheckinCount})</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={invitationSearch}
              onChange={(e) => setInvitationSearch(e.target.value)}
              placeholder="Buscar invitación por correo, cargo o equipo..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-700 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={invitationStatusFilter}
              onChange={(e) => setInvitationStatusFilter(e.target.value as any)}
              className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-700"
            >
              <option value="all">Todas las invitaciones ({relevantInvitations.length})</option>
              <option value="pending">Pendientes ({relevantInvitations.filter((i) => i.status === 'pending').length})</option>
              <option value="accepted">Aceptadas ({relevantInvitations.filter((i) => i.status === 'accepted').length})</option>
              <option value="expired">Expiradas / Revocadas ({relevantInvitations.filter((i) => i.status === 'expired' || i.status === 'revoked').length})</option>
            </select>
          </div>
        </div>
      )}

      {/* 5. Renderizado Condicional: Tabla de Miembros Activos vs. Tabla de Invitaciones */}
      {subTab === 'members' ? (
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
                    const activeWorker = activeWorkers.find((w) => w.userId === member.id && w.isRunning);
                    const todayRec = todayAttendanceByUserId.get(member.id) || null;
                    const isWorking = isMemberWorkingNow(member.id);
                    const hoursToday = formatMinutesSexagesimal(todayRec?.totalMinutes || 0);
                    const userAssignments = assignments.filter((a) => a.userId === member.id);
                    const isExemptFacial = member.role === 'Supervisor' || member.role === 'TI';

                    const formatHHMM = (iso?: string | null) => {
                      if (!iso) return null;
                      const d = new Date(iso);
                      if (Number.isNaN(d.getTime())) return null;
                      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    };

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
                        entryTimeStr={formatHHMM(todayRec?.checkIn?.timestamp)}
                        exitTimeStr={formatHHMM(todayRec?.checkOut?.timestamp)}
                        hasFacialVerifiedToday={Boolean(todayRec?.checkIn?.facialMatch)}
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
      ) : (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="p-4">Destinatario / Correo</th>
                  <th className="p-4">Perfil / Rol</th>
                  <th className="p-4">Equipo Destino</th>
                  <th className="p-4">Fecha de Emisión</th>
                  <th className="p-4">Estatus</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 px-4">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center mx-auto">
                          <Mail className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          No se encontraron invitaciones con los criterios seleccionados
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Emite una nueva invitación para autorizar el acceso y registro de nuevos integrantes al equipo.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setIsInviteModalOpen(true)}
                            className="h-9 px-4 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 active:bg-blue-950 rounded-lg shadow-xs hover:shadow transition-all cursor-pointer inline-flex items-center gap-2 border border-blue-700/60"
                          >
                            <Plus className="w-4 h-4 shrink-0 stroke-[2.25]" />
                            <span>Invitar Miembro al Equipo</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((inv) => {
                    const isPending = inv.status === 'pending';
                    const isAccepted = inv.status === 'accepted';
                    const isRevoked = inv.status === 'revoked';

                    const createdDateStr = inv.createdAt
                      ? new Date(inv.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : '—';

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Destinatario / Correo */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
                              <Mail className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-slate-100 truncate block text-xs">
                                {inv.email}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate block">
                                Emitido por: {inv.supervisorName || 'Líder'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Perfil / Rol */}
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-sky-300 border border-blue-200 dark:border-blue-900">
                            {inv.roleTitle || inv.role || 'Colaborador'}
                          </span>
                        </td>

                        {/* 3. Equipo Destino */}
                        <td className="p-4">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {inv.teamName || inv.team || 'Equipo Corporativo'}
                          </span>
                        </td>

                        {/* 4. Fecha de Emisión */}
                        <td className="p-4">
                          <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {createdDateStr}
                          </span>
                        </td>

                        {/* 5. Estatus */}
                        <td className="p-4">
                          {isAccepted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60">
                              Aceptada
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60">
                              Pendiente
                            </span>
                          ) : isRevoked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                              Revocada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Expirada
                            </span>
                          )}
                        </td>

                        {/* 6. Acciones */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Copiar Enlace Directo */}
                            <button
                              type="button"
                              onClick={() => handleCopyActivationUrl(inv)}
                              className="p-1.5 text-slate-400 hover:text-blue-700 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Copiar enlace de activación"
                            >
                              {copiedTokenId === inv.id ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            {/* Reenviar Correo */}
                            <button
                              type="button"
                              disabled={resendingId === inv.id}
                              onClick={() => handleResend(inv)}
                              className="p-1.5 text-slate-400 hover:text-blue-700 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Reenviar invitación por correo"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${resendingId === inv.id ? 'animate-spin text-blue-700' : ''
                                  }`}
                              />
                            </button>

                            {/* Revocar Invitación */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleRevoke(inv)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Revocar invitación"
                              >
                                <Ban className="w-4 h-4" />
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
      )}

      {/* 6. Modal Integrado de Invitación */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}

interface FragmentRowProps {
  member: ReturnType<typeof useRayonerStore.getState>['teamMembers'][number];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isWorking: boolean;
  activeWorker: ReturnType<typeof useRayonerStore.getState>['activeWorkers'][number] | null;
  entryTimeStr: string | null;
  exitTimeStr: string | null;
  hasFacialVerifiedToday: boolean;
  hoursToday: string;
  isExemptFacial: boolean;
  clients: ReturnType<typeof useRayonerStore.getState>['clients'];
  projects: ReturnType<typeof useRayonerStore.getState>['projects'];
  tasks: ReturnType<typeof useRayonerStore.getState>['tasks'];
  userAssignments: ReturnType<typeof useRayonerStore.getState>['assignments'];
  userTaskActualHours: ReturnType<typeof useRayonerStore.getState>['userTaskActualHours'];
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
  entryTimeStr,
  exitTimeStr,
  hasFacialVerifiedToday,
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
      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
        {/* 1. Colaborador */}
        <td className="p-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={member.name} photoURL={member.photoURL} size="md" />
            <div className="min-w-0">
              <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                {member.name}
              </span>
              <span className="text-xs text-slate-400 block truncate">
                {member.email} • {member.roleTitle || 'Colaborador'}
              </span>
            </div>
          </div>
        </td>

        {/* 2. Proyecto y Tarea Activa */}
        <td className="p-4">
          {activeWorker ? (
            <div className="min-w-0">
              <span className="font-medium text-slate-800 dark:text-slate-200 block truncate text-xs">
                {activeWorker.projectName || 'Proyecto'}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                {activeWorker.taskName || 'Tarea'}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Sin tarea activa</span>
          )}
        </td>

        {/* 3. Hora Entrada / Salida */}
        <td className="p-4 text-xs">
          {entryTimeStr ? (
            <div className="space-y-0.5">
              <span className="text-slate-800 dark:text-slate-200 block font-medium">
                Entrada: {entryTimeStr}
              </span>
              <span className="text-slate-400 block text-[11px]">
                {exitTimeStr ? `Salida: ${exitTimeStr}` : 'En turno'}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic">No ha ingresado</span>
          )}
        </td>

        {/* 4. Validación Facial */}
        <td className="p-4">
          {hasFacialVerifiedToday ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-900/50">
              <Check className="w-3 h-3 stroke-[3]" />
              Verificado
            </span>
          ) : isExemptFacial ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              Exento (Supervisor/TI)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/50 dark:border-amber-900/50">
              Pendiente
            </span>
          )}
        </td>

        {/* 5. Horas Acumuladas */}
        <td className="p-4 text-xs font-semibold tabular-nums">
          {isWorking && activeWorker ? (
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-sky-400">
              <LiveTimerCell
                startedAt={activeWorker.startedAt}
                accumulatedSeconds={activeWorker.accumulatedSeconds || 0}
                isRunning={activeWorker.isRunning}
              />
              <span className="text-[10px] text-slate-400 font-normal">hoy</span>
            </div>
          ) : (
            <span className="text-slate-700 dark:text-slate-300">
              {hoursToday !== '0h 00m' ? `${hoursToday} hoy` : '0h 00m'}
            </span>
          )}
        </td>

        {/* 6. Acciones */}
        <td className="p-4 text-right">
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 dark:text-sky-400 dark:hover:text-sky-300 hover:underline cursor-pointer"
          >
            {isExpanded ? 'Ocultar' : 'Detalles'}
          </button>
        </td>
      </tr>

      {/* Fila Expandible: Detalles del Colaborador */}
      {isExpanded && (
        <tr className="bg-slate-50/70 dark:bg-slate-800/30">
          <td colSpan={6} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Subpanel 1: Clientes y Empresas con Acceso */}
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Empresas con Acceso
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateUserClients(
                          member.id,
                          clients.map((c) => c.id)
                        )
                      }
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Todas
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={() => updateUserClients(member.id, [])}
                      className="text-[11px] text-slate-400 hover:underline cursor-pointer"
                    >
                      Ninguna
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

                          <span className="tabular-nums font-bold text-slate-700 dark:text-slate-300 shrink-0">
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
