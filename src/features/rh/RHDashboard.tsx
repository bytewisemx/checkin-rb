import { useState, useMemo, useEffect } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import {
  getEffectiveModules,
  normalizeRole,
  type RHAttendanceRecord,
} from '../../services/rbac';
import {
  subscribeAttendanceFromFirestore,
  type AttendanceDocument,
} from '../../services/attendanceService';
import { syncUsersDirectoryFromFirestore } from '../../services/userService';
import { FacialEnrollmentModal } from '../checkin/FacialEnrollmentModal';
import { CheckinPanel } from '../checkin/CheckinPanel';
import { UserAttendanceDrawer } from './UserAttendanceDrawer';
import { RHFortnightSheet } from './RHFortnightSheet';
import { RHIndividualAudit } from './RHIndividualAudit';

export function RHDashboard() {
  const { user, getEffectiveUserModules, userPermissionsDirectory } = useCheckinStore();
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

  // 100% Real-Time Firestore (`attendance`): cero mocks ni historiales simulados
  const [firestoreAttendance, setFirestoreAttendance] = useState<AttendanceDocument[]>([]);

  useEffect(() => {
    void syncUsersDirectoryFromFirestore();
    const unsubscribe = subscribeAttendanceFromFirestore(
      (records) => {
        setFirestoreAttendance(records);
      },
      { listenerKey: 'rh-dashboard-attendance-realtime' }
    );
    return () => {
      unsubscribe();
    };
  }, [user?.id, user?.role]);

  // Consolidación estricta desde la colección real `attendance` en Firestore (0 registros si está vacía)
  const consolidatedAttendance = useMemo<RHAttendanceRecord[]>(() => {
    const records: RHAttendanceRecord[] = firestoreAttendance
      .filter((docRec) => Boolean(docRec.checkIn?.timestamp))
      .map((docRec) => {
        const dirEntry = userPermissionsDirectory[docRec.userId];
        const memberInfo = teamMembers.find(
          (m) => m.id === docRec.userId || (dirEntry?.email && m.email.toLowerCase() === dirEntry.email.toLowerCase())
        );
        const userEmail = dirEntry?.email || memberInfo?.email || '';
        const teamName = dirEntry?.teamName || dirEntry?.team || memberInfo?.team || 'Equipo Prueba';
        const supervisorId = dirEntry?.supervisorId || dirEntry?.supervisor_id || memberInfo?.supervisor_id;
        const supervisorObj = supervisorId
          ? userPermissionsDirectory[supervisorId] || teamMembers.find((s) => s.id === supervisorId)
          : null;

        const checkInTs = docRec.checkIn.timestamp;
        const checkOutTs = docRec.checkOut?.timestamp || null;
        const totalHrs =
          typeof docRec.totalMinutes === 'number' && docRec.totalMinutes > 0
            ? Number((docRec.totalMinutes / 60).toFixed(2))
            : 0;

        return {
          id: docRec.id,
          userName: docRec.userName || dirEntry?.name || memberInfo?.name || 'Colaborador',
          userEmail,
          teamName,
          supervisorName: supervisorObj?.name || 'Supervisor Prueba',
          supervisorId: supervisorId || undefined,
          checkIn: {
            timestamp: checkInTs,
            facialMatch: Boolean(docRec.checkIn.facialMatch),
            confidenceScore:
              typeof docRec.checkIn.confidenceScore === 'number' ? docRec.checkIn.confidenceScore : 0,
            location: {
              label: docRec.checkIn.locationLabel || 'Sin ubicación registrada',
              latitude: typeof docRec.checkIn.lat === 'number' ? docRec.checkIn.lat : 0,
              longitude: typeof docRec.checkIn.lng === 'number' ? docRec.checkIn.lng : 0,
            },
          },
          checkOut: checkOutTs
            ? {
                timestamp: checkOutTs,
                facialMatch: Boolean(docRec.checkIn.facialMatch),
                location: {
                  label: docRec.checkIn.locationLabel || 'Sin ubicación registrada',
                  latitude: typeof docRec.checkIn.lat === 'number' ? docRec.checkIn.lat : 0,
                  longitude: typeof docRec.checkIn.lng === 'number' ? docRec.checkIn.lng : 0,
                },
              }
            : null,
          totalHours: totalHrs,
        };
      })
      .sort((a, b) => new Date(b.checkIn.timestamp).getTime() - new Date(a.checkIn.timestamp).getTime());

    // Filtrado de aislamiento de equipos para RH asignado por TI
    const userRole = normalizeRole(user?.role);
    const assignedTeams = user?.assignedTeams || [];

    if (userRole === 'RH' && assignedTeams.length > 0) {
      return records.filter((rec) =>
        assignedTeams.some(
          (team) =>
            team === 'team-prueba-01' ||
            rec.teamName.toLowerCase().includes(team.toLowerCase()) ||
            team.toLowerCase().includes(rec.teamName.toLowerCase())
        )
      );
    }

    return records;
  }, [firestoreAttendance, userPermissionsDirectory, teamMembers, user?.role, user?.assignedTeams]);

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
          {user?.assignedTeams && user.assignedTeams.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11px] font-semibold text-slate-400">
                Visibilidad Aislada por TI:
              </span>
              <div className="flex flex-wrap gap-1">
                {user.assignedTeams.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
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
            data-tour="rh-kardex-tab"
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
