import { useState, useMemo } from 'react';
import {
  Shield,
  UserPlus,
  Users,
  Mail,
  Copy,
  Check,
  RefreshCw,
  XCircle,
  Trash2,
  GitFork,
  CheckCircle2,
  Clock,
  Lock,
  Send,
  Sparkles,
  Eye,
  Sliders,
  Ban,
  Unlock,
} from 'lucide-react';
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

  // Filtrar solo invitaciones emitidas por TI dirigidas al rol Supervisor
  const tiSupervisorInvitations = useMemo(() => {
    return invitations.filter((inv) => inv.issuerRole === 'TI' && inv.targetRole === 'Supervisor');
  }, [invitations]);

  // Auditoría jerárquica en tiempo real
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
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in bg-[#0B111E] text-[#F8FAFC]">
      {/* Cabecera TI Root */}
      <div className="bg-[#131D31] text-[#F8FAFC] rounded-md p-6 border border-[#233354] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-md bg-[#1A2742] border border-[#233354] flex items-center justify-center text-[#38BDF8] shrink-0">
              <Shield className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider bg-[#1E40AF] text-white px-2 py-0.5 rounded-sm">
                  NIVEL MÁS ALTO • TI (ROOT)
                </span>
                <span className="text-xs text-[#94A3B8]">
                  ID: {user?.id || 'ti-root-01'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight mt-1 text-[#F8FAFC]">
                Consola Central de TI & Auditoría Global RBAC
              </h1>
              <p className="text-xs text-[#94A3B8] mt-0.5 max-w-2xl">
                Genera invitaciones para Supervisores (vinculados con <code>created_by_ti_id</code>) y audita las cuentas de todos los niveles del sistema.
              </p>
            </div>
          </div>

          {/* Navegación TI */}
          <div className="flex flex-wrap bg-[#1A2742] p-1 rounded-md border border-[#233354] gap-1">
            <button
              id="nav-user-permissions"
              onClick={() => {
                setActiveTab('users_permissions');
                navigate('/admin/users-permissions');
              }}
              className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-heading font-semibold transition-colors cursor-pointer ${
                activeTab === 'users_permissions'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-current" />
              Permisos por Usuario
            </button>

            <button
              onClick={() => {
                setActiveTab('invitations');
                navigate('/');
              }}
              className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-heading font-semibold transition-colors cursor-pointer ${
                activeTab === 'invitations'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5 text-current" />
              Invitar Supervisores
            </button>

            <button
              onClick={() => setActiveTab('audit_accounts')}
              className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-heading font-semibold transition-colors cursor-pointer ${
                activeTab === 'audit_accounts'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-current" />
              Auditar Jerarquía
            </button>

            <button
              onClick={() => setActiveTab('rbac_matrix')}
              className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-heading font-semibold transition-colors cursor-pointer ${
                activeTab === 'rbac_matrix'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
            >
              <Lock className="w-3.5 h-3.5 mr-1.5 text-current" />
              Matriz RBAC
            </button>

            <button
              onClick={() => setActiveTab('supervisor_view')}
              className={`flex items-center px-3 py-1.5 rounded-sm text-xs font-heading font-semibold transition-colors cursor-pointer ${
                activeTab === 'supervisor_view'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-current" />
              Proyectos y Tareas
            </button>
          </div>
        </div>

        {/* KPIs Globales de Auditoría TI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#233354]">
          <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-heading font-semibold tracking-wider">
              Supervisores Activos
            </span>
            <div className="text-2xl font-heading font-bold text-[#F8FAFC] metric-value mt-0.5">
              {hierarchyAudit.supervisors.length}
            </div>
            <span className="text-[10px] text-[#64748B]">Dados de alta por TI</span>
          </div>

          <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
            <span className="text-[10px] text-[#38BDF8] uppercase font-heading font-semibold tracking-wider">
              Empleados Operativos
            </span>
            <div className="text-2xl font-heading font-bold text-[#38BDF8] metric-value mt-0.5">
              {hierarchyAudit.employees.length}
            </div>
            <span className="text-[10px] text-[#64748B]">Vinculados con supervisor_id</span>
          </div>

          <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
            <span className="text-[10px] text-[#94A3B8] uppercase font-heading font-semibold tracking-wider">
              Tareas Sincronizadas
            </span>
            <div className="text-2xl font-heading font-bold text-[#F8FAFC] metric-value mt-0.5">
              {hierarchyAudit.completedTasks} / {hierarchyAudit.totalTasks}
            </div>
            <span className="text-[10px] text-[#64748B]">Completadas / Totales</span>
          </div>

          <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
            <span className="text-[10px] text-[#F59E0B] uppercase font-heading font-semibold tracking-wider">
              Empresas & Proyectos
            </span>
            <div className="text-2xl font-heading font-bold text-[#F59E0B] metric-value mt-0.5">
              {hierarchyAudit.totalClients} / {hierarchyAudit.totalProjects}
            </div>
            <span className="text-[10px] text-[#64748B]">Ocultos para RH (403)</span>
          </div>
        </div>
      </div>

      {/* PESTAÑA 0: MATRIZ GRANULAR DE MÓDULOS POR USUARIO (/admin/users-permissions) */}
      {activeTab === 'users_permissions' && <UserPermissionsTable />}

      {/* PESTAÑA 1: GENERACIÓN DE ENLACES DE INVITACIÓN PARA SUPERVISORES */}
      {activeTab === 'invitations' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#131D31] rounded-md border border-[#233354] p-5 sm:p-6 shadow-xs text-[#F8FAFC]">
            <div className="flex items-center space-x-3 pb-4 border-b border-[#233354] mb-4">
              <div className="w-9 h-9 rounded-md bg-[#1A2742] text-[#38BDF8] flex items-center justify-center border border-[#233354]">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-heading font-bold text-[#F8FAFC]">
                  Generar y Enviar Enlace de Invitación para Alta de Supervisor
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Los Supervisores se registran únicamente mediante el link generado aquí por TI, vinculados con <code>created_by_ti_id: "{user?.id || 'ti-root-01'}"</code>.
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerateSupervisorInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-heading font-semibold text-[#94A3B8] flex items-center justify-between">
                    <span>Correo(s) Electrónico(s) de los Nuevos Supervisores *</span>
                    <span className="text-[11px] font-normal text-[#64748B]">
                      Rol asignado en token: Supervisor
                    </span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    placeholder="nuevo.supervisor@russellbedford.mx, lider.equipo@russellbedford.mx"
                    className="w-full px-3 py-2 bg-[#1A2742] border border-[#233354] rounded-md text-xs font-medium text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8]"
                  />
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold text-[#94A3B8] block mb-1">
                    Práctica / Área que Liderará
                  </label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A2742] border border-[#233354] rounded-md text-xs font-medium text-[#F8FAFC] focus:border-[#38BDF8]"
                  >
                    {SUPERVISOR_TEAMS.map((t) => (
                      <option key={t} value={t} className="bg-[#131D31]">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold text-[#94A3B8] block mb-1">
                    Cargo Ejecutivo de Supervisor
                  </label>
                  <select
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A2742] border border-[#233354] rounded-md text-xs font-medium text-[#F8FAFC] focus:border-[#38BDF8]"
                  >
                    {SUPERVISOR_TITLES.map((r) => (
                      <option key={r} value={r} className="bg-[#131D31]">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold text-[#94A3B8] block mb-1">
                    Vigencia del Enlace Especial
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1A2742] border border-[#233354] rounded-md text-xs font-medium text-[#F8FAFC] focus:border-[#38BDF8]"
                  >
                    <option value={24} className="bg-[#131D31]">24 Horas</option>
                    <option value={48} className="bg-[#131D31]">48 Horas</option>
                    <option value={72} className="bg-[#131D31]">72 Horas (Recomendado)</option>
                    <option value={168} className="bg-[#131D31]">7 Días</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#233354]">
                <div className="flex items-center space-x-2 text-xs text-[#94A3B8]">
                  <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                  <span>
                    El token autorizado por TI registra exclusivamente como <b>Supervisor</b>.
                  </span>
                </div>

                <button
                  id="btn-new-supervisor-invite"
                  type="submit"
                  className="px-5 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold tracking-wide shadow-xs transition-colors cursor-pointer flex items-center space-x-2"
                >
                  <Send className="w-4 h-4 text-white" />
                  <span>Generar y Enviar Link</span>
                </button>
              </div>
            </form>
          </div>

          {recentGenerated && (
            <div className="bg-[#1A2742] border border-[#233354] rounded-md p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold text-[#38BDF8] flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
                  <span>Enlace(s) de Alta de Supervisor Generados por TI</span>
                </span>
                <button
                  onClick={() => setRecentGenerated(null)}
                  className="text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <div className="space-y-2">
                {recentGenerated.map((inv) => {
                  const url = buildInviteUrl(inv.token);
                  return (
                    <div
                      key={inv.id}
                      className="bg-[#131D31] p-3 rounded-md border border-[#233354] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-[#F8FAFC] block">
                          {inv.email} ({inv.roleTitle})
                        </span>
                        <span className="text-[11px] font-mono text-[#38BDF8] block truncate">
                          {url}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                        className="px-3 py-1.5 rounded-md bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-heading font-semibold text-xs flex items-center space-x-1 shrink-0 cursor-pointer transition-colors"
                      >
                        {copiedId === inv.id ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-white" />
                        )}
                        <span>{copiedId === inv.id ? 'Copiado' : 'Copiar Link'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabla de enlaces emitidos por TI para Supervisores */}
          <div className="bg-[#131D31] rounded-md border border-[#233354] overflow-hidden shadow-xs text-[#F8FAFC]">
            <div className="p-4 border-b border-[#233354] bg-[#0F172A] flex items-center justify-between">
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[#F8FAFC]">
                Enlaces de Invitación de Supervisores Emitidos por TI ({tiSupervisorInvitations.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#F8FAFC]">
                <thead className="bg-[#0B111E] text-[11px] font-heading font-bold uppercase text-[#94A3B8] border-b border-[#233354]">
                  <tr>
                    <th className="py-3 px-4">Correo del Supervisor</th>
                    <th className="py-3 px-4">Área & Cargo</th>
                    <th className="py-3 px-4">created_by_ti_id</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233354]">
                  {tiSupervisorInvitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#1A2742]/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#F8FAFC]">
                        {inv.email}
                        <span className="block text-[10px] font-mono text-[#64748B]">
                          Token: {inv.token.slice(0, 22)}...
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-[#F8FAFC] block">{inv.team}</span>
                        <span className="text-[11px] text-[#94A3B8]">{inv.roleTitle}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#38BDF8] font-bold">
                        {inv.created_by_ti_id || 'ti-root-01'}
                      </td>
                      <td className="py-3 px-4">
                        {inv.status === 'pending' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-heading font-semibold bg-[#1A2742] text-[#F59E0B] border border-[#F59E0B]/30">
                            <Clock className="w-3 h-3 mr-1 text-[#F59E0B]" /> Pendiente
                          </span>
                        ) : inv.status === 'accepted' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-heading font-semibold bg-[#0F172A] text-[#38BDF8] border border-[#233354]">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-[#38BDF8]" /> Aceptada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-heading font-semibold bg-[#1A2742] text-[#94A3B8]">
                            {inv.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                            className="px-2.5 py-1 rounded-md bg-[#1A2742] hover:bg-[#233354] text-[#38BDF8] font-heading font-semibold text-[11px] flex items-center space-x-1 border border-[#233354] cursor-pointer transition-colors"
                          >
                            {copiedId === inv.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>Copiar Link</span>
                          </button>
                          <button
                            onClick={() => resendInvitation(inv.id)}
                            title="Reenviar correo"
                            className="p-1 rounded-md border border-[#233354] hover:bg-[#1A2742] text-[#94A3B8] cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => revokeInvitation(inv.id)}
                              title="Revocar"
                              className="p-1 rounded-md border border-[#E11D48]/30 hover:bg-[#E11D48]/15 text-[#E11D48] cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteInvitation(inv.id)}
                            title="Eliminar"
                            className="p-1 rounded-md text-[#64748B] hover:text-[#E11D48] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: AUDITORÍA Y GESTIÓN DE LA ESTRUCTURA JERÁRQUICA COMPLETA */}
      {activeTab === 'audit_accounts' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#131D31] rounded-md border border-[#233354] p-5 sm:p-6 shadow-xs space-y-5 text-[#F8FAFC]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#233354] pb-3 gap-2">
              <div className="flex items-center space-x-2.5">
                <GitFork className="w-5 h-5 text-[#38BDF8]" />
                <div>
                  <h2 className="text-sm font-heading font-bold text-[#F8FAFC]">
                    Estructura Organizacional Gestionada por TI (TI → RH y Equipos de Supervisores → Usuarios)
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    TI es el puesto más alto: revoca o restaura permisos incluso de Socios/Supervisores, asigna qué equipos visualiza RH en checadas y supervisa cada equipo.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. NIVEL SUPREMO: TI PRUEBA */}
            <div className="border border-[#1E40AF]/60 rounded-md p-4 bg-[#0F172A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-md bg-[#1E40AF] text-amber-300 font-heading font-bold text-xs flex items-center justify-center border border-amber-400/30">
                  TI
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-heading font-bold text-[#F8FAFC] text-sm">
                      {userPermissionsDirectory['ti-root-01']?.name || 'TI Prueba'}
                    </span>
                    <span className="text-[10px] font-heading font-bold bg-[#1E40AF] text-amber-300 px-2 py-0.5 rounded-sm">
                      PUESTO MÁS ALTO • ROOT
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    {userPermissionsDirectory['ti-root-01']?.email || 'ti.root@russellbedford.mx'} • Control total sobre Socios/Supervisores, RH y Empleados
                  </p>
                </div>
              </div>
              <span className="text-xs font-heading font-semibold text-amber-300 bg-[#1A2742] px-3 py-1 rounded-md border border-[#233354]">
                Autoridad Global Activa
              </span>
            </div>

            {/* 2. PERFIL DE RECURSOS HUMANOS (RH PRUEBA) Y ASIGNACIÓN DE EQUIPOS A VISUALIZAR */}
            <div className="space-y-3">
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
                  <div
                    key={rh.id}
                    className="border border-[#F59E0B]/40 rounded-md p-4 bg-[#1A2742] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-md bg-[#F59E0B] text-black font-heading font-bold text-xs flex items-center justify-center">
                          RH
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`font-heading font-bold text-xs ${isRhRevoked ? 'line-through text-rose-400' : 'text-[#F8FAFC]'}`}>
                              {rh.name} ({rh.email})
                            </span>
                            <span className="text-[10px] font-heading font-bold bg-[#131D31] text-[#F59E0B] px-2 py-0.5 rounded-sm border border-[#F59E0B]/30">
                              Rol: RH (Checadas por Equipo)
                            </span>
                            {isRhRevoked && (
                              <span className="text-[9px] font-heading font-bold uppercase bg-rose-950 text-rose-400 border border-rose-700 px-1.5 py-0.5 rounded-sm">
                                ACCESO REVOCADO POR TI
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            TI asigna a continuación cuáles equipos (Supervisores y sus usuarios) puede visualizar RH en el módulo de checadas:
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
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
                          className={`px-3 py-1.5 rounded-md text-xs font-heading font-bold cursor-pointer flex items-center space-x-1.5 border transition-colors ${
                            isRhRevoked
                              ? 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-700/50'
                              : 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border-rose-700/50'
                          }`}
                        >
                          {isRhRevoked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          <span>{isRhRevoked ? 'Restaurar RH' : 'Revocar Permisos RH'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Selector de Equipos asignados a RH */}
                    <div className="bg-[#131D31] p-3 rounded-md border border-[#233354] flex flex-wrap items-center gap-2.5">
                      <span className="text-[11px] font-heading font-semibold text-[#94A3B8]">
                        Equipos autorizados para checadas:
                      </span>
                      {hierarchyAudit.supervisors.map((sup) => {
                        const checked = allowedSups.includes(sup.id);
                        const teamCount = hierarchyAudit.employees.filter(
                          (e) => e.supervisor_id === sup.id || e.supervisorId === sup.id
                        ).length;
                        return (
                          <label
                            key={sup.id}
                            className={`flex items-center space-x-2 px-3 py-1 rounded-md border text-xs cursor-pointer transition-all select-none ${
                              checked
                                ? 'bg-[#1E40AF]/30 border-[#38BDF8] text-[#F8FAFC] font-semibold'
                                : 'bg-[#0F172A] border-[#233354] text-[#64748B]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTeamForRH(sup.id)}
                              className="w-3.5 h-3.5 accent-[#38BDF8] rounded cursor-pointer"
                            />
                            <span>
                              Equipo de {sup.name} ({teamCount} {teamCount === 1 ? 'usuario' : 'usuarios'})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. EQUIPOS DE SUPERVISORES / SOCIOS Y SUS USUARIOS SUBORDINADOS */}
            <div className="space-y-3">
              {hierarchyAudit.supervisors.map((sup) => {
                const supDir = userPermissionsDirectory[sup.id];
                const isSupRevoked = Boolean(supDir?.accessRevoked);
                const subTeam = hierarchyAudit.employees.filter(
                  (e) => e.supervisor_id === sup.id || e.supervisorId === sup.id
                );

                return (
                  <div
                    key={sup.id}
                    className="border border-[#233354] rounded-md overflow-hidden bg-[#1A2742]"
                  >
                    <div className="p-3.5 bg-[#0F172A] border-b border-[#233354] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-md bg-[#1E40AF] text-white font-heading font-bold text-xs flex items-center justify-center">
                          SUP
                        </div>
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`font-heading font-bold text-xs ${isSupRevoked ? 'line-through text-rose-400' : 'text-[#F8FAFC]'}`}>
                              {sup.name}
                            </span>
                            <span className="text-[10px] font-heading font-semibold bg-[#0F172A] text-[#38BDF8] px-2 py-0.5 rounded-sm border border-[#233354]">
                              Socio / Supervisor • {sup.team}
                            </span>
                            {isSupRevoked && (
                              <span className="text-[9px] font-heading font-bold uppercase bg-rose-950 text-rose-400 border border-rose-700 px-1.5 py-0.5 rounded-sm">
                                PERMISOS REVOCADOS POR TI
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#94A3B8]">
                            {sup.email} • ID: <code>{sup.id}</code> • Gestionado por TI:{' '}
                            <code className="text-[#38BDF8] font-bold">
                              {sup.created_by_ti_id || 'ti-root-01'}
                            </code>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-[#94A3B8] bg-[#1A2742] px-3 py-1 rounded-md border border-[#233354]">
                          Subordinados en su equipo: {subTeam.length}
                        </span>
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
                          className={`px-3 py-1 rounded-md text-xs font-heading font-bold cursor-pointer flex items-center space-x-1 border transition-colors ${
                            isSupRevoked
                              ? 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-700/50'
                              : 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border-rose-700/50'
                          }`}
                        >
                          {isSupRevoked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          <span>{isSupRevoked ? 'Restaurar Socio/Supervisor' : 'Revocar Socio/Supervisor'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Empleados subordinados a este Supervisor */}
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {subTeam.map((emp) => {
                        const empDir = userPermissionsDirectory[emp.id];
                        const isEmpRevoked = Boolean(empDir?.accessRevoked);
                        const empTasks = tasks.filter((t) => t.assigned_to === emp.id);
                        return (
                          <div
                            key={emp.id}
                            className="bg-[#131D31] p-3 rounded-md border border-[#233354] flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`font-semibold text-xs ${isEmpRevoked ? 'line-through text-rose-400' : 'text-[#F8FAFC]'}`}>
                                  {emp.name}
                                </span>
                                <span className="text-[10px] font-heading font-semibold bg-[#0F172A] text-[#38BDF8] px-1.5 py-0.2 rounded-sm border border-[#233354]">
                                  Empleado
                                </span>
                                {isEmpRevoked && (
                                  <span className="text-[9px] font-heading font-bold uppercase bg-rose-950 text-rose-400 border border-rose-700 px-1.5 py-0.5 rounded-sm">
                                    REVOCADO
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#94A3B8] block">{emp.email}</span>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-[10px] font-mono text-[#64748B]">
                                  Equipo: <b>{sup.name}</b>
                                </span>
                                {hierarchyAudit.supervisors.length > 1 && (
                                  <select
                                    value={emp.supervisor_id || sup.id}
                                    onChange={(e) => {
                                      reassignEmployeeSupervisor(emp.id, e.target.value);
                                      addToast(`Usuario ${emp.name} reasignado por TI.`, 'info');
                                    }}
                                    className="bg-[#0F172A] border border-[#233354] text-[10px] text-[#38BDF8] rounded px-1.5 py-0.5"
                                    title="Cambiar de Supervisor / Equipo"
                                  >
                                    {hierarchyAudit.supervisors.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        Mover a: {s.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>

                            <div className="text-right flex flex-col items-end space-y-1.5">
                              <div>
                                <span className="text-xs font-heading font-bold text-[#38BDF8] block">
                                  {empTasks.length} tareas
                                </span>
                                <span className="text-[10px] text-[#64748B]">
                                  {Math.floor((emp.workedMinutesToday || 0) / 60)}h{' '}
                                  {(emp.workedMinutesToday || 0) % 60}m hoy
                                </span>
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
                                className={`px-2 py-0.5 rounded text-[10px] font-heading font-semibold cursor-pointer border ${
                                  isEmpRevoked
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                    : 'bg-rose-950/60 text-rose-300 border-rose-700/50'
                                }`}
                              >
                                {isEmpRevoked ? 'Restaurar' : 'Revocar'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: MATRIZ DE ACCESO RBAC */}
      {activeTab === 'rbac_matrix' && (
        <div className="bg-[#131D31] rounded-md border border-[#233354] p-5 sm:p-6 shadow-xs space-y-3.5 animate-fade-in text-[#F8FAFC]">
          <h2 className="text-sm font-heading font-bold text-[#F8FAFC]">
            Política Estricta de Control de Acceso Basada en Roles (RBAC)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[#233354] rounded-md overflow-hidden text-[#F8FAFC]">
              <thead className="bg-[#0B111E] text-[#94A3B8] text-[11px] uppercase font-heading font-bold border-b border-[#233354]">
                <tr>
                  <th className="py-3 px-4">Recurso / Entidad</th>
                  <th className="py-3 px-4">TI (Root)</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4">Empleado</th>
                  <th className="py-3 px-4 bg-[#0F172A] border-l border-[#233354]">RH (Restringido)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233354]">
                {(Object.keys(RBAC_MATRIX) as Array<keyof typeof RBAC_MATRIX>).map((resource) => (
                  <tr key={resource} className="hover:bg-[#1A2742]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#F8FAFC]">{resource}</td>
                    <td className="py-3 px-4 text-[#38BDF8] font-medium">
                      {RBAC_MATRIX[resource].TI.description}
                    </td>
                    <td className="py-3 px-4 text-[#94A3B8]">
                      {RBAC_MATRIX[resource].Supervisor.description}
                    </td>
                    <td className="py-3 px-4 text-[#94A3B8]">
                      {RBAC_MATRIX[resource].Empleado.description}
                    </td>
                    <td
                      className={`py-3 px-4 font-semibold border-l border-[#233354] ${
                        RBAC_MATRIX[resource].RH.read === 'DENIED_403'
                          ? 'bg-[#E11D48]/10 text-[#E11D48]'
                          : 'bg-[#0F172A] text-[#38BDF8]'
                        }`}
                    >
                      {RBAC_MATRIX[resource].RH.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: AUDITAR PANEL DE SUPERVISIÓN */}
      {activeTab === 'supervisor_view' && <SupervisorDashboard />}
    </div>
  );
}
