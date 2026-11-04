import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import type { TaskNode, Project } from '../../../types/rayoner';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { RayonerClientModal } from './RayonerClientModal';
import { RayonerProjectModal } from './RayonerProjectModal';
import { ProjectExecutiveReportModal } from './ProjectExecutiveReportModal';
import { formatHoursToSexagesimal } from '../../../utils/timeFormat';

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

  const addToast = useCheckinStore((state) => state.addToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'overbudget' | 'active_timer' | 'completed'>('all');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('all');

  const [reportModalProject, setReportModalProject] = useState<Project | null>(null);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'grp-corp': true,
    'grp-part': true,
    'grp-int': true,
    'cli-baluarte': true,
    'prj-aud-2026': true,
    'tsk-plan': true,
    'tsk-sust': true,
  });

  const handleExpandAll = () => {
    const nextState: Record<string, boolean> = {};
    groups.forEach((g) => {
      nextState[g.id] = true;
    });
    clients.forEach((c) => {
      nextState[c.id] = true;
    });
    projects.forEach((p) => {
      nextState[p.id] = true;
    });
    tasks.forEach((t) => {
      nextState[t.id] = true;
    });
    setExpandedNodes(nextState);
    addToast('Todas las carteras y proyectos expandidos', 'info');
  };

  const handleCollapseAll = () => {
    const nextState: Record<string, boolean> = {};
    groups.forEach((g) => {
      nextState[g.id] = true;
    });
    setExpandedNodes(nextState);
    addToast('Estructura colapsada a nivel de carteras', 'info');
  };

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
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleOpenContextMenu = (e: React.MouseEvent, task: TaskNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 280),
      targetTask: task,
    });
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu({ visible: false, x: 0, y: 0, targetTask: null });
    }
  };

  const handleActionEdit = () => {
    if (contextMenu.targetTask) {
      onOpenTaskModal(contextMenu.targetTask.id, contextMenu.targetTask.projectId);
    }
    closeContextMenu();
  };

  const handleActionAddSubtask = () => {
    if (contextMenu.targetTask) {
      const name = window.prompt(`Nombre de la nueva subtarea dentro de "${contextMenu.targetTask.name}":`);
      if (name && name.trim()) {
        const hoursStr = window.prompt('Horas presupuestadas para esta subtarea:', '5');
        const hours = parseFloat(hoursStr || '5') || 5;
        addSubtask(contextMenu.targetTask.id, name.trim(), hours);
        setExpandedNodes((prev) => ({ ...prev, [contextMenu.targetTask!.id]: true }));
        addToast(`Subtarea "${name.trim()}" agregada correctamente`, 'success');
      }
    }
    closeContextMenu();
  };

  const handleActionCopy = () => {
    if (contextMenu.targetTask) {
      copyTask(contextMenu.targetTask.id);
      addToast(`Tarea "${contextMenu.targetTask.name}" copiada`, 'info');
    }
    closeContextMenu();
  };

  const handleActionPaste = () => {
    if (contextMenu.targetTask && clipboardTask) {
      pasteTask(contextMenu.targetTask.projectId, contextMenu.targetTask.id);
      setExpandedNodes((prev) => ({ ...prev, [contextMenu.targetTask!.id]: true }));
      addToast(`Tarea "${clipboardTask.name}" pegada como subtarea`, 'success');
    }
    closeContextMenu();
  };

  const handleActionCopyLink = () => {
    if (contextMenu.targetTask) {
      const url = `${window.location.origin}/?task=${contextMenu.targetTask.id}`;
      navigator.clipboard?.writeText(url);
      addToast('Enlace de la tarea copiado al portapapeles', 'success');
    }
    closeContextMenu();
  };

  const handleActionToggleActive = () => {
    if (contextMenu.targetTask) {
      toggleTaskActive(contextMenu.targetTask.id);
      addToast('Estado de tarea actualizado', 'info');
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
        `Tarea "${contextMenu.targetTask.name}" enviada a revisión para el colaborador`,
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

  const projectStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
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
      }
    >();

    projects.forEach((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id);
      let totalActual = 0;
      let completedCount = 0;
      const assignedIds = new Set<string>();

      pTasks.forEach((t) => {
        totalActual += taskActualHours[t.id] || 0;
        if (t.status === 'completed') completedCount++;
        if (t.assigned_to) assignedIds.add(t.assigned_to);

        const asgs = assignments.filter((a) => a.taskId === t.id);
        asgs.forEach((a) => assignedIds.add(a.userId));
      });

      const budget = p.totalBudgetHours || 1;
      const percent = budget > 0 ? (totalActual / budget) * 100 : 0;
      const isOverbudget = percent >= 100;
      const isAlert = percent >= 80 && percent < 100;

      const activeInProject = activeWorkers.filter((w) =>
        pTasks.some((t) => t.id === w.taskId)
      );

      map.set(p.id, {
        totalActual,
        budgetHours: p.totalBudgetHours,
        percent,
        isOverbudget,
        isAlert,
        hasActiveTimer: activeInProject.length > 0,
        activeWorkerNames: activeInProject.map((w) => w.userName),
        assignedMemberIds: assignedIds,
        completedCount,
        totalTasksCount: pTasks.length,
      });
    });

    return map;
  }, [projects, tasks, taskActualHours, activeWorkers, assignments]);

  const filterProject = (project: Project): boolean => {
    const stats = projectStatsMap.get(project.id);

    if (selectedCollaboratorId !== 'all') {
      if (!stats?.assignedMemberIds.has(selectedCollaboratorId)) {
        return false;
      }
    }

    if (statusFilter === 'alert') {
      if (!stats || stats.percent < 80) return false;
    } else if (statusFilter === 'overbudget') {
      if (!stats || !stats.isOverbudget) return false;
    } else if (statusFilter === 'active_timer') {
      if (!stats || !stats.hasActiveTimer) return false;
    } else if (statusFilter === 'completed') {
      if (!stats || stats.totalTasksCount === 0 || stats.completedCount < stats.totalTasksCount) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = project.name.toLowerCase().includes(q);
      const matchCode = (project.code || '').toLowerCase().includes(q);
      const matchTasks = tasks.some(
        (t) =>
          t.projectId === project.id &&
          (t.name.toLowerCase().includes(q) ||
            (t.assigned_to && t.assigned_to.toLowerCase().includes(q)))
      );
      if (!matchName && !matchCode && !matchTasks) return false;
    }

    return true;
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (selectedGroupId !== 'all' && g.id !== selectedGroupId) return false;
      return true;
    });
  }, [groups, selectedGroupId]);

  const totalAlertProjectsCount = useMemo(() => {
    return Array.from(projectStatsMap.values()).filter((s) => s.percent >= 80).length;
  }, [projectStatsMap]);

  const totalActiveTimersCount = useMemo(() => {
    return Array.from(projectStatsMap.values()).filter((s) => s.hasActiveTimer).length;
  }, [projectStatsMap]);

  return (
    <div className="w-full space-y-8" onClick={closeContextMenu}>
      {/* 1. Barra de Herramientas y Filtros Plana (Sin Cajas Envolventes) */}
      <div className="space-y-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        {/* Fila 1: Pestañas de Carteras y Controles de Expansión */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={() => setSelectedGroupId('all')}
              className={`pb-1.5 text-xs font-heading uppercase tracking-wider cursor-pointer transition-colors ${
                selectedGroupId === 'all'
                  ? 'font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b-2 border-[#1E40AF] dark:border-[#38BDF8]'
                  : 'font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Todas las Carteras ({clients.length})
            </button>

            {groups.map((group) => {
              const count = clients.filter((c) => c.groupId === group.id).length;
              const isActive = selectedGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`pb-1.5 text-xs font-heading uppercase tracking-wider cursor-pointer transition-colors ${
                    isActive
                      ? 'font-bold text-[#0F172A] dark:text-[#F8FAFC] border-b-2 border-[#1E40AF] dark:border-[#38BDF8]'
                      : 'font-medium text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {group.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-4 text-xs font-heading">
            <button
              onClick={handleExpandAll}
              className="text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] uppercase tracking-wider cursor-pointer"
            >
              Expandir Todo
            </button>
            <span className="text-slate-300 dark:text-slate-800">/</span>
            <button
              onClick={handleCollapseAll}
              className="text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] uppercase tracking-wider cursor-pointer"
            >
              Colapsar
            </button>
          </div>
        </div>

        {/* Fila 2: Buscador + Filtros + Acciones Primarias */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 absolute left-0 top-1/2 -translate-y-1/2 text-[#475569] dark:text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Buscar cliente, proyecto o tarea..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-4 py-1.5 text-xs bg-transparent border-b border-slate-300 dark:border-slate-800 text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-transparent border-b border-slate-300 dark:border-slate-800 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
            >
              <option value="all" className="bg-[#F8FAFC] dark:bg-[#0F172A]">Todos los Estados Presupuestales</option>
              <option value="alert" className="bg-[#F8FAFC] dark:bg-[#0F172A]">En Observación (≥ 80% consumo) {totalAlertProjectsCount > 0 ? `(${totalAlertProjectsCount})` : ''}</option>
              <option value="overbudget" className="bg-[#F8FAFC] dark:bg-[#0F172A]">Excedidos (≥ 100%)</option>
              <option value="active_timer" className="bg-[#F8FAFC] dark:bg-[#0F172A]">Con Cronómetro Activo {totalActiveTimersCount > 0 ? `(${totalActiveTimersCount})` : ''}</option>
              <option value="completed" className="bg-[#F8FAFC] dark:bg-[#0F172A]">Tareas Completadas</option>
            </select>

            <select
              value={selectedCollaboratorId}
              onChange={(e) => setSelectedCollaboratorId(e.target.value)}
              className="bg-transparent border-b border-slate-300 dark:border-slate-800 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
            >
              <option value="all" className="bg-[#F8FAFC] dark:bg-[#0F172A]">Todos los Colaboradores</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#F8FAFC] dark:bg-[#0F172A]">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setClientModalState({ isOpen: true, clientId: null })}
              className="px-3.5 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              + Cliente
            </button>

            <button
              onClick={() =>
                setProjectModalState({
                  isOpen: true,
                  projectId: null,
                  initialClientId: clients[0]?.id || null,
                })
              }
              className="px-3.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:border-[#1E40AF] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              + Proyecto
            </button>

            <button
              onClick={() => onOpenTaskModal(null, projects[0]?.id)}
              className="px-3.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:border-[#1E40AF] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              + Tarea
            </button>
          </div>
        </div>
      </div>

      {/* 2. Cuerpo del Árbol Jerárquico Abierto */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {filteredGroups.length === 0 ? (
          <div className="py-12 text-center text-[#475569] dark:text-[#94A3B8]">
            <p className="text-sm font-heading font-semibold">No se encontraron carteras con los filtros actuales</p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const groupClients = clients.filter((c) => {
              if (c.groupId !== group.id) return false;
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchClient =
                  c.name.toLowerCase().includes(q) ||
                  (c.taxId || '').toLowerCase().includes(q);
                const hasMatchingProjects = projects.some(
                  (p) => p.clientId === c.id && filterProject(p)
                );
                return matchClient || hasMatchingProjects;
              }
              if (statusFilter !== 'all' || selectedCollaboratorId !== 'all') {
                return projects.some((p) => p.clientId === c.id && filterProject(p));
              }
              return true;
            });

            const isGroupExpanded = expandedNodes[group.id] ?? true;

            return (
              <div key={group.id} className="py-4 space-y-3">
                {/* Nivel 0: Grupo de Clientes (Cartera) */}
                <div
                  onClick={() => toggleExpand(group.id)}
                  className="flex items-center justify-between py-1 cursor-pointer select-none group"
                >
                  <div className="flex items-center space-x-2.5">
                    {isGroupExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
                    )}
                    <span className="uppercase tracking-widest text-xs font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {group.name}
                    </span>
                    <span className="text-xs text-[#475569] dark:text-[#94A3B8]">
                      ({groupClients.length} {groupClients.length === 1 ? 'cliente' : 'clientes'})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientModalState({ isOpen: true, clientId: null, initialGroupId: group.id });
                    }}
                    className="text-xs font-heading font-semibold text-[#1E40AF] dark:text-[#38BDF8] hover:underline"
                  >
                    + Añadir Cliente
                  </button>
                </div>

                {/* Contenido del Grupo: Clientes */}
                {isGroupExpanded && (
                  <div className="pl-6 border-l border-slate-200 dark:border-slate-800 space-y-4">
                    {groupClients.length === 0 ? (
                      <div className="text-xs text-[#475569] dark:text-[#94A3B8] py-1">
                        Sin clientes coincidentes en esta cartera
                      </div>
                    ) : (
                      groupClients.map((client) => {
                        const clientProjects = projects.filter(
                          (p) => p.clientId === client.id && filterProject(p)
                        );
                        const isClientExpanded = expandedNodes[client.id] ?? true;

                        const allClientProjects = projects.filter((p) => p.clientId === client.id);
                        const totalBudget = allClientProjects.reduce(
                          (acc, p) => acc + p.totalBudgetHours,
                          0
                        );
                        const totalActual = allClientProjects.reduce((acc, p) => {
                          const stats = projectStatsMap.get(p.id);
                          return acc + (stats?.totalActual || 0);
                        }, 0);

                        return (
                          <div key={client.id} className="space-y-3 pt-2">
                            {/* Nivel 1: Fila del Cliente / Empresa */}
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
                              <div
                                onClick={() => toggleExpand(client.id)}
                                className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                              >
                                {isClientExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8] shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8] shrink-0" />
                                )}
                                <span className="font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate text-sm">
                                  {client.name}
                                </span>

                                {client.taxId && (
                                  <span className="text-xs text-[#475569] dark:text-[#94A3B8] font-mono hidden sm:inline shrink-0">
                                    {client.taxId}
                                  </span>
                                )}

                                <span className="text-xs text-[#475569] dark:text-[#94A3B8] hidden md:inline shrink-0">
                                  • {clientProjects.length}{' '}
                                  {clientProjects.length === 1 ? 'proyecto' : 'proyectos'} ({formatHoursToSexagesimal(totalActual)} / {formatHoursToSexagesimal(totalBudget)})
                                </span>
                              </div>

                              <div className="flex items-center space-x-4 shrink-0 pl-2">
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
                                  className="text-xs font-heading font-semibold text-[#1E40AF] dark:text-[#38BDF8] hover:underline cursor-pointer"
                                >
                                  + Proyecto
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
                                  className="text-xs font-heading font-medium text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
                                >
                                  Editar
                                </button>
                              </div>
                            </div>

                            {/* Nivel 2: Proyectos del Cliente */}
                            {isClientExpanded && (
                              <div className="pl-6 border-l border-slate-200 dark:border-slate-800 space-y-4">
                                {clientProjects.length === 0 ? (
                                  <div className="text-xs text-[#475569] dark:text-[#94A3B8] py-1">
                                    Sin proyectos que coincidan con los filtros
                                  </div>
                                ) : (
                                  clientProjects.map((project) => {
                                    const projectTasks = tasks.filter(
                                      (t) => t.projectId === project.id && !t.parentTaskId
                                    );
                                    const isProjectExpanded = expandedNodes[project.id] ?? true;
                                    const stats = projectStatsMap.get(project.id);
                                    const percent = stats?.percent || 0;
                                    const actualH = stats?.totalActual || 0;
                                    const budgetH = project.totalBudgetHours || 1;

                                    return (
                                      <div key={project.id} className="space-y-2 py-1">
                                        {/* Fila Ejecutiva del Proyecto */}
                                        <div className="flex flex-col md:flex-row md:items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-slate-800/70 gap-2">
                                          <div
                                            onClick={() => toggleExpand(project.id)}
                                            className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0 select-none"
                                          >
                                            {isProjectExpanded ? (
                                              <ChevronDown className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8] shrink-0" />
                                            ) : (
                                              <ChevronRight className="w-3.5 h-3.5 text-[#475569] dark:text-[#94A3B8] shrink-0" />
                                            )}
                                            <span className="font-heading font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC] truncate">
                                              {project.name}
                                            </span>
                                            <span className="text-xs text-[#475569] dark:text-[#94A3B8] font-mono shrink-0">
                                              [{project.code}]
                                            </span>

                                            {stats?.hasActiveTimer && (
                                              <span className="text-[11px] font-heading font-semibold text-[#1E40AF] dark:text-[#38BDF8] shrink-0">
                                                • En vivo ({stats.activeWorkerNames.length})
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center space-x-5 text-xs shrink-0">
                                            <div className="flex items-center space-x-3">
                                              <div className="w-20 bg-slate-200 dark:bg-slate-800 h-1 overflow-hidden hidden sm:block">
                                                <div
                                                  className="h-full bg-[#1E40AF] dark:bg-[#38BDF8]"
                                                  style={{ width: `${Math.min(100, percent)}%` }}
                                                />
                                              </div>
                                              <span className="text-[#475569] dark:text-[#94A3B8] font-mono">
                                                {formatHoursToSexagesimal(actualH)} / {formatHoursToSexagesimal(budgetH)} ({percent.toFixed(0)}%)
                                              </span>
                                            </div>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setReportModalProject(project);
                                                if (e.shiftKey && onSelectProjectForReport) {
                                                  onSelectProjectForReport(project.id);
                                                }
                                              }}
                                              className="font-heading font-semibold text-[#1E40AF] dark:text-[#38BDF8] hover:underline cursor-pointer"
                                            >
                                              Informe
                                            </button>

                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenTaskModal(null, project.id);
                                              }}
                                              className="font-heading font-semibold text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
                                            >
                                              + Tarea
                                            </button>

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
                                              className="font-heading font-medium text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
                                            >
                                              Editar
                                            </button>
                                          </div>
                                        </div>

                                        {/* Nivel 3 y 4: Tareas y Subtareas del Proyecto */}
                                        {isProjectExpanded && (
                                          <div className="pl-6 border-l border-slate-200 dark:border-slate-800 space-y-1.5">
                                            {projectTasks.length === 0 ? (
                                              <div className="text-xs text-[#475569] dark:text-[#94A3B8] py-1">
                                                Sin tareas en este proyecto
                                              </div>
                                            ) : (
                                              projectTasks.map((task) => {
                                                const subtasks = tasks.filter(
                                                  (t) => t.parentTaskId === task.id
                                                );
                                                const isTaskExpanded = expandedNodes[task.id] ?? false;
                                                const taskActualH = taskActualHours[task.id] || 0;
                                                const taskPercent =
                                                  task.plannedHours > 0
                                                    ? (taskActualH / task.plannedHours) * 100
                                                    : 0;
                                                const activeInTask = activeWorkers.filter(
                                                  (w) =>
                                                    w.taskId === task.id ||
                                                    subtasks.some((st) => st.id === w.taskId)
                                                );

                                                return (
                                                  <div key={task.id} className="py-1">
                                                    <div
                                                      onContextMenu={(e) => handleOpenContextMenu(e, task)}
                                                      className="flex items-center justify-between py-1 hover:bg-slate-100/50 dark:hover:bg-[#0F172A]/60 transition-colors"
                                                    >
                                                      <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                                        {subtasks.length > 0 ? (
                                                          <button
                                                            onClick={() => toggleExpand(task.id)}
                                                            className="text-[#475569] dark:text-[#94A3B8]"
                                                          >
                                                            {isTaskExpanded ? (
                                                              <ChevronDown className="w-3.5 h-3.5" />
                                                            ) : (
                                                              <ChevronRight className="w-3.5 h-3.5" />
                                                            )}
                                                          </button>
                                                        ) : (
                                                          <span className="font-mono text-xs text-[#475569] dark:text-[#94A3B8]">
                                                            └─
                                                          </span>
                                                        )}

                                                        <span
                                                          className={`text-xs truncate ${
                                                            !task.isActive
                                                              ? 'text-[#475569] dark:text-[#94A3B8] line-through'
                                                              : 'font-medium text-[#0F172A] dark:text-[#F8FAFC]'
                                                          }`}
                                                        >
                                                          {task.title || task.name}
                                                        </span>

                                                        {task.assigned_to && (
                                                          <span className="text-[11px] text-[#475569] dark:text-[#94A3B8] shrink-0 hidden sm:inline">
                                                            — {teamMembers.find((m) => m.id === task.assigned_to)?.name || task.assigned_to}
                                                          </span>
                                                        )}

                                                        {task.status === 'completed' && (
                                                          <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-[#1E40AF] dark:text-[#38BDF8] shrink-0">
                                                            [Completada]
                                                          </span>
                                                        )}

                                                        {task.status === 'review' && (
                                                          <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] shrink-0">
                                                            [Revisión solicitada]
                                                          </span>
                                                        )}

                                                        {activeInTask.length > 0 && (
                                                          <span className="text-[10px] font-heading font-semibold text-[#1E40AF] dark:text-[#38BDF8]">
                                                            • {activeInTask[0].userName}: {activeInTask[0].currentDurationStr}
                                                          </span>
                                                        )}
                                                      </div>

                                                      <div className="flex items-center space-x-4 text-xs shrink-0 pl-2">
                                                        <span className="text-[#475569] dark:text-[#94A3B8] font-mono">
                                                          {formatHoursToSexagesimal(taskActualH)} / {formatHoursToSexagesimal(task.plannedHours)} ({taskPercent.toFixed(0)}%)
                                                        </span>

                                                        <button
                                                          type="button"
                                                          onClick={() => onOpenTaskModal(task.id, task.projectId)}
                                                          className="text-xs font-heading font-medium text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
                                                        >
                                                          Editar
                                                        </button>

                                                        <button
                                                          onClick={(e) => handleOpenContextMenu(e, task)}
                                                          className="text-xs font-heading font-medium text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
                                                        >
                                                          Opciones
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Subtareas (Nivel 4) */}
                                                    {isTaskExpanded && subtasks.length > 0 && (
                                                      <div className="pl-6 border-l border-slate-200 dark:border-slate-800 mt-1 space-y-1">
                                                        {subtasks.map((subtask) => {
                                                          const subActualH = taskActualHours[subtask.id] || 0;
                                                          const subPercent =
                                                            subtask.plannedHours > 0
                                                              ? (subActualH / subtask.plannedHours) * 100
                                                              : 0;
                                                          return (
                                                            <div
                                                              key={subtask.id}
                                                              onContextMenu={(e) => handleOpenContextMenu(e, subtask)}
                                                              className="flex items-center justify-between py-1 text-xs"
                                                            >
                                                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                <span className="font-mono text-[#475569] dark:text-[#94A3B8]">
                                                                  └─
                                                                </span>
                                                                <span
                                                                  className={`text-xs truncate ${
                                                                    subtask.isActive
                                                                      ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                                                                      : 'text-[#475569] dark:text-[#94A3B8] line-through'
                                                                  }`}
                                                                >
                                                                  {subtask.name}
                                                                </span>
                                                              </div>

                                                              <div className="flex items-center space-x-4 text-xs text-[#475569] dark:text-[#94A3B8] shrink-0">
                                                                <span className="font-mono">
                                                                  {formatHoursToSexagesimal(subActualH)} / {formatHoursToSexagesimal(subtask.plannedHours)} ({subPercent.toFixed(0)}%)
                                                                </span>
                                                                <button
                                                                  type="button"
                                                                  onClick={() => onOpenTaskModal(subtask.id, subtask.projectId)}
                                                                  className="font-heading hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                                                                >
                                                                  Editar
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

      {/* 3. Menú Contextual Sobrio */}
      {contextMenu.visible && contextMenu.targetTask && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[200] w-56 bg-[#F8FAFC] dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 py-1.5 text-xs font-heading font-medium text-[#0F172A] dark:text-[#F8FAFC]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 truncate">
            {contextMenu.targetTask.name}
          </div>

          <button
            onClick={handleActionEdit}
            className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Editar tarea
          </button>

          <button
            onClick={handleActionAddSubtask}
            className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Añadir subtarea
          </button>

          <button
            onClick={handleActionCopy}
            className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Copiar tarea
          </button>

          <button
            onClick={handleActionPaste}
            disabled={!clipboardTask}
            className={`w-full text-left px-3 py-2 transition-colors ${
              clipboardTask ? 'hover:bg-slate-200/60 dark:hover:bg-slate-800' : 'opacity-40 cursor-not-allowed'
            }`}
          >
            Pegar {clipboardTask ? `(${clipboardTask.name.substring(0, 10)}...)` : ''}
          </button>

          <button
            onClick={handleActionCopyLink}
            className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Copiar enlace
          </button>

          <div className="border-t border-slate-200 dark:border-slate-800 my-1" />

          {contextMenu.targetTask.status !== 'review' ? (
            <button
              onClick={handleActionRequestRevision}
              className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              Pedir revisión
            </button>
          ) : (
            <button
              onClick={handleActionApproveRevision}
              className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              Aprobar revisión
            </button>
          )}

          <button
            onClick={handleActionToggleActive}
            className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            {contextMenu.targetTask.isActive ? 'Desactivar / Pausar' : 'Activar Tarea'}
          </button>

          <button
            onClick={handleActionDelete}
            className="w-full text-left px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors text-[#475569] dark:text-[#94A3B8]"
          >
            Borrar
          </button>
        </div>
      )}

      <ProjectExecutiveReportModal
        isOpen={Boolean(reportModalProject)}
        onClose={() => setReportModalProject(null)}
        project={reportModalProject}
      />

      <RayonerClientModal
        isOpen={clientModalState.isOpen}
        onClose={() => setClientModalState({ isOpen: false, clientId: null })}
        clientId={clientModalState.clientId}
        initialGroupId={clientModalState.initialGroupId}
      />

      <RayonerProjectModal
        isOpen={projectModalState.isOpen}
        onClose={() => setProjectModalState({ isOpen: false, projectId: null, initialClientId: null })}
        projectId={projectModalState.projectId}
        initialClientId={projectModalState.initialClientId}
      />
    </div>
  );
}
