import { useState, useEffect } from 'react';
import { X, Check, Trash2, Sparkles, Layers, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { canCreateOrManageCompanies } from '../../../services/companyService';
import { normalizeRole } from '../../../services/rbac';
import type { Project } from '../../../types/rayoner';
import { TimeInputSexagesimal } from '../../../components/common/TimeInputSexagesimal';
import { CreateCompanyModal } from './CreateCompanyModal';
import {
  getServiceTemplates,
  AUDIT_MASTER_TEMPLATE_ID,
  calculateTemplateTotalHours,
} from '../../../services/serviceTemplateService';
import type { ServiceTemplate, ServiceTemplateRubro, ServiceTemplateActivity } from '../../../types/serviceTemplate';

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
    addProjectWithActivities,
    updateProject, 
    deleteProject 
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);
  const canCreateCompany = canCreateOrManageCompanies(user?.role);

  const [isQuickCompanyOpen, setIsQuickCompanyOpen] = useState(false);

  const existingProject = projectId ? projects.find(p => p.id === projectId) : null;
  const isEditing = !!existingProject;

  // Estados del selector de plantilla maestro
  const [creationMode, setCreationMode] = useState<'template' | 'blank'>('template');
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(AUDIT_MASTER_TEMPLATE_ID);
  const [templateRubros, setTemplateRubros] = useState<ServiceTemplateRubro[]>([]);
  const [showRubrosEstimation, setShowRubrosEstimation] = useState(false);

  // Estados del formulario (operativos únicamente, sin tarifas ni costos)
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [deadline, setDeadline] = useState('');
  const [totalBudgetHours, setTotalBudgetHours] = useState(226.2);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Cargar plantillas de servicio al abrir
  useEffect(() => {
    if (!isOpen) return;
    void getServiceTemplates().then((tpls) => {
      setTemplates(tpls);
      const initialTpl =
        tpls.find((t) => t.id === AUDIT_MASTER_TEMPLATE_ID) || tpls[0];
      if (initialTpl && !isEditing) {
        setSelectedTemplateId(initialTpl.id);
        setTemplateRubros(JSON.parse(JSON.stringify(initialTpl.rubros)));
        setTotalBudgetHours(initialTpl.totalBudgetHours || 226.2);
        if (!name) {
          setName(`${initialTpl.name} ${new Date().getFullYear()}`);
        }
      }
    });
  }, [isOpen, isEditing]);

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
      setCreationMode('blank');
    } else {
      const defaultClientId = initialClientId || clients[0]?.id || '';
      setClientId(defaultClientId);
      setCode(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      
      // Fecha límite sugerida: 45 días para auditoría
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 45);
      setDeadline(nextMonth.toISOString().split('T')[0]);
      setNotes('');
      setIsActive(true);
    }
  }, [existingProject?.id, initialClientId, isOpen]);

  // Al cambiar la plantilla seleccionada en modo plantilla
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      const clonedRubros = JSON.parse(JSON.stringify(tpl.rubros));
      setTemplateRubros(clonedRubros);
      const totalH = calculateTemplateTotalHours(clonedRubros);
      setTotalBudgetHours(totalH);
      setName(`${tpl.name} ${new Date().getFullYear()}`);
    }
  };

  // Ajuste en vivo de horas estimadas de un rubro en la pre-alta
  const handleRubroHoursChange = (rubroNum: number, newHours: number) => {
    const validHours = Math.max(0, Number(newHours) || 0);
    setTemplateRubros((prev) => {
      const updated = prev.map((r) => {
        if (r.number !== rubroNum) return r;
        const currentSum = r.activities.reduce((acc, a) => acc + (a.budgetedHours || 0), 0);
        const ratio = currentSum > 0 ? validHours / currentSum : 1;
        const updatedActs = r.activities.map((a) => ({
          ...a,
          budgetedHours: Number((a.budgetedHours * ratio).toFixed(2)),
        }));
        return { ...r, activities: updatedActs };
      });
      const newTotal = calculateTemplateTotalHours(updated);
      setTotalBudgetHours(newTotal);
      return updated;
    });
  };

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
          const rawRole = (m.role || '').toLowerCase();
          const title = (m.roleTitle || '').toLowerCase();
          const email = (m.email || '').toLowerCase();
          const name = (m.name || '').toLowerCase();

          const isSocio =
            r === 'Socio' ||
            rawRole.includes('socio') ||
            rawRole.includes('partner') ||
            title.includes('socio') ||
            title.includes('partner') ||
            email.includes('socio.') ||
            name.includes('socio');

          const isGerente =
            r === 'Gerente' ||
            rawRole.includes('gerent') ||
            rawRole.includes('manager') ||
            title.includes('gerent') ||
            title.includes('manager') ||
            email.includes('gerente.') ||
            name.includes('gerente');

          const isRH =
            r === 'RH' ||
            rawRole.includes('rh') ||
            rawRole.includes('recursos') ||
            title.includes('rh') ||
            title.includes('recursos') ||
            email.includes('rh.');

          const isTI =
            r === 'TI' ||
            rawRole.includes('ti') ||
            rawRole.includes('tecnolog') ||
            rawRole.includes('sistemas') ||
            rawRole.includes('admin') ||
            title.includes('ti') ||
            title.includes('tecnolog') ||
            title.includes('sistemas') ||
            title.includes('admin') ||
            email.includes('ti.');

          return !isSocio && !isGerente && !isRH && !isTI;
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

    const selectedTpl = templates.find((t) => t.id === selectedTemplateId);
    const isUsingTemplate = !isEditing && creationMode === 'template';

    const fullProjectPayload: Omit<Project, 'id'> = {
      ...projectPayload,
      templateId: isUsingTemplate ? selectedTemplateId : undefined,
      templateName: isUsingTemplate ? (selectedTpl?.name || 'Auditoría de Estados Financieros') : undefined,
      isFromTemplate: isUsingTemplate,
    };

    if (isEditing && existingProject) {
      updateProject(existingProject.id, fullProjectPayload);
      addToast(`Proyecto "${name.trim()}" actualizado con éxito`, 'success');
    } else if (isUsingTemplate && templateRubros.length > 0) {
      const flatActivities: ServiceTemplateActivity[] = templateRubros.flatMap(r => r.activities);
      addProjectWithActivities(fullProjectPayload, flatActivities);
      addToast(`Servicio "${name.trim()}" creado desde plantilla oficial con ${flatActivities.length} actividades`, 'success');
    } else {
      addProject(fullProjectPayload);
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
          
          {/* Selector de Modo de Creación: Desde Plantilla vs Personalizado */}
          {!isEditing && (
            <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                Modalidad de Creación
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreationMode('template');
                    const initialTpl = templates.find((t) => t.id === AUDIT_MASTER_TEMPLATE_ID) || templates[0];
                    if (initialTpl) {
                      setSelectedTemplateId(initialTpl.id);
                      setTemplateRubros(JSON.parse(JSON.stringify(initialTpl.rubros)));
                      setTotalBudgetHours(initialTpl.totalBudgetHours || 226.2);
                      setName(`${initialTpl.name} ${new Date().getFullYear()}`);
                    }
                  }}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    creationMode === 'template'
                      ? 'bg-blue-50/80 border-blue-600 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-200 shadow-xs ring-1 ring-blue-600/30'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Layers className={`w-4 h-4 mt-0.5 shrink-0 ${creationMode === 'template' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>Desde Plantilla de Servicio</span>
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 px-1.5 py-0.2 rounded">Recomendado</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      19 rubros y 156 procedimientos oficiales preconfigurados (226.2h base).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreationMode('blank');
                    setTotalBudgetHours(60);
                  }}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    creationMode === 'blank'
                      ? 'bg-blue-50/80 border-blue-600 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-200 shadow-xs ring-1 ring-blue-600/30'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${creationMode === 'blank' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Servicio / Proyecto Personalizado</div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Creación en blanco para definir actividades manuales desde cero.
                    </p>
                  </div>
                </button>
              </div>

              {/* Selector de Plantilla específica si hay varias */}
              {creationMode === 'template' && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Plantilla Maestra Seleccionada:
                    </label>
                    {templates.length > 1 && (
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                        className="text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} ({tpl.totalBudgetHours}h)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Acordeón de Estimación Inicial de Horas por Rubro */}
                  <div className="bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowRubrosEstimation(!showRubrosEstimation)}
                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-900 dark:text-sky-300">
                          Estimación Inicial de Horas por Rubro
                        </span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full">
                          {templateRubros.length} Rubros • {totalBudgetHours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <span>{showRubrosEstimation ? 'Ocultar' : 'Ajustar horas'}</span>
                        {showRubrosEstimation ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </button>

                    {showRubrosEstimation && (
                      <div className="p-3 border-t border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto space-y-2 bg-slate-50/50 dark:bg-slate-900/40">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Puedes ajustar las horas estimadas de cada rubro para esta empresa en particular. Las horas de sus procedimientos se recalibrarán automáticamente:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {templateRubros.map((rubro) => {
                            const rubroHours = rubro.activities.reduce((acc, a) => acc + (a.budgetedHours || 0), 0);
                            return (
                              <div
                                key={rubro.number}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={rubro.name}>
                                    {rubro.number === 0 ? '0. Planeación General y Cierre' : `${rubro.number}. ${rubro.name}`}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {rubro.activities.length} actividades
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={rubroHours}
                                    onChange={(e) => handleRubroHoursChange(rubro.number, parseFloat(e.target.value) || 0)}
                                    className="w-16 px-2 py-1 text-right text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                  />
                                  <span className="text-[11px] text-slate-500 font-bold">h</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
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
