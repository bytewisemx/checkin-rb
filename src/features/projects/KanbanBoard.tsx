import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useGamificationStore } from '../../store/useGamificationStore';
import type { TaskNode } from '../../types/rayoner';
import { EditTaskTimeModal } from './EditTaskTimeModal';
import { FinalizeTaskModal } from './FinalizeTaskModal';
import { UserCalendarView } from './UserCalendarView';
import { CreateExtraordinaryTaskModal } from './CreateExtraordinaryTaskModal';

type TabType = 'board' | 'calendar';
type SortOrder = 'none' | 'asc' | 'desc';

// 4 etapas del flujo de trabajo corporativo (estilo sobrio y homogéneo)
const STAGES: {
  id: 'pending' | 'progress' | 'review' | 'completed';
  title: string;
  subtitle: string;
  dot: string;
  isSupervisorOnly?: boolean;
}[] = [
  {
    id: 'pending',
    title: 'Nueva Tarea Asignada',
    subtitle: 'Tareas no iniciadas',
    dot: 'bg-slate-400',
  },
  {
    id: 'progress',
    title: 'En Proceso',
    subtitle: 'Tareas iniciadas y pausadas',
    dot: 'bg-blue-700',
  },
  {
    id: 'review',
    title: 'En Revisión',
    subtitle: 'Retornadas por el supervisor',
    dot: 'bg-slate-500',
    isSupervisorOnly: true,
  },
  {
    id: 'completed',
    title: 'Finalizadas',
    subtitle: 'Concluidas y cerradas',
    dot: 'bg-slate-700',
  },
];

export function KanbanBoard() {
  const { user, addToast } = useCheckinStore();
  const { 
    tasks, 
    projects, 
    clients, 
    assignments, 
    userTaskActualHours,
    teamMembers,
    activeWorkers,
    moveTaskStatus,
    updateTaskActualHours,
    finalizeTaskWithHours,
    startWorkerTimer,
    stopWorkerTimer,
    addExtraordinaryTask
  } = useRayonerStore();

  // Reducción exclusiva a 2 pestañas: 'board' (Tablero) y 'calendar' (Calendario)
  const [activeTab, setActiveTab] = useState<TabType>('board');

  // Filtros de Empresas/Clientes y Orden
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');

  // Estado del Modal de Ajuste de Horas
  const [editingTask, setEditingTask] = useState<TaskNode | null>(null);

  // Estado del Modal de Confirmación y Últimos Ajustes para Finalizar Tarea
  const [finalizingTask, setFinalizingTask] = useState<TaskNode | null>(null);

  // Estado del Modal para Crear Tareas Extraordinarias (Sin Empresa)
  const [isExtraordinaryModalOpen, setIsExtraordinaryModalOpen] = useState(false);

  // Identificador de usuario activo
  const currentUserId = user?.id || '';

  // Perfil del colaborador en Rayoner
  const currentMember = useMemo(() => {
    if (!user) return null;
    return teamMembers.find(
      m => m.id === currentUserId || (user.email && m.email.toLowerCase() === user.email.toLowerCase())
    ) || null;
  }, [teamMembers, currentUserId, user]);

  // Tareas asignadas al usuario actual (vinculación real por assigned_to y assignments)
  const userAssignedTasks = useMemo(() => {
    if (!currentUserId && !currentMember) return [];
    const userAssignments = assignments.filter(
      a => (currentUserId && a.userId === currentUserId) || (currentMember && a.userId === currentMember.id)
    );
    const assignedTaskIds = new Set(userAssignments.map(a => a.taskId));
    return tasks.filter(
      t =>
        (currentUserId && t.assigned_to === currentUserId) ||
        (currentMember && t.assigned_to === currentMember.id) ||
        assignedTaskIds.has(t.id)
    );
  }, [tasks, assignments, currentUserId, currentMember]);

  // Empresas/Clientes asignados al colaborador (incluyendo las de sus tareas)
  const assignedClients = useMemo(() => {
    const clientIds = new Set<string>();

    if (currentMember?.allowedClientIds && currentMember.allowedClientIds.length > 0) {
      currentMember.allowedClientIds.forEach(id => clientIds.add(id));
    }

    userAssignedTasks.forEach(t => {
      const proj = projects.find(p => p.id === t.projectId);
      if (proj?.clientId && proj.clientId !== 'cli-extraordinario') {
        clientIds.add(proj.clientId);
      }
    });

    return clients.filter(c => clientIds.has(c.id) && c.id !== 'cli-extraordinario');
  }, [clients, currentMember, userAssignedTasks, projects]);

  // Horas asignadas a una tarea específica para el colaborador
  const getTaskAllocatedHours = (taskId: string): number => {
    const asg = assignments.find(
      a => a.taskId === taskId && (
        (currentUserId && a.userId === currentUserId) || 
        (currentMember && a.userId === currentMember.id)
      )
    );
    return asg?.allocatedHours || 0;
  };

  // Horas reales invertidas en una tarea por el colaborador
  const getTaskUserActualHours = (taskId: string): number => {
    if (!currentUserId && !currentMember) return 0;
    const userKey = currentUserId ? `${taskId}_${currentUserId}` : '';
    const memberKey = currentMember ? `${taskId}_${currentMember.id}` : '';
    return (userKey && userTaskActualHours[userKey]) || (memberKey && userTaskActualHours[memberKey]) || 0;
  };

  // Regla de Negocio: Clasificación efectiva de la columna según el estado del sistema
  const getEffectiveColumnId = (task: TaskNode): 'pending' | 'progress' | 'review' | 'completed' => {
    // 1. Si la tarea fue finalizada
    if (task.status === 'completed') {
      return 'completed';
    }

    // 2. Si fue retornada por el supervisor tras terminarla
    if (task.status === 'review') {
      return 'review';
    }

    // 3. Si la tarea está iniciada o pausada (trabajando activamente o con tiempo acumulado > 0)
    const isWorkingOnIt = activeWorkers.some(
      w => (w.userId === currentUserId || w.userId === currentMember?.id) && w.taskId === task.id
    );
    const userActual = getTaskUserActualHours(task.id);
    const isStartedOrPaused = isWorkingOnIt || userActual > 0 || task.status === 'progress' || task.status === 'in_progress';

    if (isStartedOrPaused) {
      return 'progress';
    }

    // 4. Nueva tarea asignada (permanece aquí si aún no ha sido iniciada)
    return 'pending';
  };

  // Tareas filtradas por Empresa/Cliente, extraordinarias y búsqueda
  const filteredTasks = useMemo(() => {
    let result = [...userAssignedTasks];

    // Filtro por Empresa/Cliente o Extraordinarias
    if (selectedClientId === 'extraordinary') {
      result = result.filter(t => t.isExtraordinary || t.projectId === 'prj-extraordinario');
    } else if (selectedClientId !== 'all') {
      const projectIdsForClient = new Set(
        projects.filter(p => p.clientId === selectedClientId).map(p => p.id)
      );
      result = result.filter(t => projectIdsForClient.has(t.projectId));
    }

    // Filtro de texto
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter(t => {
        const proj = projects.find(p => p.id === t.projectId);
        const cli = clients.find(c => c.id === proj?.clientId);
        return (
          t.name.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          (cli && cli.name.toLowerCase().includes(query)) ||
          (proj && proj.name.toLowerCase().includes(query))
        );
      });
    }

    // Orden
    if (sortOrder === 'asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [userAssignedTasks, selectedClientId, searchTerm, sortOrder, projects, clients]);

  // Acción 1: Iniciar Trabajo en Tarea (pasa automáticamente a En Proceso)
  const handleStartWorkingOnTask = (task: TaskNode) => {
    const project = projects.find(p => p.id === task.projectId);
    const client = clients.find(c => c.id === project?.clientId);

    // Iniciar cronómetro de trabajador en Rayoner
    startWorkerTimer({
      userId: currentUserId,
      userName: currentMember?.name || user?.name || 'Colaborador',
      taskId: task.id,
      taskName: task.name,
      projectName: project?.name || 'Proyecto',
      clientName: client?.name || 'Cliente',
      startedAtMs: Date.now(),
      currentDurationStr: '00:00:01',
    });

    localStorage.setItem('rb_active_task_id', task.id);
    moveTaskStatus(task.id, 'progress');
    // Registrar cambio y trabajo de tarea en tiempo real para gamificación mensual
    useGamificationStore.getState().recordTaskSwitch();
    addToast(`Iniciaste trabajo en "${task.name}". Tarea en columna "En Proceso"`, 'success');
  };

  // Acción 2: Pausar trabajo (permanece en columna "En Proceso")
  const handlePauseWorkOnTask = (task: TaskNode) => {
    stopWorkerTimer(currentUserId);
    localStorage.removeItem('rb_active_task_id');
    moveTaskStatus(task.id, 'progress');
    addToast(`Pausaste trabajo en "${task.name}". Permanece en "En Proceso"`, 'info');
  };

  // Acción para Crear y Autoasignar Tarea Extraordinaria (Sin Empresa Vinculada)
  const handleCreateExtraordinaryTask = (data: {
    name: string;
    description: string;
    plannedHours: number;
    category: string;
  }) => {
    addExtraordinaryTask({
      name: data.name,
      description: data.description,
      plannedHours: data.plannedHours,
      category: data.category,
      userId: currentUserId,
      userName: currentMember?.name || user?.name || 'Colaborador',
    });
    addToast(`Tarea extraordinaria "${data.name}" agregada a "Nueva Tarea Asignada"`, 'success');
  };

  // Acción 3: Guardar ajuste de horas
  const handleSaveHours = (newHours: number) => {
    if (!editingTask) return;
    updateTaskActualHours(editingTask.id, currentUserId, newHours);
    // Registrar edición manual: si se abusa de ajustes manuales se anula el bono de tiempo en vivo
    useGamificationStore.getState().recordManualEdit();
    addToast(`Tiempo invertido ajustado a ${newHours}h en "${editingTask.name}"`, 'success');
    setEditingTask(null);
  };

  // Acción 4: Finalizar tarea desde EditTaskTimeModal con horas ajustadas
  const handleFinalizeTask = (finalHours: number) => {
    if (!editingTask) return;
    stopWorkerTimer(currentUserId);
    localStorage.removeItem('rb_active_task_id');
    finalizeTaskWithHours(editingTask.id, currentUserId, finalHours, currentMember?.name || user?.name);
    addToast(`Tarea "${editingTask.name}" finalizada con ${finalHours}h imputadas. Notificación enviada al supervisor (${editingTask.created_by || 'admin-99'}).`, 'success');
    setEditingTask(null);
  };

  // Acción 5: Abrir recuadro de últimos ajustes y confirmación de finalización
  const handleOpenFinalizeModal = (task: TaskNode) => {
    setFinalizingTask(task);
  };

  // Acción 6: Confirmar y finalizar definitivamente desde FinalizeTaskModal
  const handleConfirmFinalizeTask = (finalHours: number) => {
    if (!finalizingTask) return;
    stopWorkerTimer(currentUserId);
    localStorage.removeItem('rb_active_task_id');
    finalizeTaskWithHours(finalizingTask.id, currentUserId, finalHours, currentMember?.name || user?.name);
    addToast(`Tarea "${finalizingTask.name}" finalizada con ${finalHours}h imputadas. Notificación enviada al supervisor (${finalizingTask.created_by || 'admin-99'}).`, 'success');
    setFinalizingTask(null);
  };

  // -------------------------
  // RENDERIZADO DE TABLERO (Diseño Abierto y Minimalista)
  // -------------------------
  const renderBoard = () => {
    return (
      <div className="flex-1 flex flex-col p-6 space-y-6">
        
        {/* Banner Explicativo Minimalista de Reglas de Negocio */}
        <div className="py-2 px-1 text-xs text-slate-600">
          <span className="font-medium text-slate-700">
            <strong className="text-slate-900">Organización del Tablero:</strong> En <em>Nueva Tarea Asignada</em> están tus tareas no iniciadas. Al comenzar o pausar pasan a <em>En Proceso</em>. La columna <em>En Revisión</em> contiene tareas retornadas por el supervisor.
          </span>
        </div>

        {/* Barra Superior: Empresas Asignadas y Controles (Sin Cajas Anidadas) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 px-1">
          
          {/* Selector de Empresa / Cliente Asignado y Tareas Extraordinarias */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Empresa Asignada:
            </span>

            <select
              data-tour="task-selector"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-700 focus:border-blue-700 cursor-pointer"
            >
              <option value="all">Todas mis empresas asignadas ({assignedClients.length})</option>
              <option value="extraordinary">Actividades Extraordinarias (Sin empresa asignada)</option>
              {assignedClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Botón para crear una Tarea Extraordinaria rápida */}
            <button
              id="btn-extra-task"
              data-tour="btn-new-task"
              type="button"
              onClick={() => setIsExtraordinaryModalOpen(true)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Registrar una tarea o actividad extraordinaria no vinculada a empresas"
            >
              + Tarea Extraordinaria
            </button>
          </div>

          {/* Buscador y Orden (Únicos iconos permitidos: Search y X en buscador) */}
          <div className="flex items-center space-x-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar en mis tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-700 focus:border-blue-700"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? 'none' : 'asc')}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                sortOrder !== 'none'
                  ? 'bg-blue-50 text-blue-900 border-blue-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {sortOrder === 'asc' ? 'Orden: A-Z' : sortOrder === 'desc' ? 'Orden: Z-A' : 'Ordenar'}
            </button>
          </div>

        </div>

        {/* Mensaje amigable cuando el colaborador no tiene tareas asignadas */}
        {userAssignedTasks.length === 0 && (
          <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Aún no tienes proyectos o tareas asignadas
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tu tiempo se contabiliza como jornada general hasta que tu supervisor te asigne una actividad o crees una extraordinaria.
              </p>
            </div>
            <button
              onClick={() => setIsExtraordinaryModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-md transition-colors self-start sm:self-auto cursor-pointer"
            >
              + Tarea Extraordinaria
            </button>
          </div>
        )}

        {/* 4 Columnas del Tablero Kanban */}
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex space-x-6 items-start min-h-[550px] min-w-[1240px]">
            {STAGES.map((stage) => {
              // Filtrado según la columna efectiva calculada por el estado real del sistema
              const columnTasks = filteredTasks.filter(t => getEffectiveColumnId(t) === stage.id);

              return (
                <div
                  key={stage.id}
                  id={stage.id === 'review' ? 'board-in-review-col' : undefined}
                  data-tour={stage.id === 'progress' ? 'board-column-progress' : undefined}
                  className="flex-1 min-w-[290px] max-w-[330px] flex flex-col"
                >
                  {/* Cabecera Desencapsulada de la Columna (Sin Cajas ni Bordes Rígidos) */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                      <h3 className="font-semibold text-slate-900 text-sm tracking-tight">{stage.title}</h3>
                      {stage.isSupervisorOnly && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          (Supervisor)
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tarjetas de la Columna */}
                  <div className="space-y-3 min-h-[220px]">
                    {columnTasks.map((task) => {
                      const project = projects.find(p => p.id === task.projectId);
                      const client = clients.find(c => c.id === project?.clientId);
                      const allocatedHours = getTaskAllocatedHours(task.id);
                      const actualHours = getTaskUserActualHours(task.id);
                      
                      const percentConsumed = allocatedHours > 0 
                        ? Math.round((actualHours / allocatedHours) * 100) 
                        : 0;

                      const isCurrentlyActive = activeWorkers.some(
                        w => ((currentUserId && w.userId === currentUserId) || (currentMember && w.userId === currentMember.id)) && w.taskId === task.id
                      );

                      return (
                        <div
                          key={task.id}
                          className={`bg-white rounded-md p-4 border transition-all space-y-3 ${
                            isCurrentlyActive 
                              ? 'ring-2 ring-blue-700/30 border-blue-600 bg-blue-50/10 shadow-xs' 
                              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          {/* Empresa / Categoría y Prioridad (Sin píldoras con bordes pesados) */}
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            {task.isExtraordinary || task.projectId === 'prj-extraordinario' ? (
                              <span className="font-semibold text-[11px] text-blue-700 uppercase tracking-wider truncate">
                                Tarea Extraordinaria
                              </span>
                            ) : (
                              <span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider truncate">
                                {client?.name || 'Empresa'}
                              </span>
                            )}

                            <div className="flex items-center space-x-1.5">
                              {isCurrentlyActive && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-blue-700 text-white">
                                  EN VIVO
                                </span>
                              )}
                              {task.priority && (
                                <span className={`text-[10px] font-medium uppercase tracking-wider ${
                                  task.priority === 'urgent' ? 'text-rose-700' :
                                  task.priority === 'high' ? 'text-amber-700' :
                                  'text-slate-500'
                                }`}>
                                  {task.priority}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Nombre de la Tarea y Subtítulo */}
                          <div>
                            <h4 className={`font-semibold text-sm leading-snug ${
                              task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'
                            }`}>
                              {task.name}
                            </h4>
                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {task.isExtraordinary || task.projectId === 'prj-extraordinario' ? (
                                <span className="truncate">
                                  {task.extraordinaryCategory || 'Actividad Extraordinaria'}
                                </span>
                              ) : (
                                <span className="truncate">
                                  {project?.name || 'Proyecto'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Alerta de Revisión Solicitada por el Supervisor */}
                          {stage.id === 'review' && (
                            <div className="border-l-2 border-amber-500 pl-3 py-1 text-xs text-amber-900 space-y-0.5">
                              <span className="font-semibold text-amber-900 block">
                                Retornada por el Supervisor
                              </span>
                              <p className="text-[11px] text-amber-800 leading-relaxed">
                                {task.supervisorReviewNote || 'Favor de revisar los entregables correspondientes.'}
                              </p>
                            </div>
                          )}

                          {/* Avance en Tiempo: Presupuesto vs Invertido (Sin recuadro encapsulado) */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Avance de tiempo:</span>
                              <span className="font-mono font-medium text-slate-800">
                                {actualHours}h <span className="text-slate-400 font-normal">/ {allocatedHours > 0 ? `${allocatedHours}h` : 'N/A'}</span>
                              </span>
                            </div>

                            {/* Barra de Progreso Discreta */}
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  task.status === 'completed'
                                    ? 'bg-slate-400'
                                    : percentConsumed > 100
                                      ? 'bg-rose-600'
                                      : 'bg-blue-700'
                                }`}
                                style={{ width: `${Math.min(100, percentConsumed || 5)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                              <span>Consumo: {percentConsumed}%</span>
                              {task.dueDate && <span>Vence: {task.dueDate}</span>}
                            </div>
                          </div>

                          {/* Acciones Contextuales (Solo Texto Limpio, Sin Iconos) */}
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            
                            {/* Botón para Ajustar Horas Invertidas */}
                            {stage.id === 'completed' || task.status === 'completed' ? (
                              <span 
                                className="text-xs text-slate-400 select-none"
                                title="El tiempo de esta tarea ya no puede modificarse por encontrarse finalizada"
                              >
                                Tiempo Bloqueado
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingTask(task)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded transition cursor-pointer"
                                title="Ajustar tiempo invertido"
                              >
                                Ajustar Tiempo
                              </button>
                            )}

                            {/* Controles Específicos por Columna (Solo Texto Limpio) */}
                            <div className="flex items-center space-x-1.5">
                              
                              {/* 1. Columna Nueva Tarea Asignada: Comenzar a Trabajar */}
                              {stage.id === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleStartWorkingOnTask(task)}
                                  className="px-3 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition rounded cursor-pointer"
                                  title="Iniciar trabajo en esta tarea (pasa a En Proceso)"
                                >
                                  Comenzar
                                </button>
                              )}

                              {/* 2. Columna En Revisión: Atender y Trabajar */}
                              {stage.id === 'review' && (
                                <button
                                  id="btn-reject-task"
                                  type="button"
                                  onClick={() => handleStartWorkingOnTask(task)}
                                  className="px-3 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition rounded cursor-pointer"
                                  title="Atender observación o devolver a revisión"
                                >
                                  Devolver / Atender
                                </button>
                              )}

                              {/* 3. Columna En Proceso: Si está activa -> Pausar; si está pausada -> Reanudar; y botón Finalizar */}
                              {stage.id === 'progress' && (
                                <>
                                  {isCurrentlyActive ? (
                                    <button
                                      type="button"
                                      onClick={() => handlePauseWorkOnTask(task)}
                                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition rounded cursor-pointer"
                                      title="Pausar trabajo (permanece en En Proceso)"
                                    >
                                      Pausar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleStartWorkingOnTask(task)}
                                      className="px-3 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition rounded cursor-pointer"
                                      title="Reanudar trabajo en esta tarea iniciada"
                                    >
                                      Reanudar
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenFinalizeModal(task)}
                                    className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition rounded cursor-pointer"
                                    title="Finalizar tarea y dar últimos ajustes de tiempo"
                                  >
                                    Finalizar
                                  </button>
                                </>
                              )}

                              {/* 4. Columna Finalizada: Badge de Completada */}
                              {stage.id === 'completed' && (
                                <span className="px-2.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-50 rounded">
                                  Finalizada
                                </span>
                              )}

                            </div>

                          </div>

                        </div>
                      );
                    })}

                    {columnTasks.length === 0 && (
                      <div className="h-28 rounded border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                        <span className="font-medium text-slate-500">Sin tareas en {stage.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="w-full mt-4 animate-fade-in flex flex-col min-h-[75vh] bg-white rounded-md shadow-2xs border border-slate-200 overflow-hidden">
      
      {/* 1. Header con ÚNICAMENTE las 2 Pestañas: Tablero y Calendario (Sin Iconos Redundantes) */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 sm:px-8 py-2 bg-slate-50/60">
        
        {/* Selector de Pestañas Limpio y Minimalista */}
        <div className="flex items-center space-x-6">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center px-1 py-3 text-sm transition-all relative cursor-pointer ${
              activeTab === 'board'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <span>Tablero</span>
            {activeTab === 'board' && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-700 rounded-t" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center px-1 py-3 text-sm transition-all relative cursor-pointer ${
              activeTab === 'calendar'
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <span>Calendario (Asistencia e Historial)</span>
            {activeTab === 'calendar' && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-700 rounded-t" />
            )}
          </button>
        </div>

        {/* Indicador del Colaborador */}
        <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-blue-700" />
          <span className="font-semibold text-slate-800">{currentMember?.name || user?.name || 'Colaborador'}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">{userAssignedTasks.length} tareas asignadas</span>
        </div>

      </div>

      {/* 2. Contenido de la Pestaña Activa */}
      {activeTab === 'board' ? renderBoard() : <UserCalendarView />}

      {/* 3. Modal para Editar Tiempo Invertido */}
      {editingTask && (
        <EditTaskTimeModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          clientName={
            editingTask.isExtraordinary || editingTask.projectId === 'prj-extraordinario'
              ? 'Actividad Extraordinaria'
              : (clients.find(c => c.id === projects.find(p => p.id === editingTask.projectId)?.clientId)?.name || 'Empresa')
          }
          projectName={
            editingTask.isExtraordinary || editingTask.projectId === 'prj-extraordinario'
              ? (editingTask.extraordinaryCategory || 'Tareas Extraordinarias e Imprevistas')
              : (projects.find(p => p.id === editingTask.projectId)?.name || 'Proyecto')
          }
          currentHours={getTaskUserActualHours(editingTask.id)}
          allocatedHours={getTaskAllocatedHours(editingTask.id)}
          onSaveHours={handleSaveHours}
          onFinalizeTask={handleFinalizeTask}
        />
      )}

      {/* 4. Recuadro Modal para Confirmar Finalización y Últimos Ajustes de Tiempo */}
      {finalizingTask && (
        <FinalizeTaskModal
          isOpen={Boolean(finalizingTask)}
          onClose={() => setFinalizingTask(null)}
          task={finalizingTask}
          clientName={
            finalizingTask.isExtraordinary || finalizingTask.projectId === 'prj-extraordinario'
              ? 'Actividad Extraordinaria'
              : (clients.find(c => c.id === projects.find(p => p.id === finalizingTask.projectId)?.clientId)?.name || 'Empresa')
          }
          projectName={
            finalizingTask.isExtraordinary || finalizingTask.projectId === 'prj-extraordinario'
              ? (finalizingTask.extraordinaryCategory || 'Tareas Extraordinarias e Imprevistas')
              : (projects.find(p => p.id === finalizingTask.projectId)?.name || 'Proyecto')
          }
          currentHours={getTaskUserActualHours(finalizingTask.id)}
          allocatedHours={getTaskAllocatedHours(finalizingTask.id)}
          onConfirmFinalize={handleConfirmFinalizeTask}
        />
      )}

      {/* 5. Modal para Crear y Registrar Tareas Extraordinarias Sin Empresa */}
      {isExtraordinaryModalOpen && (
        <CreateExtraordinaryTaskModal
          isOpen={isExtraordinaryModalOpen}
          onClose={() => setIsExtraordinaryModalOpen(false)}
          onSubmit={handleCreateExtraordinaryTask}
        />
      )}

    </div>
  );
}
