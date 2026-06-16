import { useState } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import type { MockEmployee, MockEmployeeHistory } from '../../store/useCheckinStore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Users, Clock, MapPin, ChevronDown, ChevronUp, X, Map } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import L from 'leaflet';
import { CalendarView } from '../history/CalendarView';

// Fix para el icono de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente de Modal para el Mapa
function MapModal({ location, address, onClose }: { location: { lat: number; lng: number }; address: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden relative">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-rb-turquoise" />
            Ubicación Registrada
          </h3>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 bg-slate-50 text-sm text-slate-600 border-b border-slate-100">
          {address}
        </div>
        <div className="h-[400px] w-full">
          <MapContainer center={[location.lat, location.lng]} zoom={15} className="w-full h-full">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[location.lat, location.lng]}>
              <Popup>{address}</Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

// Componente para una fila de empleado expansible
function EmployeeRow({ employee, onOpenMap }: { employee: MockEmployee; onOpenMap: (loc: {lat: number, lng: number}, addr: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl mb-3 overflow-hidden bg-white shadow-sm hover:shadow transition-shadow">
      {/* Header Fila */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800">{employee.name}</span>
          <span className="text-xs text-slate-500 flex items-center mt-1">
            <span className={`w-2 h-2 rounded-full mr-2 ${employee.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
            {employee.status === 'active' ? 'Activo ahora' : 'Inactivo'}
          </span>
        </div>
        <div className="flex items-center text-slate-400">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {/* Detalle Historial (Expansible) */}
      {isExpanded && (
        <div className="bg-slate-50 border-t border-slate-100 p-2 sm:p-4">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            {/* El calendario ahora controla los modales de detalle y botones de mapa */}
            <CalendarView 
              employeeHistory={employee.history} 
              isSupervisorView={true} 
              onOpenMap={onOpenMap} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function SupervisorDashboard() {
  const { mockEmployeesData } = useCheckinStore();
  
  // Estado para el modal del mapa
  const [mapData, setMapData] = useState<{ location: {lat: number, lng: number}, address: string } | null>(null);

  // Agrupar por equipo
  const groupedByTeam = mockEmployeesData.reduce((acc, emp) => {
    const team = emp.team || 'Sin Equipo';
    if (!acc[team]) acc[team] = [];
    acc[team].push(emp);
    return acc;
  }, {} as Record<string, MockEmployee[]>);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 lg:p-6 space-y-8 animate-fade-in">
      
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            <Users className="w-6 h-6 mr-2 text-rb-navy" />
            Panel de Supervisión Administrativa
          </h2>
          <p className="text-sm text-slate-500 mt-1">Directorio de colaboradores y bitácora de asistencia.</p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedByTeam).map(([team, employees]) => (
          <div key={team} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-700 text-lg flex items-center">
                <span className="w-2 h-6 bg-rb-turquoise rounded-full mr-3"></span>
                Área: {team}
                <span className="ml-3 px-2 py-0.5 bg-white text-xs text-slate-500 rounded-full border border-slate-200 shadow-sm">
                  {employees.length} {employees.length === 1 ? 'colaborador' : 'colaboradores'}
                </span>
              </h3>
            </div>
            
            <div className="p-6">
              {employees.map(emp => (
                <EmployeeRow 
                  key={emp.id} 
                  employee={emp} 
                  onOpenMap={(loc, addr) => setMapData({ location: loc, address: addr })} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {mapData && (
        <MapModal 
          location={mapData.location} 
          address={mapData.address} 
          onClose={() => setMapData(null)} 
        />
      )}
    </div>
  );
}
