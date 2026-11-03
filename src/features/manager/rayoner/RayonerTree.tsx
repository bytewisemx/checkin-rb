import { useState, useMemo } from 'react';
import { 
  Folder, FolderOpen, Building2, Briefcase, 
  CheckSquare, CornerDownRight, ChevronRight, ChevronDown, 
  MoreHorizontal, Plus, Search, Edit2, 
  Copy, ClipboardPaste, Link as LinkIcon, Power, 
  Trash2, Play, RotateCcw, CheckCircle2,
  FileText, Users,
  Maximize2, Minimize2, X
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import type { TaskNode, Project } from '../../../types/rayoner';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { RayonerClientModal } from './RayonerClientModal';
import { RayonerProjectModal } from './RayonerProjectModal';
import { ProjectExecutiveReportModal } from './ProjectExecutiveReportModal';

interface RayonerTreeProps {
  onOpenTaskModal: (taskId?: string | null, projectId?: string | null) => void;
  onSelectProjectForReport?: (projectId: string) => void;
}

export function RayonerTree({ onOpenTaskModal, onSelectProjectForReport }: RayonerTreeProps) {
  const { 
    groups, 
    clients, 
    projects, 
    tasks, 
    assignments,
    teamMembers,
    taskActualHours, 
    activeWorkers, 
    clipboardTask,
    addSubtask, 
    deleteTask, 
    toggleTaskActive, 
    copyTask, 
    pasteTask,
    requestTaskRevision,
    approveTaskRevision,
  } = useRayonerStore();

  const addToast = useCheckinStore(state => state.addToast);

  // Estados de UI y Filtros Avanzados para Alta Concurrencia / Escala
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'overbudget' | 'active_timer' | 'completed'>('all');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('all');

  // Estado para el Modal de Informe Ejecutivo con descarga PDF y Excel
  const [reportModalProject, setReportModalProject] = useState<Project | null>(null);

  // Nodos expandidos / colapsados
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'grp-corp': true,
    'grp-part': true,
    'grp-int': true,
    'cli-baluarte': true,
    'prj-aud-2026': true,
    'tsk-plan': true,
    'tsk-sust': true,
  });

  // Expandir / Colapsar todo
  const handleExpandAll = () => {
    const nextState: Record<string, boolean> = {};
    groups.forEach(g => { nextState[g.id] = true; });
    clients.forEach(c => { nextState[c.id] = true; });
    projects.forEach(p => { nextState[p.id] = true; });
    tasks.forEach(t => { nextState[t.id] = true; });
    setExpandedNodes(nextState);
    addToast('Todas las carteras y proyectos expandidos', 'info');
  };

  const handleCollapseAll = () => {
    const nextState: Record<string, boolean> = {};
    // Solo dejamos las carteras visibles abiertas pero colapsamos clientes, proyectos y tareas
    groups.forEach(g => { nextState[g.id] = true; });
    setExpandedNodes(nextState);
    addToast('Estructura colapsada a nivel de carteras', 'info');
  };

  // Estado del menú contextual flotante para tareas
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetTask: TaskNode | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetTask: null,
  });

  // Estados de modales para Clientes y Proyectos
  const [clientModalState, setClientModalState] = useState<{
    isOpen: boolean;
    clientId?: string | null;
    initialGroupId?: string;
  }>({
    isOpen: false,
    clientId: null,
    initialGroupId: undefined,
  });

  const [projectModalState, setProjectModalState] = useState<{
    isOpen: boolean;
    projectId?: string | null;
    initialClientId?: string | null;
  }>({
    isOpen: false,
    projectId: null,
    initialClientId: null,
  });

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleOpenContextMenu = (e: React.MouseEvent, task: TaskNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 300),
      targetTask: task,
    });
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu({ visible: false, x: 0, y: 0, targetTask: null });
    }
  };

  // Acciones del Menú Contextual
  const handleActionEdit = () => {
    if (contextMenu.targetTask) {
      onOpenTaskModal(contextMenu.targetTask.id, contextMenu.targetTask.projectId);
    }
    closeContextMenu();
  };

  const handleActionAddSubtask = () => {
    if (contextMenu.targetTask) {
      const subtaskName = window.prompt('Nombre de la nueva subtarea:', 'Subtarea de control');
      if (subtaskName) {
        addSubtask(contextMenu.targetTask.id, subtaskName, 4);
        addToast('Subtarea añadida al árbol con éxito', 'success');
        setExpandedNodes(prev => ({ ...prev, [contextMenu.targetTask!.id]: true }));
      }
    }
    closeContextMenu();
  };

  const handleActionCopy = () => {
    if (contextMenu.targetTask) {
      copyTask(contextMenu.targetTask.id);
      addToast(`Tarea "${contextMenu.targetTask.name}" copiada al portapapeles`, 'info');
    }
    closeContextMenu();
  };

  const handleActionPaste = () => {
    if (contextMenu.targetTask && clipboardTask) {
      pasteTask(contextMenu.targetTask.projectId, contextMenu.targetTask.id);
      addToast(`Tarea pegada bajo "${contextMenu.targetTask.name}"`, 'success');
      setExpandedNodes(prev => ({ ...prev, [contextMenu.targetTask!.id]: true }));
    }
    closeContextMenu();
  };

  const handleActionCopyLink = () => {
    if (contextMenu.targetTask) {
      const url = `${window.location.origin}/checkin-rb/?task=${contextMenu.targetTask.id}`;
      navigator.clipboard.writeText(url);
      addToast('Enlace de la tarea copiado al portapapeles', 'success');
    }
    closeContextMenu();
  };

  const handleActionToggleActive = () => {
    if (contextMenu.targetTask) {
      toggleTaskActive(contextMenu.targetTask.id);
      addToast(`Estado de tarea actualizado`, 'info');
    }
    closeContextMenu();
  };

  const handleActionDelete = () => {
    if (contextMenu.targetTask) {
      if (window.confirm(`¿Estás seguro de eliminar "${contextMenu.targetTask.name}" y sus subtareas?`)) {
        deleteTask(contextMenu.targetTask.id);
        addToast('Tarea eliminada correctamente', 'success');
      }
    }
    closeContextMenu();
  };

  const handleActionRequestRevision = () => {
    if (contextMenu.targetTask) {
      requestTaskRevision(
        contextMenu.targetTask.id,
        'Favor de volver a revisar los cálculos y entregables correspondientes.'
      );
      addToast(
        `Tarea "${contextMenu.targetTask.name}" enviada a "Favor de Volver a Revisar" para el colaborador`,
        'info'
      );
    }
    closeContextMenu();
  };

  const handleActionApproveRevision = () => {
    if (contextMenu.targetTask) {
      approveTaskRevision(contextMenu.targetTask.id);
      addToast(
        `Revisión aprobada para "${contextMenu.targetTask.name}". Tarea finalizada`,
        'success'
      );
    }
    closeContextMenu();
  };

  // Cálculo de horas y estado de rentabilidad por proyecto
  const projectStatsMap = useMemo(() => {
    const map = new Map<string, {
      totalActual: number;
      budgetHours: number;
      percent: number;
      isOverbudget: boolean;
      isAlert: boolean;
      hasActiveTimer: boolean;
      activeWorkerNames: string[];
      assignedMemberIds: Set<string>;
      completedCount: number;
      totalTasksCount: number;
    }>();

    projects.forEach(p => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      let totalActual = 0;
      let completedCount = 0;
      const assignedIds = new Set<string>();

      pTasks.forEach(t => {
        totalActual += (taskActualHours[t.id] || 0);
        if (t.status === 'completed') completedCount++;
        if (t.assigned_to) assignedIds.add(t.assigned_to);

        // Asignaciones multinivel
        const asgs = assignments.filter(a => a.taskId === t.id);
        asgs.forEach(a => assignedIds.add(a.userId));
      });

      const budget = p.totalBudgetHours || 1;
      const percent = budget > 0 ? (totalActual / budget) * 100 : 0;
      const isOverbudget = percent >= 100;
      const isAlert = percent >= 80 && percent < 100;

      // Colaboradores con cronómetro activo en este proyecto
      const activeInProject = activeWorkers.filter(w => 
        pTasks.some(t => t.id === w.taskId)
      );

      map.set(p.id, {
        totalActual,
        budgetHours: p.totalBudgetHours,
        percent,
        isOverbudget,
        isAlert,
        hasActiveTimer: activeInProject.length > 0,
        activeWorkerNames: activeInProject.map(w => w.userName),
        assignedMemberIds: assignedIds,
        completedCount,
        totalTasksCount: pTasks.length,
      });
    });

    return map;
  }, [projects, tasks, taskActualHours, activeWorkers, assignments]);

  // Filtrado de Proyectos por criterios avanzados
  const filterProject = (project: Project): boolean => {
    const stats = projectStatsMap.get(project.id);

    // 1. Filtro por Colaborador
    if (selectedCollaboratorId !== 'all') {
      if (!stats?.assignedMemberIds.has(selectedCollaboratorId)) {
        return false;
      }
    }

    // 2. Filtro por Estado Presupuestal / Rentabilidad
    if (statusFilter === 'alert') {
      if (!stats || stats.percent < 80) return false;
    } else if (statusFilter === 'overbudget') {
      if (!stats || !stats.isOverbudget) return false;
    } else if (statusFilter === 'active_timer') {
      if (!stats || !stats.hasActiveTimer) return false;
    } else if (statusFilter === 'completed') {
      if (!stats || stats.totalTasksCount === 0 || stats.completedCount < stats.totalTasksCount) return false;
    }

    // 3. Filtro de Texto (nombre, código, o tareas)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = project.name.toLowerCase().includes(q);
      const matchCode = (project.code || '').toLowerCase().includes(q);
      const matchTasks = tasks.some(t => t.projectId === project.id && (
        t.name.toLowerCase().includes(q) ||
        (t.assigned_to && t.assigned_to.toLowerCase().includes(q))
      ));
      if (!matchName && !matchCode && !matchTasks) return false;
    }

    return true;
  };

  // Filtrado reactivo de Clientes
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (selectedGroupId !== 'all' && g.id !== selectedGroupId) return false;
      return true;
    });
  }, [groups, selectedGroupId]);

  // Métricas para los contadores rápidos del header
  const totalAlertProjectsCount = useMemo(() => {
    return Array.from(projectStatsMap.values()).filter(s => s.percent >= 80).length;
  }, [projectStatsMap]);

  const totalActiveTimersCount = useMemo(() => {
    return Array.from(projectStatsMap.values()).filter(s => s.hasActiveTimer).length;
  }, [projectStatsMap]);

  return (
    <div className="w-full flex flex-col bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden" onClick={closeContextMenu}>
      
      {/* 1. Barra de Herramientas y Filtros para Escalabilidad */}
      <div className="border-b border-slate-200 bg-slate-50/90 p-4 space-y-3">
        
        {/* Fila 1: Pestañas de Carteras / Grupos con Contador */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => setSelectedGroupId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedGroupId === 'all'
                  ? 'bg-[#0D5C75] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              Todas las Carteras ({clients.length})
            </button>
            {groups.map(group => {
              const count = clients.filter(c => c.groupId === group.id).length;
              const isActive = selectedGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    isActive
                      ? 'bg-[#0D5C75] text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{group.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Botones de Colapso / Expansión Masiva */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleExpandAll}
              title="Expandir todo el árbol de clientes y proyectos"
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Expandir Todo</span>
            </button>
            <button
              onClick={handleCollapseAll}
              title="Colapsar todo a nivel de carteras"
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
            >
              <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Colapsar</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Buscador + Filtros de Rentabilidad + Filtro de Colaborador + Botones de Creación */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Buscador de Texto */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente, proyecto o tarea..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro por Estado de Rentabilidad y Desviación */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
            >
              <option value="all">Todos los Estados Presupuestales</option>
              <option value="alert">⚠️ En Alerta / Riesgo (≥ 80% consumo) {totalAlertProjectsCount > 0 ? `(${totalAlertProjectsCount})` : ''}</option>
              <option value="overbudget">🚨 Excedidos / Desviación (≥ 100%)</option>
              <option value="active_timer">⏱️ Con Cronómetro Activo {totalActiveTimersCount > 0 ? `(${totalActiveTimersCount})` : ''}</option>
              <option value="completed">✅ Tareas Completadas</option>
            </select>

            {/* Filtro por Colaborador Asignado */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2 py-0.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCollaboratorId}
                onChange={(e) => setSelectedCollaboratorId(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent py-1 pr-1 outline-none cursor-pointer"
              >
                <option value="all">Todos los Colaboradores</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Botones de Creación Rápida */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Botón Nuevo Cliente */}
            <button
              onClick={() => setClientModalState({ isOpen: true, clientId: null })}
              className="flex items-center px-3 py-1.5 bg-[#0D5C75] hover:bg-[#0A485C] text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Cliente
            </button>

            {/* Botón Nuevo Proyecto */}
            <button
              onClick={() => setProjectModalState({ isOpen: true, projectId: null, initialClientId: clients[0]?.id || null })}
              className="flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Proyecto
            </button>

            {/* Botón Nueva Tarea */}
            <button
              onClick={() => onOpenTaskModal(null, projects[0]?.id)}
              className="flex items-center px-3 py-1.5 bg-[#FF6B35] hover:bg-[#e05622] text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Tarea
            </button>
          </div>

        </div>

      </div>

      {/* 2. Cuerpo del Árbol Jerárquico Escalable */}
      <div className="p-4 sm:p-6 overflow-x-auto min-h-[450px] divide-y divide-slate-100">
        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Folder className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-semibold">No se encontraron carteras con los filtros actuales</p>
            <p className="text-xs text-slate-400 mt-1">Prueba restableciendo los filtros o el buscador</p>
          </div>
        ) : (
          filteredGroups.map(group => {
            // Filtrar clientes dentro de este grupo
            const groupClients = clients.filter(c => {
              if (c.groupId !== group.id) return false;
              
              // Si hay búsqueda por texto de cliente
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchClient = c.name.toLowerCase().includes(q) || (c.taxId || '').toLowerCase().includes(q);
                const hasMatchingProjects = projects.some(p => p.clientId === c.id && filterProject(p));
                return matchClient || hasMatchingProjects;
              }

              // Si hay filtro de estado presupuestal o colaborador
              if (statusFilter !== 'all' || selectedCollaboratorId !== 'all') {
                const hasMatchingProjects = projects.some(p => p.clientId === c.id && filterProject(p));
                return hasMatchingProjects;
              }

              return true;
            });

            const isGroupExpanded = expandedNodes[group.id] ?? true;

            return (
              <div key={group.id} className="py-2.5">
                
                {/* Nivel 0: Grupo de Clientes (Cartera) */}
                <div 
                  onClick={() => toggleExpand(group.id)}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded-xl hover:bg-slate-100/70 cursor-pointer text-slate-800 font-bold text-xs select-none group transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isGroupExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    {isGroupExpanded ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />}
                    <span className="uppercase tracking-wider text-[11px] font-black text-slate-800">{group.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                      {groupClients.length} {groupClients.length === 1 ? 'cliente' : 'clientes'}
                    </span>
                  </div>

                  {/* Botón rápido para añadir cliente a la cartera */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientModalState({ isOpen: true, clientId: null, initialGroupId: group.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 text-[11px] font-semibold text-[#0D5C75] hover:bg-[#0D5C75]/10 px-2 py-0.5 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir Cliente</span>
                  </button>
                </div>

                {/* Contenido del Grupo: Clientes */}
                {isGroupExpanded && (
                  <div className="pl-5 border-l-2 border-slate-200 ml-3.5 mt-1 space-y-2">
                    {groupClients.length === 0 ? (
                      <div className="text-[11px] text-slate-400 py-1 italic pl-2">
                        Sin clientes coincidentes en esta cartera
                      </div>
                    ) : (
                      groupClients.map(client => {
                        const clientProjects = projects.filter(p => p.clientId === client.id && filterProject(p));
                        const isClientExpanded = expandedNodes[client.id] ?? true;

                        // Estadísticas consolidadas del cliente
                        const allClientProjects = projects.filter(p => p.clientId === client.id);
                        const totalBudget = allClientProjects.reduce((acc, p) => acc + p.totalBudgetHours, 0);
                        const totalActual = allClientProjects.reduce((acc, p) => {
                          const stats = projectStatsMap.get(p.id);
                          return acc + (stats?.totalActual || 0);
                        }, 0);

                        return (
                          <div key={client.id} className="py-1">
                            
                            {/* Nivel 1: Fila del Cliente / Empresa */}
                            <div 
                              className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/60 hover:bg-slate-100/80 text-slate-700 font-semibold text-xs select-none group border border-slate-200/80 transition-colors"
                            >
                              <div 
                                onClick={() => toggleExpand(client.id)}
                                className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                              >
                                {isClientExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                <Building2 className="w-4 h-4 text-[#0D5C75] shrink-0" />
                                <span className="font-bold text-slate-800 truncate text-[13px]">{client.name}</span>
                                
                                {client.taxId && (
                                  <span className="text-[10px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200 hidden sm:inline shrink-0">
                                    {client.taxId}
                                  </span>
                                )}

                                {!client.isActive && (
                                  <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded shrink-0">
                                    Inactivo
                                  </span>
                                )}

                                {/* Pastilla con conteo de proyectos y horas consolidadas */}
                                <span className="text-[10px] text-slate-500 font-medium hidden md:inline shrink-0 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                  {clientProjects.length} {clientProjects.length === 1 ? 'proyecto' : 'proyectos'} • {totalActual.toFixed(1)}h / {totalBudget}h
                                </span>
                              </div>

                              {/* Acciones de Cliente: Crear Proyecto y Editar Cliente */}
                              <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectModalState({
                                      isOpen: true,
                                      projectId: null,
                                      initialClientId: client.id,
                                    });
                                  }}
                                  className="flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                                  title="Crear nuevo proyecto para este cliente"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Proyecto</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setClientModalState({
                                      isOpen: true,
                                      clientId: client.id,
                                      initialGroupId: client.groupId,
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-[#0D5C75] hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                                  title="Editar datos del cliente"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Nivel 2: Proyectos del Cliente */}
                            {isClientExpanded && (
                              <div className="pl-5 border-l border-slate-200 ml-3.5 mt-1.5 space-y-2">
                                {clientProjects.length === 0 ? (
                                  <div className="text-[11px] text-slate-400 py-1.5 italic pl-2 flex items-center justify-between">
                                    <span>Sin proyectos que coincidan con los filtros</span>
                                    <button
                                      onClick={() => setProjectModalState({ isOpen: true, projectId: null, initialClientId: client.id })}
                                      className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center"
                                    >
                                      <Plus className="w-3 h-3 mr-0.5" />
                                      Crear Proyecto
                                    </button>
                                  </div>
                                ) : (
                                  clientProjects.map(project => {
                                    const projectTasks = tasks.filter(t => t.projectId === project.id && !t.parentTaskId);
                                    const isProjectExpanded = expandedNodes[project.id] ?? true;
                                    const stats = projectStatsMap.get(project.id);
                                    const percent = stats?.percent || 0;
                                    const actualH = stats?.totalActual || 0;
                                    const budgetH = project.totalBudgetHours || 1;

                                    return (
                                      <div key={project.id} className="py-1">
                                        
                                        {/* Fila Ejecutiva del Proyecto */}
                                        <div className="flex flex-col md:flex-row md:items-center justify-between py-2 px-3 rounded-xl bg-white hover:bg-slate-50/90 transition-all group border border-slate-200 shadow-2xs gap-2">
                                          
                                          {/* Columna Izquierda: Nombre, Código y Cronómetro en Vivo */}
                                          <div 
                                            onClick={() => toggleExpand(project.id)}
                                            className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0 select-none"
                                          >
                                            {isProjectExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                            <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <div className="flex items-center space-x-2 truncate">
                                              <span className="font-bold text-xs text-slate-900 truncate">{project.name}</span>
                                              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                                {project.code}
                                              </span>
                                            </div>

                                            {/* Indicador en Vivo: si hay alguien cronometrando en este proyecto */}
                                            {stats?.hasActiveTimer && (
                                              <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] text-amber-800 font-bold animate-pulse shrink-0">
                                                <Play className="w-2.5 h-2.5 fill-current text-[#FF6B35]" />
                                                <span>En vivo ({stats.activeWorkerNames.length})</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Columna Derecha: Barra de Avance, Semáforo de Rentabilidad y Acciones */}
                                          <div className="flex items-center space-x-3 text-[11px] shrink-0">
                                            
                                            {/* Semáforo y Métricas de Presupuesto */}
                                            <div className="flex items-center space-x-2">
                                              <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 hidden sm:block">
                                                <div 
                                                  className={`h-full rounded-full transition-all ${
                                                    percent >= 100 
                                                      ? 'bg-red-500' 
                                                      : percent >= 80 
                                                        ? 'bg-amber-500' 
                                                        : 'bg-emerald-500'
                                                  }`}
                                                  style={{ width: `${Math.min(100, percent)}%` }}
                                                />
                                              </div>
                                              
                                              <div className="text-right">
                                                <span className="text-slate-600 font-semibold">{actualH.toFixed(1)}h / {budgetH}h</span>
                                                <span className={`ml-1.5 px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                                  percent >= 100 
                                                    ? 'bg-red-100 text-red-700' 
                                                    : percent >= 80 
                                                      ? 'bg-amber-100 text-amber-800' 
                                                      : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                  {percent.toFixed(0)}%
                                                </span>
                                              </div>
                                            </div>

                                            {/* Botón Destacado: INFORME EJECUTIVO (Abre Recuadro con PDF / Excel) */}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setReportModalProject(project);
                                                if (e.shiftKey && onSelectProjectForReport) {
                                                  onSelectProjectForReport(project.id);
                                                }
                                              }}
                                              className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#0D5C75]/10 hover:bg-[#0D5C75] text-[#0D5C75] hover:text-white rounded-lg border border-[#0D5C75]/30 text-xs font-bold transition-all shadow-2xs"
                                              title="Ver informe ejecutivo completo, rentabilidad y descargar PDF o Excel"
                                            >
                                              <FileText className="w-3.5 h-3.5" />
                                              <span>Informe</span>
                                            </button>

                                            {/* Botón + Tarea */}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenTaskModal(null, project.id);
                                              }}
                                              className="flex items-center space-x-1 text-[10px] font-bold text-[#FF6B35] bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 border border-[#FF6B35]/30 px-2 py-1 rounded-lg transition-colors"
                                              title="Crear nueva tarea en este proyecto"
                                            >
                                              <Plus className="w-3 h-3" />
                                              <span>Tarea</span>
                                            </button>

                                            {/* Botón Editar Proyecto */}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setProjectModalState({
                                                  isOpen: true,
                                                  projectId: project.id,
                                                  initialClientId: project.clientId,
                                                });
                                              }}
                                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                                              title="Editar proyecto (presupuesto, líder, tarifas)"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>

                                          </div>

                                        </div>

                                        {/* Nivel 3 y 4: Tareas y Subtareas del Proyecto */}
                                        {isProjectExpanded && (
                                          <div className="pl-5 border-l border-slate-200 ml-3.5 mt-1.5 space-y-1.5">
                                            {projectTasks.length === 0 ? (
                                              <div className="text-[11px] text-slate-400 py-1 italic pl-2 flex items-center justify-between">
                                                <span>Sin tareas en este proyecto</span>
                                                <button
                                                  onClick={() => onOpenTaskModal(null, project.id)}
                                                  className="text-[10px] font-bold text-[#FF6B35] hover:underline flex items-center"
                                                >
                                                  <Plus className="w-3 h-3 mr-0.5" />
                                                  Crear Tarea
                                                </button>
                                              </div>
                                            ) : (
                                              projectTasks.map(task => {
                                                const subtasks = tasks.filter(t => t.parentTaskId === task.id);
                                                const isTaskExpanded = expandedNodes[task.id] ?? false;
                                                const actualH = taskActualHours[task.id] || 0;
                                                const percent = task.plannedHours > 0 ? (actualH / task.plannedHours) * 100 : 0;
                                                const activeInTask = activeWorkers.filter(w => w.taskId === task.id || subtasks.some(st => st.id === w.taskId));

                                                return (
                                                  <div key={task.id} className="py-0.5">
                                                    
                                                    {/* Fila de Tarea Principal */}
                                                    <div 
                                                      onContextMenu={(e) => handleOpenContextMenu(e, task)}
                                                      className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors group relative border border-transparent hover:border-slate-200"
                                                    >
                                                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                        {subtasks.length > 0 ? (
                                                          <button 
                                                            onClick={() => toggleExpand(task.id)}
                                                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400"
                                                          >
                                                            {isTaskExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                          </button>
                                                        ) : (
                                                          <span className="w-3" />
                                                        )}

                                                        <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${task.status === 'completed' ? 'text-emerald-600' : task.isActive ? 'text-[#0D5C75]' : 'text-slate-300'}`} />
                                                        
                                                        <span className={`text-xs font-medium truncate ${!task.isActive ? 'text-slate-400 line-through' : task.status === 'completed' ? 'text-emerald-800 font-bold' : 'text-slate-800'}`}>
                                                          {task.title || task.name}
                                                        </span>

                                                        {/* Empleado asignado */}
                                                        {task.assigned_to && (
                                                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 hidden sm:inline">
                                                            👤 {teamMembers.find(m => m.id === task.assigned_to)?.name || task.assigned_to}
                                                          </span>
                                                        )}

                                                        {/* Estado de la tarea */}
                                                        {task.status === 'completed' && (
                                                          <span className="flex items-center text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                                            Completada
                                                          </span>
                                                        )}
                                                        {(task.status === 'in_progress' || task.status === 'progress') && (
                                                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                                                            En Progreso
                                                          </span>
                                                        )}

                                                        {/* Badge si el supervisor pidió revisión */}
                                                        {task.status === 'review' && (
                                                          <span className="flex items-center text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                                            <RotateCcw className="w-2.5 h-2.5 mr-1 text-amber-600" />
                                                            Revisión solicitada
                                                          </span>
                                                        )}

                                                        {/* Indicador en Vivo: Colaborador cronometrando */}
                                                        {activeInTask.length > 0 && (
                                                          <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] text-amber-800 font-bold animate-pulse">
                                                            <Play className="w-2.5 h-2.5 fill-current text-[#FF6B35]" />
                                                            <span>{activeInTask[0].userName}: {activeInTask[0].currentDurationStr}</span>
                                                          </div>
                                                        )}
                                                      </div>

                                                      {/* Métricas y Acciones Directas de la Tarea */}
                                                      <div className="flex items-center space-x-2 text-[11px] shrink-0 pl-2">
                                                        <div className="flex items-center space-x-1.5">
                                                          <span className="text-slate-500 font-medium">{actualH.toFixed(1)}h / {task.plannedHours}h</span>
                                                          <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                                            percent >= 100 
                                                              ? 'bg-red-100 text-red-700' 
                                                              : percent >= 80 
                                                                ? 'bg-amber-100 text-amber-800' 
                                                                : 'bg-emerald-50 text-emerald-700'
                                                          }`}>
                                                            {percent.toFixed(0)}%
                                                          </span>
                                                        </div>

                                                        {/* Botón Editar Tarea Directo */}
                                                        <button
                                                          type="button"
                                                          onClick={() => onOpenTaskModal(task.id, task.projectId)}
                                                          className="p-1 text-slate-400 hover:text-[#0D5C75] hover:bg-slate-200 rounded-lg transition-colors"
                                                          title="Editar tarea y asignaciones"
                                                        >
                                                          <Edit2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        {/* Menú Contextual */}
                                                        <button
                                                          onClick={(e) => handleOpenContextMenu(e, task)}
                                                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                                                          title="Más opciones de tarea"
                                                        >
                                                          <MoreHorizontal className="w-4 h-4" />
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Subtareas (Nivel 4) */}
                                                    {isTaskExpanded && subtasks.length > 0 && (
                                                      <div className="pl-6 border-l border-dashed border-slate-200 ml-4 mt-1 space-y-1">
                                                        {subtasks.map(subtask => {
                                                          const subActualH = taskActualHours[subtask.id] || 0;
                                                          const subPercent = subtask.plannedHours > 0 ? (subActualH / subtask.plannedHours) * 100 : 0;
                                                          const activeInSub = activeWorkers.filter(w => w.taskId === subtask.id);

                                                          return (
                                                            <div 
                                                              key={subtask.id}
                                                              onContextMenu={(e) => handleOpenContextMenu(e, subtask)}
                                                              className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 text-xs transition-colors group"
                                                            >
                                                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                <CornerDownRight className="w-3 h-3 text-slate-300 shrink-0" />
                                                                <span className={`text-[11px] font-normal truncate ${subtask.isActive ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                                                                  {subtask.name}
                                                                </span>

                                                                {activeInSub.length > 0 && (
                                                                  <div className="flex items-center space-x-1 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full text-[9px] text-amber-800 font-bold animate-pulse">
                                                                    <Play className="w-2 h-2 fill-current text-[#FF6B35]" />
                                                                    <span>{activeInSub[0].userName}</span>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              <div className="flex items-center space-x-2 text-[10px] text-slate-400 shrink-0">
                                                                <span>{subActualH.toFixed(1)}h / {subtask.plannedHours}h ({subPercent.toFixed(0)}%)</span>
                                                                
                                                                <button
                                                                  type="button"
                                                                  onClick={() => onOpenTaskModal(subtask.id, subtask.projectId)}
                                                                  className="p-0.5 text-slate-400 hover:text-[#0D5C75] rounded transition-colors"
                                                                  title="Editar subtarea"
                                                                >
                                                                  <Edit2 className="w-3 h-3" />
                                                                </button>

                                                                <button
                                                                  onClick={(e) => handleOpenContextMenu(e, subtask)}
                                                                  className="p-1 rounded text-slate-400 hover:text-slate-700"
                                                                >
                                                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}

                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}

                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Menú Contextual Flotante de la Tarea (7 Acciones) */}
      {contextMenu.visible && contextMenu.targetTask && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[200] w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-fade-in text-xs font-semibold text-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 truncate">
            {contextMenu.targetTask.name}
          </div>

          <button
            onClick={handleActionEdit}
            className="w-full flex items-center px-3 py-2 hover:bg-slate-50 transition-colors text-slate-700"
          >
            <Edit2 className="w-3.5 h-3.5 mr-2.5 text-[#0D5C75]" />
            Editar tarea
          </button>

          <button
            onClick={handleActionAddSubtask}
            className="w-full flex items-center px-3 py-2 hover:bg-slate-50 transition-colors text-slate-700"
          >
            <Plus className="w-3.5 h-3.5 mr-2.5 text-blue-600" />
            Añadir subtarea
          </button>

          <button
            onClick={handleActionCopy}
            className="w-full flex items-center px-3 py-2 hover:bg-slate-50 transition-colors text-slate-700"
          >
            <Copy className="w-3.5 h-3.5 mr-2.5 text-slate-500" />
            Copiar tarea
          </button>

          <button
            onClick={handleActionPaste}
            disabled={!clipboardTask}
            className={`w-full flex items-center px-3 py-2 transition-colors ${
              clipboardTask ? 'hover:bg-slate-50 text-slate-700' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 mr-2.5 text-slate-500" />
            Pegar {clipboardTask ? `(${clipboardTask.name.substring(0, 10)}...)` : ''}
          </button>

          <button
            onClick={handleActionCopyLink}
            className="w-full flex items-center px-3 py-2 hover:bg-slate-50 transition-colors text-slate-700"
          >
            <LinkIcon className="w-3.5 h-3.5 mr-2.5 text-slate-500" />
            Copiar enlace
          </button>

          <div className="border-t border-slate-100 my-1" />

          {/* Acción exclusiva del supervisor: Enviar a "Favor de volver a revisar" */}
          {contextMenu.targetTask.status !== 'review' ? (
            <button
              onClick={handleActionRequestRevision}
              className="w-full flex items-center px-3 py-2 hover:bg-amber-50 transition-colors text-amber-800 font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2.5 text-amber-600" />
              <span>Pedir que se revise de nuevo</span>
            </button>
          ) : (
            <button
              onClick={handleActionApproveRevision}
              className="w-full flex items-center px-3 py-2 hover:bg-emerald-50 transition-colors text-emerald-700 font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-2.5 text-emerald-600" />
              <span>Aprobar revisión</span>
            </button>
          )}

          <button
            onClick={handleActionToggleActive}
            className="w-full flex items-center px-3 py-2 hover:bg-slate-50 transition-colors text-amber-700"
          >
            <Power className="w-3.5 h-3.5 mr-2.5 text-amber-500" />
            {contextMenu.targetTask.isActive ? 'Desactivar / Pausar' : 'Activar Tarea'}
          </button>

          <button
            onClick={handleActionDelete}
            className="w-full flex items-center px-3 py-2 hover:bg-red-50 transition-colors text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2.5 text-red-500" />
            Borrar
          </button>
        </div>
      )}

      {/* 4. Modal de Informe Ejecutivo con Descarga PDF y Excel */}
      <ProjectExecutiveReportModal
        isOpen={Boolean(reportModalProject)}
        onClose={() => setReportModalProject(null)}
        project={reportModalProject}
      />

      {/* 5. Modal para Crear / Editar Cliente */}
      <RayonerClientModal
        isOpen={clientModalState.isOpen}
        onClose={() => setClientModalState({ isOpen: false, clientId: null })}
        clientId={clientModalState.clientId}
        initialGroupId={clientModalState.initialGroupId}
      />

      {/* 6. Modal para Crear / Editar Proyecto */}
      <RayonerProjectModal
        isOpen={projectModalState.isOpen}
        onClose={() => setProjectModalState({ isOpen: false, projectId: null, initialClientId: null })}
        projectId={projectModalState.projectId}
        initialClientId={projectModalState.initialClientId}
      />

    </div>
  );
}
