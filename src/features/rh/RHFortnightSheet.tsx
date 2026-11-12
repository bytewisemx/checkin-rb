import { useState, useMemo, Fragment } from 'react';
import {
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import type { RHAttendanceRecord } from '../../services/rbac';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore, type AbsenceJustification } from '../../store/useCheckinStore';
import { useAuditStore } from '../../store/useAuditStore';

export interface RHFortnightSheetProps {
  allRecords: RHAttendanceRecord[];
  onOpenRecordDetail: (userEmail: string, recordId?: string) => void;
}

interface DayCellData {
  dayNumber: number;
  dayName: string;
  dateStr: string;
  isWeekend: boolean;
  isToday: boolean;
  isFuture: boolean;
  status: 'present' | 'late' | 'absence' | 'justified' | 'weekend' | 'future';
  lateMinutes?: number;
  hoursWorked?: number;
  recordId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  justification?: AbsenceJustification;
}

interface CollaboratorSheetRow {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  teamName: string;
  supervisorName: string;
  totalHours: number;
  latesCount: number;
  absencesCount: number;
  justifiedCount: number;
  days: Record<number, DayCellData>;
}

interface TeamGroup {
  teamName: string;
  supervisorName: string;
  collaborators: CollaboratorSheetRow[];
}

const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const JUSTIFICATION_REASONS: Array<{
  type: AbsenceJustification['reasonType'];
  label: string;
  defaultCredit: number;
  description: string;
}> = [
  {
    type: 'medical',
    label: 'Incapacidad Médica (IMSS)',
    defaultCredit: 8.0,
    description: 'Comprobante médico oficial o incapacidad expedida por el IMSS.',
  },
  {
    type: 'vacation',
    label: 'Vacaciones Autorizadas',
    defaultCredit: 8.0,
    description: 'Periodo vacacional formalmente programado y aprobado.',
  },
  {
    type: 'paid_leave',
    label: 'Permiso Especial con Goce de Sueldo',
    defaultCredit: 8.0,
    description: 'Permiso administrativo autorizado por la dirección.',
  },
  {
    type: 'commission',
    label: 'Comisión Laboral / Visita a Cliente',
    defaultCredit: 8.0,
    description: 'Jornada laboral en campo o en oficinas de clientes.',
  },
  {
    type: 'unpaid_leave',
    label: 'Permiso sin Goce de Sueldo',
    defaultCredit: 0.0,
    description: 'Inasistencia autorizada pero sin remuneración de jornada.',
  },
  {
    type: 'other',
    label: 'Causa de Fuerza Mayor / Otra',
    defaultCredit: 8.0,
    description: 'Contingencia o situación extraordinaria justificada por RH.',
  },
];

function getInitials(name: string): string {
  if (!name) return 'US';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export function RHFortnightSheet({ allRecords, onOpenRecordDetail }: RHFortnightSheetProps) {
  const { teamMembers } = useRayonerStore();
  const {
    user,
    absenceJustifications,
    setAbsenceJustification,
    removeAbsenceJustification,
    addToast,
  } = useCheckinStore();

  // Estados de control de periodo
  const [selectedFortnight, setSelectedFortnight] = useState<1 | 2>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(10); // Noviembre (0-indexed: 10)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});

  // Estado del Modal de Justificación de Inasistencia
  const [modalData, setModalData] = useState<{
    collaborator: { id: string; name: string; email: string; team: string; role: string };
    dayData: DayCellData;
    resolution: 'justified' | 'unjustified';
    reasonType: AbsenceJustification['reasonType'];
    hoursCredit: number;
    notes: string;
  } | null>(null);

  // Cálculo de los días del periodo
  const daysInPeriod = useMemo(() => {
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startDay = selectedFortnight === 1 ? 1 : 16;
    const endDay = selectedFortnight === 1 ? 15 : lastDayOfMonth;

    const days: number[] = [];
    for (let d = startDay; d <= endDay; d++) {
      days.push(d);
    }
    return days;
  }, [selectedFortnight, selectedMonth, selectedYear]);

  // Lista única de equipos disponibles para el filtro
  const availableTeams = useMemo(() => {
    const teamsSet = new Set<string>();
    teamMembers.forEach((m) => {
      if (m.team) teamsSet.add(m.team);
    });
    return Array.from(teamsSet);
  }, [teamMembers]);

  // Construcción de la matriz quincenal de colaboradores agrupados por equipo
  const groupedData = useMemo<TeamGroup[]>(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    // 1. Obtener lista de colaboradores evaluados (Empleados y Supervisores no TI)
    const evaluatedCollaborators = teamMembers.filter((m) => m.role !== 'TI');

    // Mapeo de registros de checada por email y fecha (YYYY-MM-DD)
    const recordByEmailAndDate = new Map<string, RHAttendanceRecord>();
    allRecords.forEach((rec) => {
      const recDate = new Date(rec.checkIn.timestamp);
      if (!Number.isNaN(recDate.getTime())) {
        const dateKey = `${rec.userEmail.toLowerCase()}_${recDate.getFullYear()}-${String(
          recDate.getMonth() + 1
        ).padStart(2, '0')}-${String(recDate.getDate()).padStart(2, '0')}`;
        recordByEmailAndDate.set(dateKey, rec);
      }
    });

    const collaboratorsRows: CollaboratorSheetRow[] = evaluatedCollaborators.map((member) => {
      let totalHours = 0;
      let latesCount = 0;
      let absencesCount = 0;
      let justifiedCount = 0;
      const daysMap: Record<number, DayCellData> = {};

      daysInPeriod.forEach((dayNum) => {
        const dateObj = new Date(selectedYear, selectedMonth, dayNum);
        const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
        const dayName = DAY_NAMES[dayOfWeek];
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const isToday =
          selectedYear === currentYear &&
          selectedMonth === currentMonth &&
          dayNum === currentDay;

        const isFuture =
          selectedYear > currentYear ||
          (selectedYear === currentYear && selectedMonth > currentMonth) ||
          (selectedYear === currentYear && selectedMonth === currentMonth && dayNum > currentDay);

        const formattedDateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const recordLookupKey = `${member.email.toLowerCase()}_${formattedDateKey}`;

        const existingRecord = recordByEmailAndDate.get(recordLookupKey);
        const existingJustification = absenceJustifications?.[recordLookupKey];

        let status: DayCellData['status'] = 'future';
        let lateMinutes = 0;
        let hoursWorked = 0;

        if (isWeekend) {
          status = 'weekend';
        } else if (isFuture) {
          status = 'future';
        } else if (existingRecord) {
          // Asistencia real registrada
          hoursWorked = existingRecord.totalHours || 8.5;
          totalHours += hoursWorked;

          // Detección de retardo: entrada posterior a las 09:15
          const inDate = new Date(existingRecord.checkIn.timestamp);
          const inHour = inDate.getHours();
          const inMinutes = inDate.getMinutes();
          const totalInMinutes = inHour * 60 + inMinutes;
          const standardStartMinutes = 9 * 60; // 09:00

          if (totalInMinutes > standardStartMinutes + 15) {
            status = 'late';
            lateMinutes = Math.min(totalInMinutes - standardStartMinutes, 90);
            latesCount++;
          } else {
            status = 'present';
          }
        } else {
          // Día entre semana SIN checada registrada
          if (existingJustification) {
            if (existingJustification.status === 'justified') {
              status = 'justified';
              hoursWorked = existingJustification.hoursCredit ?? 8.0;
              totalHours += hoursWorked;
              justifiedCount++;
            } else {
              status = 'absence';
              absencesCount++;
            }
          } else if (isToday) {
            // Hoy aún sin checada cerrada: asistencia activa simulada
            status = 'present';
            hoursWorked = 7.5;
            totalHours += hoursWorked;
          } else {
            // Día pasado sin checada:
            // Por defecto en demo simulamos asistencia general con algunas faltas/retardos
            const pseudoRandom = (member.id.charCodeAt(0) + dayNum) % 8;
            if (pseudoRandom === 1) {
              status = 'late';
              lateMinutes = 15 + ((dayNum * 5) % 25);
              hoursWorked = 8.0;
              totalHours += hoursWorked;
              latesCount++;
            } else if (pseudoRandom === 6 && dayNum < 5) {
              status = 'absence';
              absencesCount++;
            } else {
              status = 'present';
              hoursWorked = 8.5;
              totalHours += hoursWorked;
            }
          }
        }

        daysMap[dayNum] = {
          dayNumber: dayNum,
          dayName,
          dateStr: formattedDateKey,
          isWeekend,
          isToday,
          isFuture,
          status,
          lateMinutes: lateMinutes > 0 ? lateMinutes : undefined,
          hoursWorked,
          recordId: existingRecord?.id,
          checkInTime: existingRecord?.checkIn?.timestamp,
          checkOutTime: existingRecord?.checkOut?.timestamp ?? undefined,
          justification: existingJustification,
        };
      });

      return {
        userId: member.id,
        userName: member.name,
        userEmail: member.email,
        role: member.role || 'Empleado',
        teamName: member.team || 'Equipo Operativo',
        supervisorName: 'Supervisor Prueba',
        totalHours: Number(totalHours.toFixed(1)),
        latesCount,
        absencesCount,
        justifiedCount,
        days: daysMap,
      };
    });

    // 2. Agrupar por Equipo de Trabajo
    const groupsMap = new Map<string, CollaboratorSheetRow[]>();
    collaboratorsRows.forEach((row) => {
      const teamKey = row.teamName;
      if (selectedTeamFilter !== 'ALL' && teamKey !== selectedTeamFilter) return;

      if (!groupsMap.has(teamKey)) {
        groupsMap.set(teamKey, []);
      }
      groupsMap.get(teamKey)!.push(row);
    });

    const groups: TeamGroup[] = [];
    groupsMap.forEach((collabs, teamName) => {
      groups.push({
        teamName,
        supervisorName: collabs[0]?.supervisorName || 'Supervisor Líder',
        collaborators: collabs,
      });
    });

    return groups;
  }, [
    teamMembers,
    allRecords,
    absenceJustifications,
    daysInPeriod,
    selectedFortnight,
    selectedMonth,
    selectedYear,
    selectedTeamFilter,
  ]);

  const toggleTeamCollapse = (teamName: string) => {
    setCollapsedTeams((prev) => ({
      ...prev,
      [teamName]: !prev[teamName],
    }));
  };

  // Abrir modal para justificar o evaluar inasistencia
  const handleOpenJustificationModal = (
    c: CollaboratorSheetRow,
    dayData: DayCellData
  ) => {
    const existing = dayData.justification;
    setModalData({
      collaborator: {
        id: c.userId,
        name: c.userName,
        email: c.userEmail,
        team: c.teamName,
        role: c.role,
      },
      dayData,
      resolution: existing ? existing.status : 'justified',
      reasonType: existing ? existing.reasonType : 'medical',
      hoursCredit: existing ? existing.hoursCredit : 8.0,
      notes: existing?.notes || '',
    });
  };

  // Guardar resolución de inasistencia (justificada o no)
  const handleSaveJustification = () => {
    if (!modalData) return;

    const reasonObj = JUSTIFICATION_REASONS.find((r) => r.type === modalData.reasonType);
    const reasonLabel =
      modalData.resolution === 'justified'
        ? reasonObj?.label || 'Permiso Justificado'
        : 'Falta Injustificada';

    setAbsenceJustification({
      userId: modalData.collaborator.id,
      userEmail: modalData.collaborator.email,
      dateKey: modalData.dayData.dateStr,
      status: modalData.resolution,
      reasonType: modalData.reasonType,
      reasonLabel,
      notes: modalData.notes.trim() || undefined,
      hoursCredit: modalData.resolution === 'justified' ? modalData.hoursCredit : 0,
      justifiedBy: user?.name || 'Recursos Humanos',
    });

    // Registrar en Bitácora de Auditoría para Socios y TI
    useAuditStore.getState().logAuditEvent({
      eventType: 'ATTENDANCE_ADJUSTED',
      actorId: user?.id || 'rh-01',
      actorName: user?.name || 'Recursos Humanos',
      actorEmail: user?.email || '',
      actorRole: user?.role || 'RH',
      targetResource: `Jornada: ${modalData.dayData.dateStr}`,
      targetUserId: modalData.collaborator.id,
      targetUserName: modalData.collaborator.name,
      previousValue: modalData.dayData.status,
      newValue: modalData.resolution === 'justified' ? 'Justificada' : 'Injustificada',
      details: `Ajuste de inasistencia: ${reasonLabel}. ${modalData.notes || ''}`.trim(),
    });

    addToast(
      modalData.resolution === 'justified'
        ? `Inasistencia del día ${modalData.dayData.dayNumber} justificada como "${reasonLabel}" para ${modalData.collaborator.name}.`
        : `Día ${modalData.dayData.dayNumber} registrado como FALTA INJUSTIFICADA para ${modalData.collaborator.name}.`,
      modalData.resolution === 'justified' ? 'success' : 'error'
    );

    setModalData(null);
  };

  // Remover justificación registrada
  const handleRemoveJustification = () => {
    if (!modalData) return;
    removeAbsenceJustification(modalData.collaborator.email, modalData.dayData.dateStr);
    addToast(
      `Se eliminó la resolución de inasistencia del día ${modalData.dayData.dayNumber} para ${modalData.collaborator.name}.`,
      'info'
    );
    setModalData(null);
  };

  // Exportar matriz a Excel (CSV con UTF-8 BOM)
  const handleExportExcel = () => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const monthName = monthNames[selectedMonth];
    const fortnightLabel = selectedFortnight === 1 ? '1ra_Quincena' : '2da_Quincena';

    const headers = [
      'Colaborador',
      'Correo',
      'Equipo',
      'Rol',
      'Total Horas',
      'Retardos',
      'Faltas',
      'Justificadas',
      ...daysInPeriod.map((d) => {
        const dateObj = new Date(selectedYear, selectedMonth, d);
        return `"${DAY_NAMES[dateObj.getDay()]} ${d}"`;
      }),
    ];

    const rows: string[][] = [];
    groupedData.forEach((group) => {
      group.collaborators.forEach((c) => {
        const row = [
          `"${c.userName}"`,
          `"${c.userEmail}"`,
          `"${c.teamName}"`,
          `"${c.role}"`,
          `${c.totalHours} hrs`,
          `${c.latesCount}`,
          `${c.absencesCount}`,
          `${c.justifiedCount}`,
          ...daysInPeriod.map((d) => {
            const dayData = c.days[d];
            if (!dayData) return '""';
            if (dayData.status === 'present') return '"Asistencia (✓)"';
            if (dayData.status === 'late') return `"Retardo (+${dayData.lateMinutes}m)"`;
            if (dayData.status === 'justified') return `"Justificada (${dayData.justification?.reasonLabel || 'Permiso'})"`;
            if (dayData.status === 'absence') return '"Falta (✗)"';
            if (dayData.status === 'weekend') return '"Descanso (—)"';
            return '"Pendiente"';
          }),
        ];
        rows.push(row);
      });
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sabana_Asistencia_${fortnightLabel}_${monthName}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* 1. Barra de Herramientas y Filtro Quincenal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0B111E] p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Quincena */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSelectedFortnight(1)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                selectedFortnight === 1
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              1ª Quincena (1 - 15)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFortnight(2)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                selectedFortnight === 2
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              2ª Quincena (16 - Fin de Mes)
            </button>
          </div>

          {/* Selector Mes/Año */}
          <select
            value={`${selectedMonth}-${selectedYear}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split('-').map(Number);
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            className="text-xs font-medium py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600"
          >
            <option value="10-2026">Noviembre 2026</option>
            <option value="9-2026">Octubre 2026</option>
            <option value="8-2026">Septiembre 2026</option>
          </select>

          {/* Selector de Equipo */}
          <select
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
            className="text-xs font-medium py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600"
          >
            <option value="ALL">Todos los Equipos</option>
            {availableTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>

        {/* Botón de Exportación Excel */}
        <button
          type="button"
          onClick={handleExportExcel}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Quincena (Excel)
        </button>
      </div>

      {/* Leyenda Visual de Códigos de Prenómina */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-2 rounded-lg border border-slate-200/60 dark:border-slate-800 flex-wrap">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Códigos:</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-[10px]">✓</span> Asistencia puntual</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-[10px]">25m</span> Retardo</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[10px]">J</span> Falta Justificada</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-rose-50 text-rose-700 font-bold flex items-center justify-center text-[10px]">✗</span> Falta Injustificada</span>
        <span className="inline-flex items-center gap-1"><span className="text-slate-400 font-bold">—</span> Descanso</span>
        <span className="text-slate-400 italic ml-auto hidden sm:inline">Haz clic en ✗ o J para justificar o modificar inasistencias.</span>
      </div>

      {/* 2. Tabla Sábana Quincenal Horizontal */}
      <div className="w-full bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left border-collapse table-fixed text-xs">
            {/* Definición estricta de anchos de columna para evitar desalineamiento de thead y tbody */}
            <colgroup>
              <col style={{ width: '240px' }} />
              <col style={{ width: '75px' }} />
              <col style={{ width: '115px' }} />
              {daysInPeriod.map((dayNum) => (
                <col key={dayNum} style={{ width: '48px' }} />
              ))}
            </colgroup>

            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {/* Columna fija: Colaborador */}
                <th className="py-3 px-4 sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-r border-slate-200 dark:border-slate-800">
                  Colaborador
                </th>
                {/* Columna Horas */}
                <th className="py-3 px-2 text-center w-[75px] border-r border-slate-100 dark:border-slate-800">
                  Horas
                </th>
                {/* Columna Incidencias */}
                <th className="py-3 px-2 text-center w-[115px] border-r border-slate-200 dark:border-slate-800">
                  Incidencias
                </th>

                {/* Columnas de los días del periodo con nombre del día y número */}
                {daysInPeriod.map((dayNum) => {
                  const dateObj = new Date(selectedYear, selectedMonth, dayNum);
                  const dayOfWeek = dateObj.getDay();
                  const dayName = DAY_NAMES[dayOfWeek];
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isToday =
                    dayNum === 10 && selectedMonth === 10 && selectedYear === 2026;

                  return (
                    <th
                      key={dayNum}
                      className={`py-2 px-1 text-center w-[48px] border-r border-slate-100 dark:border-slate-800/60 ${
                        isToday
                          ? 'font-bold text-blue-700 dark:text-sky-300 bg-blue-50/90 dark:bg-blue-950/70 border-x-2 border-x-blue-400 dark:border-x-blue-600'
                          : isWeekend
                          ? 'bg-slate-100/70 dark:bg-slate-800/50 text-slate-400'
                          : ''
                      }`}
                      title={`${dayName} ${dayNum} de Noviembre`}
                    >
                      <div className="text-[9px] font-semibold uppercase tracking-tighter opacity-75">
                        {dayName}
                      </div>
                      <div className="text-xs font-bold mt-0.5">
                        {dayNum}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {groupedData.length === 0 ? (
                <tr>
                  <td colSpan={daysInPeriod.length + 3} className="py-10 text-center text-slate-400">
                    No se encontraron colaboradores en el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                groupedData.map((group) => {
                  const isCollapsed = Boolean(collapsedTeams[group.teamName]);

                  return (
                    <Fragment key={group.teamName}>
                      {/* Fila Encabezado de Equipo Colapsable */}
                      <tr
                        onClick={() => toggleTeamCollapse(group.teamName)}
                        className="bg-slate-50/75 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-slate-200/60 dark:border-slate-800"
                      >
                        <td
                          colSpan={daysInPeriod.length + 3}
                          className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-200 text-xs tracking-wide"
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="uppercase text-[11px] font-bold text-blue-700 dark:text-sky-400">
                              {group.teamName}
                            </span>
                            <span className="text-slate-400 font-normal">
                              • Líder: {group.supervisorName} ({group.collaborators.length} {group.collaborators.length === 1 ? 'colaborador' : 'colaboradores'})
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Filas de Colaboradores del Equipo */}
                      {!isCollapsed &&
                        group.collaborators.map((c) => (
                          <tr
                            key={c.userId}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            {/* Columna fija: Colaborador */}
                            <td className="py-2.5 px-4 sticky left-0 bg-white dark:bg-[#0B111E] z-10 w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-r border-slate-200 dark:border-slate-800">
                              <div
                                onClick={() => onOpenRecordDetail(c.userEmail)}
                                className="flex items-center gap-2.5 cursor-pointer group"
                                title="Abrir expediente del colaborador"
                              >
                                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {getInitials(c.userName)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 dark:text-white leading-tight truncate group-hover:text-blue-600 transition-colors">
                                    {c.userName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">{c.role}</div>
                                </div>
                              </div>
                            </td>

                            {/* Total Horas */}
                            <td className="p-2 text-center font-bold text-slate-800 dark:text-slate-200 bg-slate-50/40 dark:bg-slate-900/30 font-mono w-[75px] border-r border-slate-100 dark:border-slate-800">
                              {c.totalHours}h
                            </td>

                            {/* Incidencias con detalle de retardos, faltas y justificaciones */}
                            <td className="p-2 text-center text-[10px] w-[115px] border-r border-slate-200 dark:border-slate-800">
                              {c.latesCount === 0 && c.absencesCount === 0 && c.justifiedCount === 0 ? (
                                <span className="text-emerald-600 font-medium">0 inc.</span>
                              ) : (
                                <div className="flex flex-col items-center leading-tight">
                                  {c.latesCount > 0 && (
                                    <span className="text-amber-600 font-semibold">{c.latesCount} ret.</span>
                                  )}
                                  {c.absencesCount > 0 && (
                                    <span className="text-rose-600 font-semibold">{c.absencesCount} {c.absencesCount === 1 ? 'falta' : 'faltas'}</span>
                                  )}
                                  {c.justifiedCount > 0 && (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{c.justifiedCount} just.</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Celdas de Días */}
                            {daysInPeriod.map((d) => {
                              const dayData = c.days[d];
                              const isTodayCol =
                                d === 10 && selectedMonth === 10 && selectedYear === 2026;
                              const borderColClass = isTodayCol
                                ? 'border-x-2 border-x-blue-400 dark:border-x-blue-600 bg-blue-50/30 dark:bg-blue-950/20'
                                : 'border-r border-slate-100 dark:border-slate-800/60';

                              if (!dayData) {
                                return (
                                  <td key={d} className={`p-1 text-center w-[48px] ${borderColClass}`}>
                                    <span className="text-slate-300">·</span>
                                  </td>
                                );
                              }

                              // Fin de semana
                              if (dayData.status === 'weekend') {
                                return (
                                  <td
                                    key={d}
                                    className={`p-1 text-center bg-slate-100/60 dark:bg-slate-900/40 w-[48px] ${borderColClass}`}
                                    title={`${dayData.dayName} ${d} — Descanso`}
                                  >
                                    <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                                  </td>
                                );
                              }

                              // Día Futuro / Pendiente
                              if (dayData.status === 'future') {
                                return (
                                  <td
                                    key={d}
                                    className={`p-1 text-center w-[48px] ${borderColClass}`}
                                    title={`${dayData.dayName} ${d} — Pendiente`}
                                  >
                                    <span className="text-slate-300 dark:text-slate-600 font-bold">·</span>
                                  </td>
                                );
                              }

                              // FALTA JUSTIFICADA ('J')
                              if (dayData.status === 'justified') {
                                return (
                                  <td key={d} className={`p-1 text-center w-[48px] ${borderColClass}`}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenJustificationModal(c, dayData)}
                                      className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 font-bold text-[10px] cursor-pointer transition-colors"
                                      title={`${dayData.dayName} ${d}: Justificada por "${dayData.justification?.reasonLabel || 'Permiso'}" (+${dayData.hoursWorked || 8}h). Clic para gestionar.`}
                                    >
                                      J
                                    </button>
                                  </td>
                                );
                              }

                              // FALTA INJUSTIFICADA ('✗')
                              if (dayData.status === 'absence') {
                                return (
                                  <td key={d} className={`p-1 text-center w-[48px] ${borderColClass}`}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenJustificationModal(c, dayData)}
                                      className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 font-bold text-[10px] cursor-pointer transition-colors"
                                      title={`${dayData.dayName} ${d}: Falta injustificada / Sin checada. Clic para justificar inasistencia.`}
                                    >
                                      ✗
                                    </button>
                                  </td>
                                );
                              }

                              // Retardo
                              if (dayData.status === 'late') {
                                const retardoLabel =
                                  dayData.lateMinutes && dayData.lateMinutes > 60
                                    ? `+${Math.floor(dayData.lateMinutes / 60)}h`
                                    : `${dayData.lateMinutes || 15}m`;

                                return (
                                  <td key={d} className={`p-1 text-center w-[48px] ${borderColClass}`}>
                                    <button
                                      type="button"
                                      onClick={() => onOpenRecordDetail(c.userEmail, dayData.recordId)}
                                      className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-amber-50 text-amber-700 font-semibold text-[9px] hover:bg-amber-100 transition-colors cursor-pointer"
                                      title={`${dayData.dayName} ${d}: Retardo de +${dayData.lateMinutes || 15} min. Clic para ver expediente.`}
                                    >
                                      {retardoLabel}
                                    </button>
                                  </td>
                                );
                              }

                              // Asistencia Puntual ('✓')
                              const isTodayCell = dayData.isToday;

                              return (
                                <td key={d} className={`p-1 text-center w-[48px] ${borderColClass}`}>
                                  <button
                                    type="button"
                                    onClick={() => onOpenRecordDetail(c.userEmail, dayData.recordId)}
                                    className={`w-6 h-6 inline-flex items-center justify-center rounded-md font-semibold text-[11px] transition-colors cursor-pointer ${
                                      isTodayCell
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs ring-2 ring-emerald-400/50'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    }`}
                                    title={`${dayData.dayName} ${d}: Asistencia puntual (${dayData.hoursWorked || 8.5} hrs). Clic para abrir detalle.`}
                                  >
                                    ✓
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MODAL DE GESTIÓN Y JUSTIFICACIÓN DE INASISTENCIA */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {getInitials(modalData.collaborator.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Gestión de Inasistencia
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {modalData.collaborator.name} • {modalData.collaborator.role} ({modalData.collaborator.team})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalData(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fecha y Detalle de Inasistencia */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Fecha del Registro
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {modalData.dayData.dayName} {modalData.dayData.dayNumber} de Noviembre de {selectedYear}
                </span>
              </div>
              <div>
                {modalData.dayData.status === 'justified' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Justificada
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Falta Injustificada
                  </span>
                )}
              </div>
            </div>

            {/* Tipo de Resolución: Justificar vs Marcar Injustificada */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Resolución de Recursos Humanos
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalData((prev) => (prev ? { ...prev, resolution: 'justified', hoursCredit: 8.0 } : prev))
                  }
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    modalData.resolution === 'justified'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Justificar Inasistencia (J)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setModalData((prev) => (prev ? { ...prev, resolution: 'unjustified', hoursCredit: 0 } : prev))
                  }
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    modalData.resolution === 'unjustified'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <X className="w-4 h-4" />
                  Falta Injustificada (✗)
                </button>
              </div>
            </div>

            {/* Formulario de Justificación */}
            {modalData.resolution === 'justified' && (
              <div className="space-y-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Motivo Formal de Justificación
                  </label>
                  <select
                    value={modalData.reasonType}
                    onChange={(e) => {
                      const rType = e.target.value as AbsenceJustification['reasonType'];
                      const found = JUSTIFICATION_REASONS.find((r) => r.type === rType);
                      setModalData((prev) =>
                        prev
                          ? {
                              ...prev,
                              reasonType: rType,
                              hoursCredit: found?.defaultCredit ?? 8.0,
                            }
                          : prev
                      );
                    }}
                    className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-600"
                  >
                    {JUSTIFICATION_REASONS.map((r) => (
                      <option key={r.type} value={r.type}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horas a computar para nómina */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Horas a Acreditar en Nómina
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Horas sumadas al total quincenal del colaborador
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="12"
                      value={modalData.hoursCredit}
                      onChange={(e) =>
                        setModalData((prev) =>
                          prev ? { ...prev, hoursCredit: Number(e.target.value) } : prev
                        )
                      }
                      className="w-20 text-center font-bold font-mono text-xs py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <span className="text-xs font-medium text-slate-500">hrs</span>
                  </div>
                </div>

                {/* Comprobante / Folio */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Folio de Comprobante / Observaciones (Opcional)
                  </label>
                  <input
                    type="text"
                    value={modalData.notes}
                    onChange={(e) =>
                      setModalData((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                    }
                    placeholder="Ej. Folio IMSS #893481, Permiso con oficio DG-12..."
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              {modalData.dayData.justification ? (
                <button
                  type="button"
                  onClick={handleRemoveJustification}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Quitar Justificación
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalData(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveJustification}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Guardar Resolución
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
