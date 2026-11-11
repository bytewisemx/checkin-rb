import { useState, useMemo, useEffect } from 'react';
import { 
  Play, CheckSquare, Briefcase, Building2, 
  Plus, X, Clock, ArrowRight, Sparkles, ChevronRight, Timer
} from 'lucide-react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';

interface StartTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTaskAndStart: (taskId: string | null) => void;
}

export function StartTaskModal({
  isOpen,
  onClose,
  onSelectTaskAndStart,
}: StartTaskModalProps) {
  const { 
    clients, 
    projects, 
    tasks, 
    assignments, 
    teamMembers, 
    createAndAssignTask 
  } = useRayonerStore();

  const user = useCheckinStore(state => state.user);
  const addToast = useCheckinStore(state => state.addToast);

  // Obtener el perfil del colaborador en Rayoner
  const currentMember = useMemo(() => {
    if (!user) return teamMembers[0] || null;
    return teamMembers.find(
      m => m.id === user.id || m.email.toLowerCase() === user.email.toLowerCase()
    ) || teamMembers[0] || null;
  }, [user, teamMembers]);

  // Clientes a los que tiene permiso
  const allowedClientIds = currentMember?.allowedClientIds || clients.map(c => c.id);

  // Proyectos disponibles (solo de los clientes autorizados)
  const allowedProjects = useMemo(() => {
    return projects.filter(p => allowedClientIds.includes(p.clientId) && p.isActive);
  }, [projects, allowedClientIds]);

  // Tareas disponibles para este colaborador
  const availableTasks = useMemo(() => {
    const allowedProjectIds = allowedProjects.map(p => p.id);
    return tasks.filter(t => allowedProjectIds.includes(t.projectId) && t.isActive);
  }, [tasks, allowedProjects]);

  // Tareas específicamente asignadas al colaborador
  const myAssignedTaskIds = useMemo(() => {
    if (!currentMember) return [];
    const fromAssignments = assignments.filter(a => a.userId === currentMember.id).map(a => a.taskId);
    const fromDirectField = tasks.filter(t => t.assigned_to === currentMember.id).map(t => t.id);
    return Array.from(new Set([...fromAssignments, ...fromDirectField]));
  }, [assignments, tasks, currentMember]);

  // Detección de última tarea activa del día anterior o prioritaria asignada
  const smartPreselectedTask = useMemo(() => {
    const userId = currentMember?.id || user?.id || 'usr-ana';
    const storedLastId = localStorage.getItem(`rb_active_task_id_${userId}`);
    if (storedLastId) {
      const found = availableTasks.find(t => t.id === storedLastId);
      if (found) return found;
    }
    const myFirstAssigned = availableTasks.find(t => myAssignedTaskIds.includes(t.id));
    if (myFirstAssigned) return myFirstAssigned;
    return availableTasks[0] || null;
  }, [availableTasks, myAssignedTaskIds, currentMember?.id, user?.id]);

  // Estados locales
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    smartPreselectedTask?.id || null
  );
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [autoStartActive, setAutoStartActive] = useState(true);

  // Modo creación de tarea rápida
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(allowedProjects[0]?.id || '');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskHours, setNewTaskHours] = useState(4);

  // Sincronizar selección inicial
  useEffect(() => {
    if (isOpen) {
      const targetId = smartPreselectedTask?.id || null;
      setSelectedTaskId(targetId);
      setCountdown(3);
      setAutoStartActive(true);
      setShowAllTasks(false);
      setIsCreatingTask(false);
    }
  }, [isOpen, smartPreselectedTask]);

  // Auto-arranque tras 3 segundos
  useEffect(() => {
    if (!isOpen || !autoStartActive || showAllTasks || isCreatingTask || !selectedTaskId) {
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onSelectTaskAndStart(selectedTaskId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoStartActive, showAllTasks, isCreatingTask, selectedTaskId, onSelectTaskAndStart]);

  if (!isOpen) return null;

  const smartProject = projects.find(p => p.id === smartPreselectedTask?.projectId);
  const smartClient = clients.find(c => c.id === smartProject?.clientId);

  const handleCreateAndSelectTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) {
      addToast('Ingresa un nombre para la nueva tarea', 'error');
      return;
    }
    if (!newTaskProjectId) {
      addToast('Selecciona un proyecto asignado', 'error');
      return;
    }

    const userId = currentMember?.id || 'usr-ana';
    const userName = currentMember?.name || user?.name || 'Colaborador';

    const createdId = createAndAssignTask(
      newTaskProjectId,
      newTaskName.trim(),
      newTaskHours,
      userId,
      userName
    );

    addToast(`Tarea "${newTaskName.trim()}" creada y asignada`, 'success');
    setIsCreatingTask(false);
    setSelectedTaskId(createdId);
    onSelectTaskAndStart(createdId);
  };

  const handleCancelAutoStart = () => {
    setAutoStartActive(false);
    setShowAllTasks(true);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-[#131D31] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-[#233354] flex flex-col max-h-[90vh] text-[#F8FAFC]">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-[#0F172A] border-b border-[#233354] text-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E40AF]/20 text-[#38BDF8] flex items-center justify-center border border-[#1E40AF]/40">
              <Play className="w-4 h-4 fill-current text-[#38BDF8]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm tracking-tight text-[#F8FAFC]">
                Inicio Rápido de Jornada
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                {autoStartActive && !showAllTasks
                  ? `Comenzando automáticamente en ${countdown}s...`
                  : 'Confirma o selecciona tu tarea para cronometrar'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742] rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* VISTA 1: SMART LAUNCH PRE-SELECTION (Menos de 3 segundos) */}
          {!showAllTasks && !isCreatingTask && smartPreselectedTask && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Iniciando con:
                </span>
                {autoStartActive && (
                  <button
                    type="button"
                    onClick={handleCancelAutoStart}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Detener auto-inicio
                  </button>
                )}
              </div>

              {/* Tarjeta de Tarea Recomendada */}
              <div className="bg-[#101726] border border-[#1E40AF]/60 p-4 rounded-xl relative overflow-hidden group">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-base font-bold text-white tracking-tight truncate">
                      {smartPreselectedTask.name}
                    </h4>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span className="flex items-center truncate text-sky-400">
                        <Building2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                        {smartClient?.name || 'Cliente'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center truncate">
                        <Briefcase className="w-3.5 h-3.5 mr-1 shrink-0" />
                        {smartProject?.name || 'Proyecto'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#1E2B45] text-slate-200 rounded-md border border-slate-700 shrink-0">
                    {smartPreselectedTask.plannedHours}h planeadas
                  </span>
                </div>

                {/* Barra de progreso de auto-inicio */}
                {autoStartActive && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                      <Timer className="w-4 h-4 animate-spin" />
                      <span>Iniciando en {countdown}s</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelAutoStart}
                      className="text-xs text-slate-300 hover:text-white cursor-pointer font-medium"
                    >
                      (o cambiar tarea)
                    </button>
                  </div>
                )}
              </div>

              {/* Botón de Inicio Rápido en 1 Clic */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectTaskAndStart(smartPreselectedTask.id)}
                  className="flex-1 py-3 px-4 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-xl font-heading font-semibold text-xs tracking-wide shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Iniciar Jornada Ahora (1 Clic)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelAutoStart}
                  className="py-3 px-4 bg-[#1A2742] hover:bg-[#233354] text-slate-200 border border-slate-700 rounded-xl font-heading font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Cambiar tarea</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Iniciar sin asignar */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => onSelectTaskAndStart(null)}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Iniciar sin asignar tarea por ahora
                </button>
              </div>
            </div>
          )}

          {/* VISTA 2: LISTA COMPLETA O CREACIÓN */}
          {(showAllTasks || !smartPreselectedTask) && !isCreatingTask && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                  Todas las Tareas Disponibles ({availableTasks.length})
                </span>
                
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(true)}
                  className="flex items-center space-x-1 text-xs font-heading font-semibold text-[#38BDF8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear nueva tarea</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {availableTasks.length === 0 ? (
                  <div className="p-6 text-center bg-[#1A2742] rounded-xl border border-[#233354]">
                    <CheckSquare className="w-6 h-6 text-[#64748B] mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-[#F8FAFC]">
                      No tienes tareas activas asignadas
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      Puedes crear una tarea en este momento con el botón superior.
                    </p>
                  </div>
                ) : (
                  availableTasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    const isDirectlyAssigned = myAssignedTaskIds.includes(task.id);
                    const project = projects.find((p) => p.id === task.projectId);
                    const client = clients.find((c) => c.id === project?.clientId);

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#1E40AF]/25 border-[#1E40AF] ring-1 ring-[#1E40AF]'
                            : 'bg-[#101726] border-[#233354] hover:border-[#38BDF8]/40'
                        }`}
                      >
                        <div className="flex items-start space-x-3 min-w-0 pr-2">
                          <div
                            className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-[#38BDF8] bg-[#1E40AF]' : 'border-[#64748B]'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 bg-[#38BDF8] rounded-full" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                              <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                {task.name}
                              </span>
                              {isDirectlyAssigned && (
                                <span className="text-[9px] font-heading font-bold bg-[#0F172A] text-[#38BDF8] border border-[#233354] px-1.5 py-0.5 rounded-sm">
                                  Asignada
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 text-[10px] text-[#94A3B8] mt-0.5">
                              <span className="flex items-center truncate text-sky-400">
                                <Building2 className="w-3 h-3 mr-1" />
                                {client?.name || 'Cliente'}
                              </span>
                              <span>•</span>
                              <span className="flex items-center truncate">
                                <Briefcase className="w-3 h-3 mr-1 text-[#94A3B8]" />
                                {project?.name || 'Proyecto'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-xs font-heading font-bold text-[#F8FAFC] flex items-center justify-end">
                            <Clock className="w-3 h-3 mr-1 text-[#64748B]" />
                            {task.plannedHours}h
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Botón Principal al elegir en la lista */}
              <button
                type="button"
                disabled={!selectedTaskId}
                onClick={() => onSelectTaskAndStart(selectedTaskId)}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-xl font-heading font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>Iniciar con Tarea Seleccionada</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          {/* VISTA 3: CREACIÓN RÁPIDA */}
          {isCreatingTask && (
            <form onSubmit={handleCreateAndSelectTask} className="bg-[#101726] p-4 rounded-xl border border-[#233354] space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#233354] pb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                  <span className="text-xs font-heading font-semibold text-[#F8FAFC]">
                    Crear Tarea en Proyectos Asignados
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className="text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  Volver
                </button>
              </div>

              {/* Selector de Proyecto */}
              <div>
                <label className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                  Proyecto (Clientes Autorizados) *
                </label>
                <select
                  value={newTaskProjectId}
                  onChange={(e) => setNewTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#131D31] border border-[#233354] rounded-lg font-medium text-[#F8FAFC] focus:border-[#38BDF8] outline-none"
                >
                  {allowedProjects.map((p) => {
                    const client = clients.find((c) => c.id === p.clientId);
                    return (
                      <option key={p.id} value={p.id} className="bg-[#131D31] text-[#F8FAFC]">
                        {client?.name || 'Cliente'} — {p.name} ({p.code})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Nombre de la Tarea */}
              <div>
                <label className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                  Nombre de la Tarea *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Revisión y validación de asientos de ajuste..."
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#131D31] border border-[#233354] rounded-lg font-medium text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8] outline-none"
                />
              </div>

              {/* Horas Estimadas */}
              <div>
                <label className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                  Horas Estimadas (Presupuesto)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newTaskHours}
                  onChange={(e) => setNewTaskHours(parseFloat(e.target.value) || 1)}
                  className="w-32 px-3 py-1.5 text-xs bg-[#131D31] border border-[#233354] rounded-lg font-heading font-bold text-[#F8FAFC] focus:border-[#38BDF8] outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:bg-[#233354] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Crear y Comenzar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
