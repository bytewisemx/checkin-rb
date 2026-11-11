import { useState, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useInvitationStore, buildInviteUrl } from '../../store/useInvitationStore';
import { RBAC_MATRIX } from '../../services/rbac';
import { SupervisorDashboard } from '../manager/SupervisorDashboard';
import { UserPermissionsTable } from './UserPermissionsTable';
import type { Invitation } from '../../types/invitation';
import { Copy, Check, Send } from 'lucide-react';

const SUPERVISOR_TEAMS = [
  'Equipo Prueba',
  'Dirección y Supervisión de Auditoría',
  'Auditoría Fiscal',
  'Consultoría e Impuestos',
  'Contabilidad Corporativa',
  'Precios de Transferencia',
];

const SUPERVISOR_TITLES = [
  'Socio / Supervisor Líder (Prueba)',
  'Supervisor Líder de Equipo',
  'Socio Director de Práctica',
  'Gerente de Auditoría',
  'Director de Consultoría Fiscal',
];

export interface TIDashboardProps {
  initialTab?: 'invitations' | 'users_permissions' | 'audit_accounts' | 'rbac_matrix' | 'supervisor_view';
}

export function TIDashboard({ initialTab = 'users_permissions' }: TIDashboardProps) {
  const {
    user,
    userPermissionsDirectory,
    updateRHAllowedTeams,
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

  const [activeTab, setActiveTab] = useState<'invitations' | 'users_permissions' | 'audit_accounts' | 'rbac_matrix' | 'supervisor_view'>(initialTab);

  // Formulario para invitar a nuevos Supervisores
  const [emailsInput, setEmailsInput] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(SUPERVISOR_TEAMS[0]);
  const [selectedTitle, setSelectedTitle] = useState(SUPERVISOR_TITLES[0]);
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [recentGenerated, setRecentGenerated] = useState<Invitation[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const handleGenerateSupervisorInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailsInput.trim()) {
      addToast('Ingresa el correo electrónico del Supervisor a dar de alta.', 'error');
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

    const created = createInvitations({
      emails: emailsList,
      supervisorId: user?.id || 'ti-root-01',
      supervisorName: `${user?.name || 'Administrador'} ${user?.lastName || 'TI'}`.trim(),
      supervisorEmail: user?.email || 'ti.root@russellbedford.mx',
      created_by_ti_id: user?.id || 'ti-root-01',
      issuerRole: 'TI',
      targetRole: 'Supervisor',
      team: selectedTeam,
      roleTitle: selectedTitle,
      expiresInHours,
      notes: 'Alta de Supervisor autorizada por TI (Root)',
    });

    setRecentGenerated(created);
    setEmailsInput('');
    addToast(
      `Se generaron y enviaron ${created.length} enlace(s) de invitación especial para alta de Supervisor.`,
      'success'
    );
  };

  const handleCopyInviteLink = (token: string, id: string) => {
    const url = buildInviteUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    addToast('Enlace de invitación de Supervisor copiado al portapapeles.', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* 1. Encabezado y Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Consola de Administración TI y Accesos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Control jerárquico, matriz RBAC y asignación granular de permisos a nivel organizacional.
          </p>
        </div>

        {/* Pestañas Pills */}
        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
          <button
            type="button"
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
                Emitir Enlace de Invitación para Supervisor
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Los Supervisores registrados quedan vinculados con autorización directa de TI (Root).
              </p>
            </div>

            <form onSubmit={handleGenerateSupervisorInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Correo(s) Electrónico(s) del Supervisor
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    placeholder="supervisor.lider@russellbedford.mx, socio.auditoria@russellbedford.mx"
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Equipo o Práctica
                  </label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-600"
                  >
                    {SUPERVISOR_TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Cargo Ejecutivo
                  </label>
                  <select
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-600"
                  >
                    {SUPERVISOR_TITLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Vigencia del Token
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-600"
                  >
                    <option value={24}>24 Horas</option>
                    <option value={48}>48 Horas</option>
                    <option value={72}>72 Horas (Recomendado)</option>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Emitir Invitación
                </button>
              </div>
            </form>
          </div>

          {/* Enlaces Generados Recientemente */}
          {recentGenerated && (
            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                  Invitaciones Emitidas ({recentGenerated.length})
                </span>
                <button
                  type="button"
                  onClick={() => setRecentGenerated(null)}
                  className="text-xs text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  Cerrar
                </button>
              </div>
              <div className="divide-y divide-blue-100/60 dark:divide-blue-900/30">
                {recentGenerated.map((inv) => {
                  const url = buildInviteUrl(inv.token);
                  return (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {inv.email} — {inv.roleTitle}
                        </span>
                        <span className="text-[11px] font-mono text-blue-700 dark:text-sky-400 block truncate mt-0.5">
                          {url}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0"
                      >
                        {copiedId === inv.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === inv.id ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabla Ejecutiva de Invitaciones Emitidas */}
          <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Historial de Invitaciones de Supervisores ({tiSupervisorInvitations.length})
              </h3>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Correo del Supervisor</th>
                    <th className="py-3 px-4">Área y Cargo</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {tiSupervisorInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No hay invitaciones de supervisores emitidas aún.
                      </td>
                    </tr>
                  ) : (
                    tiSupervisorInvitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 dark:text-white block">{inv.email}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">Token: {inv.token.slice(0, 16)}...</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200 block">{inv.team}</span>
                          <span className="text-[11px] text-slate-400">{inv.roleTitle}</span>
                        </td>
                        <td className="py-3 px-4">
                          {inv.status === 'accepted' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Aceptada
                            </span>
                          ) : inv.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
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
                              onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              {copiedId === inv.id ? 'Copiado' : 'Copiar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => resendInvitation(inv.id)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              Reenviar
                            </button>
                            {inv.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => revokeInvitation(inv.id)}
                                className="text-xs text-slate-500 hover:text-slate-800"
                              >
                                Revocar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteInvitation(inv.id)}
                              className="text-xs text-rose-500 hover:text-rose-700"
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

      {/* PESTAÑA 2: AUDITORÍA DE JERARQUÍA */}
      {activeTab === 'audit_accounts' && (
        <div className="space-y-4 animate-fade-in">
          {/* Nivel 1: TI Root */}
          <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  TI
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {userPermissionsDirectory['ti-root-01']?.name || 'TI Prueba'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                      Nivel 1 • Root
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {userPermissionsDirectory['ti-root-01']?.email || 'ti.root@russellbedford.mx'} • Autoridad global sobre toda la estructura
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Permanente Activo
              </span>
            </div>
          </div>

          {/* Nivel 2: Recursos Humanos */}
          {hierarchyAudit.rhUsers.map((rh) => {
            const rhDir = userPermissionsDirectory[rh.id];
            const allowedSups = rhDir?.allowedSupervisorIds ?? hierarchyAudit.supervisors.map((s) => s.id);

            const toggleTeamForRH = (supId: string) => {
              const exists = allowedSups.includes(supId);
              const next = exists ? allowedSups.filter((id) => id !== supId) : [...allowedSups, supId];
              updateRHAllowedTeams(rh.id, next);
              const supName = hierarchyAudit.supervisors.find((s) => s.id === supId)?.name || supId;
              addToast(
                exists
                  ? `TI retiró a ${rh.name} el acceso al equipo de ${supName}.`
                  : `TI autorizó a ${rh.name} ver el equipo de ${supName}.`,
                exists ? 'info' : 'success'
              );
            };

            return (
              <div
                key={rh.id}
                className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 font-bold text-sm flex items-center justify-center shrink-0">
                      RH
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{rh.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
                          Nivel 2 • RH
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {rh.email} • Autorizado para auditar checadas de los siguientes equipos:
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {hierarchyAudit.supervisors.map((sup, idx) => {
                    const checked = allowedSups.includes(sup.id);
                    return (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => toggleTeamForRH(sup.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          checked
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-sky-300 dark:border-blue-800/60'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${checked ? 'bg-blue-600' : 'bg-slate-300'}`} />
                        Equipo #{idx + 1} ({sup.name})
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Nivel 3: Equipos y Supervisores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hierarchyAudit.supervisors.map((sup, idx) => {
              const teamMembersList = hierarchyAudit.employees.filter(
                (emp) => (emp.supervisor_id || 'admin-99') === sup.id
              );

              return (
                <div
                  key={sup.id}
                  className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Equipo #{idx + 1}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{sup.name}</h4>
                      <p className="text-xs text-slate-500">{sup.team || 'Equipo Corporativo'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      Nivel 3 • Supervisor
                    </span>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                      Colaboradores asignados ({teamMembersList.length}):
                    </span>
                    {teamMembersList.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Sin colaboradores asignados</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {teamMembersList.map((emp) => (
                          <span
                            key={emp.id}
                            className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
                          >
                            {emp.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: MATRIZ DE ACCESO RBAC */}
      {activeTab === 'rbac_matrix' && (
        <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
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
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4">RH (Auditoría)</th>
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
                      {RBAC_MATRIX[resource].Supervisor.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Empleado.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].RH.description}
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
    </div>
  );
}
