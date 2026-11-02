import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Calendar,
  Clock,
  FolderKanban,
  Building2,
  CheckSquare,
  Users,
  Zap,
  ArrowRight,
  ScanFace,
  Moon,
  Sun,
  User as UserIcon,
  HelpCircle,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCheckinStore, type CheckinRecord } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { normalizeRole } from '../../services/rbac';
import {
  AttendanceDateDetailModal,
  type AttendanceDetailData,
} from './AttendanceDateDetailModal';

type SearchCategory =
  | 'all'
  | 'attendance'
  | 'projects'
  | 'clients'
  | 'tasks'
  | 'people'
  | 'shortcuts';

interface SearchPersonItem {
  id: string;
  name: string;
  email: string;
  team?: string;
  role?: string;
}

interface GlobalSearchBarProps {
  onOpenProfile?: () => void;
  onOpenHelp?: () => void;
  onOpenBiometrics?: () => void;
}

export function GlobalSearchBar({
  onOpenProfile,
  onOpenHelp,
  onOpenBiometrics,
}: GlobalSearchBarProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    user,
    history,
    activeCheckin,
    mockEmployeesData,
    theme,
    toggleTheme,
    addToast,
  } = useCheckinStore();

  const { clients, projects, tasks, teamMembers } = useRayonerStore();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedDateDetail, setSelectedDateDetail] = useState<AttendanceDetailData | null>(null);
  const [customDatePicker, setCustomDatePicker] = useState('');

  const normalizedRole = normalizeRole(user?.role);

  // Atajo global de teclado (Ctrl + K o Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formateador de fechas en español
  const formatFriendlyDate = (isoDate: string) => {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  // 1. Filtrado de Proyectos
  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects.slice(0, 4);
    const q = query.toLowerCase();
    return projects.filter((p) => {
      const clientName = clients.find((c) => c.id === p.clientId)?.name.toLowerCase() || '';
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        clientName.includes(q)
      );
    });
  }, [projects, clients, query]);

  // 2. Filtrado de Clientes
  const filteredClients = useMemo(() => {
    if (!query.trim()) return clients.slice(0, 4);
    const q = query.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.taxId && c.taxId.toLowerCase().includes(q))
    );
  }, [clients, query]);

  // 3. Filtrado de Tareas
  const filteredTasks = useMemo(() => {
    if (!query.trim()) return tasks.slice(0, 4);
    const q = query.toLowerCase();
    return tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.extraordinaryCategory && t.extraordinaryCategory.toLowerCase().includes(q))
    );
  }, [tasks, query]);

  // 4. Filtrado de Personas / Colaboradores
  const filteredPeople = useMemo(() => {
    const allPeople: SearchPersonItem[] = teamMembers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      team: m.team,
      role: m.role || 'Empleado',
    }));

    mockEmployeesData.forEach((emp) => {
      if (!allPeople.some((p) => p.id === emp.id || p.email.toLowerCase() === emp.email.toLowerCase())) {
        allPeople.push({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          team: emp.team,
          role: emp.role || 'Empleado',
        });
      }
    });

    if (!query.trim()) return allPeople.slice(0, 5);
    const q = query.toLowerCase();
    return allPeople.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.team && p.team.toLowerCase().includes(q)) ||
        (p.role && p.role.toLowerCase().includes(q))
    );
  }, [teamMembers, mockEmployeesData, query]);

  // 5. Filtrado de Asistencias por Fecha
  const filteredAttendanceDates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dateMap = new Map<string, CheckinRecord>();

    // Registros del historial personal
    history.forEach((rec) => {
      dateMap.set(rec.date, rec);
    });

    // Entrada especial fija de demo si es 16 de octubre de 2026
    if (!dateMap.has('2026-10-16')) {
      const demoCheckinTime = new Date(2026, 9, 16, 9, 58).getTime();
      const demoCheckOutTime = new Date(2026, 9, 16, 18, 0).getTime();
      dateMap.set('2026-10-16', {
        id: 'mock-oct-16',
        date: '2026-10-16',
        checkInTimeMs: demoCheckinTime,
        checkOutTimeMs: demoCheckOutTime,
        pauses: [],
        location: { lat: 19.4326, lng: -99.1332 },
        address: 'Russell Bedford CDMX',
        totalDurationMinutes: 482,
        clientIp: '189.200.10.15',
        isLate: true,
        minutesLate: 58,
        biometricMatchScore: 98,
        biometricDistance: 0.28,
      });
    }

    // Si hay check-in activo hoy
    if (activeCheckin) {
      dateMap.set(activeCheckin.date, activeCheckin);
    }

    const allDates = Array.from(dateMap.entries()).map(([dateStr, record]) => ({
      date: dateStr,
      record,
      formatted: formatFriendlyDate(dateStr),
    }));

    allDates.sort((a, b) => b.date.localeCompare(a.date));

    // Si no hay búsqueda o busca palabras genéricas de asistencia
    if (!q || q === 'asistencia' || q === 'asistencias' || q === 'fecha' || q === 'fechas') {
      return allDates.slice(0, 6);
    }

    // Palabras clave específicas
    if (q === 'hoy') {
      const todayIso = new Date().toISOString().split('T')[0];
      return allDates.filter((d) => d.date === todayIso);
    }

    if (q === 'ayer') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterdayIso = y.toISOString().split('T')[0];
      return allDates.filter((d) => d.date === yesterdayIso);
    }

    // Coincidencia por fecha ISO, número de día o nombre del mes
    return allDates.filter(
      (d) =>
        d.date.includes(q) ||
        d.formatted.toLowerCase().includes(q) ||
        (d.record.isLate && q.includes('retardo'))
    );
  }, [history, activeCheckin, query]);

  // 6. Accesos Directos del Sistema
  const shortcuts = useMemo(() => {
    const list = [
      {
        id: 'sc-checkin',
        title: 'Marcar Asistencia / Check-in',
        description: 'Abrir visor de entrada, salida y tiempo diario',
        icon: Clock,
        action: () => {
          navigate('/');
          addToast('Navegando a Registro de Asistencia', 'info');
        },
      },
      {
        id: 'sc-tasks',
        title: 'Mis Tareas Asignadas (Kanban)',
        description: 'Ver tablero de tareas activas, en revisión y finalizadas',
        icon: CheckSquare,
        action: () => {
          navigate('/tasks');
          addToast('Abriendo tablero de tareas', 'info');
        },
      },
      {
        id: 'sc-profile',
        title: 'Mi Perfil y Gamificación',
        description: 'Consultar medallas, puntos, temporada y ajustes personales',
        icon: UserIcon,
        action: () => {
          if (onOpenProfile) onOpenProfile();
        },
      },
      {
        id: 'sc-biometrics',
        title: 'Calibrar Vector Facial Biométrico',
        description: 'Actualizar modelo vectorial 128D sin fotos',
        icon: ScanFace,
        action: () => {
          if (onOpenBiometrics) {
            onOpenBiometrics();
          } else if (onOpenProfile) {
            onOpenProfile();
          }
        },
      },
      {
        id: 'sc-help',
        title: 'Centro de Asistencia y Guías',
        description: 'Tours interactivos paso a paso según tu rol',
        icon: HelpCircle,
        action: () => {
          if (onOpenHelp) onOpenHelp();
        },
      },
      {
        id: 'sc-theme',
        title: `Cambiar a Modo ${theme === 'dark' ? 'Claro' : 'Oscuro'}`,
        description: 'Alternar tonalidad visual de la plataforma',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => {
          toggleTheme();
          addToast(`Modo ${theme === 'dark' ? 'Claro' : 'Oscuro'} activado`, 'info');
        },
      },
    ];

    if (normalizedRole === 'TI') {
      list.push({
        id: 'sc-permissions',
        title: 'Matriz de Permisos y Módulos TI',
        description: 'Gestionar accesos individuales (/admin/users-permissions)',
        icon: Sliders,
        action: () => {
          navigate('/admin/users-permissions');
          addToast('Abriendo matriz de módulos TI', 'info');
        },
      });
    }

    if (normalizedRole === 'Supervisor' || normalizedRole === 'TI') {
      list.push({
        id: 'sc-tree',
        title: 'Árbol de Clientes / Proyectos / Tareas',
        description: 'Gestionar jerarquía corporativa y asignaciones',
        icon: FolderKanban,
        action: () => {
          navigate('/clients');
          addToast('Abriendo Árbol de Clientes y Proyectos', 'info');
        },
      });
    }

    if (!query.trim()) return list;

    const q = query.toLowerCase();
    return list.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (q === 'facial' && s.id === 'sc-biometrics') ||
        (q === 'asistencia' && s.id === 'sc-checkin') ||
        (q === 'perfil' && s.id === 'sc-profile') ||
        (q === 'tema' && s.id === 'sc-theme')
    );
  }, [query, theme, toggleTheme, navigate, addToast, onOpenProfile, onOpenHelp, onOpenBiometrics, normalizedRole]);

  // Manejador al seleccionar una fecha para ver asistencia
  const handleSelectDateAttendance = (isoDate: string, record?: CheckinRecord | null) => {
    // Buscar colaboradores para esta fecha si es Supervisor o RH
    let employeeRecords: AttendanceDetailData['employeeRecords'];

    if (normalizedRole === 'Supervisor' || normalizedRole === 'RH' || normalizedRole === 'TI') {
      employeeRecords = [];
      mockEmployeesData.forEach((emp) => {
        const empRec = (emp.history || []).find((h) => h.date === isoDate);
        if (empRec) {
          employeeRecords?.push({ employee: emp, record: empRec });
        }
      });
    }

    setSelectedDateDetail({
      date: isoDate,
      formattedDate: formatFriendlyDate(isoDate),
      record: record || null,
      employeeRecords,
    });

    setIsOpen(false);
  };

  // Manejador del datepicker personalizado
  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDatePicker) return;

    const foundRecord = history.find((h) => h.date === customDatePicker);
    handleSelectDateAttendance(customDatePicker, foundRecord);
  };

  // Totales para las pestañas
  const counts = {
    all:
      filteredAttendanceDates.length +
      filteredProjects.length +
      filteredClients.length +
      filteredTasks.length +
      filteredPeople.length +
      shortcuts.length,
    attendance: filteredAttendanceDates.length,
    projects: filteredProjects.length,
    clients: filteredClients.length,
    tasks: filteredTasks.length,
    people: filteredPeople.length,
    shortcuts: shortcuts.length,
  };

  return (
    <>
      <div ref={containerRef} className="relative w-full max-w-2xl">
        {/* Barra de Búsqueda Input */}
        <div className="relative w-full group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#38BDF8] transition-colors pointer-events-none" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Buscar proyectos, clientes, tareas o fecha de asistencia..."
            className="w-full bg-[#1A2742] text-[#F8FAFC] placeholder:text-[#64748B] text-xs rounded-md py-2 pl-9 pr-20 border border-[#233354] focus:border-[#38BDF8] focus:bg-[#131D31] focus:outline-none transition-all shadow-inner"
            aria-label="Buscar accesos directos, proyectos, clientes o fecha"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 text-[#94A3B8] hover:text-white transition-colors cursor-pointer rounded-sm"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[#94A3B8] bg-[#0F172A] border border-[#233354] rounded">
                <span className="text-[11px]">⌘</span>K
              </kbd>
            )}
          </div>
        </div>

        {/* Dropdown Flotante de Resultados */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#131D31] text-[#F8FAFC] border border-[#233354] rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in flex flex-col max-h-[75vh]">
            {/* Pestañas de Filtro Superior */}
            <div className="flex items-center space-x-1 p-2 border-b border-[#233354] bg-[#0F172A]/90 overflow-x-auto text-[11px] font-heading font-semibold scrollbar-thin">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                Todos ({counts.all})
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('attendance')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'attendance'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                <Calendar className="w-3 h-3 text-[#38BDF8]" />
                <span>Asistencia ({counts.attendance})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('projects')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'projects'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                <FolderKanban className="w-3 h-3 text-amber-400" />
                <span>Proyectos ({counts.projects})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('clients')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'clients'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                <Building2 className="w-3 h-3 text-emerald-400" />
                <span>Clientes ({counts.clients})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('tasks')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'tasks'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                <CheckSquare className="w-3 h-3 text-purple-400" />
                <span>Tareas ({counts.tasks})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('people')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'people'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                <Users className="w-3 h-3 text-sky-400" />
                <span>Equipo ({counts.people})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('shortcuts')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  activeCategory === 'shortcuts'
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A2742]'
                }`}
              >
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>Accesos ({counts.shortcuts})</span>
              </button>
            </div>

            {/* Contenedor scrolleable de resultados */}
            <div className="p-3 overflow-y-auto space-y-4">
              {/* SELECTOR RÁPIDO DE FECHA PARA ASISTENCIA */}
              {(activeCategory === 'all' || activeCategory === 'attendance') && (
                <div className="p-2.5 rounded-md bg-[#1A2742]/70 border border-[#233354] space-y-2">
                  <div className="flex items-center justify-between text-xs font-heading font-semibold text-[#38BDF8]">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Consultar Asistencia por Fecha Específica</span>
                    </div>
                    <span className="text-[10px] text-[#94A3B8]">Día exacto</span>
                  </div>

                  <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customDatePicker}
                      onChange={(e) => setCustomDatePicker(e.target.value)}
                      className="flex-1 bg-[#131D31] text-[#F8FAFC] border border-[#233354] rounded px-2.5 py-1.5 text-xs focus:border-[#38BDF8] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!customDatePicker}
                      className="px-3 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded text-xs font-heading font-semibold transition-colors cursor-pointer"
                    >
                      Ver Asistencia
                    </button>
                  </form>
                </div>
              )}

              {/* SECCIÓN 1: ASISTENCIAS Y FECHAS ENCONTRADAS */}
              {(activeCategory === 'all' || activeCategory === 'attendance') &&
                filteredAttendanceDates.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                      <span>Registro de Asistencia por Fecha</span>
                      <span>Clic para ver desglose</span>
                    </div>

                    <div className="space-y-1">
                      {filteredAttendanceDates.map(({ date, formatted, record }) => (
                        <div
                          key={date}
                          onClick={() => handleSelectDateAttendance(date, record)}
                          className="group flex items-center justify-between p-2 rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 rounded bg-blue-600/10 text-[#38BDF8] group-hover:bg-[#1E40AF] group-hover:text-white transition-colors">
                              <Calendar className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-white capitalize block">
                                {formatted}
                              </span>
                              <span className="text-[11px] text-[#94A3B8]">
                                {record.checkInTimeMs ? (
                                  <>
                                    Entrada: {new Date(record.checkInTimeMs).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    {' • '}
                                    {record.totalDurationMinutes ? `${Math.floor(record.totalDurationMinutes / 60)}h ${record.totalDurationMinutes % 60}m` : 'En jornada'}
                                  </>
                                ) : (
                                  'Sin registro marcado'
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {record.isLate ? (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Retardo</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Puntual</span>
                              </span>
                            )}
                            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* SECCIÓN 2: PROYECTOS */}
              {(activeCategory === 'all' || activeCategory === 'projects') &&
                filteredProjects.length > 0 && (
                  <div>
                    <div className="px-1 mb-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                      Proyectos
                    </div>
                    <div className="space-y-1">
                      {filteredProjects.map((p) => {
                        const client = clients.find((c) => c.id === p.clientId);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              navigate('/tasks');
                              addToast(`Proyecto: ${p.name}`, 'info');
                              setIsOpen(false);
                            }}
                            className="group flex items-center justify-between p-2 rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <FolderKanban className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-semibold text-white block">{p.name}</span>
                                  <span className="text-[10px] font-mono text-[#94A3B8] bg-[#0F172A] px-1.5 py-0.2 rounded border border-[#233354]">
                                    {p.code}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#94A3B8]">
                                  {client ? `Cliente: ${client.name}` : 'Proyecto interno'} • {p.totalBudgetHours || 0}h presupuesto
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-white transition-colors" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* SECCIÓN 3: CLIENTES */}
              {(activeCategory === 'all' || activeCategory === 'clients') &&
                filteredClients.length > 0 && (
                  <div>
                    <div className="px-1 mb-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                      Clientes Corporativos
                    </div>
                    <div className="space-y-1">
                      {filteredClients.map((c) => {
                        const clientProjectsCount = projects.filter((p) => p.clientId === c.id).length;
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              navigate('/clients');
                              addToast(`Cliente: ${c.name}`, 'info');
                              setIsOpen(false);
                            }}
                            className="group flex items-center justify-between p-2 rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-white block">{c.name}</span>
                                <span className="text-[11px] text-[#94A3B8]">
                                  {clientProjectsCount} proyecto(s) vinculados {c.taxId ? `• RFC: ${c.taxId}` : ''}
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-white transition-colors" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* SECCIÓN 4: TAREAS */}
              {(activeCategory === 'all' || activeCategory === 'tasks') &&
                filteredTasks.length > 0 && (
                  <div>
                    <div className="px-1 mb-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                      Tareas
                    </div>
                    <div className="space-y-1">
                      {filteredTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            navigate('/tasks');
                            addToast(`Tarea: ${t.name}`, 'info');
                            setIsOpen(false);
                          }}
                          className="group flex items-center justify-between p-2 rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 rounded bg-purple-500/10 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                              <CheckSquare className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-white block">{t.name}</span>
                              <span className="text-[11px] text-[#94A3B8]">
                                {t.plannedHours || 0}h planeadas • Estado: {t.status || 'Pendiente'}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-white transition-colors" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* SECCIÓN 5: EQUIPO / PERSONAS */}
              {(activeCategory === 'all' || activeCategory === 'people') &&
                filteredPeople.length > 0 && (
                  <div>
                    <div className="px-1 mb-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                      Colaboradores y Equipo
                    </div>
                    <div className="space-y-1">
                      {filteredPeople.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            addToast(`Colaborador: ${p.name} (${p.team})`, 'info');
                            setIsOpen(false);
                          }}
                          className="group flex items-center justify-between p-2 rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-white block">{p.name}</span>
                              <span className="text-[11px] text-[#94A3B8]">
                                {p.email} • {p.team}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 bg-[#0F172A] px-2 py-0.5 rounded border border-[#233354]">
                            {p.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* SECCIÓN 6: ACCESOS DIRECTOS */}
              {(activeCategory === 'all' || activeCategory === 'shortcuts') &&
                shortcuts.length > 0 && (
                  <div>
                    <div className="px-1 mb-1.5 text-[10px] font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                      Accesos Rápidos del Sistema
                    </div>
                    <div className="space-y-1">
                      {shortcuts.map((sc) => {
                        const IconComponent = sc.icon;
                        return (
                          <div
                            key={sc.id}
                            onClick={() => {
                              sc.action();
                              setIsOpen(false);
                            }}
                            className="group flex items-center justify-between p-2 rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="p-1.5 rounded bg-sky-500/10 text-[#38BDF8] group-hover:bg-[#1E40AF] group-hover:text-white transition-colors">
                                <IconComponent className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-white block">{sc.title}</span>
                                <span className="text-[11px] text-[#94A3B8]">{sc.description}</span>
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-white transition-colors" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* ESTADO SIN RESULTADOS */}
              {counts.all === 0 && (
                <div className="text-center py-8 space-y-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-300">
                    No se encontraron coincidencias para &quot;{query}&quot;
                  </h4>
                  <p className="text-[11px] text-[#94A3B8] max-w-xs mx-auto">
                    Intenta buscar por fecha (ej. 2026-10-16 o &quot;ayer&quot;), nombre de cliente, proyecto, colaborador o atajos como &quot;perfil&quot;.
                  </p>
                </div>
              )}
            </div>

            {/* Pie del Dropdown */}
            <div className="px-3 py-2 border-t border-[#233354] bg-[#0F172A]/90 flex items-center justify-between text-[11px] text-[#94A3B8]">
              <div className="flex items-center space-x-3">
                <span>
                  <kbd className="px-1 py-0.5 bg-[#1A2742] rounded text-[10px] font-mono border border-[#233354] text-slate-300">
                    Esc
                  </kbd>{' '}
                  cerrar
                </span>
                <span>
                  <kbd className="px-1 py-0.5 bg-[#1A2742] rounded text-[10px] font-mono border border-[#233354] text-slate-300">
                    Ctrl K
                  </kbd>{' '}
                  abrir
                </span>
              </div>
              <span className="text-[#38BDF8] font-medium">Búsqueda Universal Activa</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Emergente con el Detalle de la Fecha Seleccionada */}
      <AttendanceDateDetailModal
        isOpen={Boolean(selectedDateDetail)}
        onClose={() => setSelectedDateDetail(null)}
        data={selectedDateDetail}
        userName={user?.name ? `${user.name} ${user.lastName || ''}` : 'Colaborador'}
        userRole={normalizedRole}
      />
    </>
  );
}
