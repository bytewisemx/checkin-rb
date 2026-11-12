import { useState, useMemo } from 'react';
import { 
  Mail, CheckCircle2, Clock, 
  Copy, Check, Search, Trash2, Ban, Send, RefreshCw
} from 'lucide-react';
import { useInvitationStore } from '../../../store/useInvitationStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useAuditStore } from '../../../store/useAuditStore';
import type { InvitationStatus } from '../../../types/invitation';
import { 
  dispatchInviteWebhook, 
  buildActivationUrl 
} from '../../../services/n8nWebhookService';
import { getAllowedRolesToInvite, normalizeRole, type UserRole } from '../../../services/rbac';

export function SupervisorInvitationsView() {
  const { user, addToast } = useCheckinStore();
  const { getSupervisorCode } = useRayonerStore();
  const { 
    invitations, 
    createInvitations, 
    revokeInvitation, 
    deleteInvitation 
  } = useInvitationStore();

  const allowedRoles = useMemo(() => {
    return getAllowedRolesToInvite(user?.role);
  }, [user?.role]);

  const [copiedCode, setCopiedCode] = useState(false);
  const supervisorCode = getSupervisorCode(user?.id || '') || 'SUP-RB-9901';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(supervisorCode);
    setCopiedCode(true);
    addToast(`Código ${supervisorCode} copiado al portapapeles.`, 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Estados del Formulario Rápido de Emisión
  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(allowedRoles[0]?.value || 'colaborador');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvitationStatus>('all');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Métricas
  const metrics = useMemo(() => {
    const total = invitations.length;
    const pending = invitations.filter((i) => i.status === 'pending').length;
    const accepted = invitations.filter((i) => i.status === 'accepted').length;
    const expired = invitations.filter((i) => i.status === 'expired' || i.status === 'revoked').length;
    return { total, pending, accepted, expired };
  }, [invitations]);

  // Filtrado de invitaciones
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inv.email.toLowerCase().includes(q) ||
          inv.roleTitle.toLowerCase().includes(q) ||
          inv.team.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invitations, statusFilter, searchQuery]);

  // Emisión rápida de invitación con integración n8n Webhook
  const handleQuickInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      addToast('Ingresa un correo electrónico corporativo válido.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const normRole = normalizeRole(user?.role);
      const roleTitle = allowedRoles.find((r) => r.value === selectedRole)?.label || selectedRole;

      // 1. Generar la invitación en el store con token único y expiración
      const created = createInvitations({
        emails: [emailInput.trim().toLowerCase()],
        supervisorId: user?.id || 'admin-99',
        supervisorName: `${user?.name || 'Líder'} ${user?.lastName || ''}`.trim(),
        supervisorEmail: user?.email || '',
        team: user?.team || 'Auditoría Fiscal',
        targetRole: selectedRole,
        roleTitle,
        expiresInHours: 48,
        notes: `Invitación emitida por ${user?.name} (${normRole})`,
      });

      if (created.length > 0) {
        const inv = created[0];

        // Registrar en Bitácora de Auditoría
        useAuditStore.getState().logAuditEvent({
          eventType: 'INVITATION_CREATED',
          actorId: user?.id || 'admin-99',
          actorName: user?.name || 'Emisor',
          actorEmail: user?.email || '',
          actorRole: normRole,
          targetResource: `Invitación: ${inv.email}`,
          details: `Emisión de invitación con rol ${roleTitle} en equipo ${inv.team}`,
        });

        // 2. Construir la URL de activación: /activar-cuenta?token=...&email=...
        const activationUrl = buildActivationUrl(inv.token, inv.email);

        // 3. Despachar payload al Webhook de n8n
        const webhookRes = await dispatchInviteWebhook({
          event: 'invite_created',
          recipientEmail: inv.email,
          supervisorName: inv.supervisorName,
          teamName: inv.team,
          roleName: inv.roleTitle,
          activationUrl,
          expiresAt: new Date(inv.expiresAt).toISOString(),
        });

        // 4. Feedback al usuario
        if (webhookRes.success) {
          addToast('Invitación generada y enviada al correo del colaborador', 'success');
        } else if (webhookRes.simulated) {
          addToast('Invitación generada localmente. (Configura VITE_N8N_INVITE_WEBHOOK_URL en .env para envío real vía n8n)', 'info');
        } else {
          addToast(
            `Invitación registrada, pero falló el envío por n8n: ${webhookRes.error || 'Error de webhook'}. Puedes copiar el enlace manualmente.`,
            'error'
          );
        }

        setEmailInput('');
      }
    } catch {
      addToast('Error al procesar la emisión de la invitación.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (token: string, email: string, id: string) => {
    const url = buildActivationUrl(token, email);
    navigator.clipboard.writeText(url);
    setCopiedTokenId(id);
    addToast('Enlace de registro copiado al portapapeles.', 'success');
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const handleRevoke = (id: string, email: string) => {
    if (window.confirm(`¿Estás seguro de revocar el acceso para ${email}?`)) {
      revokeInvitation(id);
      addToast(`Invitación para ${email} revocada.`, 'info');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* 1. Tarjeta Principal Blanca de Métricas y Código de Asignación */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
        
        {/* Barra Superior: Código de Asignación y Métricas Horizontales */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
              Lista Blanca y Control de Acceso
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Invitaciones de Colaboradores
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Solo los colaboradores autorizados con token único pueden registrarse y sumarse a tu equipo.
            </p>
          </div>

          {/* Bloque Estilizado del Código de Supervisor */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Código de Supervisor
              </span>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tracking-widest">
                {supervisorCode}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-3.5 py-1.5 text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              title="Copiar código al portapapeles"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Barra de Métricas Horizontales Limpias con tipografía Inter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Emitidas
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {metrics.total}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Pendientes
            </span>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {metrics.pending}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Aceptadas
            </span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.accepted}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              Revocadas / Expiradas
            </span>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {metrics.expired}
            </div>
          </div>
        </div>

        {/* 2. Formulario de Emitir Nuevas Invitaciones Integrado en una Sola Fila */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <form onSubmit={handleQuickInvite} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="correo.colaborador@russellbedford.mx"
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="w-full sm:w-56 shrink-0">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-600"
              >
                {allowedRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando invitación...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Emitir Invitación</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 3. Filtros y Tabla de Invitaciones Emitidas */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar invitación por correo o cargo..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-600"
            >
              <option value="all">Todos los estatus</option>
              <option value="pending">Pendientes</option>
              <option value="accepted">Aceptadas</option>
              <option value="revoked">Revocadas / Expiradas</option>
            </select>
          </div>
        </div>

        {/* Tabla Estructurada */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="p-4">Correo Electrónico</th>
                  <th className="p-4">Cargo Asignado</th>
                  <th className="p-4">Estatus</th>
                  <th className="p-4">Fecha de Emisión</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                      No hay invitaciones registradas con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredInvitations.map((inv) => {
                    const isCopied = copiedTokenId === inv.id;
                    const isPending = inv.status === 'pending';
                    const isAccepted = inv.status === 'accepted';

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Correo */}
                        <td className="p-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                            {inv.email}
                          </span>
                        </td>

                        {/* Cargo / Rol */}
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-300">
                          {inv.roleTitle}
                        </td>

                        {/* Estatus con Badge Discreto */}
                        <td className="p-4">
                          {isAccepted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Aceptada
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              <Ban className="w-3 h-3 mr-1 text-slate-500" />
                              Revocada
                            </span>
                          )}
                        </td>

                        {/* Fecha */}
                        <td className="p-4 text-xs text-slate-400">
                          {new Date(inv.createdAt).toLocaleDateString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Acciones */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleCopyLink(inv.token, inv.email, inv.id)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Copiar enlace directo de invitación"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Enlace</span>
                                  </>
                                )}
                              </button>
                            )}

                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleRevoke(inv.id, inv.email)}
                                className="px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                title="Revocar token de invitación"
                              >
                                Revocar
                              </button>
                            )}

                            {!isPending && (
                              <button
                                type="button"
                                onClick={() => deleteInvitation(inv.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
}
