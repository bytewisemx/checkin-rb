import { useState, useMemo } from 'react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { 
  Users, Clock, Building2, FolderKanban, ChevronDown, 
  Check, X, Search, Lock, Unlock, Play, Sparkles, Filter, 
  AlertCircle, ShieldCheck
} from 'lucide-react';

interface TeamMembersViewProps {
  onNavigateToTree?: () => void;
}

export function TeamMembersView({ onNavigateToTree }: TeamMembersViewProps) {
  const user = useCheckinStore(state => state.user);
  const { 
    teamMembers: allTeamMembers,
    getTeamMembersBySupervisor,
    clients, 
    projects, 
    tasks, 
    assignments, 
    userTaskActualHours, 
    activeWorkers,
    toggleUserClientPermission,
    updateUserClients
  } = useRayonerStore();

  // Miembros filtrados por supervisor_id (assigned_team_members)
  const teamMembers = useMemo(() => {
    return getTeamMembersBySupervisor(user?.id, user?.role);
  }, [allTeamMembers, user?.id, user?.role, getTeamMembersBySupervisor]);

  // Estados de interfaz
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'in_timer'>('all');
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});

  // Lista única de áreas / departamentos
  const teamsList = useMemo(() => {
    const list = Array.from(new Set(teamMembers.map(m => m.team))).filter(Boolean);
    return list;
  }, [teamMembers]);

  // Alternar expansión de una tarjeta de usuario
  const toggleExpand = (userId: string) => {
    setExpandedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Expandir o contraer todos
  const toggleAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    if (expand) {
      teamMembers.forEach(m => {
        nextState[m.id] = true;
      });
    }
    setExpandedUserIds(nextState);
  };

  // Filtrado reactivo de colaboradores
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      // Filtro de texto
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.roleTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.team.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Filtro de equipo / área
      if (selectedTeam !== 'all' && member.team !== selectedTeam) {
        return false;
      }

      // Filtro de estado
      if (statusFilter === 'active' && member.status !== 'active') {
        return false;
      }

      if (statusFilter === 'in_timer') {
        const isTimerActive = activeWorkers.some(w => w.userId === member.id);
        if (!isTimerActive) return false;
      }

      return true;
    });
  }, [teamMembers, searchTerm, selectedTeam, statusFilter, activeWorkers]);

  // Métricas globales
  const totalWorkedMinutesToday = useMemo(() => {
    return teamMembers.reduce((acc, m) => acc + (m.workedMinutesToday || 0), 0);
  }, [teamMembers]);

  const totalWorkedHoursStr = useMemo(() => {
    const hours = Math.floor(totalWorkedMinutesToday / 60);
    const mins = totalWorkedMinutesToday % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }, [totalWorkedMinutesToday]);

  const activeCount = teamMembers.filter(m => m.status === 'active').length;
  const inTimerCount = activeWorkers.length;

  // Formateador de minutos a formato legible "06h 45m"
  const formatMinutes = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* 1. Header con Resumen de Usuarios y Pulso del Equipo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-[#0D5C75]/10 text-[#0D5C75] rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-800">
                Directorio y Permisos del Equipo
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Supervisa el tiempo trabajado hoy por cada colaborador, gestiona a qué clientes tienen permitido imputar horas y revisa sus proyectos y tareas asignadas.
            </p>
          </div>

          {/* Botones de expandir / contraer todo */}
          <div className="flex items-center space-x-2 self-start md:self-auto">
            <button
              onClick={() => toggleAll(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              Expandir todos
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              Colapsar todos
            </button>
          </div>
        </div>

        {/* KPIs Rápidos del Equipo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          {/* Total Colaboradores */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Colaboradores
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-slate-800">{teamMembers.length}</span>
              <span className="text-xs font-medium text-slate-500">registrados</span>
            </div>
          </div>

          {/* Activos en Jornada */}
          <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              Activos en Jornada
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-emerald-800">{activeCount}</span>
              <span className="text-xs font-medium text-emerald-600">de {teamMembers.length}</span>
            </div>
          </div>

          {/* Cronometrando En Vivo */}
          <div className="bg-sky-50/60 rounded-xl p-3.5 border border-sky-100">
            <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider flex items-center justify-between">
              <span>Cronometrando Ahora</span>
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-sky-800">{inTimerCount}</span>
              <span className="text-xs font-medium text-sky-600">en tareas activas</span>
            </div>
          </div>

          {/* Tiempo Total Registrado Hoy */}
          <div className="bg-[#0D5C75]/5 rounded-xl p-3.5 border border-[#0D5C75]/10">
            <span className="text-[11px] font-bold text-[#0D5C75] uppercase tracking-wider block">
              Tiempo Equipo Hoy
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-[#0D5C75]">{totalWorkedHoursStr}</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mt-5 pt-4 border-t border-slate-100">
          
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar colaborador por nombre, cargo, correo o área..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Área */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#0D5C75]"
            >
              <option value="all">Todas las Áreas ({teamMembers.length})</option>
              {teamsList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Estado */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all' 
                  ? 'bg-white text-slate-800 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'active' 
                  ? 'bg-white text-emerald-700 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Activos
            </button>
            <button
              onClick={() => setStatusFilter('in_timer')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'in_timer' 
                  ? 'bg-white text-sky-700 shadow-2xs' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cronometrando
            </button>
          </div>

        </div>
      </div>

      {/* 2. Listado de Colaboradores (Cards Desplegables con Reloj en la Esquina) */}
      <div className="space-y-3.5">
        {filteredMembers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">No se encontraron colaboradores</h4>
            <p className="text-xs text-slate-400 mt-1">Prueba cambiando los términos de búsqueda o filtros.</p>
          </div>
        ) : (
          filteredMembers.map(member => {
            const isExpanded = !!expandedUserIds[member.id];
            
            // Comprobar si está cronometrando en vivo en este instante
            const activeWorker = activeWorkers.find(w => w.userId === member.id);
            const isCurrentlyTiming = !!activeWorker;

            // Tareas asignadas a este colaborador
            const userAssignments = assignments.filter(a => a.userId === member.id);

            // Cálculo de jornada sobre meta estándar de 8 horas (480 minutos)
            const targetDailyMinutes = 480;
            const progressPercent = Math.min(100, Math.round((member.workedMinutesToday / targetDailyMinutes) * 100));

            return (
              <div 
                key={member.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded 
                    ? 'border-[#0D5C75]/40 shadow-md ring-1 ring-[#0D5C75]/20' 
                    : 'border-slate-200 shadow-xs hover:border-slate-300 hover:shadow'
                }`}
              >
                {/* Cabecera de la Tarjeta (Clickable para desplegar) */}
                <div 
                  onClick={() => toggleExpand(member.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-white hover:bg-slate-50/50 transition-colors"
                >
                  
                  {/* Lado Izquierdo: Avatar y Datos del Colaborador */}
                  <div className="flex items-center space-x-3.5 min-w-0">
                    {/* Avatar con iniciales */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0D5C75] to-[#167794] text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      {/* Punto de estado en vivo */}
                      {isCurrentlyTiming ? (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-sky-500 rounded-full border-2 border-white flex items-center justify-center">
                          <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                        </span>
                      ) : member.status === 'active' ? (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                      ) : (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-slate-300 rounded-full border-2 border-white" />
                      )}
                    </div>

                    {/* Información textual */}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-black text-slate-800 text-sm sm:text-base hover:text-[#0D5C75] transition-colors truncate">
                          {member.name}
                        </span>
                        
                        {/* Badge de Área */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {member.team}
                        </span>

                        {/* Indicador si está cronometrando ahora */}
                        {isCurrentlyTiming && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 flex items-center space-x-1 border border-sky-200 animate-pulse">
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>EN VIVO</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-slate-600">{member.roleTitle}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 truncate hidden sm:inline">{member.email}</span>
                      </div>

                      {/* Tarea activa si está cronometrando */}
                      {activeWorker && (
                        <div className="flex items-center space-x-1.5 mt-1.5 text-xs text-sky-700 font-semibold bg-sky-50 px-2.5 py-1 rounded-lg w-fit border border-sky-100">
                          <Play className="w-3 h-3 text-sky-600 fill-current shrink-0" />
                          <span className="truncate max-w-[260px] sm:max-w-md">
                            {activeWorker.projectName}: {activeWorker.taskName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lado Derecho: RELOJ DE TIEMPO EN LA ESQUINA (Intuitivo, Compacto y sin calendarios pesados) */}
                  <div className="flex items-center justify-between md:justify-end space-x-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
                    
                    {/* Widget / Reloj de Tiempo */}
                    <div className={`flex items-center space-x-3 px-3.5 py-2 rounded-xl border transition-all ${
                      isCurrentlyTiming 
                        ? 'bg-sky-50/70 border-sky-200 shadow-2xs'
                        : member.status === 'active'
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                    }`}>
                      
                      {/* Icono de Reloj */}
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isCurrentlyTiming 
                          ? 'bg-sky-500 text-white animate-spin-slow' 
                          : member.status === 'active'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>

                      {/* Cifra de Tiempo y Barra */}
                      <div className="text-left min-w-[110px]">
                        <div className="flex items-baseline justify-between space-x-2">
                          <span className={`text-sm font-black tracking-tight ${
                            isCurrentlyTiming ? 'text-sky-900' : 'text-slate-800'
                          }`}>
                            {formatMinutes(member.workedMinutesToday)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            hoy
                          </span>
                        </div>

                        {/* Mini barra de progreso hacia las 8 horas */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              progressPercent >= 100 
                                ? 'bg-emerald-500' 
                                : isCurrentlyTiming 
                                  ? 'bg-sky-500' 
                                  : 'bg-[#0D5C75]'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        {/* Subtexto con Hora de entrada y Puntualidad */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span>Entrada: {member.entryTime}</span>
                          {member.isLate ? (
                            <span className="font-bold text-amber-600">+{member.minutesLate}m</span>
                          ) : (
                            <span className="font-bold text-emerald-600">Puntual</span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Botón Indicador de Despliegue */}
                    <div className="flex items-center space-x-1 text-slate-400 hover:text-slate-600 transition-colors pl-1">
                      <span className="text-xs font-semibold hidden lg:inline">
                        {isExpanded ? 'Ocultar' : 'Detalles y Permisos'}
                      </span>
                      <div className={`p-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 bg-slate-50' : ''
                      }`}>
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      </div>
                    </div>

                  </div>

                </div>

                {/* 3. Panel Desplegable: Información Detallada al hacer Clic */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-6 space-y-6 animate-fade-in">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* COLUMNA 1: Permisos y Asignación de Clientes (Lg: 6 cols) */}
                      <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center space-x-2">
                              <ShieldCheck className="w-4 h-4 text-[#0D5C75]" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Clientes Autorizados para Trabajar
                              </h3>
                            </div>
                            <span className="text-xs font-black text-[#0D5C75] bg-[#0D5C75]/10 px-2 py-0.5 rounded-full">
                              {member.allowedClientIds.length} de {clients.length}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 mt-2">
                            Haz clic sobre cada cliente para permitir o revocar el registro de tiempo y acceso a tareas de este colaborador:
                          </p>

                          {/* Listado de Clientes con Chips / Toggles Interactivos */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                            {clients.map(client => {
                              const isAllowed = member.allowedClientIds.includes(client.id);

                              return (
                                <button
                                  key={client.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleUserClientPermission(member.id, client.id);
                                  }}
                                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all group ${
                                    isAllowed
                                      ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-2xs hover:bg-emerald-100/60'
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                    <div className={`p-1.5 rounded-lg shrink-0 ${
                                      isAllowed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                      <Building2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className={`text-xs font-bold block truncate ${
                                        isAllowed ? 'text-emerald-900' : 'text-slate-700'
                                      }`}>
                                        {client.name}
                                      </span>
                                      {client.taxId && (
                                        <span className="text-[10px] text-slate-400 font-medium block">
                                          RFC: {client.taxId}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Badge / Switch de Estado */}
                                  <div className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-md flex items-center space-x-1 ${
                                    isAllowed 
                                      ? 'bg-emerald-200/60 text-emerald-800' 
                                      : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                                  }`}>
                                    {isAllowed ? (
                                      <>
                                        <Check className="w-3 h-3 stroke-[3]" />
                                        <span>Permitido</span>
                                      </>
                                    ) : (
                                      <>
                                        <X className="w-3 h-3" />
                                        <span>Bloqueado</span>
                                      </>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Botones de acción rápida para clientes */}
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
                          <span className="text-[11px] text-slate-400">
                            Cambios aplicados de inmediato
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateUserClients(member.id, clients.map(c => c.id));
                              }}
                              className="text-[11px] font-bold text-[#0D5C75] hover:underline"
                            >
                              Autorizar todos
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateUserClients(member.id, []);
                              }}
                              className="text-[11px] font-bold text-rose-600 hover:underline"
                            >
                              Revocar todos
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* COLUMNA 2: Proyectos y Tareas Asignadas (Lg: 6 cols) */}
                      <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center space-x-2">
                              <FolderKanban className="w-4 h-4 text-[#FF6B35]" />
                              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Proyectos y Tareas Asignadas
                              </h3>
                            </div>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {userAssignments.length} {userAssignments.length === 1 ? 'tarea' : 'tareas'}
                            </span>
                          </div>

                          <div className="mt-3 space-y-3">
                            {userAssignments.length === 0 ? (
                              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <AlertCircle className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                                <p className="text-xs font-semibold text-slate-600">
                                  Sin tareas asignadas actualmente
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                                  Puedes asignarle tareas y definir su presupuesto en horas desde el árbol de proyectos.
                                </p>
                              </div>
                            ) : (
                              userAssignments.map(asg => {
                                const task = tasks.find(t => t.id === asg.taskId);
                                const project = projects.find(p => p.id === task?.projectId);
                                
                                // Horas reales consumidas por este colaborador en esta tarea
                                const key = `${asg.taskId}_${member.id}`;
                                const actualHours = userTaskActualHours[key] || 0;
                                const plannedHours = asg.allocatedHours;
                                const ratio = plannedHours > 0 ? (actualHours / plannedHours) : 0;
                                const isOver = actualHours >= plannedHours;

                                return (
                                  <div 
                                    key={asg.id}
                                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center space-x-1.5">
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#0D5C75]/10 text-[#0D5C75]">
                                            {project?.name || 'Proyecto'}
                                          </span>
                                          {asg.blockOnLimit ? (
                                            <span className="text-[10px] font-bold text-amber-700 flex items-center space-x-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                              <Lock className="w-2.5 h-2.5" />
                                              <span>Hard-Stop</span>
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-0.5 bg-slate-100 px-1.5 py-0.5 rounded">
                                              <Unlock className="w-2.5 h-2.5" />
                                              <span>Flexible</span>
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-800 mt-1">
                                          {task?.name || 'Tarea sin nombre'}
                                        </h4>
                                      </div>

                                      {/* Cifra de Horas: Reales vs Presupuesto */}
                                      <div className="text-right shrink-0">
                                        <span className={`text-xs font-black ${
                                          isOver ? 'text-rose-600' : ratio >= 0.8 ? 'text-[#FF6B35]' : 'text-slate-800'
                                        }`}>
                                          {actualHours.toFixed(1)}h
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium"> / {plannedHours}h</span>
                                      </div>
                                    </div>

                                    {/* Barra de progreso de la tarea para este usuario */}
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          isOver ? 'bg-rose-500' : ratio >= 0.8 ? 'bg-[#FF6B35]' : 'bg-[#0D5C75]'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Botón rápido para gestionar en árbol */}
                        {onNavigateToTree && (
                          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTree();
                              }}
                              className="text-xs font-bold text-[#0D5C75] hover:text-[#0a485c] flex items-center space-x-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#FF6B35]" />
                              <span>Asignar más tareas en el Árbol de Proyectos →</span>
                            </button>
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
