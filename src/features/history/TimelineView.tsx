import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCheckinStore } from '../../store/useCheckinStore';
import { MapPin, Clock, ArrowRight, Hourglass } from 'lucide-react';

export function TimelineView() {
  const { history, activeCheckin } = useCheckinStore();

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
        <Clock className="w-6 h-6 mr-2 text-rb-navy" />
        Agenda de Hoy
      </h2>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        
        {/* Active Checkin Block */}
        {activeCheckin && (
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-slide-up">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-rb-turquoise shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
            </div>
            
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl glass-dark">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-white">Jornada Activa</span>
                <span className="text-xs text-white/80">
                  Desde {format(new Date(activeCheckin.checkInTime!), 'HH:mm', { locale: es })}
                </span>
              </div>
              {activeCheckin.address && (
                <div className="flex items-center text-xs text-white/80 mt-2 bg-white/10 px-2 py-1.5 rounded w-fit">
                  <MapPin className="w-3 h-3 mr-1.5 text-rb-turquoise" />
                  <span className="line-clamp-1">{activeCheckin.address}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Blocks */}
        {history.filter(h => h.checkOutTime).map((record) => {
          const hrs = Math.floor((record.totalDurationMinutes || 0) / 60);
          const mins = (record.totalDurationMinutes || 0) % 60;
          
          return (
            <div key={record.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-slide-up opacity-90 hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-200 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <div className="w-2 h-2 bg-slate-400 rounded-full group-hover:bg-rb-navy transition-colors" />
              </div>
              
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col space-y-2 text-sm">
                  <div className="flex justify-between items-center text-slate-800">
                    <span className="font-medium text-rb-navy">Jornada Completada</span>
                    <span className="text-xs font-semibold text-slate-500 flex items-center">
                      <Hourglass className="w-3 h-3 mr-1" />
                      {hrs}h {mins}m
                    </span>
                  </div>
                  
                  <div className="flex items-center text-slate-500 font-mono text-xs bg-slate-50 p-1.5 rounded w-fit">
                    <span>{format(new Date(record.checkInTime!), 'HH:mm')}</span>
                    <ArrowRight className="w-3 h-3 mx-2 text-slate-300" />
                    <span>{format(new Date(record.checkOutTime!), 'HH:mm')}</span>
                  </div>
                  
                  {record.address && (
                    <div className="flex items-start text-xs text-slate-400 mt-1">
                      <MapPin className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{record.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {history.length === 0 && !activeCheckin && (
          <div className="text-center py-10 text-slate-400 animate-fade-in">
            Aún no has registrado actividad el día de hoy.
          </div>
        )}

      </div>
    </div>
  );
}
