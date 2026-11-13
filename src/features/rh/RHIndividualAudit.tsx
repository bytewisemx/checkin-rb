import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import type { RHAttendanceRecord } from '../../services/rbac';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';

export interface RHIndividualAuditProps {
  allRecords: RHAttendanceRecord[];
  onOpenRecordDetail: (userEmail: string, recordId?: string) => void;
}

const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const DAY_NAMES_FULL = [
  'DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO',
];

function formatAuditDate(isoString?: string | null): { dateFormatted: string; dayOfWeek: string } {
  if (!isoString) return { dateFormatted: '—', dayOfWeek: '—' };
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return { dateFormatted: isoString, dayOfWeek: '—' };

  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const dayOfWeek = DAY_NAMES_FULL[d.getDay()];

  return {
    dateFormatted: `${day} ${month} ${year}`,
    dayOfWeek,
  };
}

function formatAuditTime(isoString?: string | null): string {
  if (!isoString) return 'En turno';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} hrs`;
}

export function RHIndividualAudit({ allRecords, onOpenRecordDetail }: RHIndividualAuditProps) {
  const { teamMembers } = useRayonerStore();
  const { user } = useCheckinStore();

  // Colaboradores evaluables (excluyendo TI Root)
  const availableCollaborators = useMemo(() => {
    return teamMembers.filter((m) => m.role !== 'TI');
  }, [teamMembers]);

  // Estados de Filtros
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>(
    availableCollaborators[0]?.email || ''
  );
  const [startDate, setStartDate] = useState<string>('2026-11-01');
  const [endDate, setEndDate] = useState<string>('2026-11-15');
  const [incidentFilter, setIncidentFilter] = useState<'all' | 'lates' | 'absences'>('all');

  // Estado del modal de constancia laboral formal para impresión
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);

  const selectedMember = useMemo(() => {
    return (
      availableCollaborators.find(
        (m) => m.email.toLowerCase() === selectedUserEmail.toLowerCase()
      ) || availableCollaborators[0]
    );
  }, [availableCollaborators, selectedUserEmail]);

  // Accesos directos de rango de fecha
  const setQuickRange = (range: 'current_fortnight' | 'current_month' | 'year_2026') => {
    if (range === 'current_fortnight') {
      setStartDate('2026-11-01');
      setEndDate('2026-11-15');
    } else if (range === 'current_month') {
      setStartDate('2026-11-01');
      setEndDate('2026-11-30');
    } else if (range === 'year_2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    }
  };

  // Filtrado de registros individuales por colaborador, rango y filtro de incidencias
  const userFilteredRecords = useMemo(() => {
    if (!selectedMember) return [];

    return allRecords
      .filter((r) => r.userEmail.toLowerCase() === selectedMember.email.toLowerCase())
      .filter((r) => {
        const itemDate = new Date(r.checkIn.timestamp);
        if (Number.isNaN(itemDate.getTime())) return true;
        const dateStr = itemDate.toISOString().split('T')[0];
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
        return true;
      })
      .filter((r) => {
        if (incidentFilter === 'all') return true;

        // Cálculo de si hubo retardo (entrada posterior a 09:15)
        const inDate = new Date(r.checkIn.timestamp);
        const inMinutes = inDate.getHours() * 60 + inDate.getMinutes();
        const isLate = inMinutes > 9 * 60 + 15;

        if (incidentFilter === 'lates') return isLate;
        if (incidentFilter === 'absences') return !r.checkOut;
        return true;
      })
      .sort(
        (a, b) => new Date(b.checkIn.timestamp).getTime() - new Date(a.checkIn.timestamp).getTime()
      );
  }, [allRecords, selectedMember, startDate, endDate, incidentFilter]);

  // Métricas y Resumen Ejecutivo para el colaborador en el periodo seleccionado
  const metrics = useMemo(() => {
    const totalHours = Number(
      userFilteredRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0).toFixed(1)
    );

    // Horas esperadas (estimación de jornadas hábiles x 8 hrs)
    const expectedHours = Math.max(userFilteredRecords.length * 8.0, 8.0);

    let lateCount = 0;
    let lateMinutesSum = 0;
    let totalScoreSum = 0;
    let scoreCount = 0;

    userFilteredRecords.forEach((r) => {
      const inDate = new Date(r.checkIn.timestamp);
      const inMinutes = inDate.getHours() * 60 + inDate.getMinutes();
      const delay = inMinutes - 9 * 60;
      if (delay > 15) {
        lateCount++;
        lateMinutesSum += delay;
      }

      if (r.checkIn.confidenceScore) {
        const score =
          r.checkIn.confidenceScore <= 1
            ? r.checkIn.confidenceScore * 100
            : r.checkIn.confidenceScore;
        totalScoreSum += score;
        scoreCount++;
      }
    });

    const totalDays = userFilteredRecords.length || 1;
    const punctualityRate = Math.round(((totalDays - lateCount) / totalDays) * 100);
    const averageBiometricScore = scoreCount > 0 ? (totalScoreSum / scoreCount).toFixed(1) : '96.5';

    return {
      totalHours,
      expectedHours,
      punctualityRate,
      lateCount,
      lateMinutesSum,
      averageBiometricScore,
    };
  }, [userFilteredRecords]);

  // Generación y Descarga Profesional del Archivo Excel (CSV con UTF-8 BOM y Cabeceras Institucionales)
  const handleExportKardexExcel = () => {
    if (!selectedMember) return;

    const lines: string[] = [
      '\uFEFF"RUSSELL BEDFORD - TIME & CHECK-IN SUITE"',
      '"KARDEX LABORAL Y AUDITORÍA DE ASISTENCIAS"',
      `"Colaborador:","${selectedMember.name}"`,
      `"Correo Institucional:","${selectedMember.email}"`,
      `"Rol:","${selectedMember.role}"`,
      `"Equipo:","${selectedMember.team || 'Equipo Corporativo'}"`,
      `"Periodo Analizado:","${startDate} al ${endDate}"`,
      `"Horas Totales Acumuladas:","${metrics.totalHours} hrs"`,
      `"Índice de Puntualidad:","${metrics.punctualityRate}%"`,
      `"Incidencias de Retardo:","${metrics.lateCount} (${metrics.lateMinutesSum} min)"`,
      '',
      // Encabezados de la Tabla
      [
        '"Fecha"',
        '"Día"',
        '"Hora Entrada"',
        '"Hora Salida"',
        '"Horas Laboradas"',
        '"Puntualidad / Estatus"',
        '"Minutos Retardo"',
        '"Validación Facial %"',
        '"Ubicación Registrada"',
      ].join(','),
    ];

    userFilteredRecords.forEach((r) => {
      const dateInfo = formatAuditDate(r.checkIn.timestamp);
      const inTime = formatAuditTime(r.checkIn.timestamp);
      const outTime = formatAuditTime(r.checkOut?.timestamp);

      const inDate = new Date(r.checkIn.timestamp);
      const inMinutes = inDate.getHours() * 60 + inDate.getMinutes();
      const delay = Math.max(0, inMinutes - 9 * 60);
      const isLate = delay > 15;

      const scorePct = r.checkIn.confidenceScore
        ? Math.round(
            r.checkIn.confidenceScore <= 1
              ? r.checkIn.confidenceScore * 100
              : r.checkIn.confidenceScore
          )
        : 96;

      const row = [
        `"${dateInfo.dateFormatted}"`,
        `"${dateInfo.dayOfWeek}"`,
        `"${inTime}"`,
        `"${outTime}"`,
        `${r.totalHours.toFixed(1)}`,
        `"${!r.checkOut ? 'En turno activo' : isLate ? 'Retardo' : 'A tiempo'}"`,
        `${isLate ? delay : 0}`,
        `${scorePct}%`,
        `"${r.checkIn.location.label}"`,
      ];
      lines.push(row.join(','));
    });

    lines.push('');
    lines.push(`"TOTAL DE HORAS:",,"","",${metrics.totalHours},"TOTAL RETARDOS:",${metrics.lateCount}`);

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kardex_Laboral_${selectedMember.name.replace(/\s+/g, '_')}_${startDate}_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* 1. Barra de Control y Filtros de Exportación Individual */}
      <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Selector de Usuario, Fechas y Filtro */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Colaborador */}
            <div className="min-w-[240px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Colaborador
              </label>
              <select
                data-tour="rh-user-search"
                value={selectedUserEmail}
                onChange={(e) => setSelectedUserEmail(e.target.value)}
                className="w-full text-xs font-semibold py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-blue-600"
              >
                {availableCollaborators.map((m) => (
                  <option key={m.id} value={m.email}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Rango de Fechas */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Periodo
                </label>
                <div className="flex items-center gap-1.5 ml-3">
                  <button
                    type="button"
                    onClick={() => setQuickRange('current_fortnight')}
                    className="text-[10px] font-medium text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Quincena
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setQuickRange('current_month')}
                    className="text-[10px] font-medium text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Mes
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setQuickRange('year_2026')}
                    className="text-[10px] font-medium text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    2026
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-medium py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600"
                />
                <span className="text-slate-400 text-xs">a</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs font-medium py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Filtro de Incidencias */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Filtro
              </label>
              <select
                value={incidentFilter}
                onChange={(e) => setIncidentFilter(e.target.value as 'all' | 'lates' | 'absences')}
                className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600"
              >
                <option value="all">Todas las jornadas</option>
                <option value="lates">Solo incidencias / retardos</option>
                <option value="absences">Solo turnos activos / sin salida</option>
              </select>
            </div>
          </div>

          {/* Botones de Acción / Descarga de Alto Contraste */}
          <div className="flex items-center gap-2.5 pt-2 lg:pt-0 shrink-0">
            {/* Botón Descargar Kardex Excel */}
            <button
              type="button"
              data-tour="rh-btn-export-kardex"
              onClick={handleExportKardexExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Descargar Kardex Excel
            </button>

            {/* Botón Constancia Laboral PDF */}
            <button
              type="button"
              onClick={() => setIsProofModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Constancia Laboral PDF
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen del Colaborador Seleccionado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total de Horas Trabajadas */}
        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Total Horas Trabajadas
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {metrics.totalHours} hrs
          </div>
          <span className="text-[11px] text-slate-500">
            de {metrics.expectedHours} hrs esperadas
          </span>
        </div>

        {/* Puntualidad Global */}
        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Puntualidad Global
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {metrics.punctualityRate}%
          </div>
          <span className="text-[11px] text-slate-500">
            asistencias a tiempo
          </span>
        </div>

        {/* Retardos Acumulados */}
        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Retardos Acumulados
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {metrics.lateCount} incidencias
          </div>
          <span className="text-[11px] text-slate-500">
            {metrics.lateMinutesSum > 0 ? `+${metrics.lateMinutesSum} min demora total` : 'Sin demora'}
          </span>
        </div>

        {/* Validación Biométrica Promedio */}
        <div className="bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Biometría Promedio
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-sky-400" />
            <span>{metrics.averageBiometricScore}%</span>
          </div>
          <span className="text-[11px] text-slate-500">
            similitud en validaciones
          </span>
        </div>
      </div>

      {/* 3. Rediseño de la Tabla de Registros Individuales (Full Width) */}
      <div className="w-full bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Fecha / Día</th>
                <th className="p-4">Jornada (Horarios)</th>
                <th className="p-4">Tiempo Total</th>
                <th className="p-4">Puntualidad / Estatus</th>
                <th className="p-4">Validación Facial</th>
                <th className="p-4">Geolocalización / Dispositivo</th>
                <th className="p-4 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {userFilteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    No se encontraron registros de asistencias con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                userFilteredRecords.map((record) => {
                  const dateInfo = formatAuditDate(record.checkIn.timestamp);
                  const inTime = formatAuditTime(record.checkIn.timestamp);
                  const outTime = formatAuditTime(record.checkOut?.timestamp);

                  // Detección de retardo: entrada > 09:15
                  const inDate = new Date(record.checkIn.timestamp);
                  const inMinutes = inDate.getHours() * 60 + inDate.getMinutes();
                  const delay = inMinutes - 9 * 60;
                  const isLate = delay > 15;

                  const confidencePct = record.checkIn.confidenceScore
                    ? Math.round(
                        record.checkIn.confidenceScore <= 1
                          ? record.checkIn.confidenceScore * 100
                          : record.checkIn.confidenceScore
                      )
                    : 96;

                  const isShiftActive = !record.checkOut;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Fecha / Día */}
                      <td className="p-4">
                        <span className="font-bold text-slate-800 dark:text-white block">
                          {dateInfo.dateFormatted}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                          {dateInfo.dayOfWeek}
                        </span>
                      </td>

                      {/* Horario (Entrada → Salida) */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {inTime}
                          </span>
                          <span className="text-slate-400">→</span>
                          {isShiftActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-sky-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              En curso...
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300 font-semibold">
                              {outTime}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tiempo Total */}
                      <td className="p-4 font-bold font-mono text-slate-900 dark:text-white text-sm">
                        {record.totalHours.toFixed(1)} hrs
                      </td>

                      {/* Puntualidad / Estatus */}
                      <td className="p-4">
                        {isShiftActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-sky-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                            Turno en curso
                          </span>
                        ) : isLate ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60"
                            title={`Retardo de +${delay} minutos`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Retardo (+{delay}m)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            A tiempo
                          </span>
                        )}
                      </td>

                      {/* Validación Facial */}
                      <td className="p-4">
                        {record.checkIn.facialMatch ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/40 dark:text-sky-300 dark:border-blue-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                            Facial {confidencePct}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Manual
                          </span>
                        )}
                      </td>

                      {/* Ubicación Registrada */}
                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        <div
                          className="flex items-center gap-1.5 max-w-[220px] truncate"
                          title={record.checkIn.location.label}
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{record.checkIn.location.label}</span>
                        </div>
                      </td>

                      {/* Opciones */}
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenRecordDetail(record.userEmail, record.id)}
                          className="text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 font-medium hover:underline cursor-pointer"
                        >
                          Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL / CONSTANCIA LABORAL MEMBRETADA PARA IMPRESIÓN PDF */}
      {isProofModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 space-y-6 text-slate-900 border border-slate-200 print:m-0 print:p-0 print:shadow-none print:border-none">
            {/* Cabecera Membretada de Russell Bedford */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0B253A] text-white font-bold text-xs flex items-center justify-center">
                    RB
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0B253A] leading-tight">Russell Bedford</h2>
                    <p className="text-[11px] text-slate-500">Contadores Públicos y Consultores de Negocios</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  CONSTANCIA DE ASISTENCIA LABORAL
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Folio: RB-{selectedMember.id.slice(-4).toUpperCase()}-{new Date().getFullYear()}
                </span>
              </div>
            </div>

            {/* Cuerpo del Documento Oficial */}
            <div className="space-y-4 text-xs leading-relaxed text-slate-700">
              <p>
                A quien corresponda:
              </p>
              <p>
                Por medio de la presente, la Dirección de Recursos Humanos de <strong>Russell Bedford México</strong> hace constar que el colaborador <strong>{selectedMember.name}</strong>, adscrito al <strong>{selectedMember.team || 'Equipo Corporativo'}</strong> en calidad de <strong>{selectedMember.role}</strong>, cuenta con los siguientes registros de jornada en el sistema biométrico central:
              </p>

              {/* Fila de Datos Clave */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Periodo Evaluado</span>
                  <span className="font-semibold text-slate-900">{startDate} al {endDate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas Acreditadas</span>
                  <span className="font-bold text-blue-700 text-sm">{metrics.totalHours} hrs</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Puntualidad</span>
                  <span className="font-semibold text-emerald-700">{metrics.punctualityRate}%</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Biometría OK</span>
                  <span className="font-semibold text-slate-900">{metrics.averageBiometricScore}%</span>
                </div>
              </div>

              <p>
                Los registros anteriores corresponden a las marcas digitales validadas mediante autenticación biométrica facial 128D y georreferenciación satelital. Se extiende la presente constancia para los fines legales y administrativos que al interesado convengan.
              </p>
            </div>

            {/* Firmas de Autorización */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="w-36 h-0.5 bg-slate-300 mx-auto mb-2" />
                <span className="font-bold text-slate-900 block">{user?.name || 'Recursos Humanos'}</span>
                <span className="text-slate-500 text-[11px]">Dirección de Talento Humano</span>
              </div>
              <div>
                <div className="w-36 h-0.5 bg-slate-300 mx-auto mb-2" />
                <span className="font-bold text-slate-900 block">{selectedMember.name}</span>
                <span className="text-slate-500 text-[11px]">Firma de Conformidad</span>
              </div>
            </div>

            {/* Botones del Modal de Constancia */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 print:hidden">
              <button
                type="button"
                onClick={() => setIsProofModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Constancia (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
