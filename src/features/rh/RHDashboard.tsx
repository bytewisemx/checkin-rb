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
import { RHFortnightSheet } from './RHFortnightSheet';
import { RHIndividualAudit } from './RHIndividualAudit';

export function RHDashboard() {
  const { user, getEffectiveUserModules, mockEmployeesData, history, activeCheckin } = useCheckinStore();
  const { teamMembers } = useRayonerStore();

  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);

  // Pestañas operativas principales de RH
  const [rhTab, setRhTab] = useState<'fortnight_sheet' | 'individual_audit' | 'my_checkin'>('fortnight_sheet');
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

  // Consolidación global de registros de asistencia (API + actividad en vivo + historial)
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

    // 3. Historial de colaboradores registrados en el sistema
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

      emp.history.forEach((h) => {
        const recordId = `hist-${emp.id}-${h.id}`;
        if (mapById.has(recordId)) return;

        const inMs = h.checkInTimeMs ?? Date.now();
        const inIso = new Date(inMs).toISOString();
        const outIso = h.checkOutTimeMs ? new Date(h.checkOutTimeMs).toISOString() : null;
        const hrs = Number(((h.totalDurationMinutes || 510) / 60).toFixed(1));
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

  const handleOpenRecordDetail = (userEmail: string, recordId?: string) => {
    setDrawerState({
      isOpen: true,
      collaboratorEmail: userEmail,
      initialRecordId: recordId || null,
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-6 font-sans space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* 1. Cabecera y Tabs Segmentados */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <span>Recursos Humanos</span>
            <span>/</span>
            <span className="text-blue-600 dark:text-sky-400 font-bold">Control de Asistencias</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Control General de Asistencias
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervisión de jornadas, incidencias biométricas y consolidación de nómina.
          </p>
        </div>

        {/* Pestañas de Vista Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setRhTab('fortnight_sheet')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              rhTab === 'fortnight_sheet'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sábana Quincenal por Equipo
          </button>

          <button
            type="button"
            onClick={() => setRhTab('individual_audit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              rhTab === 'individual_audit'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Historial y Auditoría por Colaborador
          </button>

          {effectiveModules.checkIn && (
            <button
              type="button"
              onClick={() => setRhTab('my_checkin')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                rhTab === 'my_checkin'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mi Asistencia
            </button>
          )}

          {/* Botón de actualizar registro facial: Solo visible cuando RH está en Mi Asistencia */}
          {rhTab === 'my_checkin' && (
            <button
              type="button"
              onClick={() => setIsRecalibrateOpen(true)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer ml-1"
            >
              Actualizar Mi Facial
            </button>
          )}
        </div>
      </div>

      {/* 2. Renderizado Condicional por Pestaña */}
      {rhTab === 'my_checkin' && effectiveModules.checkIn ? (
        <CheckinPanel />
      ) : rhTab === 'individual_audit' ? (
        <RHIndividualAudit
          allRecords={consolidatedAttendance}
          onOpenRecordDetail={handleOpenRecordDetail}
        />
      ) : (
        <RHFortnightSheet
          allRecords={consolidatedAttendance}
          onOpenRecordDetail={handleOpenRecordDetail}
        />
      )}

      {/* Modal de Calibración Facial (Solo para Mi Asistencia) */}
      <FacialEnrollmentModal
        isOpen={isRecalibrateOpen}
        onClose={() => setIsRecalibrateOpen(false)}
        mode="recalibrate"
        endpointTarget="me"
        onEnrollmentComplete={() => setIsRecalibrateOpen(false)}
      />

      {/* Drawer Lateral de Detalle con Mapa de Coordenadas GPS */}
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
