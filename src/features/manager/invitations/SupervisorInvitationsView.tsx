import { useState, useMemo } from 'react';
import { 
  Mail, UserPlus, CheckCircle2, Clock, XCircle, 
  Copy, Check, RefreshCw, Trash2, Search, 
  ShieldCheck, AlertTriangle, Send, Sparkles, Building2, 
  KeyRound, Ban
} from 'lucide-react';
import { useInvitationStore, buildInviteUrl } from '../../../store/useInvitationStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import type { Invitation, InvitationStatus } from '../../../types/invitation';

const TEAMS_LIST = [
  'Auditoría Fiscal',
  'Consultoría e Impuestos',
  'Auditoría Interna y Procesos',
  'Precios de Transferencia',
  'Legal y Corporativo',
  'Administración y Finanzas',
];

const ROLES_LIST = [
  'Auditor Junior',
  'Auditor Senior',
  'Especialista Tributario',
  'Consultor Financiero',
  'Asistente de Auditoría',
  'Gerente de Proyecto',
];

export function SupervisorInvitationsView() {
  const { user, addToast } = useCheckinStore();
  const { 
    invitations, 
    createInvitations, 
    revokeInvitation, 
    resendInvitation, 
    deleteInvitation 
  } = useInvitationStore();

  // Estados del Formulario de Emisión
  const [emailsInput, setEmailsInput] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(TEAMS_LIST[0]);
  const [selectedRole, setSelectedRole] = useState(ROLES_LIST[0]);
  const [expiresInHours, setExpiresInHours] = useState<number>(48);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvitationStatus>('all');

  // Estado de copiado
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Modal para mostrar los enlaces recién generados
  const [recentGenerated, setRecentGenerated] = useState<Invitation[] | null>(null);

  // Filtrado reactivo de invitaciones del supervisor
  const supervisorInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      // Si el usuario es supervisor, ve las emitidas por él o todas si es demo admin
      const matchSupervisor = !user?.id || inv.supervisorId === user.id || user.id === 'admin-99';
      if (!matchSupervisor) return false;

      // Filtro por estado
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;

      // Filtro por búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchEmail = inv.email.toLowerCase().includes(query);
        const matchTeam = inv.team.toLowerCase().includes(query);
        const matchRole = inv.roleTitle.toLowerCase().includes(query);
        return matchEmail || matchTeam || matchRole;
      }

      return true;
    });
  }, [invitations, user, statusFilter, searchQuery]);

  // Métricas
  const metrics = useMemo(() => {
    const total = invitations.length;
    const pending = invitations.filter(i => i.status === 'pending').length;
    const accepted = invitations.filter(i => i.status === 'accepted').length;
    const expired = invitations.filter(i => i.status === 'expired' || i.status === 'revoked').length;
    return { total, pending, accepted, expired };
  }, [invitations]);

  // Manejo de Creación / Emisión de Invitaciones
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailsInput.trim()) {
      addToast('Ingresa al menos un correo electrónico a invitar.', 'error');
      return;
    }

    // Separar correos por comas, saltos de línea o espacios
    const emailsList = emailsInput
      .split(/[\n,; ]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 3 && e.includes('@'));

    if (emailsList.length === 0) {
      addToast('No se encontraron correos electrónicos válidos.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = createInvitations({
        emails: emailsList,
        supervisorId: user?.id || 'admin-99',
        supervisorName: `${user?.name || 'Supervisor'} ${user?.lastName || 'Prueba'}`.trim(),
        supervisorEmail: user?.email || 'supervisor.prueba@russellbedford.mx',
        team: selectedTeam,
        roleTitle: selectedRole,
        expiresInHours,
        notes: notes.trim(),
      });

      addToast(
        `Se generaron y registraron ${created.length} invitación(es) en la lista blanca corporativa.`,
        'success'
      );

      // Mostrar modal con enlaces para copia rápida
      setRecentGenerated(created);

      // Limpiar formulario
      setEmailsInput('');
      setNotes('');
    } catch {
      addToast('Error al generar las invitaciones.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (token: string, invId: string) => {
    const url = buildInviteUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedTokenId(invId);
    addToast('Enlace de invitación copiado al portapapeles.', 'success');
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const handleRevoke = (id: string, email: string) => {
    if (window.confirm(`¿Estás seguro de revocar la invitación para ${email}? El enlace quedará invalidado de inmediato.`)) {
      revokeInvitation(id);
      addToast(`Invitación para ${email} revocada correctamente.`, 'info');
    }
  };

  const handleResend = (id: string, email: string) => {
    const res = resendInvitation(id);
    if (res.success) {
      addToast(`Invitación reenviada a ${email}. Vigencia renovada por 48h adicionales.`, 'success');
    }
  };

  const formatExpires = (expiresAt: number, status: InvitationStatus) => {
    if (status === 'accepted') return 'Cuenta registrada';
    if (status === 'revoked') return 'Token revocado';

    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h restantes`;
    return `${hours} horas restantes`;
  };

  const getStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Aceptada / Vinculada
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600 animate-pulse" />
            Pendiente de Registro
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
            Expirada
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3 h-3 mr-1 text-slate-500" />
            Revocada
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Header Informativo de Seguridad y Whitelist */}
      <div className="bg-gradient-to-r from-[#002D42] via-[#0D5C75] to-[#0A4B60] rounded-2xl p-6 text-white shadow-lg border border-cyan-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-[#00B5B8] shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#00B5B8] text-[#002D42] px-2.5 py-0.5 rounded-full font-mono">
                  ACCESO RESTRINGIDO • WHITELIST
                </span>
                <span className="text-xs text-cyan-200/80">Modelo de Invitación Corporativa</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight mt-1">
                Gestión de Invitaciones y Lista Blanca
              </h2>
              <p className="text-xs text-slate-200 mt-1 max-w-2xl leading-relaxed">
                El registro público está deshabilitado. Solo los colaboradores registrados en esta lista con un token criptográfico único pueden crear su cuenta y vincularse a tu equipo de trabajo.
              </p>
            </div>
          </div>
        </div>

        {/* Tarjetas KPIs de Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] text-cyan-200 uppercase font-bold tracking-wider">Total Invitaciones</span>
            <div className="text-2xl font-black text-white mt-0.5">{metrics.total}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] text-amber-300 uppercase font-bold tracking-wider">Pendientes de Registro</span>
            <div className="text-2xl font-black text-amber-300 mt-0.5">{metrics.pending}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Cuentas Aceptadas</span>
            <div className="text-2xl font-black text-emerald-300 mt-0.5">{metrics.accepted}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">Expiradas / Revocadas</span>
            <div className="text-2xl font-black text-rose-300 mt-0.5">{metrics.expired}</div>
          </div>
        </div>
      </div>

      {/* 2. Formulario para Emitir Nuevas Invitaciones */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 mb-5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0D5C75] flex items-center justify-center font-bold">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Emitir Nuevas Invitaciones a Colaboradores
            </h3>
            <p className="text-xs text-slate-500">
              Registra los correos de los miembros que formarán parte de tu equipo de auditoría o consultoría.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Campo 1: Correos Electrónicos (Acepta batch o individual) */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#0D5C75]" />
                  <span>Correos Electrónicos a Invitar</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  Separados por coma, espacio o salto de línea
                </span>
              </label>
              <textarea
                required
                rows={2}
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                placeholder="colaborador1@russellbedford.mx, colaborador2@russellbedford.mx"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5B8]/30 focus:border-[#00B5B8] transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Campo 2: Equipo / Departamento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#0D5C75]" />
                <span>Equipo / Departamento</span>
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5B8]/30"
              >
                {TEAMS_LIST.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Campo 3: Puesto / Cargo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#0D5C75]" />
                <span>Puesto o Cargo Asignado</span>
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5B8]/30"
              >
                {ROLES_LIST.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Campo 4: Vigencia del Token de Registro */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0D5C75]" />
                <span>Vigencia del Token de Registro</span>
              </label>
              <select
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B5B8]/30"
              >
                <option value={24}>24 Horas (1 Día)</option>
                <option value={48}>48 Horas (Recomendado)</option>
                <option value={72}>72 Horas (3 Días)</option>
                <option value={168}>7 Días (1 Semana)</option>
              </select>
            </div>

          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <Sparkles className="w-4 h-4 text-[#00B5B8] shrink-0" />
              <span>Cada invitado recibirá un token criptográfico único que solo puede utilizarse una vez.</span>
            </div>

            <button
              id="btn-invite-team"
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[#0D5C75] to-[#00B5B8] hover:from-[#0b4e63] hover:to-[#009da0] text-white rounded-xl text-xs font-black tracking-wide uppercase shadow-md shadow-[#0D5C75]/20 hover:shadow-lg transition-all active:scale-98 cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Generando Tokens...' : 'Generar y Registrar Invitaciones'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Modal / Alerta de Enlaces Recién Generados para Copiado Directo */}
      {recentGenerated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>¡{recentGenerated.length} Invitación(es) Generada(s) con Éxito!</span>
            </div>
            <button
              onClick={() => setRecentGenerated(null)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <p className="text-xs text-emerald-700">
            Puedes copiar y compartir los enlaces directamente con los colaboradores para que completen su registro por lista blanca:
          </p>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentGenerated.map((inv) => {
              const url = buildInviteUrl(inv.token);
              const isCopied = copiedTokenId === inv.id;
              return (
                <div key={inv.id} className="bg-white p-3 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-800 block truncate">{inv.email}</span>
                    <span className="text-[11px] text-slate-500 font-mono block truncate">{url}</span>
                  </div>
                  <button
                    onClick={() => handleCopyLink(inv.token, inv.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1 shrink-0 transition-colors cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copiado' : 'Copiar Enlace'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Tabla de Lista Blanca y Control de Invitaciones */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        
        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por correo, equipo o puesto..."
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00B5B8]/30"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Filtrar:</span>
            <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({invitations.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-white text-amber-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({metrics.pending})
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'accepted'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aceptadas ({metrics.accepted})
              </button>
            </div>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Colaborador Invitado</th>
                <th className="py-3 px-4">Equipo & Puesto</th>
                <th className="py-3 px-4">Estado Whitelist</th>
                <th className="py-3 px-4">Vigencia del Token</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supervisorInvitations.length > 0 ? (
                supervisorInvitations.map((inv) => {
                  const isCopied = copiedTokenId === inv.id;
                  const isPending = inv.status === 'pending';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Correo y detalles */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 uppercase">
                            {inv.email[0]}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs block">
                              {inv.email}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              ID: {inv.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Equipo y Puesto */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 block">{inv.team}</span>
                        <span className="text-[11px] text-slate-400 block">{inv.roleTitle}</span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(inv.status)}
                      </td>

                      {/* Vigencia */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span className={inv.status === 'pending' ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                          {formatExpires(inv.expiresAt, inv.status)}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          Emitida: {new Date(inv.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleCopyLink(inv.token, inv.id)}
                                title="Copiar enlace de invitación único"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#0D5C75] hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                              >
                                {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleResend(inv.id, inv.email)}
                                title="Reenviar invitación y renovar 48h de vigencia"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 transition-colors cursor-pointer"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleRevoke(inv.id, inv.email)}
                                title="Revocar token de invitación inmediatamente"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => deleteInvitation(inv.id)}
                            title="Eliminar registro"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-2">
                      <Mail className="w-6 h-6 opacity-40 text-slate-500" />
                    </div>
                    <p className="font-bold text-slate-700 text-xs">No hay invitaciones registradas</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Utiliza el formulario superior para emitir nuevas invitaciones a colaboradores.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}