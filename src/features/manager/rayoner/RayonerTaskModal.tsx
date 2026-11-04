import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Tag,
  Users,
  Shield,
  MapPin,
  DollarSign,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import type { TaskAssignment, BudgetType, TaskPriority } from '../../../types/rayoner';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RayonerTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string | null;
  projectId?: string | null;
  initialTab?: 'properties' | 'budget' | 'lead' | 'geofence';
}

export function RayonerTaskModal({
  isOpen,
  onClose,
  taskId,
  projectId: propProjectId,
  initialTab = 'properties',
}: RayonerTaskModalProps) {
  const {
    tasks,
    projects,
    assignments,
    geofences,
    teamMembers,
    getTeamMembersBySupervisor,
    updateTask,
    addTask,
    updateProject,
    setAssignmentsForTask,
    updateGeofence,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const currentSupervisorId = user?.id || 'admin-99';
  const currentSupervisorName = `${user?.name || 'Supervisor'} ${user?.lastName || ''}`.trim();

  // Usuarios reales filtrados estrictamente por el supervisor_id del supervisor autenticado
  const supervisorTeamMembers = useMemo(() => {
    return getTeamMembersBySupervisor(currentSupervisorId, user?.role);
  }, [teamMembers, currentSupervisorId, user?.role, getTeamMembersBySupervisor]);

  const [activeTab, setActiveTab] = useState<'properties' | 'budget' | 'lead' | 'geofence'>(
    initialTab
  );

  const currentTask = useMemo(() => {
    if (taskId) return tasks.find((t) => t.id === taskId) || null;
    return null;
  }, [taskId, tasks]);

  const targetProjectId = currentTask?.projectId || propProjectId || (projects[0]?.id ?? '');
  const currentProject = projects.find((p) => p.id === targetProjectId);

  // 1. Estados Pestaña Propiedades y Asignación Directa (assigned_to)
  const [taskName, setTaskName] = useState(currentTask?.title || currentTask?.name || '');
  const [description, setDescription] = useState(currentTask?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(currentTask?.priority || 'medium');
  const [isBillable, setIsBillable] = useState(currentTask?.isBillable ?? true);
  const [plannedHours, setPlannedHours] = useState(currentTask?.plannedHours || 20);
  const [assignedToUserId, setAssignedToUserId] = useState<string>(
    currentTask?.assigned_to || supervisorTeamMembers[0]?.id || 'usr-ana'
  );

  // 2. Estados Pestaña Usuarios y Presupuesto
  const [budgetType, setBudgetType] = useState<BudgetType>(
    currentProject?.budgetType || 'fixed_project'
  );
  const [hourlyRate, setHourlyRate] = useState(currentProject?.hourlyRate || 1500);

  const existingAssignments = useMemo(() => {
    if (!currentTask) return [];
    return assignments.filter((a) => a.taskId === currentTask.id);
  }, [currentTask, assignments]);

  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([]);

  // Sincronizar datos reales al abrir el modal o cambiar de tarea
  useEffect(() => {
    if (!isOpen) return;
    setTaskName(currentTask?.title || currentTask?.name || '');
    setDescription(currentTask?.description || '');
    setPriority(currentTask?.priority || 'medium');
    setIsBillable(currentTask?.isBillable ?? true);
    setPlannedHours(currentTask?.plannedHours || 20);

    const defaultMember =
      supervisorTeamMembers.find((m) => m.id === currentTask?.assigned_to) ||
      supervisorTeamMembers[0];

    const initialAssigneeId = defaultMember?.id || 'usr-ana';
    setAssignedToUserId(initialAssigneeId);

    if (existingAssignments.length > 0) {
      setTaskAssignments(existingAssignments);
    } else if (defaultMember) {
      setTaskAssignments([
        {
          id: `asg-init-${defaultMember.id}`,
          taskId: currentTask?.id || '',
          userId: defaultMember.id,
          userName: defaultMember.name,
          userRoleTitle: defaultMember.roleTitle,
          allocatedHours: currentTask?.plannedHours || 20,
          hourlyRateOverride: currentProject?.hourlyRate || 1500,
          blockOnLimit: true,
        },
      ]);
    } else {
      setTaskAssignments([]);
    }
  }, [isOpen, currentTask, existingAssignments, supervisorTeamMembers, currentProject]);

  // Al cambiar el empleado principal (assigned_to), asegurar que esté en taskAssignments
  const handleSelectPrimaryAssignee = (newUserId: string) => {
    setAssignedToUserId(newUserId);
    const member = supervisorTeamMembers.find((m) => m.id === newUserId);
    if (!member) return;

    setTaskAssignments((prev) => {
      const alreadyExists = prev.some((a) => a.userId === newUserId);
      if (alreadyExists) {
        // Mover al principio como responsable principal
        const target = prev.find((a) => a.userId === newUserId)!;
        return [target, ...prev.filter((a) => a.userId !== newUserId)];
      }
      if (prev.length === 1) {
        return [
          {
            ...prev[0],
            userId: member.id,
            userName: member.name,
            userRoleTitle: member.roleTitle,
          },
        ];
      }
      return [
        {
          id: `asg-${Date.now()}`,
          taskId: currentTask?.id || '',
          userId: member.id,
          userName: member.name,
          userRoleTitle: member.roleTitle,
          allocatedHours: plannedHours,
          hourlyRateOverride: hourlyRate,
          blockOnLimit: true,
        },
        ...prev,
      ];
    });
  };

  const subtasksHours = useMemo(() => {
    if (!currentTask) return 0;
    return tasks
      .filter((t) => t.parentTaskId === currentTask.id)
      .reduce((sum, sub) => sum + (sub.plannedHours || 0), 0);
  }, [currentTask, tasks]);

  const totalConsolidatedHours = plannedHours + subtasksHours;

  const [leadUserName, setLeadUserName] = useState(
    currentProject?.leadUserName || currentSupervisorName
  );
  const [notifyAt80, setNotifyAt80] = useState(true);
  const [notifyOffHours, setNotifyOffHours] = useState(true);

  const existingGeo = geofences[targetProjectId];
  const [geoMode, setGeoMode] = useState<'remote' | 'office' | 'client_site'>(
    existingGeo?.locationMode || 'client_site'
  );
  const [geoAddress, setGeoAddress] = useState(
    existingGeo?.address || 'Av. Paseo de la Reforma 483, Cuauhtémoc, CDMX'
  );
  const [geoRadius, setGeoRadius] = useState(existingGeo?.radiusMeters || 250);
  const [geoEnforcement, setGeoEnforcement] = useState<'strict_block' | 'warning' | 'none'>(
    existingGeo?.enforcementMode || 'warning'
  );
  const geoLat = existingGeo?.lat || 19.427;
  const geoLng = existingGeo?.lng || -99.1677;

  if (!isOpen) return null;

  const handleToggleBlock = (index: number) => {
    const updated = [...taskAssignments];
    updated[index] = { ...updated[index], blockOnLimit: !updated[index].blockOnLimit };
    setTaskAssignments(updated);
  };

  const handleUpdateAllocatedHours = (index: number, val: number) => {
    const updated = [...taskAssignments];
    updated[index] = { ...updated[index], allocatedHours: Math.max(0, val) };
    setTaskAssignments(updated);
  };

  const handleChangeAssignmentMember = (index: number, memberId: string) => {
    const member = supervisorTeamMembers.find((m) => m.id === memberId);
    if (!member) return;
    const updated = [...taskAssignments];
    updated[index] = {
      ...updated[index],
      userId: member.id,
      userName: member.name,
      userRoleTitle: member.roleTitle,
    };
    setTaskAssignments(updated);
    if (index === 0) {
      setAssignedToUserId(member.id);
    }
  };

  const handleAddAssignment = () => {
    const assignedIds = new Set(taskAssignments.map((a) => a.userId));
    const nextAvailable =
      supervisorTeamMembers.find((m) => !assignedIds.has(m.id)) || supervisorTeamMembers[0];

    if (!nextAvailable) return;

    const newAsg: TaskAssignment = {
      id: `asg-${Date.now()}`,
      taskId: currentTask?.id || '',
      userId: nextAvailable.id,
      userName: nextAvailable.name,
      userRoleTitle: nextAvailable.roleTitle,
      allocatedHours: 8,
      hourlyRateOverride: hourlyRate,
      blockOnLimit: true,
    };
    setTaskAssignments([...taskAssignments, newAsg]);
  };

  const handleRemoveAssignment = (index: number) => {
    const filtered = taskAssignments.filter((_, idx) => idx !== index);
    setTaskAssignments(filtered);
    if (filtered[0]) {
      setAssignedToUserId(filtered[0].userId);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const addToast = useCheckinStore.getState().addToast;
    const finalTitle = taskName.trim() || 'Nueva Tarea de Proyecto';
    const primaryMember =
      supervisorTeamMembers.find((m) => m.id === assignedToUserId) || supervisorTeamMembers[0];

    const finalAssignments: TaskAssignment[] =
      taskAssignments.length > 0
        ? taskAssignments
        : primaryMember
        ? [
            {
              id: `asg-${Date.now()}`,
              taskId: currentTask?.id || '',
              userId: primaryMember.id,
              userName: primaryMember.name,
              userRoleTitle: primaryMember.roleTitle,
              allocatedHours: plannedHours,
              hourlyRateOverride: hourlyRate,
              blockOnLimit: true,
            },
          ]
        : [];

    if (currentTask) {
      updateTask(currentTask.id, {
        title: finalTitle,
        name: finalTitle,
        description,
        priority,
        isBillable,
        plannedHours,
        assigned_to: assignedToUserId,
        created_by: currentTask.created_by || currentSupervisorId,
      });

      setAssignmentsForTask(
        currentTask.id,
        finalAssignments.map((a) => ({ ...a, taskId: currentTask.id })),
        currentSupervisorId,
        currentSupervisorName
      );

      addToast(
        `Tarea "${finalTitle}" actualizada y notificada en tiempo real a ${primaryMember?.name || 'empleado'}.`,
        'success'
      );
    } else {
      const newId = addTask(
        {
          projectId: targetProjectId,
          parentTaskId: null,
          title: finalTitle,
          name: finalTitle,
          assigned_to: assignedToUserId,
          created_by: currentSupervisorId,
          status: 'pending',
          created_at: new Date().toISOString(),
          completed_at: null,
          description,
          priority,
          isBillable,
          plannedHours,
          isActive: true,
        },
        false
      );

      setAssignmentsForTask(
        newId,
        finalAssignments.map((a) => ({ ...a, taskId: newId })),
        currentSupervisorId,
        currentSupervisorName
      );

      addToast(
        `Nueva tarea "${finalTitle}" asignada y notificada en tiempo real a ${primaryMember?.name || 'empleado'}.`,
        'success'
      );
    }

    if (currentProject) {
      updateProject(currentProject.id, {
        budgetType,
        hourlyRate,
        leadUserName,
      });

      updateGeofence(currentProject.id, {
        id: existingGeo?.id || `geo-${Date.now()}`,
        projectId: currentProject.id,
        locationMode: geoMode,
        address: geoAddress,
        lat: geoLat,
        lng: geoLng,
        radiusMeters: geoRadius,
        enforcementMode: geoEnforcement,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Encabezado del Modal */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-[#0D5C75] text-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm">
              R
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {currentTask
                  ? `Editar: ${currentTask.title || currentTask.name}`
                  : 'Asignar Nueva Tarea al Equipo'}
              </h2>
              <p className="text-xs text-white/80">
                {currentProject?.name} • Supervisor Emisor: {currentSupervisorName} ({currentSupervisorId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación Horizontal */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 overflow-x-auto text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`flex items-center py-3 px-3.5 border-b-2 transition-all ${
              activeTab === 'properties'
                ? 'border-[#0D5C75] text-[#0D5C75] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            Propiedades & Asignación
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`flex items-center py-3 px-3.5 border-b-2 transition-all ${
              activeTab === 'budget'
                ? 'border-[#0D5C75] text-[#0D5C75] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Equipo (supervisor_id) y Presupuesto
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lead')}
            className={`flex items-center py-3 px-3.5 border-b-2 transition-all ${
              activeTab === 'lead'
                ? 'border-[#0D5C75] text-[#0D5C75] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Responsable del Proyecto
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('geofence')}
            className={`flex items-center py-3 px-3.5 border-b-2 transition-all ${
              activeTab === 'geofence'
                ? 'border-[#0D5C75] text-[#0D5C75] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Dirección y Perímetro
          </button>
        </div>

        {/* Contenido Dinámico */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* PESTAÑA 1: PROPIEDADES Y ASIGNACIÓN DIRECTA */}
          {activeTab === 'properties' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Título de la Tarea (title)
                </label>
                <input
                  type="text"
                  required
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Ej: Pruebas Sustantivas de Ingresos y CFDI..."
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
                />
              </div>

              {/* Selector de Empleado Asignado filtrado por supervisor_id */}
              <div className="bg-cyan-50/50 border border-cyan-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#0D5C75] uppercase flex items-center space-x-1.5">
                    <UserCheck className="w-4 h-4 text-[#0D5C75]" />
                    <span>Empleado Asignado (assigned_to)</span>
                  </label>
                  <span className="text-[10px] font-bold bg-white text-[#0D5C75] px-2 py-0.5 rounded-full border border-cyan-200">
                    Filtrado por supervisor_id: {currentSupervisorId} ({supervisorTeamMembers.length} miembros)
                  </span>
                </div>
                <select
                  value={assignedToUserId}
                  onChange={(e) => handleSelectPrimaryAssignee(e.target.value)}
                  className="w-full border border-cyan-300 bg-white rounded-lg px-3.5 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                >
                  {supervisorTeamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} — {member.roleTitle} ({member.email}) [ID: {member.id}]
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Al guardar, se emitirá un evento en <code>notifications</code> y se notificará en tiempo real a este empleado.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Descripción y Criterios Técnicos
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles sobre el procedimiento de auditoría o alcance..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Horas Estimadas Propias
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={plannedHours}
                      onChange={(e) => setPlannedHours(parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nivel de Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none capitalize"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tratamiento Fiscal / Costo
                  </label>
                  <div className="flex items-center space-x-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsBillable(!isBillable)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        isBillable ? 'bg-[#0D5C75]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isBillable ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-semibold text-slate-700">
                      {isBillable ? 'Facturable a Cliente' : 'Interno / No Facturable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: USUARIOS FILTRADOS POR SUPERVISOR_ID Y PRESUPUESTO */}
          {activeTab === 'budget' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-xs text-slate-500 font-medium block">
                    Horas Propias de Tarea
                  </span>
                  <span className="text-xl font-bold text-slate-800">
                    {plannedHours.toFixed(1)} hrs
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-xs text-slate-500 font-medium block">
                    Horas en Subtareas
                  </span>
                  <span className="text-xl font-bold text-blue-600">
                    +{subtasksHours.toFixed(1)} hrs
                  </span>
                </div>

                <div className="bg-[#0D5C75]/10 border border-[#0D5C75]/20 rounded-xl p-3.5">
                  <span className="text-xs text-[#0D5C75] font-semibold block">
                    Total Consolidado (Rollup)
                  </span>
                  <span className="text-xl font-bold text-[#0D5C75]">
                    {totalConsolidatedHours.toFixed(1)} hrs
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipo de Planificación
                  </label>
                  <select
                    value={budgetType}
                    onChange={(e) => setBudgetType(e.target.value as BudgetType)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                  >
                    <option value="fixed_project">Presupuesto Fijo por Proyecto</option>
                    <option value="by_tasks">Presupuesto por Tareas (Bottom-Up)</option>
                    <option value="by_person">Presupuesto por Persona</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tarifa Base por Hora
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                    />
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Lista de Colaboradores Reales Filtrados por supervisor_id */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase">
                      Miembros Reales del Equipo Asignados (supervisor_id: {currentSupervisorId})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Selecciona entre los colaboradores vinculados a tu supervisión.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAssignment}
                    className="inline-flex items-center text-xs font-bold text-[#0D5C75] hover:text-[#0E7490] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Agregar Miembro de mi Equipo
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {taskAssignments.map((asg, idx) => (
                    <div
                      key={asg.id || idx}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-8 h-8 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] font-bold text-xs flex items-center justify-center shrink-0">
                          {asg.userName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 max-w-xs">
                          <select
                            value={asg.userId}
                            onChange={(e) => handleChangeAssignmentMember(idx, e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white focus:border-[#0D5C75] outline-none"
                          >
                            {supervisorTeamMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name} ({member.roleTitle})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1.5">
                          <label className="text-xs text-slate-500 font-medium">Horas:</label>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={asg.allocatedHours}
                            onChange={(e) =>
                              handleUpdateAllocatedHours(idx, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-center font-bold text-slate-800"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleBlock(idx)}
                          className={`flex items-center px-2.5 py-1 rounded-md text-xs font-bold border transition-all ${
                            asg.blockOnLimit
                              ? 'bg-red-50 border-red-200 text-red-600 shadow-2xs'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                          title="Detener cronómetro automáticamente al llegar al límite asignado"
                        >
                          {asg.blockOnLimit ? (
                            <>
                              <Lock className="w-3 h-3 mr-1 text-red-500" />
                              Bloqueo Activo
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 mr-1 text-slate-400" />
                              Sin Bloqueo
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(idx)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: RESPONSABLE DEL PROYECTO */}
          {activeTab === 'lead' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Líder del Proyecto / Supervisor Responsable (created_by)
                </label>
                <input
                  type="text"
                  value={leadUserName}
                  onChange={(e) => setLeadUserName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-[#FF6B35]" />
                  Alertas y Notificaciones Bidireccionales
                </h4>

                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyAt80}
                    onChange={(e) => setNotifyAt80(e.target.checked)}
                    className="mt-0.5 rounded text-[#0D5C75] focus:ring-[#0D5C75]"
                  />
                  <span className="text-xs text-slate-600 leading-snug">
                    <b>Notificación en tiempo real al completar:</b> Recibir alerta instantánea en bandeja cuando el empleado marque la tarea como <code>completed</code>.
                  </span>
                </label>

                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOffHours}
                    onChange={(e) => setNotifyOffHours(e.target.checked)}
                    className="mt-0.5 rounded text-[#0D5C75] focus:ring-[#0D5C75]"
                  />
                  <span className="text-xs text-slate-600 leading-snug">
                    <b>Alerta al 80% de consumo:</b> Notificar automáticamente en el tablero antes de agotar el presupuesto.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: DIRECCIÓN Y PERÍMETRO GEOGRÁFICO */}
          {activeTab === 'geofence' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Modalidad de Trabajo
                  </label>
                  <select
                    value={geoMode}
                    onChange={(e) =>
                      setGeoMode(e.target.value as 'remote' | 'office' | 'client_site')
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                  >
                    <option value="client_site">En Sitio del Cliente</option>
                    <option value="office">Oficina del Despacho</option>
                    <option value="remote">Remoto / Sin Restricción</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Radio de Geocerca (Metros)
                  </label>
                  <select
                    value={geoRadius}
                    onChange={(e) => setGeoRadius(parseInt(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                  >
                    <option value="50">50 metros (Tolerancia estricta)</option>
                    <option value="100">100 metros (Estándar)</option>
                    <option value="250">250 metros (Campus / Planta)</option>
                    <option value="500">500 metros (Área amplia)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Política de Incumplimiento
                  </label>
                  <select
                    value={geoEnforcement}
                    onChange={(e) =>
                      setGeoEnforcement(e.target.value as 'strict_block' | 'warning' | 'none')
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                  >
                    <option value="warning">Alerta y Solicitud de Aprobación</option>
                    <option value="strict_block">Bloqueo Estricto de Cronómetro</option>
                    <option value="none">Solo Registro Informativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Dirección Física Registrada
                </label>
                <input
                  type="text"
                  value={geoAddress}
                  onChange={(e) => setGeoAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D5C75]/20 outline-none"
                />
              </div>

              <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-700 shadow-inner relative corporate-dark-map bg-[#090E17]">
                <MapContainer
                  center={[geoLat, geoLng]}
                  zoom={15}
                  attributionControl={false}
                  className="w-full h-full corporate-dark-map"
                >
                  <TileLayer
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                  <Marker position={[geoLat, geoLng]} />
                  <Circle
                    center={[geoLat, geoLng]}
                    radius={geoRadius}
                    pathOptions={{ color: '#0D5C75', fillColor: '#0D5C75', fillOpacity: 0.2 }}
                  />
                </MapContainer>
                <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded text-[11px] font-semibold text-slate-700 shadow-sm border border-slate-200">
                  Perímetro activo: {geoRadius}m alrededor del punto
                </div>
              </div>
            </div>
          )}

          {/* Pie del Modal */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between mt-6">
            <span className="text-xs text-slate-400">
              💡 La asignación y notificación se sincronizan en tiempo real con el empleado seleccionado.
            </span>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#FF6B35] hover:bg-[#F97316] text-white rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer"
              >
                Guardar y Notificar Asignación
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
