import { useState, useEffect } from 'react';
import { X, Check, Trash2, Sparkles } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { canCreateOrManageCompanies } from '../../../services/companyService';
import { normalizeRole } from '../../../services/rbac';
import type { Project } from '../../../types/rayoner';
import { TimeInputSexagesimal } from '../../../components/common/TimeInputSexagesimal';
import { CreateCompanyModal } from './CreateCompanyModal';

interface RayonerProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  initialClientId?: string | null;
}

export function RayonerProjectModal({
  isOpen,
  onClose,
  projectId,
  initialClientId,
}: RayonerProjectModalProps) {
  const { 
    projects, 
    clients, 
    tasks,
    teamMembers,
    addProject, 
    updateProject, 
    deleteProject 
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);
  const canCreateCompany = canCreateOrManageCompanies(user?.role);

  const [isQuickCompanyOpen, setIsQuickCompanyOpen] = useState(false);

  const existingProject = projectId ? projects.find(p => p.id === projectId) : null;
  const isEditing = !!existingProject;

  // Estados del formulario (operativos únicamente, sin tarifas ni costos)
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [deadline, setDeadline] = useState('');
  const [totalBudgetHours, setTotalBudgetHours] = useState(60);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Sincronizar formulario al abrir o cambiar de proyecto
  useEffect(() => {
    if (!isOpen) return;
    if (existingProject) {
      setClientId(existingProject.clientId);
      setName(existingProject.name);
      setCode(existingProject.code);
      setDeadline(existingProject.deadline || new Date().toISOString().split('T')[0]);
      setTotalBudgetHours(existingProject.totalBudgetHours || 60);
      setNotes(existingProject.notes || '');
      setIsActive(existingProject.isActive ?? true);
    } else {
      const defaultClientId = initialClientId || clients[0]?.id || '';
      setClientId(defaultClientId);
      setName('');
      setCode(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      
      // Fecha límite sugerida: 30 días
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      setDeadline(nextMonth.toISOString().split('T')[0]);

      setTotalBudgetHours(60);
      setNotes('');
      setIsActive(true);
    }
  }, [existingProject?.id, initialClientId, isOpen]);

  // Si aún no había empresa seleccionada y aparece la primera en el catálogo, seleccionarla
  useEffect(() => {
    if (isOpen && !isEditing && !clientId && clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [isOpen, isEditing, clientId, clients]);

  // Autogenerar código sugerido si cambia el nombre del proyecto
  const handleAutoGenerateCode = () => {
    const selectedClient = clients.find(c => c.id === clientId);
    const clientPrefix = selectedClient ? selectedClient.name.substring(0, 3).toUpperCase() : 'CLI';
    const words = name.trim().split(' ').filter(Boolean);
    const namePrefix = words.length >= 2 
      ? words.slice(0, 2).map(w => w[0].toUpperCase()).join('') 
      : 'PRJ';
    const year = new Date().getFullYear();
    setCode(`${namePrefix}-${year}-${clientPrefix}`);
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast('El nombre del proyecto es obligatorio', 'error');
      return;
    }

    if (!clientId) {
      addToast('Debes seleccionar un cliente para este proyecto', 'error');
      return;
    }

    const currentUserId = user?.id || 'demo_gerente';
    const currentUserName = user?.name 
      ? `${user.name} ${user.lastName || ''}`.trim() 
      : (user?.email || 'Gerente');

    // Regla de negocio 2: Encargado automático (el usuario creador)
    const effectiveLeadId = isEditing && existingProject 
      ? (existingProject.leadUserId || currentUserId) 
      : currentUserId;
    const effectiveLeadName = isEditing && existingProject 
      ? (existingProject.leadUserName || currentUserName) 
      : currentUserName;

    // Regla directiva: Socio y Gerente acceden y supervisan por default (partnerId y managerId).
    // assignedUserIds está reservado exclusivamente para los colaboradores y supervisores operativos asignados.
    const socioMember = teamMembers.find((m) => normalizeRole(m.role) === 'Socio');
    const partnerId = isEditing && existingProject
      ? (existingProject.partnerId || socioMember?.id || '')
      : (socioMember?.id || '');

    const eligibleOpIds = new Set(
      teamMembers
        .filter((m) => {
          const r = normalizeRole(m.role);
          return r !== 'Socio' && r !== 'Gerente' && r !== 'RH' && r !== 'TI';
        })
        .map((m) => m.id)
    );

    const baseAssignedIds = isEditing && existingProject?.assignedUserIds
      ? existingProject.assignedUserIds.filter((id) => eligibleOpIds.has(id))
      : [];

    const finalAssignedUserIds = Array.from(new Set(baseAssignedIds));

    const plannedMinutes = Math.max(0, Math.round((Number(totalBudgetHours) || 0) * 60));

    const projectPayload: Omit<Project, 'id'> = {
      clientId,
      name: name.trim(),
      code: code.trim() || `PRJ-${Date.now()}`,
      leadUserId: effectiveLeadId,
      leadUserName: effectiveLeadName,
      managerId: effectiveLeadId,
      managerName: effectiveLeadName,
      partnerId,
      deadline,
      totalBudgetHours: Number((plannedMinutes / 60).toFixed(4)),
      plannedMinutes,
      notes: notes.trim(),
      isActive,
      assignedUserIds: finalAssignedUserIds,
      assignedToIds: finalAssignedUserIds,
    };

    if (isEditing && existingProject) {
      updateProject(existingProject.id, projectPayload);
      addToast(`Proyecto "${name.trim()}" actualizado con éxito`, 'success');
    } else {
      addProject(projectPayload);
      addToast(`Proyecto "${name.trim()}" creado con éxito`, 'success');
    }

    onClose();
  };

  const handleDelete = () => {
    if (!existingProject) return;
    const projectTasksCount = tasks.filter(t => t.projectId === existingProject.id).length;
    const confirmMsg = projectTasksCount > 0
      ? `¿Estás seguro de eliminar el proyecto "${existingProject.name}"? Se eliminarán también sus ${projectTasksCount} actividades asociadas.`
      : `¿Estás seguro de eliminar el proyecto "${existingProject.name}"?`;

    if (window.confirm(confirmMsg)) {
      deleteProject(existingProject.id);
      addToast('Proyecto eliminado con éxito', 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-8 flex flex-col">
        
        {/* Cabecera del Modal (Diseño sobrio corporativo sin iconos decorativos en título) */}
        <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
              {isEditing ? 'Editar Proyecto / Servicio' : 'Nuevo Proyecto / Servicio'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEditing 
                ? 'Modifica el alcance operativo, fechas y horas estimadas del proyecto.' 
                : 'Registra un nuevo proyecto o servicio para asignación de actividades y seguimiento de horas.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          
          {/* Fila 1: Cliente y Código */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            
            {/* Empresa / Cliente Asignado */}
            <div className="sm:col-span-7">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Empresa / Cliente Asignado *
                </label>
                {canCreateCompany && (
                  <button
                    type="button"
                    onClick={() => setIsQuickCompanyOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    <span>+ Registrar empresa</span>
                  </button>
                )}
              </div>
              {clients.length === 0 ? (
                <div className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 flex items-center justify-between gap-2">
                  <span>No hay empresas registradas aún.</span>
                  {canCreateCompany && (
                    <button
                      type="button"
                      onClick={() => setIsQuickCompanyOpen(true)}
                      className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer shrink-0"
                    >
                      + Registrar empresa
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
                >
                  <option value="">-- Seleccionar empresa --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : c.taxId ? `(${c.taxId})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Código del Proyecto */}
            <div className="sm:col-span-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Código del Proyecto *
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateCode}
                  className="text-[10px] font-semibold text-blue-700 dark:text-sky-400 hover:underline flex items-center cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 mr-0.5" />
                  Sugerir
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="AUD-2026-01"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-sans font-medium tabular-nums text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
              />
            </div>

          </div>

          {/* Fila 2: Nombre del Proyecto */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Nombre del Proyecto o Servicio *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Auditoría Fiscal Anual 2026 / Dictamen SAT"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
            />
          </div>

          {/* Fila 3: Fecha Límite */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Fecha Límite / Entrega *
            </label>
            <input
              type="date"
              required
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
            />
          </div>

          {/* Fila 4: Control Operativo de Horas Estimadas (Sin Tarifas ni Costos) */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider block">
                Horas Estimadas / Presupuestadas
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Bolsa total de horas estimadas para la ejecución y seguimiento operativo del proyecto o servicio.
              </p>
            </div>

            <div className="max-w-xs" data-tour="project-budget-input">
              <TimeInputSexagesimal
                label="Total de Horas Estimadas"
                totalHours={totalBudgetHours}
                onChange={(newH) => setTotalBudgetHours(newH)}
              />
            </div>
          </div>

          {/* Fila 5: Notas y Observaciones */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Notas u Observaciones del Proyecto
            </label>
            <textarea
              rows={2}
              placeholder="Instrucciones especiales para el equipo, alcance operativo o requerimientos técnicos..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none resize-none"
            />
          </div>

          {/* Fila 6: Estado Activo / Inactivo */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Proyecto Activo</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Los colaboradores solo pueden registrar tiempo en proyectos activos.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                isActive ? 'bg-blue-700' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Eliminar Proyecto
              </button>
            ) : <span />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                {isEditing ? 'Guardar Cambios' : 'Crear Proyecto'}
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* Acceso Rápido Inline: Registrar nueva empresa sin salir del modal de proyecto */}
      <CreateCompanyModal
        isOpen={isQuickCompanyOpen}
        onClose={() => setIsQuickCompanyOpen(false)}
        onCreated={(newCompanyId) => {
          setClientId(newCompanyId);
        }}
      />
    </div>
  );
}
