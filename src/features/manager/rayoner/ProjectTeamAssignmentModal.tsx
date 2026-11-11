import { useState, useMemo } from 'react';
import { X, Search, Check, Users, UserPlus } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import type { Project, TeamMember } from '../../../types/rayoner';

interface ProjectTeamAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export function ProjectTeamAssignmentModal({
  isOpen,
  onClose,
  project,
}: ProjectTeamAssignmentModalProps) {
  const { teamMembers, tasks, assignments, updateProject, setAssignmentsForTask } = useRayonerStore();
  const addToast = useCheckinStore((state) => state.addToast);
  const user = useCheckinStore((state) => state.user);

  const [searchQuery, setSearchQuery] = useState('');

  // Identificar los IDs de los usuarios actualmente asignados a este proyecto
  const currentAssignedIds = useMemo(() => {
    if (!project) return new Set<string>();
    const ids = new Set<string>(project.assignedUserIds || []);

    // Incluir al líder del proyecto
    if (project.leadUserId) {
      ids.add(project.leadUserId);
    }

    // Incluir a los asignados a tareas del proyecto
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    projectTasks.forEach((t) => {
      if (t.assigned_to) ids.add(t.assigned_to);
      const taskAssignees = assignments.filter((a) => a.taskId === t.id);
      taskAssignees.forEach((a) => ids.add(a.userId));
    });

    return ids;
  }, [project, tasks, assignments]);

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Sincronizar al abrir el modal con el proyecto seleccionado
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  if (project && project.id !== lastProjectId) {
    setLastProjectId(project.id);
    setSelectedUserIds(new Set(currentAssignedIds));
  }

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.roleTitle && m.roleTitle.toLowerCase().includes(q))
      );
    });
  }, [teamMembers, searchQuery]);

  if (!isOpen || !project) return null;

  const handleToggleUser = (memberId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        // No permitir revocar al líder principal desde este modal si es el único
        if (memberId === project.leadUserId && next.size === 1) {
          addToast('El líder del proyecto debe permanecer asignado.', 'error');
          return prev;
        }
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleSave = () => {
    const assignedArray = Array.from(selectedUserIds);
    updateProject(project.id, {
      assignedUserIds: assignedArray,
    });

    // Asegurar que si hay tareas en el proyecto, los colaboradores asignados tengan visibilidad
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    if (projectTasks.length > 0) {
      const primaryTask = projectTasks[0];
      const existingTaskAssignments = assignments.filter((a) => a.taskId === primaryTask.id);
      
      const updatedTaskAssignments = [...existingTaskAssignments];
      assignedArray.forEach((userId) => {
        if (!updatedTaskAssignments.some((a) => a.userId === userId)) {
          const member = teamMembers.find((m) => m.id === userId);
          if (member) {
            updatedTaskAssignments.push({
              id: `asg-${Date.now()}-${userId}`,
              taskId: primaryTask.id,
              userId: member.id,
              userName: member.name,
              userRoleTitle: member.roleTitle || 'Colaborador',
              allocatedHours: Math.round(primaryTask.plannedHours / Math.max(assignedArray.length, 1)) || 5,
              blockOnLimit: false,
            });
          }
        }
      });
      setAssignmentsForTask(primaryTask.id, updatedTaskAssignments, user?.id, user?.name);
    }

    addToast(`Equipo asignado actualizado (${assignedArray.length} colaboradores).`, 'success');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
              <span>Gestión de Equipo</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {project.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {project.code} • Asigna o revoca colaboradores para este proyecto.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador de Colaboradores */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, cargo o correo..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 transition"
          />
        </div>

        {/* Lista de Colaboradores */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {filteredMembers.map((member: TeamMember) => {
            const isAssigned = selectedUserIds.has(member.id);
            const isLeader = member.id === project.leadUserId;

            return (
              <div
                key={member.id}
                onClick={() => handleToggleUser(member.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isAssigned
                    ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                    {member.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {member.name}
                      </span>
                      {isLeader && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          Líder
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                      {member.roleTitle || member.team || 'Colaborador'} • {member.email}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {isAssigned ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      Asignado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium hover:border-blue-400">
                      <UserPlus className="w-3.5 h-3.5" />
                      Asignar
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredMembers.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">
              No se encontraron colaboradores con ese criterio.
            </p>
          )}
        </div>

        {/* Resumen y Acciones */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {selectedUserIds.size} de {teamMembers.length} seleccionados
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
            >
              Guardar Asignaciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
