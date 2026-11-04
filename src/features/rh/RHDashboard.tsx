import { useState, useMemo, useEffect } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import {
  fetchRHAttendanceRecords,
  getEffectiveModules,
  type RHAttendanceRecord,
} from '../../services/rbac';
import { FacialEnrollmentModal } from '../checkin/FacialEnrollmentModal';
import { CheckinPanel } from '../checkin/CheckinPanel';
import { UserAttendanceDrawer } from './UserAttendanceDrawer';

type DateRangePreset = 'all' | 'today' | 'week' | 'custom';

function formatCheckTimestamp(isoString?: string | null): string {
  if (!isoString) return 'En turno';
  const dateObj = new Date(isoString);
  if (Number.isNaN(dateObj.getTime())) return isoString;

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} • ${hours}:${minutes} hrs`;
}

function formatLocationSummary(label: string, lat: number, lng: number): string {
  const cleanLabel = label.split(',')[0].trim() || 'Oficina Central';
  return `${cleanLabel} (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
}

export function RHDashboard() {
  const { user, getEffectiveUserModules, mockEmployeesData, history, activeCheckin } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);

  const [rhTab, setRhTab] = useState<'metrics' | 'my_checkin'>('metrics');
  const [isRecalibrateOpen, setIsRecalibrateOpen] = useState(false);

  // Estado del Drawer lateral de detalle de colaborador y mapa
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    collaboratorEmail: string | null;
    initialRecordId: string | null;
  }>({
    isOpen: false,
    collaboratorEmail: null,
    initialRecordId: null,
  });

  // Filtros limpios de la vista global de asistencias
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('2026-10-01');
  const [customEndDate, setCustomEndDate] = useState('2026-11-30');

  const [apiAttendanceRecords, setApiAttendanceRecords] = useState<RHAttendanceRecord[]>([]);

  useEffect(() => {
    let active = true;
    fetchRHAttendanceRecords({ id: user?.id, role: user?.role }).then((data) => {
      if (active) {
        setApiAttendanceRecords(data);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  // Lista global de equipos / supervisores para el filtro opcional
  const availableTeams = useMemo(() => {
    const supervisors = teamMembers.filter((m) => m.role === 'Supervisor');
    const options: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();

    supervisors.forEach((sup) => {
      const label = sup.team ? `${sup.team} — ${sup.name}` : `Equipo de ${sup.name}`;
      if (!seen.has(sup.name)) {
        seen.add(sup.name);
        options.push({ value: sup.name, label });
      }
    });

    return options;
  }, [teamMembers]);

  // Consolidación global de registros de asistencia (API + actividad en vivo + historial) sin división forzada
  const consolidatedAttendance = useMemo(() => {
    const mapById = new Map<string, RHAttendanceRecord>();

    // 1. Registros provenientes de GET /api/rh/attendance
    apiAttendanceRecords.forEach((rec) => {
      mapById.set(rec.id, rec);
    });

    // 2. Registros en vivo del usuario activo (si realizó check-in durante la sesión)
    const liveRecords = activeCheckin ? [activeCheckin, ...history] : history;
    liveRecords.forEach((rec) => {
      const checkInMs = rec.checkInTimeMs ?? Date.now();
      const checkInIso = new Date(checkInMs).toISOString();
      const checkOutIso = rec.checkOutTimeMs ? new Date(rec.checkOutTimeMs).toISOString() : null;
      const totalHrs = rec.totalDurationMinutes
        ? Number((rec.totalDurationMinutes / 60).toFixed(1))
        : Number(((Date.now() - checkInMs) / 3600000).toFixed(1));

      const confidence =
        typeof rec.biometricMatchScore === 'number'
          ? rec.biometricMatchScore > 1
            ? Number((rec.biometricMatchScore / 100).toFixed(2))
            : rec.biometricMatchScore
          : 0.97;

      const hasFacialMatch = Boolean(rec.biometricMatchScore && rec.biometricMatchScore > 0);

      mapById.set(`live-${rec.id}`, {
        id: `live-${rec.id}`,
        userName: user?.name || 'Colaborador Activo',
        userEmail: user?.email || 'colaborador.prueba@russellbedford.mx',
        teamName: 'Equipo Prueba (Auditoría Fiscal)',
        supervisorName: 'Supervisor Prueba',
        checkIn: {
          timestamp: checkInIso,
          facialMatch: hasFacialMatch,
          confidenceScore: confidence,
          location: {
            label: rec.address || 'Oficina Central',
            latitude: rec.location?.lat ?? 21.8853,
            longitude: rec.location?.lng ?? -102.2915,
          },
        },
        checkOut: checkOutIso
          ? {
              timestamp: checkOutIso,
              facialMatch: hasFacialMatch,
              location: {
                label: rec.address || 'Oficina Central',
                latitude: rec.location?.lat ?? 21.8853,
                longitude: rec.location?.lng ?? -102.2915,
              },
            }
          : null,
        totalHours: Math.max(0.1, totalHrs),
      });
    });

    // 3. Historial y estado actual de colaboradores registrados en el sistema
    mockEmployeesData.forEach((emp) => {
      const memberInfo = teamMembers.find(
        (m) => m.id === emp.id || m.email.toLowerCase() === emp.email.toLowerCase()
      );
      const supervisorMember = teamMembers.find(
        (s) => s.id === (emp.supervisor_id || memberInfo?.supervisor_id || 'admin-99')
      );
      const supervisorName = supervisorMember?.name || 'Supervisor Prueba';
      const teamName = memberInfo?.team || emp.team || 'Equipo Operaciones';
      const empRequiresFacial = emp.role !== 'Supervisor' && emp.role !== 'TI';

      emp.history.slice(0, 5).forEach((h) => {
        const recordId = `hist-${emp.id}-${h.id}`;
        if (mapById.has(recordId)) return;

        const inMs = h.checkInTimeMs ?? Date.now();
        const inIso = new Date(inMs).toISOString();
        const outIso = h.checkOutTimeMs ? new Date(h.checkOutTimeMs).toISOString() : null;
        const hrs = Number(((h.totalDurationMinutes || 540) / 60).toFixed(1));
        const rawScore = h.biometricMatchScore
          ? h.biometricMatchScore > 1
            ? h.biometricMatchScore / 100
            : h.biometricMatchScore
          : empRequiresFacial
          ? 0.96
          : 0;

        mapById.set(recordId, {
          id: recordId,
          userName: emp.name,
          userEmail: emp.email,
          teamName,
          supervisorName,
          checkIn: {
            timestamp: inIso,
            facialMatch: empRequiresFacial,
            confidenceScore: Number(rawScore.toFixed(2)),
            location: {
              label: h.address || 'Oficina Central',
              latitude: h.location?.lat ?? 21.8853,
              longitude: h.location?.lng ?? -102.2915,
            },
          },
          checkOut: outIso
            ? {
                timestamp: outIso,
                facialMatch: empRequiresFacial,
                location: {
                  label: h.address || 'Oficina Central',
                  latitude: h.location?.lat ?? 21.8853,
                  longitude: h.location?.lng ?? -102.2915,
                },
              }
            : null,
          totalHours: hrs,
        });
      });
    });

    return Array.from(mapById.values()).sort(
      (a, b) => new Date(b.checkIn.timestamp).getTime() - new Date(a.checkIn.timestamp).getTime()
    );
  }, [apiAttendanceRecords, activeCheckin, history, mockEmployeesData, teamMembers, user?.name, user?.email]);

  // Aplicación de filtros de búsqueda, equipo/supervisor y rango de fechas
  const filteredAttendance = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return consolidatedAttendance.filter((item) => {
      // Filtro por equipo / supervisor (por defecto "" muestra todos los colaboradores)
      if (teamFilter) {
        const matchesTeamOrSup =
          item.supervisorName.toLowerCase().includes(teamFilter.toLowerCase()) ||
          item.teamName.toLowerCase().includes(teamFilter.toLowerCase());
        if (!matchesTeamOrSup) return false;
      }

      // Filtro por rango de fechas
      const itemDate = new Date(item.checkIn.timestamp);
      const itemDateStr = Number.isNaN(itemDate.getTime())
        ? ''
        : itemDate.toISOString().split('T')[0];

      if (datePreset === 'today') {
        if (itemDateStr !== todayStr) return false;
      } else if (datePreset === 'week') {
        if (itemDate.getTime() < sevenDaysAgoMs) return false;
      } else if (datePreset === 'custom') {
        if (customStartDate && itemDateStr < customStartDate) return false;
        if (customEndDate && itemDateStr > customEndDate) return false;
      }

      // Filtro por búsqueda de nombre o correo
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          item.userName.toLowerCase().includes(q) ||
          item.userEmail.toLowerCase().includes(q) ||
          item.teamName.toLowerCase().includes(q) ||
          item.supervisorName.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [
    consolidatedAttendance,
    teamFilter,
    datePreset,
    customStartDate,
    customEndDate,
    searchQuery,
  ]);

  // Métricas operativas globales
  const totalCollaborators = useMemo(() => {
    return teamMembers.filter((m) => m.role !== 'TI').length;
  }, [teamMembers]);

  const activeCollaboratorsCount = useMemo(() => {
    return teamMembers.filter((m) => m.role !== 'TI' && m.status === 'active').length;
  }, [teamMembers]);

  const biometricVerifiedCount = useMemo(() => {
    return filteredAttendance.filter((r) => r.checkIn.facialMatch).length;
  }, [filteredAttendance]);

  const totalConsolidatedHours = useMemo(() => {
    return Number(
      filteredAttendance.reduce((acc, r) => acc + (r.totalHours || 0), 0).toFixed(1)
    );
  }, [filteredAttendance]);

  const resolvedRhTab =
    rhTab === 'my_checkin' && !effectiveModules.checkIn ? 'metrics' : rhTab;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8 animate-fade-in bg-[#F8FAFC] dark:bg-[#090E17] text-slate-900 dark:text-slate-200">
      {/* Cabecera Corporativa de Recursos Humanos */}
      <header className="space-y-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-heading font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">
              <span className="text-[#1E40AF] dark:text-[#38BDF8]">RECURSOS HUMANOS</span>
              <span>/</span>
              <span>Auditoría Global de Asistencia y Biometría</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Control General de Asistencias y Jornadas
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              Vista centralizada de entradas, salidas, validación biométrica facial y ubicación de marcación de todo el personal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              id="nav-metrics-time"
              type="button"
              onClick={() => setRhTab('metrics')}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                resolvedRhTab === 'metrics'
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Tablero de Asistencias
              {resolvedRhTab === 'metrics' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D4ED8] dark:bg-[#38BDF8]" />
              )}
            </button>

            {effectiveModules.checkIn && (
              <button
                type="button"
                onClick={() => setRhTab('my_checkin')}
                className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                  resolvedRhTab === 'my_checkin'
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Mi Asistencia
                {resolvedRhTab === 'my_checkin' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D4ED8] dark:bg-[#38BDF8]" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsRecalibrateOpen(true)}
              className="px-4 py-1.5 bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-heading font-semibold uppercase tracking-wider rounded cursor-pointer transition-colors"
            >
              Actualizar Registro Facial
            </button>
          </div>
        </div>

        {/* Resumen de Indicadores Globales */}
        {effectiveModules.reports && (
          <div
            id="nav-headcount"
            className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            <div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold tracking-wider block">
                Total Colaboradores
              </span>
              <div className="text-3xl font-heading font-bold text-slate-900 dark:text-slate-100 metric-value mt-1">
                {totalCollaborators}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">Personal registrado</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold tracking-wider block">
                En Turno Activo
              </span>
              <div className="text-3xl font-heading font-bold text-slate-900 dark:text-slate-100 metric-value mt-1">
                {activeCollaboratorsCount}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">Con jornada abierta</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold tracking-wider block">
                Validaciones Biométricas
              </span>
              <div className="text-3xl font-heading font-bold text-slate-900 dark:text-slate-100 metric-value mt-1">
                {biometricVerifiedCount}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">Marcaciones con Facial OK</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 uppercase font-heading font-semibold tracking-wider block">
                Horas Consolidadas
              </span>
              <div className="text-3xl font-heading font-bold text-slate-900 dark:text-slate-100 metric-value mt-1">
                {totalConsolidatedHours} hrs
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">En la vista actual</span>
            </div>
          </div>
        )}
      </header>

      {/* Contenido Principal */}
      {resolvedRhTab === 'my_checkin' && effectiveModules.checkIn ? (
        <CheckinPanel />
      ) : !effectiveModules.reports ? (
        <div className="py-12 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-heading font-bold text-slate-900 dark:text-slate-100">
            Módulo de Reportes Deshabilitado por Administración TI
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            El administrador de TI desactivó temporalmente la visualización de reportes para tu cuenta.
          </p>
        </div>
      ) : (
        <section id="time-summary-view" className="w-full">
          {/* Barra de Filtros Limpia */}
          <div
            id="filter-user-select"
            className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800"
          >
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="bg-white dark:bg-[#0B111E] text-slate-900 dark:text-slate-200 text-sm border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded focus:outline-none focus:border-blue-600 dark:focus:border-sky-400 placeholder:text-slate-500 min-w-[240px]"
              />

              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="bg-white dark:bg-[#0B111E] text-slate-700 dark:text-slate-300 text-sm border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded focus:outline-none focus:border-blue-600 dark:focus:border-sky-400"
              >
                <option value="">Todos los equipos</option>
                {availableTeams.map((team) => (
                  <option key={team.value} value={team.value}>
                    {team.label}
                  </option>
                ))}
              </select>

              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
                className="bg-white dark:bg-[#0B111E] text-slate-700 dark:text-slate-300 text-sm border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded focus:outline-none focus:border-blue-600 dark:focus:border-sky-400"
              >
                <option value="all">Todos los registros</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="custom">Personalizado</option>
              </select>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white dark:bg-[#0B111E] text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded text-xs"
                  />
                  <span>a</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white dark:bg-[#0B111E] text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded text-xs"
                  />
                </div>
              )}
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              Mostrando registros consolidados de asistencia ({filteredAttendance.length})
            </div>
          </div>

          {/* Tabla General de Asistencias */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Equipo</th>
                  <th className="py-3 px-4">Entrada</th>
                  <th className="py-3 px-4">Salida</th>
                  <th className="py-3 px-4 text-center">Biometría</th>
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4 text-right">Jornada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-sm">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 px-4 text-center text-xs text-slate-600 dark:text-slate-400"
                    >
                      No se encontraron registros de asistencia con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((record) => {
                    const confidencePct = record.checkIn.confidenceScore
                      ? Math.round(
                          record.checkIn.confidenceScore <= 1
                            ? record.checkIn.confidenceScore * 100
                            : record.checkIn.confidenceScore
                        )
                      : 96;

                    return (
                      <tr
                        key={record.id}
                        onClick={() =>
                          setDrawerState({
                            isOpen: true,
                            collaboratorEmail: record.userEmail,
                            initialRecordId: record.id,
                          })
                        }
                        title="Haz clic para abrir el expediente de asistencia y ubicación en mapa"
                        className="hover:bg-slate-100/70 dark:hover:bg-[#172238]/60 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-[#1D4ED8] dark:group-hover:text-sky-400 transition-colors">
                            {record.userName}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {record.userEmail}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {record.teamName}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            Sup: {record.supervisorName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-800 dark:text-slate-200">
                          {formatCheckTimestamp(record.checkIn.timestamp)}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-800 dark:text-slate-200">
                          {record.checkOut ? (
                            formatCheckTimestamp(record.checkOut.timestamp)
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[11px] font-sans font-medium bg-slate-100 dark:bg-[#1E2B45] text-[#1D4ED8] dark:text-sky-400 border border-slate-300 dark:border-slate-700 rounded">
                              En turno
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {record.checkIn.facialMatch ? (
                            <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-[#1D4ED8] dark:text-sky-400 border border-slate-300 dark:border-slate-700 rounded">
                              Facial OK ({confidencePct}%)
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-[#1E2B45] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded">
                              Manual / Sin coincidencia
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                          {formatLocationSummary(
                            record.checkIn.location.label,
                            record.checkIn.location.latitude,
                            record.checkIn.location.longitude
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-900 dark:text-slate-100 font-semibold">
                          {record.totalHours.toFixed(1)} hrs
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <FacialEnrollmentModal
        isOpen={isRecalibrateOpen}
        onClose={() => setIsRecalibrateOpen(false)}
        mode="recalibrate"
        endpointTarget="me"
        onEnrollmentComplete={() => setIsRecalibrateOpen(false)}
      />

      <UserAttendanceDrawer
        isOpen={drawerState.isOpen}
        onClose={() =>
          setDrawerState({
            isOpen: false,
            collaboratorEmail: null,
            initialRecordId: null,
          })
        }
        collaboratorEmail={drawerState.collaboratorEmail}
        allRecords={consolidatedAttendance}
        initialRecordId={drawerState.initialRecordId}
      />
    </div>
  );
}
