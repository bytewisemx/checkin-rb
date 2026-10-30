import { useState, useMemo } from 'react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, ChevronRight, Clock, MapPin, 
  CheckSquare, Briefcase, ShieldCheck, 
  Calendar as CalendarIcon 
} from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';

export function UserCalendarView() {
  const { history, user, activeCheckin } = useCheckinStore();
  const { clients, projects, tasks, assignments, userTaskActualHours } = useRayonerStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Navegación de mes
  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Generar días del mes para el grid (empezando en Lunes)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Indexar historial de check-ins por fecha ISO (YYYY-MM-DD)
  const historyByDate = useMemo(() => {
    const map = new Map<string, typeof history[0]>();
    history.forEach(rec => {
      map.set(rec.date, rec);
    });
    // Si hoy está en jornada activa, incorporarlo
    if (activeCheckin) {
      map.set(activeCheckin.date, activeCheckin);
    }
    return map;
  }, [history, activeCheckin]);

  // Tareas asignadas al usuario actual
  const userTasks = useMemo(() => {
    const currentUserId = user?.id || 'usr-ana';
    const userAssignments = assignments.filter(a => a.userId === currentUserId || a.userId === 'usr-ana');
    const taskIds = new Set(userAssignments.map(a => a.taskId));
    return tasks.filter(t => taskIds.has(t.id));
  }, [tasks, assignments, user]);

  // Registro del día seleccionado
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedRecord = historyByDate.get(selectedDateStr) || null;

  // Formato de hora amigable
  const formatTime = (timeMs?: number | null) => {
    if (!timeMs) return '--:--';
    return format(new Date(timeMs), 'hh:mm a');
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 overflow-hidden">
      
      {/* Columna Izquierda: Calendario Mensual */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Cabecera del Calendario */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0D5C75] flex items-center justify-center border border-blue-100">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </h2>
              <p className="text-xs text-slate-500">
                Historial de asistencia y tareas trabajadas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToday}
              className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Hoy
            </button>
            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Días de la Semana */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-center py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mié</span>
          <span>Jue</span>
          <span>Vie</span>
          <span>Sáb</span>
          <span>Dom</span>
        </div>

        {/* Grid de Celdas del Calendario */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[520px]">
          {calendarDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayRecord = historyByDate.get(dateStr);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            // Tareas trabajadas en este día (muestra de asignaciones)
            const dayTasks = userTasks.slice(0, 2);

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(day)}
                className={`p-1.5 sm:p-2 min-h-[85px] sm:min-h-[105px] flex flex-col justify-between transition-all cursor-pointer select-none group relative ${
                  !isCurrentMonth ? 'bg-slate-50/40 text-slate-400' : 'bg-white hover:bg-blue-50/30'
                } ${isSelected ? 'ring-2 ring-inset ring-[#0D5C75] bg-blue-50/40 z-10' : ''}`}
              >
                {/* Número del día */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-[#0D5C75] text-white shadow-xs'
                        : isSelected
                          ? 'text-[#0D5C75] font-black'
                          : 'text-slate-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {dayRecord?.biometricMatchScore != null && (
                    <span title="Validado con Vector Biométrico 128D (Sin imágenes)">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </span>
                  )}
                </div>

                {/* Bloque de Asistencia (Llegada / Salida) */}
                <div className="space-y-1 my-1">
                  {dayRecord ? (
                    <div className="space-y-0.5">
                      {/* Entrada */}
                      <div className="flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 shrink-0" />
                        <span className="truncate">{formatTime(dayRecord.checkInTimeMs)}</span>
                      </div>

                      {/* Salida */}
                      {dayRecord.checkOutTimeMs ? (
                        <div className="flex items-center text-[10px] font-semibold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1 shrink-0" />
                          <span className="truncate">{formatTime(dayRecord.checkOutTimeMs)}</span>
                        </div>
                      ) : isToday ? (
                        <div className="flex items-center text-[10px] font-semibold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          <span>En jornada</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>

                {/* Píldoras de Tareas Trabajadas */}
                <div className="space-y-0.5">
                  {dayRecord && dayTasks.length > 0 && (
                    <div className="text-[9px] font-medium text-slate-500 bg-blue-50/70 border border-blue-100/80 px-1 py-0.5 rounded truncate">
                      {dayTasks[0].name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Columna Derecha: Detalle del Día Seleccionado */}
      <div className="w-full lg:w-96 flex flex-col space-y-4">
        
        {/* Tarjeta de Resumen del Día */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Detalle del Día
            </span>
            <h3 className="text-base font-black text-slate-900 capitalize mt-0.5">
              {format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </h3>
          </div>

          {/* Estado de Asistencia del Día */}
          {selectedRecord ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Llegada */}
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Llegada (Check-in)
                  </span>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">
                    {formatTime(selectedRecord.checkInTimeMs)}
                  </div>
                  <span className={`text-[10px] font-semibold ${selectedRecord.isLate ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {selectedRecord.isLate ? `Retardo (+${selectedRecord.minutesLate}m)` : 'Puntual ✓'}
                  </span>
                </div>

                {/* Salida */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Salida (Check-out)
                  </span>
                  <div className="text-lg font-black text-slate-800 mt-0.5">
                    {formatTime(selectedRecord.checkOutTimeMs)}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {selectedRecord.totalDurationMinutes 
                      ? `${Math.floor(selectedRecord.totalDurationMinutes / 60)}h ${selectedRecord.totalDurationMinutes % 60}m` 
                      : 'En curso'}
                  </span>
                </div>
              </div>

              {/* Ubicación y Validación Vectorial Biométrica (Sin almacenar imágenes) */}
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-[#0D5C75] mr-1.5 shrink-0" />
                  <span className="truncate">{selectedRecord.address || 'Oficina Russell Bedford'}</span>
                </div>

                {selectedRecord.biometricMatchScore != null && (
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/60">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1 text-[11px] font-bold text-emerald-700">
                        <span>Vector Facial Validado ({selectedRecord.biometricMatchScore}%)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Descriptor vectorial face_recognition_v1 (0 imágenes almacenadas)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-dashed border-slate-200 text-xs text-slate-400">
              <Clock className="w-6 h-6 mx-auto mb-1 text-slate-300" />
              <span>Sin registros de asistencia en esta fecha</span>
            </div>
          )}

        </div>

        {/* Tareas Trabajadas en la Fecha */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3 flex-1 flex flex-col">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center">
              <CheckSquare className="w-4 h-4 mr-1.5 text-[#0D5C75]" />
              Tareas Trabajadas
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {userTasks.length} disponibles
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {userTasks.map(task => {
              const project = projects.find(p => p.id === task.projectId);
              const client = clients.find(c => c.id === project?.clientId);
              const currentUserId = user?.id || 'usr-ana';
              const userKey = `${task.id}_${currentUserId}`;
              const userHours = userTaskActualHours[userKey] || 0;

              return (
                <div 
                  key={task.id}
                  className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 transition-colors text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-bold text-[#0D5C75] truncate max-w-[160px]">
                      {client?.name || 'Cliente'}
                    </span>
                    <span className="font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {userHours}h registradas
                    </span>
                  </div>

                  <h5 className="font-bold text-slate-800 line-clamp-1">
                    {task.name}
                  </h5>

                  <div className="text-[11px] text-slate-400 flex items-center">
                    <Briefcase className="w-3 h-3 mr-1 text-slate-400" />
                    <span className="truncate">{project?.name || 'Proyecto'}</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
}
