import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import type { TaskAssignment, TaskPriority } from '../../../types/rayoner';

interface RayonerTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string | null;
  projectId?: string | null;
  initialTab?: 'properties' | 'location';
}

type TaskModalTab = 'properties' | 'location';
type ExecutionLocationMode = 'office' | 'client_site';

const DEFAULT_OFFICE_ADDRESS = 'Oficina Central — Despacho Corporativo';
const DEFAULT_OFFICE_RADIUS = 150;

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
    clients,
    geofences,
    teamMembers,
    getTeamMembersBySupervisor,
    updateTask,
    addTask,
    setAssignmentsForTask,
    updateGeofence,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);

  const currentIssuerId = user?.id || 'demo_supervisor';
  const currentIssuerName = `${user?.name || 'Responsable'} ${user?.lastName || ''}`.trim();

  // Colaboradores de la línea operativa autorizados para asignación
  const eligibleCollaborators = useMemo(() => {
    const list = getTeamMembersBySupervisor(currentIssuerId, user?.role);
    if (list.length > 0) return list;
    // Respaldo operativo limpio si el catálogo aún está sincronizando
    return teamMembers.filter((m) => {
      const r = (m.role || '').toUpperCase();
      return r !== 'TI' && r !== 'RH';
    });
  }, [teamMembers, currentIssuerId, user?.role, getTeamMembersBySupervisor]);

  const currentTask = useMemo(() => {
    if (taskId) return tasks.find((t) => t.id === taskId) || null;
    return null;
  }, [taskId, tasks]);

  const [activeTab, setActiveTab] = useState<TaskModalTab>(initialTab);

  // Pestaña 1: Propiedades y Asignación
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string>('');

  // Pestaña 2: Ubicación de Ejecución (Oficina / Oficina de Cliente)
  const [locationMode, setLocationMode] = useState<ExecutionLocationMode>('office');
  const [useCustomClientAddress, setUseCustomClientAddress] = useState<boolean>(false);
  const [clientAddress, setClientAddress] = useState<string>('');
  const [radiusMeters, setRadiusMeters] = useState<number>(250);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Proyectos filtrados por empresa seleccionada
  const filteredProjects = useMemo(() => {
    if (!selectedCompanyId) return projects;
    return projects.filter((p) => p.clientId === selectedCompanyId);
  }, [projects, selectedCompanyId]);

  const targetProjectId = selectedProjectId || filteredProjects[0]?.id || '';
  const currentProject = useMemo(
    () => projects.find((p) => p.id === targetProjectId) || null,
    [projects, targetProjectId]
  );

  const currentCompany = useMemo(() => {
    const cid = selectedCompanyId || currentProject?.clientId || '';
    return clients.find((c) => c.id === cid) || null;
  }, [clients, selectedCompanyId, currentProject?.clientId]);

  // Inicializar estado al abrir el modal o cambiar la tarea objetivo
  useEffect(() => {
    if (!isOpen) return;

    setActiveTab(initialTab);
    setErrorMessage('');

    const resolvedProjectId =
      currentTask?.projectId || propProjectId || projects[0]?.id || '';
    const resolvedProject = projects.find((p) => p.id === resolvedProjectId) || null;
    const resolvedCompanyId =
      currentTask?.companyId || resolvedProject?.clientId || clients[0]?.id || '';
    const resolvedCompany = clients.find((c) => c.id === resolvedCompanyId) || null;

    setSelectedCompanyId(resolvedCompanyId);
    setSelectedProjectId(resolvedProjectId);
    setTaskTitle(currentTask?.title || currentTask?.name || '');
    setDescription(currentTask?.description || '');
    setPriority(currentTask?.priority || 'medium');
    setDueDate(currentTask?.dueDate || resolvedProject?.deadline || '');

    // Tiempo estimado en formato sexagesimal (Horas + Minutos 0-59)
    const totalMins =
      currentTask?.plannedMinutes !== undefined
        ? Math.max(0, Math.round(currentTask.plannedMinutes))
        : currentTask?.plannedHours !== undefined
        ? Math.max(0, Math.round(currentTask.plannedHours * 60))
        : 120;
    setEstimatedHours(Math.floor(totalMins / 60));
    setEstimatedMinutes(totalMins % 60);

    // Colaborador asignado
    const existingAssigneeId = currentTask?.assignedToId || currentTask?.assigned_to || '';
    const existingAssigneeEmail = (currentTask?.assignedToEmail || '').toLowerCase();
    const matchedMember =
      eligibleCollaborators.find(
        (m) =>
          (existingAssigneeId && m.id === existingAssigneeId) ||
          (existingAssigneeEmail && m.email.toLowerCase() === existingAssigneeEmail)
      ) || eligibleCollaborators[0];
    setAssignedUserId(matchedMember?.id || '');

    // Ubicación de ejecución
    const existingGeo = resolvedProjectId ? geofences[resolvedProjectId] : undefined;
    const initialMode: ExecutionLocationMode =
      currentTask?.locationMode === 'client_site' ||
      (!currentTask && existingGeo?.locationMode === 'client_site')
        ? 'client_site'
        : 'office';
    setLocationMode(initialMode);

    const fiscalAddr = (resolvedCompany?.fiscalAddress || '').trim();
    const savedAddr = (currentTask?.locationAddress || existingGeo?.address || '').trim();

    if (initialMode === 'client_site') {
      if (savedAddr && savedAddr !== fiscalAddr) {
        setUseCustomClientAddress(true);
        setClientAddress(savedAddr);
      } else {
        setUseCustomClientAddress(false);
        setClientAddress(fiscalAddr || savedAddr);
      }
    } else {
      setUseCustomClientAddress(false);
      setClientAddress(fiscalAddr);
    }

    const initialRadius =
      currentTask?.locationRadiusMeters || existingGeo?.radiusMeters || 250;
    setRadiusMeters(initialRadius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentTask?.id, propProjectId]);

  // Si el usuario cambia de empresa/proyecto en modo sede fiscal, sincronizar la dirección del cliente
  useEffect(() => {
    if (!isOpen || useCustomClientAddress) return;
    const fiscalAddr = (currentCompany?.fiscalAddress || '').trim();
    if (fiscalAddr) {
      setClientAddress(fiscalAddr);
    }
  }, [isOpen, currentCompany?.fiscalAddress, useCustomClientAddress]);

  if (!isOpen) return null;

  const handleHoursChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    setEstimatedHours(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  };

  const handleMinutesChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setEstimatedMinutes(0);
      return;
    }
    if (parsed >= 60) {
      const extraH = Math.floor(parsed / 60);
      setEstimatedHours((prev) => prev + extraH);
      setEstimatedMinutes(parsed % 60);
      return;
    }
    setEstimatedMinutes(parsed);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanTitle = taskTitle.trim();
    if (!cleanTitle) {
      setErrorMessage('Ingresa un título para la tarea.');
      setActiveTab('properties');
      return;
    }

    if (!targetProjectId) {
      setErrorMessage('Selecciona un proyecto vinculado antes de guardar la tarea.');
      setActiveTab('properties');
      return;
    }

    const selectedMember =
      eligibleCollaborators.find((m) => m.id === assignedUserId) || eligibleCollaborators[0];

    if (!selectedMember) {
      setErrorMessage('Selecciona un colaborador para asignar la tarea.');
      setActiveTab('properties');
      return;
    }

    const totalPlannedMinutes = Math.max(
      0,
      Math.round(estimatedHours) * 60 + Math.min(59, Math.max(0, Math.round(estimatedMinutes)))
    );
    const totalPlannedHours = Number((totalPlannedMinutes / 60).toFixed(4));

    const resolvedLocationAddress =
      locationMode === 'office'
        ? DEFAULT_OFFICE_ADDRESS
        : (useCustomClientAddress
            ? clientAddress
            : currentCompany?.fiscalAddress || clientAddress
          ).trim();

    if (locationMode === 'client_site' && !resolvedLocationAddress) {
      setErrorMessage(
        'Captura la dirección de la oficina del cliente o selecciona ejecución en oficina.'
      );
      setActiveTab('location');
      return;
    }

    const resolvedRadius =
      locationMode === 'office' ? DEFAULT_OFFICE_RADIUS : Math.max(50, Math.round(radiusMeters));

    const resolvedCompanyId = currentCompany?.id || currentProject?.clientId || '';
    const resolvedCompanyName =
      currentCompany?.commercialName || currentCompany?.name || '';
    const resolvedProjectName = currentProject?.name || '';
    const memberEmail = (selectedMember.email || '').trim().toLowerCase();

    const assignmentEntry: TaskAssignment = {
      id: `asg-${Date.now()}`,
      taskId: currentTask?.id || '',
      userId: selectedMember.id,
      userName: selectedMember.name,
      userRoleTitle: selectedMember.roleTitle || 'Colaborador',
      allocatedHours: totalPlannedHours,
      hourlyRateOverride: currentProject?.hourlyRate || 0,
      blockOnLimit: false,
    };

    if (currentTask) {
      updateTask(currentTask.id, {
        projectId: targetProjectId,
        projectName: resolvedProjectName,
        companyId: resolvedCompanyId,
        companyName: resolvedCompanyName,
        title: cleanTitle,
        name: cleanTitle,
        description: description.trim(),
        priority,
        dueDate: dueDate || undefined,
        plannedHours: totalPlannedHours,
        plannedMinutes: totalPlannedMinutes,
        assigned_to: selectedMember.id,
        assignedToId: selectedMember.id,
        assignedToEmail: memberEmail,
        assignedToName: selectedMember.name,
        created_by: currentTask.created_by || currentIssuerId,
        locationMode,
        locationAddress: resolvedLocationAddress,
        locationRadiusMeters: resolvedRadius,
      });

      setAssignmentsForTask(
        currentTask.id,
        [{ ...assignmentEntry, taskId: currentTask.id }],
        currentIssuerId,
        currentIssuerName
      );

      addToast(`Tarea "${cleanTitle}" actualizada y asignada a ${selectedMember.name}.`, 'success');
    } else {
      const newTaskId = addTask(
        {
          projectId: targetProjectId,
          projectName: resolvedProjectName,
          companyId: resolvedCompanyId,
          companyName: resolvedCompanyName,
          parentTaskId: null,
          title: cleanTitle,
          name: cleanTitle,
          assigned_to: selectedMember.id,
          assignedToId: selectedMember.id,
          assignedToEmail: memberEmail,
          assignedToName: selectedMember.name,
          created_by: currentIssuerId,
          status: 'pending',
          created_at: new Date().toISOString(),
          completed_at: null,
          description: description.trim(),
          priority,
          dueDate: dueDate || undefined,
          isBillable: true,
          plannedHours: totalPlannedHours,
          plannedMinutes: totalPlannedMinutes,
          loggedMinutes: 0,
          locationMode,
          locationAddress: resolvedLocationAddress,
          locationRadiusMeters: resolvedRadius,
          isActive: true,
        },
        false
      );

      setAssignmentsForTask(
        newTaskId,
        [{ ...assignmentEntry, taskId: newTaskId }],
        currentIssuerId,
        currentIssuerName
      );

      addToast(`Tarea "${cleanTitle}" asignada a ${selectedMember.name}.`, 'success');
    }

    if (currentProject) {
      const existingGeo = geofences[currentProject.id];
      updateGeofence(currentProject.id, {
        id: existingGeo?.id || `geo-${Date.now()}`,
        projectId: currentProject.id,
        locationMode,
        address: resolvedLocationAddress,
        lat: existingGeo?.lat || 0,
        lng: existingGeo?.lng || 0,
        radiusMeters: resolvedRadius,
        enforcementMode: existingGeo?.enforcementMode || 'warning',
      });
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0B111E] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Minimalista Corporativo (Sin iconos decorativos ni textos técnicos) */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-heading font-bold tracking-tight text-slate-900 dark:text-white">
              {currentTask ? 'Editar Tarea' : 'Asignar Nueva Tarea'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {currentCompany && currentProject
                ? `${currentCompany.commercialName || currentCompany.name} — ${currentProject.name}`
                : 'Define el alcance, colaborador responsable y ubicación de ejecución.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Únicamente 2 Pestañas Sobrias */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#101726] px-6 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`py-3 text-xs font-heading font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'properties'
                ? 'border-blue-700 dark:border-sky-400 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            1. Propiedades y Asignación
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`py-3 text-xs font-heading font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'location'
                ? 'border-blue-700 dark:border-sky-400 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            2. Ubicación de Ejecución
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {errorMessage && (
            <div className="px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
              {errorMessage}
            </div>
          )}

          {/* PESTAÑA 1: PROPIEDADES Y ASIGNACIÓN */}
          {activeTab === 'properties' && (
            <div className="space-y-4 animate-fade-in">
              {/* Empresa y Proyecto Vinculado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Empresa / Cliente
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => {
                      const nextCid = e.target.value;
                      setSelectedCompanyId(nextCid);
                      const firstProj = projects.find((p) => p.clientId === nextCid);
                      setSelectedProjectId(firstProj?.id || '');
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none cursor-pointer"
                  >
                    <option value="">Todas las empresas ({clients.length})</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.commercialName || c.name}
                        {c.code ? ` (${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Proyecto Vinculado *
                  </label>
                  <select
                    value={targetProjectId}
                    required
                    onChange={(e) => {
                      const nextPid = e.target.value;
                      setSelectedProjectId(nextPid);
                      const proj = projects.find((p) => p.id === nextPid);
                      if (proj?.clientId) setSelectedCompanyId(proj.clientId);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none cursor-pointer"
                  >
                    <option value="">
                      {filteredProjects.length === 0
                        ? 'Sin proyectos registrados'
                        : 'Seleccionar proyecto'}
                    </option>
                    {filteredProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Título de la Tarea */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Título de la Tarea *
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej. Conciliación bancaria y pruebas sustantivas de ingresos"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-700 dark:focus:border-sky-400 outline-none"
                />
              </div>

              {/* Descripción breve */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Descripción Breve <span className="font-normal text-slate-400">(Opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Alcance, entregables o notas operativas..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-700 dark:focus:border-sky-400 outline-none resize-none"
                />
              </div>

              {/* Colaborador Asignado */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Colaborador Asignado *
                </label>
                <select
                  required
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-medium bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none cursor-pointer"
                >
                  {eligibleCollaborators.length === 0 ? (
                    <option value="">Sin colaboradores disponibles</option>
                  ) : (
                    eligibleCollaborators.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} — {member.roleTitle || 'Colaborador'} ({member.email})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Tiempo Estimado (Horas y Minutos 0-59), Prioridad y Fecha Límite */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Tiempo Estimado
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={estimatedHours}
                        onChange={(e) => handleHoursChange(e.target.value)}
                        aria-label="Horas estimadas"
                        className="w-full px-2.5 py-2 pr-7 text-xs font-mono font-semibold text-right bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 pointer-events-none">
                        h
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono text-xs">:</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        step={1}
                        value={estimatedMinutes}
                        onChange={(e) => handleMinutesChange(e.target.value)}
                        aria-label="Minutos estimados"
                        className="w-full px-2.5 py-2 pr-7 text-xs font-mono font-semibold text-right bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 pointer-events-none">
                        m
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none cursor-pointer"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: UBICACIÓN DE EJECUCIÓN */}
          {activeTab === 'location' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2.5">
                  Lugar de Ejecución
                </span>

                {/* Selector Binario Sobrio (Radio Cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-4 border transition-colors cursor-pointer ${
                      locationMode === 'office'
                        ? 'border-blue-700 dark:border-sky-400 bg-slate-50 dark:bg-[#101726]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="executionLocationMode"
                      value="office"
                      checked={locationMode === 'office'}
                      onChange={() => setLocationMode('office')}
                      className="mt-0.5 accent-blue-700"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                        En Oficina (Despacho)
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Aplica el perímetro y coordenadas de la oficina central del despacho ({DEFAULT_OFFICE_RADIUS} m).
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 border transition-colors cursor-pointer ${
                      locationMode === 'client_site'
                        ? 'border-blue-700 dark:border-sky-400 bg-slate-50 dark:bg-[#101726]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="executionLocationMode"
                      value="client_site"
                      checked={locationMode === 'client_site'}
                      onChange={() => {
                        setLocationMode('client_site');
                        if (!clientAddress && currentCompany?.fiscalAddress) {
                          setClientAddress(currentCompany.fiscalAddress);
                        }
                      }}
                      className="mt-0.5 accent-blue-700"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                        En Oficina de Cliente
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Ejecución presencial en las instalaciones de la empresa vinculada con geocerca configurable.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Detalle Opción A: Oficina del Despacho */}
              {locationMode === 'office' && (
                <div className="p-4 border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#101726]/70 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Sede Predeterminada
                  </span>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {DEFAULT_OFFICE_ADDRESS}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Perímetro permitido: {DEFAULT_OFFICE_RADIUS} metros
                  </p>
                </div>
              )}

              {/* Detalle Opción B: Oficina de Cliente */}
              {locationMode === 'client_site' && (
                <div className="space-y-4 pt-1 border-t border-slate-200 dark:border-slate-800">
                  {currentCompany?.fiscalAddress && (
                    <div className="flex items-start justify-between gap-3 pt-3">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Sede Fiscal Registrada — {currentCompany.commercialName || currentCompany.name}
                        </span>
                        <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5">
                          {currentCompany.fiscalAddress}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCustomClientAddress}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setUseCustomClientAddress(checked);
                            if (!checked) {
                              setClientAddress(currentCompany.fiscalAddress || '');
                            }
                          }}
                          className="accent-blue-700"
                        />
                        <span>Usar otra dirección</span>
                      </label>
                    </div>
                  )}

                  {(!currentCompany?.fiscalAddress || useCustomClientAddress) && (
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                        Dirección de la Oficina del Cliente *
                      </label>
                      <input
                        type="text"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        placeholder="Calle, número, colonia, ciudad y código postal"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-700 dark:focus:border-sky-400 outline-none"
                      />
                    </div>
                  )}

                  <div className="max-w-xs">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      Radio de Geocerca Permitido
                    </label>
                    <select
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-sky-400 outline-none cursor-pointer"
                    >
                      <option value={50}>50 metros (Tolerancia estricta)</option>
                      <option value={100}>100 metros (Edificio / Oficina)</option>
                      <option value={250}>250 metros (Campus / Planta)</option>
                      <option value={500}>500 metros (Parque industrial)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pie de Acciones del Modal */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300 bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold tracking-wide text-white bg-blue-700 hover:bg-blue-600 transition-colors cursor-pointer"
            >
              {currentTask ? 'Guardar Cambios' : 'Guardar y Asignar Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
