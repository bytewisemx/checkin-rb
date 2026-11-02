import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  X,
  Users,
  Coffee,
} from 'lucide-react';
import type { CheckinRecord, MockEmployee } from '../../store/useCheckinStore';

export interface AttendanceDetailData {
  date: string; // YYYY-MM-DD
  formattedDate: string; // ej: "Viernes, 16 de Octubre de 2026"
  record?: CheckinRecord | null;
  dayType?: 'workday' | 'weekend' | 'holiday';
  employeeRecords?: Array<{
    employee: MockEmployee;
    record: CheckinRecord;
  }>;
}

interface AttendanceDateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AttendanceDetailData | null;
  userName?: string;
  userRole?: string;
}

export function AttendanceDateDetailModal({
  isOpen,
  onClose,
  data,
  userName = 'Colaborador',
  userRole = 'Empleado',
}: AttendanceDateDetailModalProps) {
  if (!isOpen || !data) return null;

  const { date, formattedDate, record, employeeRecords } = data;

  const formatTime = (ms: number | null | undefined) => {
    if (!ms) return '—';
    const d = new Date(ms);
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatHoursMinutes = (totalMins: number | null | undefined) => {
    if (totalMins == null || totalMins <= 0) return '0h 00m';
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const hasRecord = Boolean(record && record.checkInTimeMs);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
    >
      <div
        className="relative w-full max-w-xl bg-[#131D31] text-[#F8FAFC] border border-[#233354] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#233354] bg-[#0F172A]/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-blue-600/10 text-[#38BDF8] border border-blue-500/20">
              <Calendar className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div>
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                Detalle de Asistencia Diaria
              </span>
              <h2 id="attendance-modal-title" className="text-base font-heading font-bold text-white capitalize">
                {formattedDate || date}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-white rounded-md transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Tarjeta de Registro Personal */}
          {hasRecord ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#233354]">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#38BDF8]" />
                  <span className="text-sm font-semibold text-white">
                    {userName} ({userRole})
                  </span>
                </div>

                {record?.isLate ? (
                  <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-sm bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Retardo ({record.minutesLate} min)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Puntual</span>
                  </span>
                )}
              </div>

              {/* Grid con Horarios y Métricas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-md bg-[#1A2742] border border-[#233354]">
                  <span className="text-[10px] text-[#94A3B8] block uppercase font-heading font-semibold">
                    Entrada
                  </span>
                  <span className="text-sm font-bold text-white mt-0.5 block font-mono">
                    {formatTime(record?.checkInTimeMs)}
                  </span>
                </div>

                <div className="p-3 rounded-md bg-[#1A2742] border border-[#233354]">
                  <span className="text-[10px] text-[#94A3B8] block uppercase font-heading font-semibold">
                    Salida
                  </span>
                  <span className="text-sm font-bold text-white mt-0.5 block font-mono">
                    {record?.checkOutTimeMs ? formatTime(record.checkOutTimeMs) : 'En curso'}
                  </span>
                </div>

                <div className="p-3 rounded-md bg-[#1A2742] border border-[#233354]">
                  <span className="text-[10px] text-[#94A3B8] block uppercase font-heading font-semibold">
                    Total Horas
                  </span>
                  <span className="text-sm font-bold text-[#38BDF8] mt-0.5 block font-mono">
                    {formatHoursMinutes(record?.totalDurationMinutes)}
                  </span>
                </div>
              </div>

              {/* Validación Biométrica y Ubicación */}
              <div className="space-y-2 text-xs text-[#94A3B8]">
                <div className="flex items-center space-x-2 p-2.5 rounded-md bg-[#0F172A] border border-[#233354]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">
                    Verificación Facial Vectorial:
                    <strong className="text-white ml-1">
                      {record?.biometricMatchScore ? `${record.biometricMatchScore}% coincidencia` : '100% calibrado'}
                    </strong>
                    {record?.biometricDistance != null && (
                      <span className="text-slate-400 ml-1">(distancia={record.biometricDistance})</span>
                    )}
                  </span>
                </div>

                {record?.address && (
                  <div className="flex items-center space-x-2 p-2.5 rounded-md bg-[#0F172A] border border-[#233354]">
                    <MapPin className="w-4 h-4 text-[#38BDF8] shrink-0" />
                    <span className="text-slate-300">
                      Ubicación de registro: <span className="text-white">{record.address}</span>
                    </span>
                  </div>
                )}

                {record?.pauses && record.pauses.length > 0 && (
                  <div className="flex items-center space-x-2 p-2.5 rounded-md bg-[#0F172A] border border-[#233354]">
                    <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-slate-300">
                      Pausas / descansos: {record.pauses.length} intervalo(s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                Sin registro de jornada personal para este día
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                No se encontró un check-in completado para el {formattedDate || date}. Podría corresponder a un día de descanso, fin de semana o ausencia.
              </p>
            </div>
          )}

          {/* Listado de Colaboradores si es Supervisor o RH */}
          {employeeRecords && employeeRecords.length > 0 && (
            <div className="pt-3 border-t border-[#233354]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-xs font-heading font-semibold text-[#38BDF8]">
                  <Users className="w-4 h-4" />
                  <span>Asistencia del Equipo en esta Fecha ({employeeRecords.length})</span>
                </div>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {employeeRecords.map(({ employee, record: empRec }) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-2.5 rounded-md bg-[#1A2742] border border-[#233354] text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white block">{employee.name}</span>
                      <span className="text-[11px] text-[#94A3B8]">{employee.team}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-white block">
                        {formatTime(empRec.checkInTimeMs)} - {empRec.checkOutTimeMs ? formatTime(empRec.checkOutTimeMs) : 'En curso'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          empRec.isLate ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {empRec.isLate ? `Retardo (${empRec.minutesLate}m)` : 'Puntual'} • {formatHoursMinutes(empRec.totalDurationMinutes)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie de página */}
        <div className="px-6 py-3 border-t border-[#233354] bg-[#0F172A]/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold rounded-md transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
