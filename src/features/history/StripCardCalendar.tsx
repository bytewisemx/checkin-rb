import { useState, useRef, useEffect, useMemo } from 'react';
import { useCheckinStore, type CheckinRecord } from '../../store/useCheckinStore';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  AlertCircle, 
  Clock, 
  MapPin, 
  X 
} from 'lucide-react';

interface DayDetailData {
  date: Date;
  hasRecord: boolean;
  entryTimeStr: string;
  exitTimeStr: string;
  isLate: boolean;
  minutesLate: number;
  isWeekend: boolean;
  address: string;
  isToday: boolean;
  isActiveNow: boolean;
}

export function StripCardCalendar() {
  const { history, activeCheckin } = useCheckinStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const today = useMemo(() => new Date(), []);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);

  // Fecha de referencia visual (año y mes seleccionados en la navegación)
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  // Generamos los días del mes visualizado: si es el mes actual, hasta hoy (o el mes completo)
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();
  const daysInMonthCount = new Date(currentYear, currentMonth + 1, 0).getDate();
  const maxDay = isCurrentMonth ? today.getDate() : daysInMonthCount;

  const daysToDisplay = useMemo(() => {
    const list: Date[] = [];
    for (let day = 1; day <= maxDay; day++) {
      list.push(new Date(currentYear, currentMonth, day));
    }
    return list;
  }, [currentYear, currentMonth, maxDay]);

  // Al cambiar de mes o al montar, desplazarse hacia el final (el día más reciente)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [daysToDisplay.length, viewDate]);

  // Navegación de mes con < y >
  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      // No permitir avanzar más allá del mes presente
      if (next > today) return prev;
      return next;
    });
  };

  const handleGoToToday = () => {
    setViewDate(new Date());
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          left: scrollRef.current.scrollWidth,
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  // Obtener la información del check-in para una fecha específica
  const getDayEntry = (dateObj: Date): DayDetailData => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const isoStr = `${y}-${m}-${d}`;

    const isToday = isSameDay(dateObj, today);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Si es hoy y hay check-in activo
    if (isToday && activeCheckin) {
      const entryTime = activeCheckin.checkInTimeMs
        ? format(new Date(activeCheckin.checkInTimeMs), 'hh:mm a')
        : '09:00 AM';
      return {
        date: dateObj,
        hasRecord: true,
        entryTimeStr: entryTime,
        exitTimeStr: 'En curso...',
        isLate: Boolean(activeCheckin.isLate || activeCheckin.minutesLate > 0),
        minutesLate: activeCheckin.minutesLate || 0,
        isWeekend,
        address: activeCheckin.address || 'Oficina Corporativa Central, CDMX',
        isToday: true,
        isActiveNow: true,
      };
    }

    const records = history.filter((r) => r.date === isoStr);

    if (records.length === 0) {
      // Mock específico histórico si aplica
      if (dateObj.getDate() === 16 && dateObj.getMonth() === 9 && dateObj.getFullYear() === 2026) {
        return {
          date: dateObj,
          hasRecord: true,
          entryTimeStr: '09:58 AM',
          exitTimeStr: '07:30 PM',
          isLate: true,
          minutesLate: 58,
          isWeekend: false,
          address: 'Av. Insurgentes Sur 1602, Benito Juárez, CDMX',
          isToday,
          isActiveNow: false,
        };
      }

      return {
        date: dateObj,
        hasRecord: false,
        entryTimeStr: '—',
        exitTimeStr: '—',
        isLate: false,
        minutesLate: 0,
        isWeekend,
        address: isWeekend ? 'Día de descanso laboral' : 'Sin registro de asistencia',
        isToday,
        isActiveNow: false,
      };
    }

    // Tomar el check-in más temprano del día
    const validRecordsWithTime = records.filter((r) => r.checkInTimeMs);
    const primaryRecord: CheckinRecord =
      validRecordsWithTime.length > 0
        ? validRecordsWithTime.reduce((earliest, cur) =>
            cur.checkInTimeMs! < earliest.checkInTimeMs! ? cur : earliest
          , validRecordsWithTime[0])
        : records[0];

    const entryTimeStr = primaryRecord.checkInTimeMs
      ? format(new Date(primaryRecord.checkInTimeMs), 'hh:mm a')
      : '09:00 AM';

    const exitTimeStr = primaryRecord.checkOutTimeMs
      ? format(new Date(primaryRecord.checkOutTimeMs), 'hh:mm a')
      : isToday ? 'En curso...' : '07:00 PM';

    return {
      date: dateObj,
      hasRecord: true,
      entryTimeStr,
      exitTimeStr,
      isLate: Boolean(primaryRecord.isLate || primaryRecord.minutesLate > 0),
      minutesLate: primaryRecord.minutesLate || 0,
      isWeekend,
      address: primaryRecord.address || 'Corporativo Russell Bedford, CDMX',
      isToday,
      isActiveNow: isToday && Boolean(activeCheckin),
    };
  };

  // Formato sobrio de Mes y Año: "Noviembre 2026"
  const monthTitle = format(viewDate, 'MMMM yyyy', { locale: es });
  const formattedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs animate-fade-in space-y-3.5 select-none">
      {/* 1. Cabecera Minimalista y Sobria */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          {formattedMonthTitle}
        </h3>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handleGoToToday}
            className="text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Ir al día de hoy"
          >
            Hoy
          </button>

          <div className="flex items-center space-x-0.5 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Mes anterior"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Mes siguiente"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tira Horizontal de Tarjetas de Día Esbeltas */}
      <div
        ref={scrollRef}
        className="flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth py-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {daysToDisplay.map((dateObj, idx) => {
          const entry = getDayEntry(dateObj);
          const dayName = format(dateObj, 'E', { locale: es }).toUpperCase().slice(0, 3);
          const dayNumber = format(dateObj, 'd');
          const isToday = isSameDay(dateObj, today);

          return (
            <button
              key={idx}
              type="button"
              style={{ scrollSnapAlign: 'start' }}
              onClick={() => setSelectedDayDetail(entry)}
              className={`flex flex-col items-center justify-between py-2 px-1.5 min-w-[56px] h-20 rounded-xl transition-all duration-200 cursor-pointer shrink-0 border ${
                isToday
                  ? 'border-2 border-blue-600 bg-blue-50/20 text-blue-600 dark:border-blue-500 dark:bg-blue-950/20'
                  : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/50'
              }`}
              title={`Ver detalle del ${dayName} ${dayNumber}`}
            >
              {/* Día de la semana */}
              <span
                className={`text-[10px] font-semibold tracking-wider ${
                  isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {dayName}
              </span>

              {/* Número de día */}
              <span
                className={`text-base font-bold tracking-tight ${
                  isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'
                }`}
              >
                {dayNumber}
              </span>

              {/* Estado visual en un solo icono minimalista en la base */}
              <div className="flex items-center justify-center h-4">
                {entry.hasRecord ? (
                  entry.isLate ? (
                    <span 
                      className="w-4 h-4 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center p-0.5"
                      title={`Retardo: +${entry.minutesLate}m`}
                    >
                      <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span 
                      className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center p-0.5"
                      title="Asistencia puntual a tiempo"
                    >
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  )
                ) : (
                  <span className="w-3 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full my-1.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Modal / Popover de Detalle al Dar Clic */}
      {selectedDayDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setSelectedDayDetail(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Detalle */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Detalle de Asistencia
                </p>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white capitalize mt-0.5">
                  {format(selectedDayDetail.date, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </h4>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Badge de Puntualidad */}
            <div>
              {selectedDayDetail.hasRecord ? (
                selectedDayDetail.isLate ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50">
                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                    Retardo (+{selectedDayDetail.minutesLate} min)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/50">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    A tiempo
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {selectedDayDetail.isWeekend ? 'Día de Descanso' : 'Sin Registro'}
                </span>
              )}
            </div>

            {/* Bloques de Horarios: Entrada y Salida */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Entrada</span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {selectedDayDetail.entryTimeStr}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Salida</span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {selectedDayDetail.exitTimeStr}
                </p>
              </div>
            </div>

            {/* Ubicación de Registro */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                  Ubicación de Marcaje
                </p>
                <p className="text-slate-700 dark:text-slate-200 font-medium mt-0.5 leading-relaxed">
                  {selectedDayDetail.address}
                </p>
              </div>
            </div>

            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={() => setSelectedDayDetail(null)}
              className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
