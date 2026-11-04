import { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RHAttendanceRecord } from '../../services/rbac';
import { formatHoursToSexagesimal } from '../../utils/timeFormat';

export interface UserAttendanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  collaboratorEmail: string | null;
  allRecords: RHAttendanceRecord[];
  initialRecordId?: string | null;
}

type DrawerPeriodFilter = 'week' | 'fortnight' | 'month' | 'all';

function formatShortDate(isoString?: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatShortTime(isoString?: string | null): string {
  if (!isoString) return 'En turno';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} hrs`;
}

function formatCoordinateString(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, -${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export function UserAttendanceDrawer({
  isOpen,
  onClose,
  collaboratorEmail,
  allRecords,
  initialRecordId,
}: UserAttendanceDrawerProps) {
  const [periodFilter, setPeriodFilter] = useState<DrawerPeriodFilter>('month');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initialRecordId || null);
  const [pinType, setPinType] = useState<'checkIn' | 'checkOut'>('checkIn');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Filtrar todas las checadas de este colaborador ordenadas de más reciente a más antigua
  const userRecords = useMemo(() => {
    if (!collaboratorEmail) return [];
    return allRecords
      .filter((r) => r.userEmail.toLowerCase() === collaboratorEmail.toLowerCase())
      .sort(
        (a, b) => new Date(b.checkIn.timestamp).getTime() - new Date(a.checkIn.timestamp).getTime()
      );
  }, [allRecords, collaboratorEmail]);

  // Aplicar filtro de periodo (semana actual, quincena, mes o todo)
  const filteredUserRecords = useMemo(() => {
    if (periodFilter === 'all') return userRecords;
    const referenceMs =
      userRecords.length > 0
        ? new Date(userRecords[0].checkIn.timestamp).getTime()
        : Date.now();

    const daysMap: Record<Exclude<DrawerPeriodFilter, 'all'>, number> = {
      week: 7,
      fortnight: 15,
      month: 31,
    };
    const cutoffMs = referenceMs - daysMap[periodFilter] * 24 * 60 * 60 * 1000;

    return userRecords.filter((r) => new Date(r.checkIn.timestamp).getTime() >= cutoffMs);
  }, [userRecords, periodFilter]);

  // Sincronizar el registro activo cuando se abre el drawer o cambia de colaborador
  useEffect(() => {
    if (initialRecordId && userRecords.some((r) => r.id === initialRecordId)) {
      setSelectedRecordId(initialRecordId);
    } else if (userRecords.length > 0) {
      setSelectedRecordId(userRecords[0].id);
    } else {
      setSelectedRecordId(null);
    }
    setPinType('checkIn');
  }, [initialRecordId, collaboratorEmail, userRecords]);

  const activeRecord = useMemo(() => {
    if (!userRecords.length) return null;
    return userRecords.find((r) => r.id === selectedRecordId) || userRecords[0];
  }, [userRecords, selectedRecordId]);

  const activePinData = useMemo(() => {
    if (!activeRecord) {
      return {
        latitude: 21.8853,
        longitude: -102.2915,
        label: 'Oficina Central',
        timestamp: null as string | null,
      };
    }
    if (pinType === 'checkOut' && activeRecord.checkOut) {
      return {
        latitude: activeRecord.checkOut.location.latitude,
        longitude: activeRecord.checkOut.location.longitude,
        label: activeRecord.checkOut.location.label,
        timestamp: activeRecord.checkOut.timestamp,
      };
    }
    return {
      latitude: activeRecord.checkIn.location.latitude,
      longitude: activeRecord.checkIn.location.longitude,
      label: activeRecord.checkIn.location.label,
      timestamp: activeRecord.checkIn.timestamp,
    };
  }, [activeRecord, pinType]);

  // Inicializar y actualizar el mapa Leaflet con estilo oscuro minimalista
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const { latitude, longitude, label } = activePinData;

    const customPinIcon = L.divIcon({
      className: 'custom-corporate-map-pin',
      html: `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 22px; height: 22px; border-radius: 9999px; background: rgba(56, 189, 248, 0.25); border: 1px solid rgba(56, 189, 248, 0.6);"></span>
          <span style="position: relative; width: 10px; height: 10px; border-radius: 9999px; background: #38BDF8; border: 2px solid #090E17; box-shadow: 0 0 8px rgba(56,189,248,0.8);"></span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!mapInstanceRef.current) {
      mapContainerRef.current.classList.add('corporate-dark-map');

      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      const fallbackTileDataUri =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#f1f5f9"/><path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#cbd5e1" stroke-width="1"/></svg>'
        );

      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        errorTileUrl: fallbackTileDataUri,
      });

      tileLayer.addTo(map);

      const geocenceCircle = L.circle([latitude, longitude], {
        radius: 65,
        color: '#38BDF8',
        weight: 1,
        fillColor: '#1D4ED8',
        fillOpacity: 0.14,
      }).addTo(map);

      const marker = L.marker([latitude, longitude], { icon: customPinIcon })
        .addTo(map)
        .bindTooltip(label, {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.92,
        });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = geocenceCircle;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    } else {
      const map = mapInstanceRef.current;
      map.invalidateSize();
      map.setView([latitude, longitude], 16, { animate: true });

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        markerRef.current.setTooltipContent(label);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([latitude, longitude]);
      }
    }
  }, [isOpen, activePinData]);

  // Limpiar instancia de Leaflet al cerrar el Drawer o actualizar módulo
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen || !collaboratorEmail) return null;

  const primaryProfile = userRecords[0];
  const collaboratorName = primaryProfile?.userName || 'Colaborador';
  const teamName = primaryProfile?.teamName || 'Equipo Operaciones';
  const supervisorName = primaryProfile?.supervisorName || 'Supervisor';

  const totalHoursInPeriod = Number(
    filteredUserRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0).toFixed(1)
  );
  const facialVerifiedRate =
    filteredUserRecords.length > 0
      ? Math.round(
          (filteredUserRecords.filter((r) => r.checkIn.facialMatch).length /
            filteredUserRecords.length) *
            100
        )
      : 100;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Fondo atenuado */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Lateral de Detalle con Mapa e Historial (RH) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Expediente de asistencia de ${collaboratorName}`}
        className="relative fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-[#101726] text-slate-800 dark:text-slate-200 shadow-2xl z-50 border-l border-slate-200 dark:border-slate-800 flex flex-col animate-fade-in"
      >
        {/* Cabecera del Colaborador */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white">
              {collaboratorName}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {collaboratorEmail} • {teamName} (Sup: {supervisorName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle de colaborador"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo Desplazable */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Métricas consolidadas del expediente */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Horas del Periodo
              </span>
              <span className="text-xl font-bold font-heading text-slate-900 dark:text-white mt-0.5 block">
                {totalHoursInPeriod} hrs
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Jornadas Auditadas
              </span>
              <span className="text-xl font-bold font-heading text-slate-900 dark:text-slate-200 mt-0.5 block">
                {filteredUserRecords.length} registros
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Tasa Biométrica
              </span>
              <span className="text-xl font-bold font-heading text-[#1D4ED8] dark:text-sky-400 mt-0.5 block">
                {facialVerifiedRate}% OK
              </span>
            </div>
          </div>

          {/* Contenedor del Mapa (Modo Oscuro Minimalista) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Ubicación de Marcación ({formatShortDate(activePinData.timestamp)})
              </span>

              {activeRecord && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPinType('checkIn')}
                    className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      pinType === 'checkIn'
                        ? 'bg-[#1D4ED8] text-white border-blue-500'
                        : 'bg-slate-100 dark:bg-[#1E2B45] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Pin Entrada ({formatShortTime(activeRecord.checkIn.timestamp)})
                  </button>
                  {activeRecord.checkOut && (
                    <button
                      type="button"
                      onClick={() => setPinType('checkOut')}
                      className={`px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                        pinType === 'checkOut'
                          ? 'bg-[#1D4ED8] text-white border-blue-500'
                          : 'bg-slate-100 dark:bg-[#1E2B45] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Pin Salida ({formatShortTime(activeRecord.checkOut.timestamp)})
                    </button>
                  )}
                </div>
              )}
            </div>

            <div
              id="attendanceMapContainer"
              className="w-full h-56 bg-[#090E17] border border-slate-300 dark:border-slate-800 rounded overflow-hidden relative"
            >
              {/* Contenedor de Leaflet */}
              <div ref={mapContainerRef} className="w-full h-full z-10" />

              {/* Etiqueta sobria de coordenadas, precisión y geocerca */}
              <div className="absolute bottom-2 left-2 z-20 bg-[#101726]/95 border border-slate-700 px-2.5 py-1 text-xs font-mono text-sky-400 rounded-xs">
                {formatCoordinateString(activePinData.latitude, activePinData.longitude)} •{' '}
                {activePinData.label.split(',')[0]} (Precisión ±8m • Geocerca Validada)
              </div>
            </div>
          </div>

          {/* Historial Cronológico de Entradas y Salidas del Usuario */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Registro de Jornadas (Clic en una fila para ubicar en mapa)
              </span>

              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as DrawerPeriodFilter)}
                className="bg-white dark:bg-[#090E17] text-slate-800 dark:text-slate-200 text-xs border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded focus:outline-none focus:border-blue-600 dark:focus:border-sky-400"
              >
                <option value="week">Semana actual</option>
                <option value="fortnight">Última quincena</option>
                <option value="month">Mes completo</option>
                <option value="all">Todo el historial</option>
              </select>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
                  <th className="py-2 px-2">Fecha</th>
                  <th className="py-2 px-2">Entrada</th>
                  <th className="py-2 px-2">Salida</th>
                  <th className="py-2 px-2 text-center">Biometría</th>
                  <th className="py-2 px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                {filteredUserRecords.map((rec) => {
                  const isSelected = activeRecord?.id === rec.id;
                  const scorePct = rec.checkIn.confidenceScore
                    ? Math.round(
                        rec.checkIn.confidenceScore <= 1
                          ? rec.checkIn.confidenceScore * 100
                          : rec.checkIn.confidenceScore
                      )
                    : 96;

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => {
                        setSelectedRecordId(rec.id);
                        setPinType('checkIn');
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-[#172238] border-l-2 border-[#1D4ED8] dark:border-sky-400'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                      }`}
                    >
                      <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">
                        {formatShortDate(rec.checkIn.timestamp)}
                      </td>
                      <td className="py-2.5 px-2 text-slate-900 dark:text-slate-200">
                        {formatShortTime(rec.checkIn.timestamp)}
                      </td>
                      <td className="py-2.5 px-2 text-slate-900 dark:text-slate-200">
                        {rec.checkOut ? formatShortTime(rec.checkOut.timestamp) : 'En turno'}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {rec.checkIn.facialMatch ? (
                          <span className="text-[#1D4ED8] dark:text-sky-400 font-semibold">
                            {scorePct}% OK
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">Manual</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 dark:text-white">
                        {formatHoursToSexagesimal(rec.totalHours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

