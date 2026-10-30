import { useState, useMemo } from 'react';
import { 
  Play, CheckSquare, Briefcase, Building2, 
  Plus, X, Clock, ArrowRight, Sparkles 
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

  // Estados locales
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    myAssignedTaskIds[0] || availableTasks[0]?.id || null
  );

  // Modo creación de tarea rápida
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>(allowedProjects[0]?.id || '');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskHours, setNewTaskHours] = useState(4);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-[#131D31] rounded-md shadow-2xl w-full max-w-xl overflow-hidden border border-[#233354] flex flex-col max-h-[90vh] text-[#F8FAFC]">
        {/* Cabecera */}
        <div className="px-5 py-4 bg-[#0F172A] border-b border-[#233354] text-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-md bg-[#1E40AF]/20 text-[#38BDF8] flex items-center justify-center border border-[#1E40AF]/40">
              <Play className="w-4 h-4 fill-current text-[#38BDF8]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm tracking-tight text-[#F8FAFC]">
                Iniciar Jornada Laboral
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Selecciona la tarea en la que comenzarás a trabajar hoy o inicia sin asignar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Subformulario de Creación Rápida */}
          {isCreatingTask ? (
            <form onSubmit={handleCreateAndSelectTask} className="bg-[#1A2742] p-4 rounded-md border border-[#233354] space-y-3.5 animate-fade-in">
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
                  className="text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
                >
                  Volver a lista
                </button>
              </div>

              {/* Selector de Proyecto */}
              <div>
                <label className="text-[11px] font-medium text-[#94A3B8] block mb-1">
                  Proyecto (Clientes Autorizados) *
                </label>
                <select
                  value={newTaskProjectId}
                  onChange={e => setNewTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#131D31] border border-[#233354] rounded-md font-medium text-[#F8FAFC] focus:border-[#38BDF8] outline-none"
                >
                  {allowedProjects.map(p => {
                    const client = clients.find(c => c.id === p.clientId);
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
                  onChange={e => setNewTaskName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#131D31] border border-[#233354] rounded-md font-medium text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8] outline-none"
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
                  onChange={e => setNewTaskHours(parseFloat(e.target.value) || 1)}
                  className="w-32 px-3 py-1.5 text-xs bg-[#131D31] border border-[#233354] rounded-md font-heading font-bold text-[#F8FAFC] focus:border-[#38BDF8] outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:bg-[#233354] rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold rounded-md shadow-xs transition-colors"
                >
                  Crear y Comenzar
                </button>
              </div>
            </form>
          ) : (
            /* Lista de Tareas Disponibles */
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#94A3B8]">
                  Tareas Asignadas y Disponibles ({availableTasks.length})
                </span>
                
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(true)}
                  className="flex items-center space-x-1 text-xs font-heading font-semibold text-[#38BDF8] hover:text-[#F8FAFC]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear nueva tarea</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {availableTasks.length === 0 ? (
                  <div className="p-6 text-center bg-[#1A2742] rounded-md border border-[#233354]">
                    <CheckSquare className="w-6 h-6 text-[#64748B] mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-[#F8FAFC]">
                      No tienes tareas activas asignadas
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      Puedes crear una tarea en este momento con el botón superior.
                    </p>
                  </div>
                ) : (
                  availableTasks.map(task => {
                    const isSelected = selectedTaskId === task.id;
                    const isDirectlyAssigned = myAssignedTaskIds.includes(task.id);
                    const project = projects.find(p => p.id === task.projectId);
                    const client = clients.find(c => c.id === project?.clientId);

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`p-3 rounded-md border transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#1E40AF]/20 border-[#1E40AF] ring-1 ring-[#1E40AF]'
                            : 'bg-[#1A2742] border-[#233354] hover:border-[#38BDF8]/40'
                        }`}
                      >
                        <div className="flex items-start space-x-3 min-w-0 pr-2">
                          <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-[#38BDF8] bg-[#1E40AF]' : 'border-[#64748B]'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 bg-[#38BDF8] rounded-full" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                              <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                {task.name}
                              </span>
                              {isDirectlyAssigned && (
                                <span className="text-[9px] font-heading font-bold bg-[#0F172A] text-[#38BDF8] border border-[#233354] px-1.5 py-0.5 rounded-sm">
                                  Asignada a ti
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 text-[10px] text-[#94A3B8] mt-0.5">
                              <span className="flex items-center truncate">
                                <Building2 className="w-3 h-3 mr-1 text-[#38BDF8]" />
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
            </div>
          )}

          {/* Botón Principal de Continuar con Tarea */}
          <button
            type="button"
            disabled={!selectedTaskId}
            onClick={() => onSelectTaskAndStart(selectedTaskId)}
            className="w-full flex items-center justify-center space-x-2 py-2.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md font-heading font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span>Iniciar Jornada con la Tarea Seleccionada</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>

          {/* Botón Sutil Omitir */}
          <div className="pt-2 border-t border-[#233354] text-center">
            <button
              type="button"
              onClick={() => onSelectTaskAndStart(null)}
              className="text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] transition-colors py-1 px-3 rounded-md hover:bg-[#1A2742] cursor-pointer"
            >
              Iniciar jornada sin asignar tarea por ahora (Omitir)
            </button>
            <p className="text-[10px] text-[#64748B] mt-0.5">
              Registrarás tu tiempo en modo general y podrás justificar tus horas al cerrar el día.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
