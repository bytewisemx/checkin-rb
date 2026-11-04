import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useInvitationStore, buildInviteUrl } from '../../store/useInvitationStore';
import { RBAC_MATRIX } from '../../services/rbac';
import { SupervisorDashboard } from '../manager/SupervisorDashboard';
import { UserPermissionsTable } from './UserPermissionsTable';
import type { Invitation } from '../../types/invitation';

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
  const navigate = useNavigate();
  const {
    user,
    userPermissionsDirectory,
    toggleUserAccessRevoked,
    updateRHAllowedTeams,
    reassignEmployeeSupervisor,
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
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10 animate-fade-in bg-[#F8FAFC] dark:bg-[#090E17] text-slate-900 dark:text-slate-200">
      {/* Cabecera Editorial Abierta de TI Root */}
      <header className="space-y-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3 text-xs font-heading font-semibold uppercase tracking-widest text-[#475569] dark:text-[#94A3B8]">
              <span className="text-[#1E40AF] dark:text-[#38BDF8]">NIVEL 1 • TI ROOT</span>
              <span>/</span>
              <span>ID: {user?.id || 'ti-root-01'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              Consola Central de TI y Control Jerárquico
            </h1>
            <p className="text-sm text-[#475569] dark:text-[#94A3B8] max-w-2xl">
              Administración de permisos granulares, revocación de cuentas de Socios/Supervisores, RH y Empleados, y asignación de equipos visibles en checadas.
            </p>
          </div>

          {/* Navegación Editorial Plana (Sin Iconos Decorativos ni Cajas) */}
          <nav className="flex flex-wrap items-center gap-6 border-b border-slate-200 dark:border-slate-800 lg:border-b-0 pb-2 lg:pb-0">
            <button
              id="nav-user-permissions"
              onClick={() => {
                setActiveTab('users_permissions');
                navigate('/admin/users-permissions');
              }}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                activeTab === 'users_permissions'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Permisos y Equipos
              {activeTab === 'users_permissions' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('invitations');
                navigate('/');
              }}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                activeTab === 'invitations'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Invitar Supervisores
              {activeTab === 'invitations' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('audit_accounts')}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                activeTab === 'audit_accounts'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Auditar Jerarquía
              {activeTab === 'audit_accounts' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('rbac_matrix')}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                activeTab === 'rbac_matrix'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Matriz RBAC
              {activeTab === 'rbac_matrix' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('supervisor_view')}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                activeTab === 'supervisor_view'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Proyectos y Tareas
              {activeTab === 'supervisor_view' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>
          </nav>
        </div>

        {/* Métricas Editoriales sin Recuadros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] uppercase font-heading font-semibold tracking-wider block">
              Supervisores Activos
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              {hierarchyAudit.supervisors.length}
            </div>
            <span className="text-xs text-[#475569] dark:text-[#94A3B8]">Dados de alta por TI</span>
          </div>

          <div>
            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] uppercase font-heading font-semibold tracking-wider block">
              Empleados Operativos
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              {hierarchyAudit.employees.length}
            </div>
            <span className="text-xs text-[#475569] dark:text-[#94A3B8]">Vinculados por equipo</span>
          </div>

          <div>
            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] uppercase font-heading font-semibold tracking-wider block">
              Tareas Sincronizadas
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              {hierarchyAudit.completedTasks} / {hierarchyAudit.totalTasks}
            </div>
            <span className="text-xs text-[#475569] dark:text-[#94A3B8]">Completadas / Totales</span>
          </div>

          <div>
            <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] uppercase font-heading font-semibold tracking-wider block">
              Empresas y Proyectos
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              {hierarchyAudit.totalClients} / {hierarchyAudit.totalProjects}
            </div>
            <span className="text-xs text-[#475569] dark:text-[#94A3B8]">Ocultos para RH (403)</span>
          </div>
        </div>
      </header>

      {/* PESTAÑA 0: MATRIZ GRANULAR Y ÁRBOL DE EQUIPOS (/admin/users-permissions) */}
      {activeTab === 'users_permissions' && <UserPermissionsTable />}

      {/* PESTAÑA 1: GENERACIÓN DE ENLACES DE INVITACIÓN PARA SUPERVISORES */}
      {activeTab === 'invitations' && (
        <div className="space-y-10 animate-fade-in">
          <section className="space-y-6 pb-8 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Generar Enlace de Invitación para Alta de Supervisor
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                Los Supervisores se registran mediante el enlace emitido por TI, quedando vinculados con <code>created_by_ti_id: "{user?.id || 'ti-root-01'}"</code>.
              </p>
            </div>

            <form onSubmit={handleGenerateSupervisorInvite} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-heading font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] flex items-center justify-between">
                    <span>Correo(s) Electrónico(s) de Nuevos Supervisores</span>
                    <span className="text-[11px] font-normal">Rol en token: Supervisor</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    placeholder="nuevo.supervisor@russellbedford.mx, lider.equipo@russellbedford.mx"
                    className="w-full py-2 bg-transparent border-b border-slate-300 dark:border-slate-800 text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:border-[#1E40AF] dark:focus:border-[#38BDF8]"
                  />
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] block mb-1.5">
                    Práctica / Equipo que Liderará
                  </label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full py-2 bg-transparent border-b border-slate-300 dark:border-slate-800 text-sm text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    {SUPERVISOR_TEAMS.map((t) => (
                      <option key={t} value={t} className="bg-[#F8FAFC] dark:bg-[#0F172A]">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] block mb-1.5">
                    Cargo Ejecutivo de Supervisor
                  </label>
                  <select
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(e.target.value)}
                    className="w-full py-2 bg-transparent border-b border-slate-300 dark:border-slate-800 text-sm text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    {SUPERVISOR_TITLES.map((r) => (
                      <option key={r} value={r} className="bg-[#F8FAFC] dark:bg-[#0F172A]">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] block mb-1.5">
                    Vigencia del Enlace
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="w-full py-2 bg-transparent border-b border-slate-300 dark:border-slate-800 text-sm text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    <option value={24} className="bg-[#F8FAFC] dark:bg-[#0F172A]">24 Horas</option>
                    <option value={48} className="bg-[#F8FAFC] dark:bg-[#0F172A]">48 Horas</option>
                    <option value={72} className="bg-[#F8FAFC] dark:bg-[#0F172A]">72 Horas (Recomendado)</option>
                    <option value={168} className="bg-[#F8FAFC] dark:bg-[#0F172A]">7 Días</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <span className="text-xs text-[#475569] dark:text-[#94A3B8]">
                  El token autorizado por TI registra exclusivamente con nivel de Supervisor.
                </span>

                <button
                  id="btn-new-supervisor-invite"
                  type="submit"
                  className="px-5 py-2.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Generar y Enviar Enlace
                </button>
              </div>
            </form>
          </section>

          {recentGenerated && (
            <section className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                  Enlaces de Alta de Supervisor Generados
                </span>
                <button
                  onClick={() => setRecentGenerated(null)}
                  className="text-xs font-heading font-medium text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentGenerated.map((inv) => {
                  const url = buildInviteUrl(inv.token);
                  return (
                    <div
                      key={inv.id}
                      className="py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">
                          {inv.email} — {inv.roleTitle}
                        </span>
                        <span className="text-[11px] font-mono text-[#1E40AF] dark:text-[#38BDF8] block truncate mt-0.5">
                          {url}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                        className="px-3.5 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-heading font-semibold text-xs shrink-0 cursor-pointer transition-colors"
                      >
                        {copiedId === inv.id ? 'Copiado' : 'Copiar Enlace'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tabla con Elevación #101726 de enlaces emitidos por TI */}
          <section className="space-y-4">
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Enlaces de Invitación de Supervisores Emitidos por TI ({tiSupervisorInvitations.length})
            </h3>
            <div className="overflow-x-auto bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 rounded-md">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#0B111E] text-[11px] font-heading font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Correo del Supervisor</th>
                    <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Área y Cargo</th>
                    <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Autorizado por</th>
                    <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Estado</th>
                    <th className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                  {tiSupervisorInvitations.map((inv) => (
                    <tr key={inv.id} className="bg-white dark:bg-[#101726] hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-200">
                        {inv.email}
                        <span className="block text-[10px] font-mono text-slate-600 dark:text-slate-400">
                          Token: {inv.token.slice(0, 22)}...
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-900 dark:text-slate-200 block">{inv.team}</span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">{inv.roleTitle}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {inv.created_by_ti_id || 'ti-root-01'}
                      </td>
                      <td className="py-3.5 px-4 font-heading font-medium text-slate-900 dark:text-slate-200">
                        {inv.status === 'pending'
                          ? 'Pendiente'
                          : inv.status === 'accepted'
                          ? 'Aceptada'
                          : inv.status}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-4">
                          <button
                            onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                            className="text-xs font-heading font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            {copiedId === inv.id ? 'Copiado' : 'Copiar'}
                          </button>
                          <button
                            onClick={() => resendInvitation(inv.id)}
                            className="text-xs font-heading font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                          >
                            Reenviar
                          </button>
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => revokeInvitation(inv.id)}
                              className="text-xs font-heading font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                            >
                              Revocar
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvitation(inv.id)}
                            className="text-xs font-heading font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* PESTAÑA 2: AUDITORÍA Y GESTIÓN DE LA ESTRUCTURA JERÁRQUICA COMPLETA */}
      {activeTab === 'audit_accounts' && (
        <div className="space-y-10 animate-fade-in">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Estructura Organizacional (TI → RH y Equipos de Supervisores → Colaboradores)
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
              TI es el puesto más alto: revoca o restaura permisos de Socios/Supervisores, asigna qué equipos visualiza RH en checadas y supervisa cada equipo.
            </p>
          </div>

          {/* NIVEL 1: TI PRUEBA */}
          <section className="space-y-3 pb-8 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-heading font-bold uppercase tracking-widest text-[#1E40AF] dark:text-[#38BDF8]">
              NIVEL 1 — PUESTO MÁS ALTO (TI ROOT)
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
              <div>
                <div className="flex items-center space-x-3">
                  <span className="text-base font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {userPermissionsDirectory['ti-root-01']?.name || 'TI Prueba'}
                  </span>
                  <span className="text-xs font-heading font-medium text-[#475569] dark:text-[#94A3B8]">
                    — Autoridad Global del Sistema
                  </span>
                </div>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                  {userPermissionsDirectory['ti-root-01']?.email || 'ti.root@russellbedford.mx'} • Control sobre Socios/Supervisores, RH y Empleados
                </p>
              </div>
              <span className="text-xs font-heading font-semibold uppercase tracking-wider text-[#1E40AF] dark:text-[#38BDF8]">
                Acceso Permanente Activo
              </span>
            </div>
          </section>

          {/* NIVEL 2: RECURSOS HUMANOS (RH PRUEBA) */}
          <section className="space-y-4 pb-8 border-b border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-heading font-bold uppercase tracking-widest text-[#475569] dark:text-[#94A3B8]">
              NIVEL 2 — RECURSOS HUMANOS (AUDITORÍA DE CHECADAS POR EQUIPO)
            </div>

            {hierarchyAudit.rhUsers.map((rh) => {
              const rhDir = userPermissionsDirectory[rh.id];
              const isRhRevoked = Boolean(rhDir?.accessRevoked);
              const allowedSups = rhDir?.allowedSupervisorIds ?? hierarchyAudit.supervisors.map((s) => s.id);

              const toggleTeamForRH = (supId: string) => {
                const exists = allowedSups.includes(supId);
                const next = exists ? allowedSups.filter((id) => id !== supId) : [...allowedSups, supId];
                updateRHAllowedTeams(rh.id, next);
                const supName = hierarchyAudit.supervisors.find((s) => s.id === supId)?.name || supId;
                addToast(
                  exists
                    ? `TI retiró a ${rh.name} el acceso a las checadas del equipo de ${supName}.`
                    : `TI asignó a ${rh.name} la visualización de checadas del equipo de ${supName}.`,
                  exists ? 'info' : 'success'
                );
              };

              return (
                <div key={rh.id} className="space-y-4 pl-4 border-l-2 border-slate-300 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className={`text-base font-heading font-bold ${isRhRevoked ? 'line-through text-[#475569] dark:text-[#94A3B8]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                          {rh.name}
                        </span>
                        <span className="text-xs text-[#475569] dark:text-[#94A3B8]">
                          {rh.email}
                        </span>
                        {isRhRevoked && (
                          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                            [REVOCADO POR TI]
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                        Selecciona los equipos cuyas checadas puede visualizar este perfil de Recursos Humanos:
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toggleUserAccessRevoked(rh.id);
                        addToast(
                          isRhRevoked
                            ? `Permisos restaurados por TI para ${rh.name}.`
                            : `Permisos revocados por TI para ${rh.name}.`,
                          isRhRevoked ? 'success' : 'error'
                        );
                      }}
                      className={`px-3.5 py-1.5 text-xs font-heading font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                        isRhRevoked
                          ? 'bg-[#1E40AF] hover:bg-[#1D4ED8] text-white'
                          : 'border border-slate-300 dark:border-slate-700 text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#1E40AF]'
                      }`}
                    >
                      {isRhRevoked ? 'Restaurar RH' : 'Revocar RH'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-1">
                    {hierarchyAudit.supervisors.map((sup, idx) => {
                      const checked = allowedSups.includes(sup.id);
                      const teamCount = hierarchyAudit.employees.filter(
                        (e) => e.supervisor_id === sup.id || e.supervisorId === sup.id
                      ).length;
                      return (
                        <label
                          key={sup.id}
                          className="flex items-center space-x-2.5 text-xs cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTeamForRH(sup.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <span className={checked ? 'font-semibold text-[#0F172A] dark:text-[#F8FAFC]' : 'text-[#475569] dark:text-[#94A3B8]'}>
                            Equipo #{idx + 1}: {sup.name} ({teamCount} {teamCount === 1 ? 'subordinado' : 'subordinados'})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          {/* NIVEL 3: EQUIPOS OPERATIVOS (SOCIOS/SUPERVISORES Y SUS SUBORDINADOS) */}
          <section className="space-y-8">
            <div className="text-[11px] font-heading font-bold uppercase tracking-widest text-[#475569] dark:text-[#94A3B8]">
              NIVEL 3 — EQUIPOS OPERATIVOS (SOCIOS / SUPERVISORES → EMPLEADOS SUBORDINADOS)
            </div>

            {hierarchyAudit.supervisors.map((sup, idx) => {
              const supDir = userPermissionsDirectory[sup.id];
              const isSupRevoked = Boolean(supDir?.accessRevoked);
              const subTeam = hierarchyAudit.employees.filter(
                (e) => e.supervisor_id === sup.id || e.supervisorId === sup.id
              );

              return (
                <div
                  key={sup.id}
                  className="space-y-4 pb-8 border-b border-slate-200 dark:border-slate-800"
                >
                  {/* Cabecera de Equipo y Socio/Supervisor */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-heading font-bold uppercase tracking-widest text-[#1E40AF] dark:text-[#38BDF8]">
                        EQUIPO #{idx + 1} • {sup.team.toUpperCase()}
                      </div>
                      <div className="flex items-center flex-wrap gap-3 mt-1">
                        <span className={`text-base font-heading font-bold ${isSupRevoked ? 'line-through text-[#475569] dark:text-[#94A3B8]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                          {sup.name}
                        </span>
                        <span className="text-xs font-heading font-medium text-[#475569] dark:text-[#94A3B8]">
                          Líder de Equipo (Socio / Supervisor)
                        </span>
                        {isSupRevoked && (
                          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                            [REVOCADO POR TI]
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
                        {sup.email} • ID: <code>{sup.id}</code> • Subordinados: {subTeam.length}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toggleUserAccessRevoked(sup.id);
                        addToast(
                          isSupRevoked
                            ? `Permisos de Socio / Supervisor restaurados por TI para ${sup.name}.`
                            : `Permisos de Socio / Supervisor REVOCADOS por TI para ${sup.name}.`,
                          isSupRevoked ? 'success' : 'error'
                        );
                      }}
                      className={`px-3.5 py-1.5 text-xs font-heading font-semibold uppercase tracking-wider cursor-pointer transition-colors self-start sm:self-auto ${
                        isSupRevoked
                          ? 'bg-[#1E40AF] hover:bg-[#1D4ED8] text-white'
                          : 'border border-slate-300 dark:border-slate-700 text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#1E40AF]'
                      }`}
                    >
                      {isSupRevoked ? 'Restaurar Socio / Supervisor' : 'Revocar Socio / Supervisor'}
                    </button>
                  </div>

                  {/* Rama Jerárquica de Empleados Subordinados */}
                  <div className="pl-6 border-l-2 border-slate-300 dark:border-slate-800 space-y-3 pt-2">
                    <div className="text-[11px] font-heading font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                      Subordinados directos de {sup.name} ({subTeam.length})
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {subTeam.map((emp) => {
                        const empDir = userPermissionsDirectory[emp.id];
                        const isEmpRevoked = Boolean(empDir?.accessRevoked);
                        const empTasks = tasks.filter((t) => t.assigned_to === emp.id);
                        return (
                          <div
                            key={emp.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center space-x-3">
                                <span className="text-xs font-mono text-[#475569] dark:text-[#94A3B8]">└─</span>
                                <span className={`font-heading font-semibold text-sm ${isEmpRevoked ? 'line-through text-[#475569] dark:text-[#94A3B8]' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                                  {emp.name}
                                </span>
                                <span className="text-xs text-[#475569] dark:text-[#94A3B8]">
                                  Empleado Subordinado • {emp.email}
                                </span>
                                {isEmpRevoked && (
                                  <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
                                    [REVOCADO]
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 pl-6 mt-1 text-xs text-[#475569] dark:text-[#94A3B8]">
                                <span>Reporta a: <strong>{sup.name}</strong></span>
                                <span>•</span>
                                <span>{empTasks.length} tareas asignadas</span>
                                {hierarchyAudit.supervisors.length > 1 && (
                                  <select
                                    value={emp.supervisor_id || sup.id}
                                    onChange={(e) => {
                                      reassignEmployeeSupervisor(emp.id, e.target.value);
                                      addToast(`Usuario ${emp.name} reasignado por TI.`, 'info');
                                    }}
                                    className="bg-transparent border-b border-slate-300 dark:border-slate-700 text-xs text-[#0F172A] dark:text-[#F8FAFC] py-0.5"
                                  >
                                    {hierarchyAudit.supervisors.map((s, sIdx) => (
                                      <option key={s.id} value={s.id} className="bg-[#F8FAFC] dark:bg-[#0F172A]">
                                        Mover a Equipo #{sIdx + 1}: {s.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                toggleUserAccessRevoked(emp.id);
                                addToast(
                                  isEmpRevoked
                                    ? `Permisos restaurados por TI para ${emp.name}.`
                                    : `Permisos revocados por TI para ${emp.name}.`,
                                  isEmpRevoked ? 'success' : 'error'
                                );
                              }}
                              className={`px-3 py-1 text-xs font-heading font-semibold uppercase tracking-wider cursor-pointer transition-colors self-start sm:self-auto ${
                                isEmpRevoked
                                  ? 'bg-[#1E40AF] hover:bg-[#1D4ED8] text-white'
                                  : 'border border-slate-300 dark:border-slate-700 text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#1E40AF]'
                              }`}
                            >
                              {isEmpRevoked ? 'Restaurar Empleado' : 'Revocar Empleado'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* PESTAÑA 3: MATRIZ DE ACCESO RBAC */}
      {activeTab === 'rbac_matrix' && (
        <section className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-heading font-bold text-slate-900 dark:text-slate-100">
            Política de Control de Acceso Basada en Roles (RBAC)
          </h2>
          <div className="overflow-x-auto bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-[#0B111E] text-[11px] font-heading font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Recurso / Entidad</th>
                  <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">TI (Root)</th>
                  <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Supervisor</th>
                  <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">Empleado</th>
                  <th className="py-3.5 px-4 text-slate-600 dark:text-slate-400">RH (Restringido)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {(Object.keys(RBAC_MATRIX) as Array<keyof typeof RBAC_MATRIX>).map((resource) => (
                  <tr key={resource} className="bg-white dark:bg-[#101726] hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-200">{resource}</td>
                    <td className="py-3.5 px-4 text-slate-900 dark:text-slate-200">
                      {RBAC_MATRIX[resource].TI.description}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Supervisor.description}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].Empleado.description}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {RBAC_MATRIX[resource].RH.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PESTAÑA 4: AUDITAR PANEL DE SUPERVISIÓN */}
      {activeTab === 'supervisor_view' && <SupervisorDashboard />}
    </div>
  );
}
