import { useState, useEffect } from 'react';
import { 
  X, Briefcase, Building2, User, Clock, 
  DollarSign, Calendar, FileText, Check, 
  Trash2, Sparkles, Hash 
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import type { BudgetType, Project } from '../../../types/rayoner';

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

  const addToast = useCheckinStore(state => state.addToast);

  const existingProject = projectId ? projects.find(p => p.id === projectId) : null;
  const isEditing = !!existingProject;

  // Estados del formulario
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [leadUserId, setLeadUserId] = useState('');
  const [leadUserName, setLeadUserName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('fixed_project');
  const [totalBudgetHours, setTotalBudgetHours] = useState(60);
  const [hourlyRate, setHourlyRate] = useState(1500);
  const [currency, setCurrency] = useState('MXN');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Sincronizar formulario al abrir o cambiar de proyecto
  useEffect(() => {
    if (existingProject) {
      setClientId(existingProject.clientId);
      setName(existingProject.name);
      setCode(existingProject.code);
      setLeadUserId(existingProject.leadUserId || 'sup-1');
      setLeadUserName(existingProject.leadUserName || 'Mtro. Roberto Silva (Socio)');
      setDeadline(existingProject.deadline || new Date().toISOString().split('T')[0]);
      setBudgetType(existingProject.budgetType || 'fixed_project');
      setTotalBudgetHours(existingProject.totalBudgetHours || 60);
      setHourlyRate(existingProject.hourlyRate || 1500);
      setCurrency(existingProject.currency || 'MXN');
      setNotes(existingProject.notes || '');
      setIsActive(existingProject.isActive ?? true);
    } else {
      const defaultClientId = initialClientId || clients[0]?.id || '';
      setClientId(defaultClientId);
      setName('');
      setCode(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setLeadUserId(teamMembers[0]?.id || 'sup-1');
      setLeadUserName(teamMembers[0]?.name || 'Mtro. Roberto Silva (Socio)');
      
      // Fecha límite sugerida: fin de mes actual o 30 días
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      setDeadline(nextMonth.toISOString().split('T')[0]);

      setBudgetType('fixed_project');
      setTotalBudgetHours(60);
      setHourlyRate(1500);
      setCurrency('MXN');
      setNotes('');
      setIsActive(true);
    }
  }, [existingProject, initialClientId, clients, teamMembers, isOpen]);

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

    const selectedLead = teamMembers.find(m => m.id === leadUserId);
    const finalLeadName = selectedLead ? `${selectedLead.name} (${selectedLead.roleTitle})` : leadUserName;

    const projectPayload: Omit<Project, 'id'> = {
      clientId,
      name: name.trim(),
      code: code.trim() || `PRJ-${Date.now()}`,
      leadUserId: leadUserId || 'sup-1',
      leadUserName: finalLeadName,
      deadline,
      budgetType,
      totalBudgetHours: Number(totalBudgetHours) || 0,
      hourlyRate: Number(hourlyRate) || 0,
      currency,
      notes: notes.trim(),
      isActive,
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
      ? `¿Estás seguro de eliminar el proyecto "${existingProject.name}"? Se eliminarán también sus ${projectTasksCount} tareas asociadas.`
      : `¿Estás seguro de eliminar el proyecto "${existingProject.name}"?`;

    if (window.confirm(confirmMsg)) {
      deleteProject(existingProject.id);
      addToast('Proyecto eliminado con éxito', 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-8 flex flex-col">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEditing ? 'Modifica el presupuesto, fechas y alcance del proyecto' : 'Asigna presupuesto, horas estimadas y responsable del proyecto'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          
          {/* Fila 1: Cliente y Código */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            
            {/* Cliente */}
            <div className="sm:col-span-7">
              <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" />
                Cliente Asignado *
              </label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.taxId ? `(${c.taxId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Código del Proyecto */}
            <div className="sm:col-span-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center">
                  <Hash className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Código *
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateCode}
                  className="text-[10px] font-bold text-[#0D5C75] hover:underline flex items-center"
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
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
              />
            </div>

          </div>

          {/* Fila 2: Nombre del Proyecto */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Nombre del Proyecto *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Auditoría Fiscal Anual 2026 / Dictamen SAT"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
            />
          </div>

          {/* Fila 3: Responsable y Fecha Límite */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            
            {/* Responsable */}
            <div className="sm:col-span-7">
              <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" />
                Líder / Socio Responsable
              </label>
              <select
                value={leadUserId}
                onChange={e => {
                  setLeadUserId(e.target.value);
                  const member = teamMembers.find(m => m.id === e.target.value);
                  if (member) setLeadUserName(`${member.name} (${member.roleTitle})`);
                }}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
              >
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.roleTitle} ({m.team})
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha Límite */}
            <div className="sm:col-span-5">
              <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Fecha Límite / Entrega
              </label>
              <input
                type="date"
                required
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
              />
            </div>

          </div>

          {/* Fila 4: Tipo de Presupuesto y Horas */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Control Presupuestario y Tarifas
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Opción 1: Presupuesto Fijo */}
              <button
                type="button"
                onClick={() => setBudgetType('fixed_project')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  budgetType === 'fixed_project'
                    ? 'bg-[#0D5C75]/10 border-[#0D5C75] text-[#0D5C75] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold block">Bolsa Fija Proyecto</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Límite total de horas para todo el proyecto.
                </span>
              </button>

              {/* Opción 2: Suma de Tareas */}
              <button
                type="button"
                onClick={() => setBudgetType('by_tasks')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  budgetType === 'by_tasks'
                    ? 'bg-[#0D5C75]/10 border-[#0D5C75] text-[#0D5C75] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold block">Suma de Tareas</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Se calcula sumando las subtareas del proyecto.
                </span>
              </button>

              {/* Opción 3: Por Colaborador */}
              <button
                type="button"
                onClick={() => setBudgetType('by_person')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  budgetType === 'by_person'
                    ? 'bg-[#0D5C75]/10 border-[#0D5C75] text-[#0D5C75] shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-bold block">Por Colaborador</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Límites independientes asignados por persona.
                </span>
              </button>

            </div>

            {/* Horas Presupuestadas y Tarifa */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              
              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-[#0D5C75]" />
                  Presupuesto Total (Horas)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={totalBudgetHours}
                  onChange={e => setTotalBudgetHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center">
                  <DollarSign className="w-3 h-3 mr-1 text-emerald-600" />
                  Tarifa por Hora Base
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Moneda
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
                >
                  <option value="MXN">MXN ($)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Fila 5: Notas y Observaciones */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Notas u Observaciones del Proyecto
            </label>
            <textarea
              rows={2}
              placeholder="Instrucciones especiales para el equipo, alcance o detalles del contrato..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none resize-none"
            />
          </div>

          {/* Fila 6: Estado Activo / Inactivo */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Proyecto Activo</span>
              <span className="text-[11px] text-slate-500">
                Los colaboradores solo pueden registrar tiempo en proyectos activos.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                isActive ? 'bg-[#0D5C75]' : 'bg-slate-300'
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
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Eliminar Proyecto
              </button>
            ) : <span />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 bg-[#0D5C75] hover:bg-[#0A485C] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                {isEditing ? 'Guardar Cambios' : 'Crear Proyecto'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
