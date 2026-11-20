import { useState, useMemo, useEffect } from 'react';
import { X, Mail, Users, Clock, Send, ShieldCheck } from 'lucide-react';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { useInvitationStore } from '../../../store/useInvitationStore';
import { useTeamStore } from '../../../store/useTeamStore';
import { useAuditStore } from '../../../store/useAuditStore';
import { getAllowedRolesToInvite, normalizeRole, type UserRole } from '../../../services/rbac';
import { saveInvitationToFirestore } from '../../../services/invitations';
import { dispatchInviteWebhook, buildActivationUrl } from '../../../services/n8nWebhookService';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InviteMemberModal({ isOpen, onClose, onSuccess }: InviteMemberModalProps) {
  const { user, addToast } = useCheckinStore();
  const { createInvitations } = useInvitationStore();
  const { teams, fetchTeams } = useTeamStore();

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen, fetchTeams]);

  const activeTeams = useMemo(() => teams.filter((t) => t.status === 'active'), [teams]);
  const normRole = normalizeRole(user?.role);
  const isTI = normRole === 'TI';

  // 1. Roles permitidos según jerarquía estricta
  const allowedRoles = useMemo(() => {
    return getAllowedRolesToInvite(user?.role);
  }, [user?.role]);

  const [selectedRole, setSelectedRole] = useState<UserRole>(
    (allowedRoles[0]?.value as UserRole) || 'colaborador'
  );

  // Sincronizar rol por defecto al abrir o cambiar roles permitidos
  useEffect(() => {
    if (allowedRoles.length > 0 && !allowedRoles.some((r) => r.value === selectedRole)) {
      setSelectedRole(allowedRoles[0].value as UserRole);
    }
  }, [allowedRoles, selectedRole]);

  // 2. Equipos disponibles para el emisor
  const userAvailableTeams = useMemo(() => {
    if (!user) return [];

    // Si es TI: acceso global a todos los equipos activos
    if (isTI) {
      return activeTeams;
    }

    const assigned = user.assignedTeams || [];
    const primaryTeam = user.team || '';
    const primaryTeamId = user.teamId || '';

    if (assigned.length > 0) {
      const matched = activeTeams.filter(
        (t) =>
          assigned.includes(t.name) ||
          assigned.includes(t.id) ||
          t.name === primaryTeam ||
          t.id === primaryTeamId
      );
      if (matched.length > 0) return matched;

      return assigned.map((name, idx) => ({
        id: `team-assigned-${idx}`,
        name,
        code: `EQ-0${idx + 1}`,
        leaderId: user.id,
        leaderName: user.name,
        leaderRole: normRole,
        memberIds: [],
        status: 'active' as const,
        createdAt: '',
        updatedAt: '',
      }));
    }

    if (primaryTeam || primaryTeamId) {
      const matched = activeTeams.filter(
        (t) => t.name === primaryTeam || t.id === primaryTeamId
      );
      if (matched.length > 0) return matched;

      return [
        {
          id: primaryTeamId || 'team-primary',
          name: primaryTeam,
          code: 'EQ-01',
          leaderId: user.id,
          leaderName: user.name,
          leaderRole: normRole,
          memberIds: [],
          status: 'active' as const,
          createdAt: '',
          updatedAt: '',
        },
      ];
    }

    // Directivos sin filtro restrictivo en perfil
    if (normRole === 'Socio' || normRole === 'Gerente') {
      return activeTeams.length > 0 ? activeTeams : [
        {
          id: 'team-corporativo',
          name: 'Equipo Corporativo',
          code: 'EQ-01',
          leaderId: user.id,
          leaderName: user.name,
          leaderRole: normRole,
          memberIds: [],
          status: 'active' as const,
          createdAt: '',
          updatedAt: '',
        }
      ];
    }

    return activeTeams;
  }, [user, activeTeams, isTI, normRole]);

  // Equipo predeterminado automático
  const defaultTeam = useMemo(() => {
    if (userAvailableTeams.length === 0) return null;

    if (user?.teamId) {
      const match = userAvailableTeams.find((t) => t.id === user.teamId);
      if (match) return match;
    }

    if (user?.assignedTeams && user.assignedTeams.length > 0) {
      const first = user.assignedTeams[0];
      const match = userAvailableTeams.find((t) => t.name === first || t.id === first);
      if (match) return match;
    }

    if (user?.team) {
      const match = userAvailableTeams.find((t) => t.name === user.team);
      if (match) return match;
    }

    return userAvailableTeams[0];
  }, [user, userAvailableTeams]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    if (defaultTeam && (!selectedTeamId || !userAvailableTeams.some((t) => t.id === selectedTeamId))) {
      setSelectedTeamId(defaultTeam.id);
    }
  }, [defaultTeam, selectedTeamId, userAvailableTeams]);

  // Campos de formulario
  const [emailsInput, setEmailsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawEmails = emailsInput
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes('@'));

    if (rawEmails.length === 0) {
      addToast('Ingresa al menos un correo electrónico válido.', 'error');
      return;
    }

    // Resolver equipo
    const chosenTeam =
      userAvailableTeams.find((t) => t.id === selectedTeamId) ||
      defaultTeam ||
      userAvailableTeams[0];
    const targetTeamId = chosenTeam?.id || user?.teamId || 'team-default';
    const targetTeamName = chosenTeam?.name || user?.team || 'Equipo Corporativo';
    const roleTitle = allowedRoles.find((r) => r.value === selectedRole)?.label || selectedRole;

    setIsSubmitting(true);
    try {
      // 1. Crear las invitaciones en el store
      const created = createInvitations({
        emails: rawEmails,
        supervisorId: user?.id || 'admin',
        supervisorName: `${user?.name || 'Líder'} ${user?.lastName || ''}`.trim(),
        supervisorEmail: user?.email || '',
        issuerRole: isTI ? 'TI' : 'Supervisor',
        targetRole: selectedRole,
        roleTitle,
        team: targetTeamName,
        teamId: targetTeamId,
        teamName: targetTeamName,
        expiresInHours: 48,
        notes: `Invitación emitida por ${user?.name || 'Administración'} (${normRole})`,
      });

      if (created.length > 0) {
        // 2. Guardar en Firestore y despachar Webhook de n8n para cada invitación
        let successWebhooks = 0;
        for (const inv of created) {
          saveInvitationToFirestore(inv).catch(console.warn);

          useAuditStore.getState().logAuditEvent({
            eventType: 'INVITATION_CREATED',
            actorId: user?.id || 'admin',
            actorName: user?.name || 'Emisor',
            actorEmail: user?.email || '',
            actorRole: normRole,
            targetResource: `Invitación: ${inv.email}`,
            details: `Emisión de invitación con rol ${roleTitle} en equipo ${targetTeamName}`,
          });

          const activationUrl = buildActivationUrl(inv.token, inv.email);
          const webhookRes = await dispatchInviteWebhook({
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
            successWebhooks++;
          }
        }

        if (successWebhooks > 0) {
          addToast(
            created.length === 1
              ? `Invitación enviada correctamente por correo a ${created[0].email}`
              : `${created.length} invitaciones emitidas y despachadas correctamente vía correo.`,
            'success'
          );
        } else {
          addToast(
            `Invitaciones registradas en sistema. (Revisar conexión con webhook de n8n).`,
            'info'
          );
        }

        setEmailsInput('');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch {
      addToast('Ocurrió un error inesperado al emitir la invitación.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              + Invitar Miembro al Equipo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Genera tokens criptográficos de acceso y envía el correo oficial vía webhook de n8n.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario de Emisión */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Correo(s) Electrónico(s) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Correo(s) Electrónico(s) a Invitar</span>
            </label>
            <textarea
              required
              rows={2}
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              placeholder="colaborador@empresa.com, colega@empresa.com"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-700 transition resize-none"
            />
            <p className="text-[11px] text-slate-400">
              Ingresa uno o varios correos separados por comas o saltos de línea.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 2. Perfil / Rol */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span>Perfil / Rol</span>
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-700 cursor-pointer font-medium"
              >
                {allowedRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Vigencia del Token */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span>Vigencia del Token</span>
              </label>
              <div className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                48 Horas (Recomendado)
              </div>
            </div>
          </div>

          {/* 4. Equipo Destino */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Equipo Destino</span>
            </label>

            {isTI ? (
              // Para TI: Selector completo de todos los equipos activos
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-700 cursor-pointer font-medium"
              >
                {activeTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.code})
                  </option>
                ))}
              </select>
            ) : userAvailableTeams.length > 1 ? (
              // Para Gerente/Socio con múltiples equipos asignados
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-blue-700 cursor-pointer font-medium"
              >
                {userAvailableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.code || 'Equipo'})
                  </option>
                ))}
              </select>
            ) : (
              // Para Supervisor o con un solo equipo asignado: preseleccionado y bloqueado
              <div className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-medium flex items-center justify-between">
                <span>{defaultTeam?.name || user?.team || 'Equipo Asignado'}</span>
                <span className="text-[10px] text-blue-700 dark:text-sky-400 font-semibold uppercase tracking-wider">
                  Asignación Automática
                </span>
              </div>
            )}
          </div>

          {/* Pie de acciones */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>{isSubmitting ? 'Emitiendo invitación...' : 'Emitir Invitación'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
