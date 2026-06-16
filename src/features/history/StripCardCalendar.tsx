import { useCheckinStore } from '../../store/useCheckinStore';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export function StripCardCalendar() {
  const { history } = useCheckinStore();
  const today = new Date();
  
  // Generamos un arreglo de 7 días donde HOY (índice 3) está en el centro
  const daysArray = Array.from({ length: 7 }).map((_, i) => addDays(today, i - 3));

  const getDayRecord = (dateObj: Date) => {
    const isoStr = dateObj.toISOString().split('T')[0];
    return history.filter(r => r.date === isoStr);
  };

  return (
    <div className="w-full mt-6 pb-2">
      <div className="flex items-center justify-between mb-4 px-2">
        <h4 className="text-sm font-semibold text-slate-500">Historial Reciente</h4>
      </div>
      
      {/* Scroll horizontal Container - Clean & Light SaaS Architecture */}
      <div className="flex bg-white shadow-sm border border-slate-100 justify-start overflow-x-auto py-4 px-2 md:px-4 rounded-2xl no-scrollbar">
        {daysArray.map((dateObj, idx) => {
          const records = getDayRecord(dateObj);
          const isToday = dateObj.toDateString() === today.toDateString();
          const hasRecord = records.length > 0;
          
          let isLate = false;
          let maxMinutesLate = 0;
          records.forEach(r => { 
            if (r.isLate) {
              isLate = true;
              maxMinutesLate = Math.max(maxMinutesLate, r.minutesLate);
            }
          });

          // Estilo SaaS (Tonos Índigo, rounded-full como solicitó el usuario, o rounded-2xl suaves)
          return (
            <div 
              key={idx} 
              className={`flex group flex-shrink-0 mx-1.5 transition-all duration-300 cursor-pointer justify-center w-[4.5rem]
                rounded-full overflow-hidden border border-transparent
                ${isToday 
                  ? 'bg-indigo-50 border-indigo-100 shadow-sm' 
                  : 'bg-transparent hover:bg-slate-50 hover:border-slate-200'}
              `}
              title={hasRecord ? 'Ver detalles' : 'Sin registro'}
            >
              <div className="flex flex-col items-center justify-center py-5 w-full h-full relative">
                {/* Etiqueta de Día (Sun, Mon, etc.) */}
                <p className={`text-[11px] uppercase tracking-wide transition-all duration-300 font-semibold
                  ${isToday ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}
                `}>
                  {format(dateObj, 'E', { locale: es }).substring(0, 3)}
                </p>
                
                {/* Número del Día */}
                <p className={`mt-1.5 text-xl transition-all duration-300 font-bold
                  ${isToday ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-600'}
                `}>
                  {format(dateObj, 'dd')}
                </p>

                {/* Retardo o Estado */}
                {hasRecord && (
                  <div className="mt-2 text-[10px] text-center w-full">
                    {isLate ? (
                      <span className="text-red-500 font-bold tracking-tight">+{maxMinutesLate}m</span>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mx-auto" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
