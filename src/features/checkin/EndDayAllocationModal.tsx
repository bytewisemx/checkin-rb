import { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle2, Clock, Plus, X, Building2, 
  Briefcase, CheckSquare, Sparkles, AlertCircle 
} from 'lucide-react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';

interface EndDayAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCloseDay: (allocations: Array<{ taskId: string; hours: number }>) => void;
  onCloseAsGeneral: () => void;
  workedDurationMinutes: number;
  activeTaskId?: string | null;
}

export function EndDayAllocationModal({
  isOpen,
  onClose,
  onConfirmCloseDay,
  onCloseAsGeneral,
  workedDurationMinutes,
  activeTaskId,
}: EndDayAllocationModalProps) {
  const { 
    clients, 
    projects, 
    tasks, 
    teamMembers, 
    createAndAssignTask 
  } = useRayonerStore();

  const user = useCheckinStore(state => state.user);
  const addToast = useCheckinStore(state => state.addToast);

  // Perfil del colaborador en Rayoner
  const currentMember = useMemo(() => {
    if (!user) return teamMembers[0] || null;
    return teamMembers.find(
      m => m.id === user.id || m.email.toLowerCase() === user.email.toLowerCase()
    ) || teamMembers[0] || null;
  }, [user, teamMembers]);

  // Total de horas trabajadas hoy en formato decimal (ej: 7.5 hrs)
  const totalDayHours = useMemo(() => {
    return Math.max(0.1, Number((workedDurationMinutes / 60).toFixed(2)));
  }, [workedDurationMinutes]);

  // Clientes y proyectos permitidos
  const allowedClientIds = currentMember?.allowedClientIds || clients.map(c => c.id);
  const allowedProjects = useMemo(() => {
    return projects.filter(p => allowedClientIds.includes(p.clientId) && p.isActive);
  }, [projects, allowedClientIds]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  // Tareas disponibles para este colaborador
  const availableTasks = useMemo(() => {
    return tasks.filter(t => allowedProjectIds.includes(t.projectId) && t.isActive);
  }, [tasks, allowedProjectIds]);

  // Mapa de horas imputadas por tarea: taskId -> horas
  const [allocatedHours, setAllocatedHours] = useState<Record<string, number>>({});

  // Subformulario para crear tarea si no está en la lista
  const [isAddingNewTask, setIsAddingNewTask] = useState(false);
  const [newProjectId, setNewProjectId] = useState(allowedProjects[0]?.id || '');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskHours, setNewTaskHours] = useState(4);

  // Inicializar imputaciones cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};

      // Si estuvo cronometrando una tarea en específico, precargarle las horas
      if (activeTaskId && availableTasks.some(t => t.id === activeTaskId)) {
        initial[activeTaskId] = totalDayHours;
      }

      setAllocatedHours(initial);
      setIsAddingNewTask(false);
    }
  }, [isOpen, activeTaskId, totalDayHours, availableTasks]);

  // Suma total de horas asignadas por el usuario
  const sumAllocatedHours = useMemo(() => {
    const sum = Object.values(allocatedHours).reduce((acc, h) => acc + (Number(h) || 0), 0);
    return Number(sum.toFixed(2));
  }, [allocatedHours]);

  const remainingHours = Number((totalDayHours - sumAllocatedHours).toFixed(2));
  const progressRatio = totalDayHours > 0 ? (sumAllocatedHours / totalDayHours) : 0;
  const isBalanced = Math.abs(remainingHours) <= 0.05;

  if (!isOpen) return null;

  // Actualizar horas de una tarea
  const handleSetHours = (taskId: string, hours: number) => {
    setAllocatedHours(prev => ({
      ...prev,
      [taskId]: Math.max(0, Number(hours.toFixed(2)))
    }));
  };

  // Botón rápido para asignar el tiempo restante a una tarea
  const handleAssignRemaining = (taskId: string) => {
    const currentTaskHours = allocatedHours[taskId] || 0;
    const add = remainingHours > 0 ? remainingHours : 0;
    handleSetHours(taskId, currentTaskHours + add);
  };

  // Crear tarea y agregarla a la lista de imputación
  const handleCreateTaskAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) {
      addToast('Ingresa un nombre para la tarea', 'error');
      return;
    }
    if (!newProjectId) {
      addToast('Selecciona un proyecto asignado', 'error');
      return;
    }

    const userId = currentMember?.id || 'usr-ana';
    const userName = currentMember?.name || user?.name || 'Colaborador';

    const createdId = createAndAssignTask(
      newProjectId,
      newTaskName.trim(),
      newTaskHours,
      userId,
      userName
    );

    addToast(`Tarea "${newTaskName.trim()}" creada y agregada a tu jornada`, 'success');
    
    // Si queda tiempo restante, asignárselo a esta nueva tarea
    if (remainingHours > 0) {
      handleSetHours(createdId, remainingHours);
    } else {
      handleSetHours(createdId, 1);
    }

    setIsAddingNewTask(false);
    setNewTaskName('');
  };

  // Confirmar Cierre
  const handleConfirm = () => {
    const allocationsArray = Object.entries(allocatedHours)
      .filter(([_, hours]) => hours > 0)
      .map(([taskId, hours]) => ({ taskId, hours }));

    onConfirmCloseDay(allocationsArray);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-6 flex flex-col max-h-[92vh]">
        
        {/* Cabecera */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#0D5C75] via-[#116985] to-[#0D5C75] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight text-white">
                Cierre de Jornada y Reporte de Horas
              </h3>
              <p className="text-[11px] text-slate-200">
                Distribuye tu tiempo trabajado hoy entre tus proyectos y tareas asignadas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Card Resumen de Tiempo y Balanza */}
          <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tiempo Total Registrado Hoy
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {totalDayHours} hrs
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Horas Asignadas a Tareas
                </span>
                <span className={`text-2xl font-black ${
                  isBalanced ? 'text-emerald-600' : 'text-[#FF6B35]'
                }`}>
                  {sumAllocatedHours} / {totalDayHours} hrs
                </span>
              </div>
            </div>

            {/* Barra de Progreso de Conciliación */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isBalanced 
                    ? 'bg-emerald-500' 
                    : progressRatio > 1 
                      ? 'bg-rose-500' 
                      : 'bg-[#FF6B35]'
                }`}
                style={{ width: `${Math.min(100, Math.round(progressRatio * 100))}%` }}
              />
            </div>

            {/* Estado de Balanza */}
            <div className="flex items-center justify-between mt-2 text-xs">
              {isBalanced ? (
                <span className="text-emerald-700 font-bold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Jornada 100% justificada y conciliada
                </span>
              ) : remainingHours > 0 ? (
                <span className="text-amber-700 font-semibold flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Te faltan <b>{remainingHours} hrs</b> por asignar a tareas
                </span>
              ) : (
                <span className="text-rose-600 font-semibold flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Excediste por <b>{Math.abs(remainingHours)} hrs</b> el tiempo del día
                </span>
              )}

              <span className="text-slate-400 text-[11px]">
                {Math.round(progressRatio * 100)}% distribuido
              </span>
            </div>
          </div>

          {/* Subformulario para Agregar Nueva Tarea si no está en la lista */}
          {isAddingNewTask ? (
            <form onSubmit={handleCreateTaskAndAdd} className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                  <Sparkles className="w-4 h-4 text-[#FF6B35]" />
                  <span>Agregar Tarea a la Jornada</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNewTask(false)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Proyecto del Cliente Autorizado *
                </label>
                <select
                  value={newProjectId}
                  onChange={e => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                >
                  {allowedProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nombre de la Tarea *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Revisión y validación de inventarios físicos..."
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Horas Presupuestadas / Estimadas
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newTaskHours}
                  onChange={e => setNewTaskHours(parseFloat(e.target.value) || 1)}
                  className="w-28 px-3 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNewTask(false)}
                  className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-[#FF6B35] hover:bg-[#e05622] text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Agregar a la Jornada
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tareas Asignadas ("Hoy trabajé tales horas en...")
              </span>

              <button
                type="button"
                onClick={() => setIsAddingNewTask(true)}
                className="flex items-center space-x-1 text-xs font-bold text-[#0D5C75] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ¿No está tu tarea? Agregarla</span>
              </button>
            </div>
          )}

          {/* Listado de Tareas Asignadas para Imputar Horas */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {availableTasks.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckSquare className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">
                  No tienes tareas en la lista
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Haz clic en "+ ¿No está tu tarea? Agregarla" para registrar tu actividad de hoy.
                </p>
              </div>
            ) : (
              availableTasks.map(task => {
                const project = projects.find(p => p.id === task.projectId);
                const client = clients.find(c => c.id === project?.clientId);
                const currentTaskAllocated = allocatedHours[task.id] || 0;

                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      currentTaskAllocated > 0 
                        ? 'bg-blue-50/40 border-blue-200 shadow-2xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Datos de la Tarea */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {task.name}
                          </span>
                          {task.id === activeTaskId && (
                            <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full">
                              Cronometrada
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1">
                          <span className="flex items-center">
                            <Building2 className="w-3 h-3 mr-1 text-[#0D5C75]" />
                            {client?.name || 'Cliente'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center">
                            <Briefcase className="w-3 h-3 mr-1 text-emerald-600" />
                            {project?.name || 'Proyecto'}
                          </span>
                        </div>
                      </div>

                      {/* Control de Horas para esta tarea */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Botón rápido +30m */}
                        <button
                          type="button"
                          onClick={() => handleSetHours(task.id, currentTaskAllocated + 0.5)}
                          className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                        >
                          +30m
                        </button>

                        {/* Botón rápido +1h */}
                        <button
                          type="button"
                          onClick={() => handleSetHours(task.id, currentTaskAllocated + 1)}
                          className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                        >
                          +1h
                        </button>

                        {/* Asignar Restante */}
                        {remainingHours > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAssignRemaining(task.id)}
                            className="px-2 py-1 text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                            title="Asignar todo el tiempo restante a esta tarea"
                          >
                            Restante
                          </button>
                        )}

                        {/* Input de Horas */}
                        <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-xl px-2 py-1 focus-within:ring-2 focus-within:ring-[#0D5C75]/20 focus-within:border-[#0D5C75]">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            value={currentTaskAllocated || ''}
                            placeholder="0"
                            onChange={e => handleSetHours(task.id, parseFloat(e.target.value) || 0)}
                            className="w-14 text-xs font-black text-slate-800 text-center outline-none bg-transparent"
                          />
                          <span className="text-[10px] font-bold text-slate-400">hrs</span>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Botones de Cierre */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            
            {/* Botón Principal: Confirmar con Horas */}
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3 bg-[#0D5C75] hover:bg-[#0A485C] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Cierre de Jornada e Imputar Horas ({sumAllocatedHours} hrs)</span>
            </button>

            {/* Opción Sutil: Cerrar como tiempo general */}
            <div className="text-center">
              <button
                type="button"
                onClick={onCloseAsGeneral}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors py-1 px-3 rounded-lg hover:bg-slate-50"
              >
                Cerrar jornada como tiempo general sin imputar a tareas específicas
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
