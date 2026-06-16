import { useState } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import type { CheckinRecord } from '../../store/useCheckinStore';
import { Calendar as CalendarIcon, AlertCircle, Clock, Map as MapIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CalendarViewProps {
  employeeHistory?: CheckinRecord[];
  isSupervisorView?: boolean;
  onOpenMap?: (location: {lat: number, lng: number}, address: string) => void;
}

export function CalendarView({ employeeHistory, isSupervisorView = false, onOpenMap }: CalendarViewProps) {
  const storeHistory = useCheckinStore(state => state.history);
  const history = employeeHistory || storeHistory;

  const [selectedDayRecords, setSelectedDayRecords] = useState<{ day: number, records: CheckinRecord[] } | null>(null);
  
  // Estado para controlar el mes que estamos viendo
  const [viewDate, setViewDate] = useState(new Date());

  const today = new Date();
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); 
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getRecordsForDay = (dayIndex: number) => {
    const dayStr = dayIndex.toString().padStart(2, '0');
    const monthStr = (currentMonth + 1).toString().padStart(2, '0');
    const targetDateIso = `${currentYear}-${monthStr}-${dayStr}`;
    return history.filter(r => r.date === targetDateIso);
  };

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  return (
    <div className="w-full max-w-2xl mx-auto p-2 sm:p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        
        {/* Cabecera del Calendario */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center text-rb-navy font-bold text-lg">
            <CalendarIcon className="w-5 h-5 mr-2" />
            <span className="capitalize">{viewDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200 bg-white shadow-sm"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => setViewDate(new Date())}
              disabled={isCurrentMonth}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors border ${isCurrentMonth ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' : 'bg-white text-rb-navy border-slate-200 hover:bg-slate-50 shadow-sm'}`}
            >
              Hoy
            </button>

            <button 
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200 bg-white shadow-sm"
              title="Mes Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
          {dayNames.map(day => (
            <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white/50 min-h-[100px] sm:min-h-[120px]"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const records = getRecordsForDay(day);
            const isToday = day === today.getDate();

            let totalMins = 0;
            let isLate = false;
            let lateMins = 0;

            records.forEach(r => {
              if (r.totalDurationMinutes) totalMins += r.totalDurationMinutes;
              if (r.isLate) {
                isLate = true;
                lateMins = Math.max(lateMins, r.minutesLate);
              }
            });

            const hours = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            const hasData = records.length > 0;

            return (
              <div 
                key={day} 
                onClick={() => hasData ? setSelectedDayRecords({ day, records }) : undefined}
                className={`bg-white p-2 min-h-[100px] sm:min-h-[120px] transition-all relative group
                  ${isToday ? 'bg-blue-50/50' : ''}
                  ${hasData ? 'cursor-pointer hover:bg-slate-50 ring-inset hover:ring-2 hover:ring-rb-turquoise/30' : ''}
                `}
              >
                <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-rb-turquoise' : 'text-slate-700'}`}>
                  {day}
                </div>

                {hasData && (
                  <div className="space-y-1">
                    {isLate && (
                      <div className="flex items-center text-[10px] leading-tight font-bold text-red-600 bg-red-50 p-1 rounded">
                        <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                        <span className="hidden sm:inline">+{lateMins}m tarde</span>
                        <span className="sm:hidden">+{lateMins}m</span>
                      </div>
                    )}
                    
                    {totalMins > 0 ? (
                      <div className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100 p-1 rounded text-center">
                        {hours}h {mins}m
                      </div>
                    ) : (
                      <div className="text-[9px] sm:text-[10px] font-medium text-amber-600 bg-amber-50 p-1 rounded text-center animate-pulse">
                        Activo
                      </div>
                    )}
                  </div>
                )}
                
                {/* Overlay flotante sutil para indicar clicabilidad */}
                {hasData && (
                  <div className="absolute inset-0 bg-rb-turquoise/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* MODAL / POPOVER de Detalles del Día (Superpuesto en pantalla completa o panel) */}
      {selectedDayRecords && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
            
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <CalendarIcon className="w-5 h-5 mr-2 text-rb-turquoise" />
                Detalle del Día {selectedDayRecords.day} de {today.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
              </h3>
              <button 
                onClick={() => setSelectedDayRecords(null)} 
                className="p-2 bg-white rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-100 max-h-[60vh] overflow-y-auto space-y-3">
              {selectedDayRecords.records.map((record, idx) => {
                const dateObj = new Date(record.date + 'T00:00:00');
                return (
                  <div key={record.id || idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-sm font-semibold text-slate-800 capitalize flex items-center">
                          {format(dateObj, 'EEEE, d MMM yyyy', { locale: es })}
                          {record.isLate && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">Retardo</span>}
                        </span>
                        <div className="flex items-center text-xs font-mono text-slate-500 mt-1.5">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          <div>
                            <div>Entrada: <strong className="text-slate-700">{record.checkInTimeMs ? format(new Date(record.checkInTimeMs), 'HH:mm') : 'N/A'}</strong></div>
                            {record.checkOutTimeMs && <div>Salida: <strong className="text-slate-700">{format(new Date(record.checkOutTimeMs), 'HH:mm')}</strong></div>}
                          </div>
                        </div>
                      </div>
                      
                      {record.totalDurationMinutes !== null && (
                        <div className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                          {Math.floor(record.totalDurationMinutes / 60)}h {record.totalDurationMinutes % 60}m
                        </div>
                      )}
                    </div>

                    {onOpenMap && record.location ? (
                      <button 
                        onClick={() => { 
                          setSelectedDayRecords(null); // Opcional: cerrar este modal para ver el mapa limpio, o dejarlo abierto
                          onOpenMap(record.location!, record.address || 'Ubicación Desconocida'); 
                        }}
                        className="w-full flex items-center justify-center px-4 py-2 mt-2 bg-slate-50 hover:bg-rb-turquoise hover:border-rb-turquoise hover:text-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        <MapIcon className="w-4 h-4 mr-2" />
                        Ver Localización GPS
                      </button>
                    ) : (
                      <div className="text-xs text-slate-400 italic text-center mt-2 p-2 bg-slate-50 rounded border border-dashed border-slate-200">
                        {onOpenMap ? 'Sin ubicación registrada' : 'Localización no disponible en esta vista'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
