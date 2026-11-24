import { useState, useMemo, useEffect } from 'react';
import { Search, X, Play, Pause, CheckCircle2 } from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useOperationalCatalogSync } from '../../hooks/useLiveTeamTimers';
import { doesTaskBelongToUser } from '../../services/taskService';
import { formatMinutesSexagesimal } from '../../services/attendanceService';
import { auth } from '../../services/firebase';
import { normalizeRole } from '../../services/rbac';
import { CompanyLogoBadge } from '../../components/common/CompanyLogoBadge';
import type { TaskNode } from '../../types/rayoner';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { FinalizeTaskModal } from './FinalizeTaskModal';
import { FinalizeReviewModal } from './FinalizeReviewModal';
import { UserCalendarView } from './UserCalendarView';
import { CreateExtraordinaryTaskModal } from './CreateExtraordinaryTaskModal';

type TabType = 'board' | 'calendar';
type SortOrder = 'none' | 'asc' | 'desc';

const STAGES: {
  id: 'pending' | 'progress' | 'review' | 'completed';
  title: string;
  subtitle: string;
  dot: string;
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
    subtitle: 'Actividades en desarrollo',
    dot: 'bg-blue-700',
  },
  {
    id: 'review',
    title: 'En Revisión',
    subtitle: 'Esperando visto bueno del supervisor',
    dot: 'bg-slate-500',
  },
  {
    id: 'completed',
    title: 'Finalizadas',
    subtitle: 'Concluidas y cerradas',
    dot: 'bg-slate-700',
  },
];

export function KanbanBoard() {
  useOperationalCatalogSync();
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
    finalizeTaskWithHours,
    startWorkerTimer,
    stopWorkerTimer,
    adjustTaskTimeManually,
    addExtraordinaryTask,
    addTaskNote,
  } = useRayonerStore();

  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedRubro, setSelectedRubro] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');

  // Estado del Drawer de Detalle y Bitácora
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskNode | null>(null);

  // Estado del Modal de Confirmación para Finalizar Tarea
  const [finalizingTask, setFinalizingTask] = useState<TaskNode | null>(null);

  // Estado del Modal para Finalizar Revisión (Supervisor / Gerente / Socio)
  const [reviewModalTask, setReviewModalTask] = useState<{
    task: TaskNode;
    projectName?: string;
    companyName?: string;
  } | null>(null);

  // Modal para Tareas Extraordinarias Sin Empresa
  const [isExtraordinaryModalOpen, setIsExtraordinaryModalOpen] = useState(false);

  const normRole = normalizeRole(user?.role);
  const canReview = normRole === 'Supervisor' || normRole === 'Gerente' || normRole === 'Socio';

  // Contador de segundos en vivo para re-renderizado suave del cronómetro activo
  const [liveClockTick, setLiveClockTick] = useState<number>(0);

  const currentUserId = user?.id || '';

  const currentMember = useMemo(() => {
    if (!user) return null;
    return (
      teamMembers.find(
        (m) =>
          m.id === currentUserId ||
          (user.email && m.email.toLowerCase() === user.email.toLowerCase())
      ) || null
    );
  }, [teamMembers, currentUserId, user]);

  const userIdentity = useMemo(
    () => ({
      id: currentUserId,
      uid: auth?.currentUser?.uid || null,
      memberId: currentMember?.id || null,
      email: user?.email || currentMember?.email || null,
    }),
    [currentUserId, currentMember?.id, currentMember?.email, user?.email]
  );

  // Trabajador activo corriendo en vivo en este momento
  const myActiveWorker = useMemo(() => {
    return (
      activeWorkers.find(
        (w) =>
          w.isRunning !== false &&
          ((currentUserId && w.userId === currentUserId) ||
            (currentMember && w.userId === currentMember.id) ||
            (auth?.currentUser?.uid && w.userId === auth.currentUser.uid))
      ) || null
    );
  }, [activeWorkers, currentUserId, currentMember]);

  // Cronómetro reactivo: actualiza cada segundo cuando hay un timer en curso
  useEffect(() => {
    if (!myActiveWorker) return;
    const interval = setInterval(() => {
      setLiveClockTick((prev) => (prev + 1) % 1000000);
    }, 1000);
    return () => clearInterval(interval);
  }, [myActiveWorker]);

  // Calcula los segundos acumulados en vivo por la tarea activa
  const computeActiveLiveSeconds = (taskId: string): number => {
    // Referencia intencional para reaccionar al tick del reloj en vivo
    if (liveClockTick < 0) return 0;
    if (!myActiveWorker || myActiveWorker.taskId !== taskId) return 0;
    const startedMs = myActiveWorker.startedAtMs || (
      typeof myActiveWorker.startedAt === 'number'
        ? myActiveWorker.startedAt
        : myActiveWorker.startedAt
        ? new Date(myActiveWorker.startedAt).getTime()
        : Date.now()
    );
    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
    return (myActiveWorker.accumulatedSeconds || 0) + elapsedSinceStart;
  };

  // Rol efectivo: Socio, Gerente y TI tienen visualización y supervisión por default en todos los proyectos
  const effectiveRole = normalizeRole(user?.role || currentMember?.role);
  const isExecutiveRole = effectiveRole === 'Socio' || effectiveRole === 'Gerente' || effectiveRole === 'TI';

  // Tareas asignadas al usuario actual
  const userAssignedTasks = useMemo(() => {
    if (!user && !currentMember) return [];
    const userAssignments = assignments.filter(
      (a) =>
        (currentUserId && a.userId === currentUserId) ||
        (currentMember && a.userId === currentMember.id) ||
        (auth?.currentUser?.uid && a.userId === auth.currentUser.uid)
    );
    const assignedTaskIds = new Set(userAssignments.map((a) => a.taskId));
    return tasks.filter((t) => doesTaskBelongToUser(t, userIdentity, assignedTaskIds));
  }, [tasks, assignments, currentUserId, currentMember, user, userIdentity]);

  // Empresas disponibles en el filtro:
  // - Socio, Gerente y TI: todas las empresas del catálogo por default.
  // - Supervisor y Colaborador: empresas asociadas a sus tareas y permisos.
  const assignedClients = useMemo(() => {
    if (isExecutiveRole) {
      return clients.filter((c) => c.id !== 'cli-extraordinario');
    }

    const clientIds = new Set<string>();

    if (currentMember?.allowedClientIds && currentMember.allowedClientIds.length > 0) {
      currentMember.allowedClientIds.forEach((id) => clientIds.add(id));
    }

    userAssignedTasks.forEach((t) => {
      if (t.companyId && t.companyId !== 'cli-extraordinario') {
        clientIds.add(t.companyId);
      }
      const proj = projects.find((p) => p.id === t.projectId);
      if (proj?.clientId && proj.clientId !== 'cli-extraordinario') {
        clientIds.add(proj.clientId);
      }
    });

    return clients.filter((c) => clientIds.has(c.id) && c.id !== 'cli-extraordinario');
  }, [clients, currentMember, userAssignedTasks, projects, isExecutiveRole]);

  // Proyectos disponibles en el filtro:
  // - Socio, Gerente y TI: todos los proyectos activos (filtrados opcionalmente por cliente).
  // - Supervisor y Colaborador: proyectos asignados a sus tareas.
  const assignedProjects = useMemo(() => {
    if (isExecutiveRole) {
      return projects.filter((p) => {
        if (p.id === 'prj-extraordinario') return false;
        if (selectedClientId !== 'all' && selectedClientId !== 'extraordinary') {
          return p.clientId === selectedClientId;
        }
        return true;
      });
    }

    const projIds = new Set(userAssignedTasks.map((t) => t.projectId).filter(Boolean));
    return projects.filter((p) => {
      if (!projIds.has(p.id)) return false;
      if (selectedClientId !== 'all' && selectedClientId !== 'extraordinary') {
        return p.clientId === selectedClientId;
      }
      return true;
    });
  }, [userAssignedTasks, projects, selectedClientId, isExecutiveRole]);

  // Rubros disponibles en las tareas del contexto
  const availableRubros = useMemo(() => {
    const rubros = new Set<string>();
    const sourceTasks =
      isExecutiveRole && (selectedProjectId !== 'all' || selectedClientId !== 'all' || userAssignedTasks.length === 0)
        ? tasks
        : userAssignedTasks;
    sourceTasks.forEach((t) => {
      if (t.rubro) rubros.add(t.rubro);
      else if (typeof t.rubroNumber === 'number') rubros.add(`Rubro ${t.rubroNumber}`);
    });
    return Array.from(rubros);
  }, [userAssignedTasks, isExecutiveRole, selectedProjectId, selectedClientId, tasks]);

  const getTaskAllocatedHours = (taskId: string): number => {
    const asg = assignments.find(
      (a) =>
        a.taskId === taskId &&
        ((currentUserId && a.userId === currentUserId) ||
          (currentMember && a.userId === currentMember.id))
    );
    if (asg?.allocatedHours && asg.allocatedHours > 0) return asg.allocatedHours;
    const taskObj = tasks.find((t) => t.id === taskId);
    if (taskObj && typeof taskObj.plannedMinutes === 'number' && taskObj.plannedMinutes > 0) {
      return Number((taskObj.plannedMinutes / 60).toFixed(4));
    }
    return taskObj?.plannedHours || 0;
  };

  const getTaskUserActualHours = (taskId: string): number => {
    if (!currentUserId && !currentMember) return 0;
    const userKey = currentUserId ? `${taskId}_${currentUserId}` : '';
    const memberKey = currentMember ? `${taskId}_${currentMember.id}` : '';
    const fromStore =
      (userKey && userTaskActualHours[userKey]) ||
      (memberKey && userTaskActualHours[memberKey]) ||
      0;
    if (fromStore > 0) return fromStore;
    const taskObj = tasks.find((t) => t.id === taskId);
    if (taskObj && typeof taskObj.loggedMinutes === 'number' && taskObj.loggedMinutes > 0) {
      return Number((taskObj.loggedMinutes / 60).toFixed(4));
    }
    return 0;
  };

  // Clasificación efectiva de columna:
  // - completed -> Finalizadas
  // - review -> En Revisión
  // - Activa en timer O con horas reales O status progress/in_progress -> En Proceso
  // - Sin tiempo y no iniciada -> Nueva Tarea Asignada
  const getEffectiveColumnId = (task: TaskNode): 'pending' | 'progress' | 'review' | 'completed' => {
    if (task.status === 'completed') return 'completed';
    if (task.status === 'review') return 'review';

    const isWorkingOnIt = myActiveWorker?.taskId === task.id;
    const userActual = getTaskUserActualHours(task.id);
    const isStarted =
      isWorkingOnIt ||
      userActual > 0 ||
      task.status === 'progress' ||
      task.status === 'in_progress';

    if (isStarted) return 'progress';
    return 'pending';
  };

  const filteredTasks = useMemo(() => {
    let result: TaskNode[];
    if (
      isExecutiveRole &&
      (selectedProjectId !== 'all' || selectedClientId !== 'all' || userAssignedTasks.length === 0)
    ) {
      result = tasks.filter((t) => t.isActive !== false);
    } else {
      result = [...userAssignedTasks];
    }

    if (selectedClientId === 'extraordinary') {
      result = result.filter((t) => t.isExtraordinary || t.projectId === 'prj-extraordinario');
    } else if (selectedClientId !== 'all') {
      const projectIdsForClient = new Set(
        projects.filter((p) => p.clientId === selectedClientId).map((p) => p.id)
      );
      result = result.filter(
        (t) => projectIdsForClient.has(t.projectId) || t.companyId === selectedClientId
      );
    }

    if (selectedProjectId !== 'all') {
      result = result.filter((t) => t.projectId === selectedProjectId);
    }

    if (selectedRubro !== 'all') {
      result = result.filter(
        (t) =>
          t.rubro === selectedRubro ||
          (typeof t.rubroNumber === 'number' && `Rubro ${t.rubroNumber}` === selectedRubro)
      );
    }

    if (selectedStatus !== 'all') {
      result = result.filter((t) => getEffectiveColumnId(t) === selectedStatus);
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter((t) => {
        const proj = projects.find((p) => p.id === t.projectId);
        const cli = clients.find((c) => c.id === (proj?.clientId || t.companyId));
        return (
          t.name.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          (cli &&
            (cli.name.toLowerCase().includes(query) ||
              (cli.commercialName || '').toLowerCase().includes(query))) ||
          (t.companyName && t.companyName.toLowerCase().includes(query)) ||
          (proj && proj.name.toLowerCase().includes(query)) ||
          (t.projectName && t.projectName.toLowerCase().includes(query)) ||
          (t.procedimiento && t.procedimiento.toLowerCase().includes(query)) ||
          (t.rubro && t.rubro.toLowerCase().includes(query))
        );
      });
    }

    if (sortOrder === 'asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [
    userAssignedTasks,
    selectedClientId,
    selectedProjectId,
    selectedRubro,
    selectedStatus,
    searchTerm,
    sortOrder,
    projects,
    clients,
    myActiveWorker,
    userTaskActualHours,
    tasks,
  ]);

  // Acción única de la columna En Proceso: Finalizar Tarea
  const handleOpenFinalizeModal = (task: TaskNode) => {
    setFinalizingTask(task);
  };

  const handleConfirmFinalizeTask = (finalHours: number) => {
    if (!finalizingTask) return;
    const isCurrentActive = myActiveWorker?.taskId === finalizingTask.id;
    if (isCurrentActive) {
      stopWorkerTimer(currentUserId);
      localStorage.removeItem('rb_active_task_id');
      if (currentUserId) {
        localStorage.removeItem(`rb_active_task_id_${currentUserId}`);
      }
    }

    // Al finalizar por el colaborador, pasa a "review" para validación del supervisor
    finalizeTaskWithHours(
      finalizingTask.id,
      currentUserId,
      finalHours,
      currentMember?.name || user?.name
    );
    moveTaskStatus(
      finalizingTask.id,
      'review',
      currentUserId,
      currentMember?.name || user?.name
    );

    addToast(
      `Tarea "${finalizingTask.name}" enviada a "En Revisión" para el supervisor (${formatMinutesSexagesimal(
        Math.round(finalHours * 60)
      )} reportados).`,
      'success'
    );
    setFinalizingTask(null);
  };

  const handleAddNoteToTask = (noteData: { text: string; linkUrl?: string }) => {
    if (!selectedTaskForDetail) return;
    addTaskNote(selectedTaskForDetail.id, {
      text: noteData.text,
      linkUrl: noteData.linkUrl,
      authorId: currentUserId,
      authorName: currentMember?.name || user?.name || 'Colaborador',
      authorRole: currentMember?.roleTitle || 'Colaborador',
    });
    addToast('Nota registrada en la bitácora.', 'success');
  };

  // Mantener actualizado el objeto de tarea seleccionado si cambian las notas en el store
  const activeDetailTaskLive = useMemo(() => {
    if (!selectedTaskForDetail) return null;
    return tasks.find((t) => t.id === selectedTaskForDetail.id) || selectedTaskForDetail;
  }, [selectedTaskForDetail, tasks]);

  const detailCompany = useMemo(() => {
    if (!activeDetailTaskLive) return null;
    const proj = projects.find((p) => p.id === activeDetailTaskLive.projectId);
    return (
      clients.find((c) => c.id === (proj?.clientId || activeDetailTaskLive.companyId)) || null
    );
  }, [activeDetailTaskLive, projects, clients]);

  const detailProject = useMemo(() => {
    if (!activeDetailTaskLive) return null;
    return projects.find((p) => p.id === activeDetailTaskLive.projectId) || null;
  }, [activeDetailTaskLive, projects]);

  const renderBoard = () => {
    return (
      <div className="flex-1 flex flex-col p-6 space-y-6">
        {/* Banner Explicativo de Fuente Única de Tiempo */}
        <div className="py-2 px-1 text-xs text-slate-600">
          <span className="font-medium text-slate-700">
            <strong className="text-slate-900">Control de Tiempo Unificado:</strong> Tu actividad en curso se controla desde el selector de tarea de tu asistencia. Las tareas pasan a <em>En Proceso</em> automáticamente al cronometrar y a <em>En Revisión</em> al finalizar.
          </span>
        </div>

        {/* Barra Superior: Filtros y Acciones */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 px-1">
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Filtros:
            </span>

            {/* Filtro Empresa */}
            <select
              data-tour="task-selector"
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedProjectId('all');
              }}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-700 focus:border-blue-700 cursor-pointer"
            >
              <option value="all">Todas las empresas ({assignedClients.length})</option>
              <option value="extraordinary">Actividades Extraordinarias</option>
              {assignedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.commercialName || c.name}
                </option>
              ))}
            </select>

            {/* Filtro Proyecto / Servicio */}
            {assignedProjects.length > 0 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-700 focus:border-blue-700 cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">Todos los proyectos / servicios ({assignedProjects.length})</option>
                {assignedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro Rubro */}
            {availableRubros.length > 0 && (
              <select
                value={selectedRubro}
                onChange={(e) => setSelectedRubro(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-700 focus:border-blue-700 cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">Todos los rubros ({availableRubros.length})</option>
                {availableRubros.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro Estado */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-700 focus:border-blue-700 cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Nuevas Asignadas</option>
              <option value="progress">En Proceso</option>
              <option value="review">En Revisión</option>
              <option value="completed">Finalizadas</option>
            </select>

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
              onClick={() =>
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? 'none' : 'asc'))
              }
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

        {/* Mensaje de bienvenida si no hay tareas asignadas */}
        {userAssignedTasks.length === 0 && (
          <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Aún no tienes tareas asignadas en tu tablero
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tu jornada se contabiliza como tiempo general. Puedes registrar una actividad extraordinaria con el botón superior.
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
              const columnTasks = filteredTasks.filter((t) => getEffectiveColumnId(t) === stage.id);

              return (
                <div
                  key={stage.id}
                  id={stage.id === 'review' ? 'board-in-review-col' : undefined}
                  data-tour={stage.id === 'progress' ? 'board-column-progress' : undefined}
                  className="flex-1 min-w-[290px] max-w-[330px] flex flex-col"
                >
                  {/* Cabecera Desencapsulada de la Columna */}
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                      <h3 className="font-semibold text-slate-900 text-sm tracking-tight">{stage.title}</h3>
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tarjetas de la Columna */}
                  <div className="space-y-3 min-h-[220px]">
                    {columnTasks.map((task) => {
                      const project = projects.find((p) => p.id === task.projectId);
                      const client = clients.find((c) => c.id === (project?.clientId || task.companyId));
                      const displayCompanyName =
                        client?.commercialName || client?.name || task.companyName || 'Empresa';
                      const displayProjectName = project?.name || task.projectName || 'Proyecto';
                      const allocatedHours = getTaskAllocatedHours(task.id);
                      const actualHours = getTaskUserActualHours(task.id);
                      const allocatedMinutes = Math.max(0, Math.round(allocatedHours * 60));
                      const storedActualMinutes = Math.max(0, Math.round(actualHours * 60));

                      const isCurrentlyActive = myActiveWorker?.taskId === task.id;
                      const runningSeconds = isCurrentlyActive ? computeActiveLiveSeconds(task.id) : 0;
                      const liveMinutes = Math.floor(runningSeconds / 60);
                      const totalActualMinutes = storedActualMinutes + liveMinutes;

                      const percentConsumed =
                        allocatedMinutes > 0
                          ? Math.round((totalActualMinutes / allocatedMinutes) * 100)
                          : 0;

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskForDetail(task)}
                          className={`bg-white rounded-md p-4 border transition-all space-y-3 cursor-pointer ${
                            isCurrentlyActive
                              ? 'border-blue-600 ring-2 ring-blue-700/20 bg-blue-50/10 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          {/* Empresa (con logotipo/monograma) y Prioridad */}
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            {task.isExtraordinary || task.projectId === 'prj-extraordinario' ? (
                              <span className="font-semibold text-[11px] text-blue-700 uppercase tracking-wider truncate">
                                Tarea Extraordinaria
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 min-w-0">
                                <CompanyLogoBadge
                                  name={client?.name || task.companyName}
                                  commercialName={client?.commercialName}
                                  logoUrl={client?.logoUrl}
                                  size="sm"
                                />
                                <span className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider truncate">
                                  {displayCompanyName}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center space-x-1.5 shrink-0">
                              {task.isManuallyModified && (
                                <span
                                  title={
                                    task.manualAdjustment?.reason
                                      ? `Modificado manualmente por ${task.manualAdjustment.modifiedByName || 'Supervisor'}: "${task.manualAdjustment.reason}"`
                                      : 'Modificado de manera manual'
                                  }
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 cursor-help"
                                >
                                  Modificado manual
                                </span>
                              )}
                              {isCurrentlyActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-blue-700 text-white shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>EN VIVO</span>
                                </span>
                              )}
                              {task.priority && (
                                <span
                                  className={`text-[10px] font-medium uppercase tracking-wider ${
                                    task.priority === 'urgent'
                                      ? 'text-rose-700'
                                      : task.priority === 'high'
                                      ? 'text-amber-700'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {task.priority === 'urgent'
                                    ? 'Urgente'
                                    : task.priority === 'high'
                                    ? 'Alta'
                                    : task.priority === 'low'
                                    ? 'Baja'
                                    : 'Media'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Nombre de la Tarea y Subtítulo */}
                          <div>
                            <h4
                              className={`font-semibold text-sm leading-snug ${
                                task.status === 'completed'
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-900'
                              }`}
                            >
                              {task.name}
                            </h4>
                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {task.isExtraordinary || task.projectId === 'prj-extraordinario' ? (
                                <span className="truncate">
                                  {task.extraordinaryCategory || 'Actividad Extraordinaria'}
                                </span>
                              ) : (
                                <span className="truncate">{displayProjectName}</span>
                              )}
                            </div>
                            {task.locationMode && (
                              <div className="text-xs text-slate-400 mt-1 truncate">
                                {task.locationMode === 'client_site'
                                  ? `En Oficina de Cliente${task.locationAddress ? ` • ${task.locationAddress}` : ''}`
                                  : 'En Oficina (Despacho)'}
                              </div>
                            )}
                          </div>

                          {/* Alerta de Retorno por el Supervisor */}
                          {stage.id === 'review' && task.supervisorReviewNote && (
                            <div className="border-l-2 border-amber-500 pl-3 py-1.5 text-xs text-amber-900 space-y-0.5 bg-amber-50/50 rounded-r-md">
                              <span className="font-semibold text-amber-900 block">
                                Retornada por el Supervisor
                              </span>
                              <p className="text-xs text-amber-800 leading-relaxed">
                                {task.supervisorReviewNote}
                              </p>
                            </div>
                          )}

                          {/* Avance en Tiempo: Presupuesto vs Invertido en formato sexagesimal (Xh Ym) */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">
                                {isCurrentlyActive ? (
                                  <span className="text-[#1E3A8A] dark:text-sky-400 font-semibold flex items-center gap-1">
                                    <span>En curso ahora:</span>
                                    <span className="tabular-nums">
                                      {formatMinutesSexagesimal(liveMinutes)}
                                    </span>
                                  </span>
                                ) : (
                                  'Avance de tiempo:'
                                )}
                              </span>
                              <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatMinutesSexagesimal(totalActualMinutes)}{' '}
                                <span className="text-slate-400 font-normal">
                                  /{' '}
                                  {allocatedMinutes > 0
                                    ? formatMinutesSexagesimal(allocatedMinutes)
                                    : 'Sin estimación'}
                                </span>
                              </span>
                            </div>

                            {/* Barra de Progreso Discreta */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  task.status === 'completed'
                                    ? 'bg-slate-400'
                                    : percentConsumed > 100
                                    ? 'bg-rose-600'
                                    : 'bg-[#1E3A8A] dark:bg-blue-600'
                                }`}
                                style={{ width: `${Math.min(100, percentConsumed || 4)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                              <span>Consumo: {percentConsumed}%</span>
                              {task.dueDate && <span>Vence: {task.dueDate}</span>}
                            </div>
                          </div>

                          {/* Pie de la Tarjeta con Acción Única Sobria y Cronómetro */}
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
                            <span className="text-xs text-slate-400 truncate">
                              {task.notes && task.notes.length > 0
                                ? `${task.notes.length} notas`
                                : 'Ver detalle'}
                            </span>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Iniciar / Pausar Cronómetro directo */}
                              {stage.id !== 'completed' && stage.id !== 'review' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isCurrentlyActive) {
                                      stopWorkerTimer(currentUserId);
                                      addToast(`Cronómetro en pausa para "${task.name}".`, 'info');
                                    } else {
                                      startWorkerTimer({
                                        userId: currentUserId,
                                        userName: currentMember?.name || user?.name || 'Usuario',
                                        taskId: task.id,
                                        taskName: task.name,
                                        projectId: task.projectId,
                                        projectName: displayProjectName,
                                        clientName: displayCompanyName,
                                        startedAtMs: Date.now(),
                                        startedAt: Date.now(),
                                        accumulatedSeconds: runningSeconds,
                                        isRunning: true,
                                        currentDurationStr: formatMinutesSexagesimal(liveMinutes),
                                      });
                                      addToast(`Cronómetro iniciado en "${task.name}".`, 'success');
                                    }
                                  }}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 border ${
                                    isCurrentlyActive
                                      ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300'
                                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                  }`}
                                  title={isCurrentlyActive ? 'Pausar cronómetro' : 'Iniciar cronómetro en esta tarea'}
                                >
                                  {isCurrentlyActive ? (
                                    <>
                                      <Pause className="w-3 h-3 fill-current" />
                                      <span>Pausar</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 fill-current" />
                                      <span>Iniciar</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* En Proceso: Acción Única -> Finalizar */}
                              {stage.id === 'progress' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFinalizeModal(task);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded transition-colors cursor-pointer"
                                  title="Finalizar tarea y enviar a revisión del supervisor"
                                >
                                  Finalizar
                                </button>
                              )}

                              {/* Acción de Revisión para Supervisor / Gerente / Socio */}
                              {task.reviewStatus === 'lead_reviewed' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800" title={`Revisión aprobada por ${task.reviewedBy?.name || 'Supervisor'}`}>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>Revisión Finalizada</span>
                                </span>
                              ) : canReview ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewModalTask({
                                      task,
                                      projectName: displayProjectName,
                                      companyName: displayCompanyName,
                                    });
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                                  title="Finalizar revisión y aprobar tarea al 100%"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
                                  <span>Finalizar Revisión</span>
                                </button>
                              ) : (
                                <>
                                  {/* En Revisión: Tarjeta de solo lectura */}
                                  {stage.id === 'review' && (
                                    <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                                      En Revisión
                                    </span>
                                  )}

                                  {/* Finalizadas: Tarjeta de solo lectura */}
                                  {stage.id === 'completed' && (
                                    <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                                      Concluida
                                    </span>
                                  )}
                                </>
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
      {/* Selector de Pestañas Editorial */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 sm:px-8 py-2 bg-slate-50/60">
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
          <span className="font-semibold text-slate-800">
            {currentMember?.name || user?.name || 'Colaborador'}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">{userAssignedTasks.length} tareas asignadas</span>
        </div>
      </div>

      {/* Contenido */}
      {activeTab === 'board' ? renderBoard() : <UserCalendarView />}

      {/* Drawer de Detalle Completo y Bitácora de Avances */}
      {selectedTaskForDetail && (
        <TaskDetailDrawer
          isOpen={Boolean(selectedTaskForDetail)}
          onClose={() => setSelectedTaskForDetail(null)}
          task={activeDetailTaskLive}
          companyName={
            detailCompany?.commercialName ||
            detailCompany?.name ||
            activeDetailTaskLive?.companyName ||
            'Empresa'
          }
          projectName={
            detailProject?.name || activeDetailTaskLive?.projectName || 'Proyecto'
          }
          companyLogoUrl={detailCompany?.logoUrl}
          allocatedMinutes={
            activeDetailTaskLive
              ? Math.max(0, Math.round(getTaskAllocatedHours(activeDetailTaskLive.id) * 60))
              : 0
          }
          actualMinutes={
            activeDetailTaskLive
              ? Math.max(0, Math.round(getTaskUserActualHours(activeDetailTaskLive.id) * 60))
              : 0
          }
          isCurrentlyActive={myActiveWorker?.taskId === activeDetailTaskLive?.id}
          activeSecondsRunning={
            activeDetailTaskLive ? computeActiveLiveSeconds(activeDetailTaskLive.id) : 0
          }
          onAddNote={handleAddNoteToTask}
          onAdjustTime={async (newMinutes, reason) => {
            if (!activeDetailTaskLive) return;
            await adjustTaskTimeManually(
              activeDetailTaskLive.id,
              newMinutes,
              reason,
              {
                id: currentUserId,
                name: currentMember?.name || user?.name || 'Usuario',
                email: user?.email,
              }
            );
            addToast('Tiempo de la tarea ajustado exitosamente con registro de auditoría.', 'success');
          }}
          onFinalizeTask={() => {
            if (activeDetailTaskLive) {
              handleOpenFinalizeModal(activeDetailTaskLive);
            }
          }}
          canReview={canReview}
          onFinalizeReview={() => {
            if (activeDetailTaskLive) {
              setReviewModalTask({
                task: activeDetailTaskLive,
                projectName: detailProject?.name || activeDetailTaskLive.projectName,
                companyName:
                  detailCompany?.commercialName ||
                  detailCompany?.name ||
                  activeDetailTaskLive.companyName,
              });
            }
          }}
        />
      )}

      {/* Modal para Confirmar Finalización y Últimos Ajustes de Tiempo */}
      {finalizingTask && (
        <FinalizeTaskModal
          isOpen={Boolean(finalizingTask)}
          onClose={() => setFinalizingTask(null)}
          task={finalizingTask}
          clientName={
            finalizingTask.isExtraordinary || finalizingTask.projectId === 'prj-extraordinario'
              ? 'Actividad Extraordinaria'
              : clients.find(
                  (c) =>
                    c.id ===
                    (projects.find((p) => p.id === finalizingTask.projectId)?.clientId ||
                      finalizingTask.companyId)
                )?.name || 'Empresa'
          }
          projectName={
            finalizingTask.isExtraordinary || finalizingTask.projectId === 'prj-extraordinario'
              ? finalizingTask.extraordinaryCategory || 'Tareas Extraordinarias e Imprevistas'
              : projects.find((p) => p.id === finalizingTask.projectId)?.name || 'Proyecto'
          }
          currentHours={getTaskUserActualHours(finalizingTask.id)}
          allocatedHours={getTaskAllocatedHours(finalizingTask.id)}
          onConfirmFinalize={handleConfirmFinalizeTask}
        />
      )}

      {/* Modal para Crear y Registrar Tareas Extraordinarias Sin Empresa */}
      {isExtraordinaryModalOpen && (
        <CreateExtraordinaryTaskModal
          isOpen={isExtraordinaryModalOpen}
          onClose={() => setIsExtraordinaryModalOpen(false)}
          onSubmit={(data) => {
            addExtraordinaryTask({
              name: data.name,
              description: data.description,
              plannedHours: data.plannedHours,
              category: data.category,
              userId: currentUserId,
              userName: currentMember?.name || user?.name || 'Colaborador',
            });
            addToast(
              `Tarea extraordinaria "${data.name}" agregada a "Nueva Tarea Asignada".`,
              'success'
            );
          }}
        />
      )}

      {/* Modal de Finalizar Revisión para Supervisor / Gerente / Socio */}
      {reviewModalTask && (
        <FinalizeReviewModal
          isOpen={Boolean(reviewModalTask)}
          onClose={() => setReviewModalTask(null)}
          task={reviewModalTask.task}
          projectName={reviewModalTask.projectName}
          companyName={reviewModalTask.companyName}
        />
      )}
    </div>
  );
}
