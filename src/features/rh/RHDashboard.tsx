import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Clock,
  Calendar,
  ShieldAlert,
  Search,
  CheckCircle2,
  UserCheck,
  UserX,
  Lock,
  Activity,
  FileSpreadsheet,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { probeRBACEndpoint, getEffectiveModules } from '../../services/rbac';
import { FacialEnrollmentModal } from '../checkin/FacialEnrollmentModal';
import { CheckinPanel } from '../checkin/CheckinPanel';

/**
 * Panel Exclusivo de Recursos Humanos (RH - Perfil Restringido)
 * - Permisos estrictos: Solo lectura de métricas operativas (headcount, listas de personal y time_logs).
 * - BLOQUEADO (403 Forbidden): Sin ningún acceso ni renderizado de empresas/clientes, proyectos ni tareas.
 * - Paleta monocromática/análoga oscura corporativa con acentos celestes y azul rey.
 */
export function RHDashboard() {
  const { user, userPermissionsDirectory, getEffectiveUserModules, mockEmployeesData, addToast } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);
  const hasVector = Boolean(
    user?.biometrics?.faceDescriptor?.length || user?.faceDescriptor?.length
  );

  // Equipos (Supervisores) que TI autorizó visualizar a este perfil de RH
  const rhPermissionEntry = userPermissionsDirectory[user?.id || 'rh-01'] || userPermissionsDirectory['rh-01'];
  const allowedSupervisorIds = useMemo(() => {
    if (rhPermissionEntry?.allowedSupervisorIds) {
      return rhPermissionEntry.allowedSupervisorIds;
    }
    return teamMembers.filter((m) => m.role === 'Supervisor').map((m) => m.id);
  }, [rhPermissionEntry, teamMembers]);

  const authorizedSupervisors = useMemo(() => {
    return teamMembers.filter((m) => m.role === 'Supervisor' && allowedSupervisorIds.includes(m.id));
  }, [teamMembers, allowedSupervisorIds]);

  const [rhTab, setRhTab] = useState<'metrics' | 'my_checkin'>('metrics');
  const [isRecalibrateOpen, setIsRecalibrateOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-31');

  // Estado de prueba de endpoints API RBAC (/api/rh/work-summary vs /api/tasks y /api/clients)
  const [rbacAuditResults, setRbacAuditResults] = useState<{
    workSummaryStatus?: number;
    tasksStatus?: number;
    tasksError?: string;
    clientsStatus?: number;
    clientsError?: string;
  }>({});

  useEffect(() => {
    async function verifyRHRBACBoundaries() {
      const [summaryRes, tasksRes, clientsRes] = await Promise.all([
        probeRBACEndpoint('/api/rh/work-summary', 'RH', user?.id, { startDate, endDate }),
        probeRBACEndpoint('/api/tasks', 'RH', user?.id),
        probeRBACEndpoint('/api/clients', 'RH', user?.id),
      ]);

      setRbacAuditResults({
        workSummaryStatus: summaryRes.status,
        tasksStatus: tasksRes.status,
        tasksError: String(tasksRes.body?.error || '403 Forbidden'),
        clientsStatus: clientsRes.status,
        clientsError: String(clientsRes.body?.error || '403 Forbidden'),
      });
    }
    verifyRHRBACBoundaries();
  }, [user?.id, startDate, endDate]);

  // Vista limpia equivalente a rh_work_time_view:
  // Filtra únicamente los equipos asignados por TI a RH y omite cualquier campo de clientes, proyectos o tareas
  const sanitizedPersonnel = useMemo(() => {
    return teamMembers
      .filter((m) => {
        if (m.role === 'RH') return false;
        if (m.role === 'Supervisor') return allowedSupervisorIds.includes(m.id);
        const supId = m.supervisor_id || m.supervisorId || 'admin-99';
        return allowedSupervisorIds.includes(supId);
      })
      .map((m) => {
        const mockEmp = mockEmployeesData.find(
          (e) => e.id === m.id || e.email.toLowerCase() === m.email.toLowerCase()
        );
        const historyLogs = (mockEmp?.history || []).filter((h) => {
          if (startDate && h.date < startDate) return false;
          if (endDate && h.date > endDate) return false;
          return true;
        });

        const historyHours = historyLogs.reduce(
          (sum, h) => sum + (h.totalDurationMinutes || 480) / 60,
          0
        );
        const todayHours = Number(((m.workedMinutesToday || 0) / 60).toFixed(2));
        const totalPeriodHours = Number((historyHours + todayHours).toFixed(2));

        return {
          user_id: m.id,
          user_name: m.name,
          email: m.email,
          role: m.role || 'Empleado',
          department: m.team,
          status: m.status,
          check_in: m.entryTime || '09:00',
          check_out: m.checkOutTime || (m.status === 'active' ? 'En jornada' : '18:00'),
          hours_today: todayHours,
          hours_worked_period: totalPeriodHours,
          is_late: m.isLate,
          minutes_late: m.minutesLate,
        };
      });
  }, [teamMembers, mockEmployeesData, startDate, endDate, allowedSupervisorIds]);

  const filteredPersonnel = useMemo(() => {
    return sanitizedPersonnel.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.user_name.toLowerCase().includes(q) ||
          p.user_id.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sanitizedPersonnel, statusFilter, searchQuery]);

  // Registros detallados de tiempo de trabajo (time_logs) sin referencias a tareas ni clientes
  const sanitizedTimeLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      user_id: string;
      user_name: string;
      status: 'active' | 'inactive';
      date: string;
      check_in: string;
      check_out: string;
      hours_worked: number;
    }> = [];

    sanitizedPersonnel.forEach((p) => {
      logs.push({
        id: `tl-today-${p.user_id}`,
        user_id: p.user_id,
        user_name: p.user_name,
        status: p.status,
        date: new Date().toISOString().split('T')[0],
        check_in: p.check_in,
        check_out: p.check_out,
        hours_worked: p.hours_today,
      });
    });

    mockEmployeesData.forEach((emp) => {
      const empSupId = emp.supervisor_id || 'admin-99';
      if (!allowedSupervisorIds.includes(empSupId)) return;

      emp.history.slice(0, 6).forEach((h) => {
        if (startDate && h.date < startDate) return;
        if (endDate && h.date > endDate) return;

        const inDate = h.checkInTimeMs ? new Date(h.checkInTimeMs) : null;
        const outDate = h.checkOutTimeMs ? new Date(h.checkOutTimeMs) : null;
        logs.push({
          id: h.id,
          user_id: emp.id,
          user_name: emp.name,
          status: emp.status,
          date: h.date,
          check_in: inDate
            ? inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '09:00',
          check_out: outDate
            ? outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '18:00',
          hours_worked: Number(((h.totalDurationMinutes || 480) / 60).toFixed(2)),
        });
      });
    });

    return logs.filter((l) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return l.user_name.toLowerCase().includes(q) || l.user_id.toLowerCase().includes(q);
    });
  }, [sanitizedPersonnel, mockEmployeesData, startDate, endDate, searchQuery, allowedSupervisorIds]);

  const totalUsers = sanitizedPersonnel.length;
  const activeUsers = sanitizedPersonnel.filter((p) => p.status === 'active').length;
  const inactiveUsers = totalUsers - activeUsers;
  const totalHoursToday = Number(
    sanitizedPersonnel.reduce((acc, p) => acc + p.hours_today, 0).toFixed(2)
  );

  const handleTestForbiddenAccess = async (endpoint: '/api/tasks' | '/api/clients') => {
    const res = await probeRBACEndpoint(endpoint, 'RH', user?.id);
    addToast(
      `[${res.status} Forbidden] ${endpoint}: ${res.body?.error || 'Acceso denegado por RBAC'}`,
      'error'
    );
  };

  const resolvedRhTab =
    rhTab === 'my_checkin' && !effectiveModules.checkIn ? 'metrics' : rhTab;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in bg-[#0B111E] text-[#F8FAFC]">
      {/* 1. Cabecera de Recursos Humanos (Perfil Restringido) */}
      <div className="bg-[#131D31] text-[#F8FAFC] rounded-md p-5 sm:p-6 border border-[#233354] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-md bg-[#1A2742] border border-[#233354] flex items-center justify-center text-[#38BDF8] shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider bg-[#1A2742] text-[#F59E0B] border border-[#F59E0B]/30 px-2 py-0.5 rounded-sm">
                  RECURSOS HUMANOS (RH) • PERFIL RESTRINGIDO
                </span>
                <span className="text-xs text-[#94A3B8]">Vista: rh_work_time_view</span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-heading font-semibold px-2 py-0.5 rounded-md border ${
                    hasVector
                      ? 'bg-[#0F172A] text-[#38BDF8] border-[#233354]'
                      : 'bg-[#1A2742] text-[#F59E0B] border-[#F59E0B]/30'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3 text-current" />
                  {hasVector ? 'Vector 128D Activo' : 'Vector Facial Pendiente'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-[#F8FAFC] tracking-tight mt-1">
                Métricas Operativas de Personal y Registros de Tiempo
              </h1>
              <p className="text-xs text-[#94A3B8] mt-0.5 max-w-2xl">
                Acceso exclusivo de solo lectura a conteo de personal activo (<code>headcount</code>) y checadas (<code>time_logs</code>) de los equipos asignados por TI:{' '}
                <strong className="text-[#38BDF8]">
                  {authorizedSupervisors.length > 0
                    ? authorizedSupervisors.map((s) => `Equipo de ${s.name}`).join(', ')
                    : 'Sin equipos asignados por TI'}
                </strong>.
              </p>
            </div>
          </div>

          {/* Acciones rápidas de Biometría y Selector de Vista RH */}
          <div className="flex flex-col sm:items-end gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-[#1A2742] p-1 rounded-md border border-[#233354] flex items-center gap-1 text-xs font-heading font-semibold">
                <button
                  id="nav-metrics-time"
                  type="button"
                  onClick={() => setRhTab('metrics')}
                  className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                    resolvedRhTab === 'metrics'
                      ? 'bg-[#1E40AF] text-white shadow-xs'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  Métricas de Personal
                </button>
                {effectiveModules.checkIn && (
                  <button
                    type="button"
                    onClick={() => setRhTab('my_checkin')}
                    className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                      resolvedRhTab === 'my_checkin'
                        ? 'bg-[#1E40AF] text-white shadow-xs'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Mi Asistencia
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsRecalibrateOpen(true)}
                className="px-3.5 py-1.5 rounded-md bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border border-[#1E40AF]"
              >
                <ScanFace className="w-3.5 h-3.5 text-white" />
                <span>Actualizar Registro Facial</span>
              </button>
            </div>

            {resolvedRhTab === 'metrics' && (
              <div className="bg-[#1A2742] p-2 rounded-md border border-[#233354] flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center space-x-1.5 text-[#38BDF8] font-heading font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Periodo:</span>
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#131D31] text-[#F8FAFC] border border-[#233354] rounded-sm px-2 py-0.5 text-xs font-medium"
                />
                <span className="text-[#64748B]">a</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#131D31] text-[#F8FAFC] border border-[#233354] rounded-sm px-2 py-0.5 text-xs font-medium"
                />
              </div>
            )}
          </div>
        </div>

        {/* KPIs de Métricas Operativas Permitidas para RH */}
        {effectiveModules.reports && (
          <div id="nav-headcount" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#233354]">
            <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-heading font-semibold tracking-wider flex items-center justify-between">
                <span>Total Personal</span>
                <Users className="w-3.5 h-3.5 text-[#38BDF8]" />
              </span>
              <div className="text-2xl font-heading font-bold text-[#F8FAFC] metric-value mt-1">{totalUsers}</div>
              <span className="text-[10px] text-[#64748B]">Colaboradores</span>
            </div>

            <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
              <span className="text-[10px] text-[#38BDF8] uppercase font-heading font-semibold tracking-wider flex items-center justify-between">
                <span>Usuarios Activos Hoy</span>
                <UserCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
              </span>
              <div className="text-2xl font-heading font-bold text-[#38BDF8] metric-value mt-1">{activeUsers}</div>
              <span className="text-[10px] text-[#64748B]">En jornada</span>
            </div>

            <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
              <span className="text-[10px] text-[#94A3B8] uppercase font-heading font-semibold tracking-wider flex items-center justify-between">
                <span>Fuera de Turno</span>
                <UserX className="w-3.5 h-3.5 text-[#64748B]" />
              </span>
              <div className="text-2xl font-heading font-bold text-[#94A3B8] metric-value mt-1">{inactiveUsers}</div>
              <span className="text-[10px] text-[#64748B]">Sin sesión</span>
            </div>

            <div className="bg-[#1A2742] rounded-md p-3 border border-[#233354]">
              <span className="text-[10px] text-[#38BDF8] uppercase font-heading font-semibold tracking-wider flex items-center justify-between">
                <span>Horas Hoy</span>
                <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
              </span>
              <div className="text-2xl font-heading font-bold text-[#F8FAFC] metric-value mt-1">{totalHoursToday} hrs</div>
              <span className="text-[10px] text-[#64748B]">Asistencia diaria</span>
            </div>
          </div>
        )}
      </div>

      {/* Vista de Asistencia Personal de RH */}
      {resolvedRhTab === 'my_checkin' && effectiveModules.checkIn ? (
        <CheckinPanel />
      ) : !effectiveModules.reports ? (
        <div className="bg-[#131D31] rounded-md border border-[#233354] p-8 text-center shadow-xs text-[#F8FAFC]">
          <div className="w-12 h-12 rounded-md bg-[#1A2742] border border-[#233354] text-[#F59E0B] flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-heading font-bold text-[#F8FAFC]">
            Módulo de Reportes Deshabilitado por Administración TI
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
            El administrador de TI desactivó temporalmente el permiso <code>modules.reports</code> para tu cuenta.
          </p>
        </div>
      ) : (
        <>
          {/* 2. Guardia de Seguridad RBAC Activa */}
          <div className="bg-[#131D31] rounded-md border border-[#233354] p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-[#F8FAFC]">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#1A2742] border border-[#233354] text-[#38BDF8] flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[#F8FAFC]">
                  Guardia de Seguridad RBAC Activa (Middleware Backend & Capa de Datos)
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Endpoint autorizado: <code>GET /api/rh/work-summary</code> ({rbacAuditResults.workSummaryStatus || 200} OK) • Endpoints denegados para RH:{' '}
                  <code>GET /api/tasks</code> ({rbacAuditResults.tasksStatus || 403} Forbidden) y{' '}
                  <code>GET /api/clients</code> ({rbacAuditResults.clientsStatus || 403} Forbidden).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleTestForbiddenAccess('/api/tasks')}
                className="px-3 py-1.5 rounded-md bg-[#1A2742] hover:bg-[#E11D48]/15 text-[#E11D48] border border-[#E11D48]/30 text-xs font-heading font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Verificar /api/tasks (403)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTestForbiddenAccess('/api/clients')}
                className="px-3 py-1.5 rounded-md bg-[#1A2742] hover:bg-[#E11D48]/15 text-[#E11D48] border border-[#E11D48]/30 text-xs font-heading font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Verificar /api/clients (403)</span>
              </button>
            </div>
          </div>

          {/* 3. Barra de Búsqueda y Filtro de Personal */}
          <div id="filter-user-select" className="bg-[#131D31] rounded-md border border-[#233354] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[#F8FAFC]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar colaborador por ID, nombre o departamento..."
                className="w-full pl-9 pr-3.5 py-1.5 bg-[#1A2742] border border-[#233354] rounded-md text-xs font-medium text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-heading font-semibold text-[#94A3B8]">Estado:</span>
              <div className="flex bg-[#1A2742] p-1 rounded-md border border-[#233354] text-xs font-heading font-semibold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                    statusFilter === 'all' ? 'bg-[#1E40AF] text-white shadow-2xs' : 'text-[#94A3B8]'
                  }`}
                >
                  Todos ({totalUsers})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                    statusFilter === 'active'
                      ? 'bg-[#1E40AF] text-white shadow-2xs'
                      : 'text-[#94A3B8]'
                  }`}
                >
                  Activos ({activeUsers})
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1 rounded-sm transition-colors cursor-pointer ${
                    statusFilter === 'inactive'
                      ? 'bg-[#1E40AF] text-white shadow-2xs'
                      : 'text-[#94A3B8]'
                  }`}
                >
                  Inactivos ({inactiveUsers})
                </button>
              </div>
            </div>
          </div>

          {/* 4. Tabla 1: Lista de Colaboradores y Resumen de Horas */}
          <div id="time-summary-view" className="bg-[#131D31] rounded-md border border-[#233354] shadow-xs overflow-hidden text-[#F8FAFC]">
            <div className="p-4 border-b border-[#233354] bg-[#0F172A] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="text-xs font-heading font-bold uppercase tracking-wider text-[#F8FAFC]">
                  1. Lista de Personal y Horas Laboradas por Periodo
                </h2>
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                Datos sanitizados (Sin proyectos ni tareas)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#F8FAFC]">
                <thead className="bg-[#0B111E] text-[11px] font-heading font-bold uppercase text-[#94A3B8] border-b border-[#233354]">
                  <tr>
                    <th className="py-3 px-4">ID Colaborador</th>
                    <th className="py-3 px-4">Nombre Completo</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Check-In / Out</th>
                    <th className="py-3 px-4">Puntualidad</th>
                    <th className="py-3 px-4 text-right">Horas Hoy</th>
                    <th className="py-3 px-4 text-right">Horas Periodo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233354]">
                  {filteredPersonnel.map((person) => (
                    <tr key={person.user_id} className="hover:bg-[#1A2742]/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#94A3B8]">
                        {person.user_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#F8FAFC] block">{person.user_name}</span>
                        <span className="text-[11px] text-[#94A3B8]">{person.department}</span>
                      </td>
                      <td className="py-3 px-4">
                        {person.status === 'active' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-heading font-semibold bg-[#0F172A] text-[#38BDF8] border border-[#233354]">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-[#38BDF8]" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-heading font-semibold bg-[#1A2742] text-[#94A3B8] border border-[#233354]">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="text-[#F8FAFC] font-semibold">{person.check_in}</span>
                        <span className="mx-1.5 text-[#64748B]">→</span>
                        <span className="text-[#94A3B8]">{person.check_out}</span>
                      </td>
                      <td className="py-3 px-4">
                        {person.is_late ? (
                          <span className="text-[10px] font-heading font-semibold text-[#F59E0B] bg-[#1A2742] px-2 py-0.5 rounded-sm border border-[#F59E0B]/30">
                            Retardo (+{person.minutes_late}m)
                          </span>
                        ) : (
                          <span className="text-[10px] font-heading font-semibold text-[#38BDF8] bg-[#0F172A] px-2 py-0.5 rounded-sm border border-[#233354]">
                            Puntual
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-heading font-bold text-[#F8FAFC]">
                        {person.hours_today} hrs
                      </td>
                      <td className="py-3 px-4 text-right font-heading font-bold text-[#38BDF8]">
                        {person.hours_worked_period} hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Tabla 2: Registros Detallados de Tiempo (time_logs) */}
          <div className="bg-[#131D31] rounded-md border border-[#233354] shadow-xs overflow-hidden text-[#F8FAFC]">
            <div className="p-4 border-b border-[#233354] bg-[#0F172A] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="text-xs font-heading font-bold uppercase tracking-wider text-[#F8FAFC]">
                  2. Bitácora de Registros de Tiempo de Trabajo (time_logs)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-[#64748B]">
                rh_work_time_view
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-[#F8FAFC]">
                <thead className="bg-[#0B111E] text-[11px] font-heading font-bold uppercase text-[#94A3B8] border-b border-[#233354] sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">ID Usuario</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Check-In</th>
                    <th className="py-3 px-4">Check-Out</th>
                    <th className="py-3 px-4 text-right">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233354]">
                  {sanitizedTimeLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1A2742]/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-[#94A3B8]">{log.date}</td>
                      <td className="py-2.5 px-4 font-mono text-[#64748B]">{log.user_id}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#F8FAFC]">{log.user_name}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-sm border ${
                            log.status === 'active'
                              ? 'bg-[#0F172A] text-[#38BDF8] border-[#233354]'
                              : 'bg-[#1A2742] text-[#94A3B8] border-[#233354]'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono">{log.check_in}</td>
                      <td className="py-2.5 px-4 font-mono">{log.check_out}</td>
                      <td className="py-2.5 px-4 text-right font-heading font-bold text-[#F8FAFC]">
                        {log.hours_worked} hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal para recalibrar / actualizar el vector facial */}
      <FacialEnrollmentModal
        isOpen={isRecalibrateOpen}
        onClose={() => setIsRecalibrateOpen(false)}
        mode="recalibrate"
        endpointTarget="me"
        onEnrollmentComplete={() => setIsRecalibrateOpen(false)}
      />
    </div>
  );
}
