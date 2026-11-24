import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Users,
  Plus,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { canCreateOrManageCompanies } from '../../../services/companyService';
import { normalizeRole } from '../../../services/rbac';
import type { Project } from '../../../types/rayoner';
import { TimeInputSexagesimal } from '../../../components/common/TimeInputSexagesimal';
import { CreateCompanyModal } from './CreateCompanyModal';
import {
  getServiceCatalog,
  SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026,
  SERVICE_DICTAMEN_FISCAL_IMSS,
  SERVICE_REVISION_LIMITADA,
  SERVICE_CONSULTORIA_CONTROL_INTERNO,
  calculateTemplateTotalHours,
} from '../../../services/serviceCatalogService';

// Etiquetas de enfoque para el Catálogo de Servicios
const CATALOG_ITEM_BADGES: Record<string, string> = {
  [SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026]: 'NIA / Integral',
  [SERVICE_DICTAMEN_FISCAL_IMSS]: 'Fiscal / IMSS',
  [SERVICE_REVISION_LIMITADA]: 'Financiero',
  [SERVICE_CONSULTORIA_CONTROL_INTERNO]: 'COSO / TI',
};

// Formatea el nombre sugerido evitando duplicar el año (ej: "Auditoría de Estados Financieros 2026")
function formatSuggestedServiceName(templateName: string): string {
  if (/\b20\d{2}\b/.test(templateName)) {
    return templateName;
  }
  return `${templateName} ${new Date().getFullYear()}`;
}
import type {
  ServiceTemplate,
  ServiceTemplateRubro,
  ServiceTemplateActivity,
} from '../../../types/serviceTemplate';

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
    deleteProject,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);
  const canCreateCompany = canCreateOrManageCompanies(user?.role);

  const [isQuickCompanyOpen, setIsQuickCompanyOpen] = useState(false);

  const existingProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const isEditing = !!existingProject;

  // Control de Pasos: 1 = Definición del Servicio, 2 = Equipo y Asignación Inicial
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Modalidad: Catálogo de Servicios vs Nuevo Servicio en Blanco
  const [creationMode, setCreationMode] = useState<'catalog' | 'blank'>('catalog');
  const [catalogServices, setCatalogServices] = useState<ServiceTemplate[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(
    SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026
  );
  const [catalogRubros, setCatalogRubros] = useState<ServiceTemplateRubro[]>([]);
  const [showRubrosEstimation, setShowRubrosEstimation] = useState(false);

  // Paso 1: Campos del Servicio
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [deadline, setDeadline] = useState('');
  const [totalBudgetHours, setTotalBudgetHours] = useState(226.2);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Paso 2: Asignación de Equipo Obligatorio
  const [leadUserId, setLeadUserId] = useState<string>(''); // Encargado del Servicio (Obligatorio)
  const [secondMemberId, setSecondMemberId] = useState<string>(''); // Segundo Colaborador (Obligatorio)
  const [additionalMemberIds, setAdditionalMemberIds] = useState<string[]>([]); // Colaboradores Adicionales

  // Cargar Catálogo Oficial de Servicios desde Firestore al abrir
  useEffect(() => {
    if (!isOpen) return;
    void getServiceCatalog().then((services) => {
      setCatalogServices(services);
      const initialSrv =
        services.find((s) => s.id === SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026) ||
        services[0];
      if (initialSrv && !isEditing) {
        setSelectedCatalogId(initialSrv.id);
        setCatalogRubros(JSON.parse(JSON.stringify(initialSrv.rubros)));
        setTotalBudgetHours(initialSrv.totalBudgetHours || 226.2);
        if (!name) {
          setName(formatSuggestedServiceName(initialSrv.name));
        }
      }
    });
  }, [isOpen, isEditing]);

  // Sincronizar formulario al abrir o cambiar de proyecto
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);
    if (existingProject) {
      setClientId(existingProject.clientId);
      setName(existingProject.name);
      setCode(existingProject.code);
      setDeadline(existingProject.deadline || new Date().toISOString().split('T')[0]);
      setTotalBudgetHours(existingProject.totalBudgetHours || 60);
      setNotes(existingProject.notes || '');
      setIsActive(existingProject.isActive ?? true);
      setCreationMode('blank');
      setLeadUserId(existingProject.leadUserId || '');

      const assigned = existingProject.assignedUserIds || [];
      if (assigned.length > 0) {
        const firstColab = assigned.find((id) => id !== existingProject.leadUserId);
        setSecondMemberId(firstColab || assigned[0] || '');
        setAdditionalMemberIds(
          assigned.filter(
            (id) => id !== existingProject.leadUserId && id !== firstColab
          )
        );
      } else {
        setSecondMemberId('');
        setAdditionalMemberIds([]);
      }
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

      // Sugerir líderes operativos iniciales por defecto si existen
      const defaultLeader =
        teamMembers.find((m) => normalizeRole(m.role) === 'Supervisor') ||
        teamMembers.find((m) => normalizeRole(m.role) === 'Gerente');
      const defaultColab = teamMembers.find(
        (m) =>
          normalizeRole(m.role) === 'Colaborador' && m.id !== defaultLeader?.id
      );

      setLeadUserId(defaultLeader?.id || user?.id || '');
      setSecondMemberId(defaultColab?.id || '');
      setAdditionalMemberIds([]);
    }
  }, [existingProject?.id, initialClientId, isOpen]);

  // Al cambiar el servicio seleccionado en el Catálogo de Servicios
  const handleSelectCatalogService = (serviceId: string) => {
    setSelectedCatalogId(serviceId);
    setCreationMode('catalog');
    const srv = catalogServices.find((s) => s.id === serviceId);
    if (srv) {
      const clonedRubros = JSON.parse(JSON.stringify(srv.rubros));
      setCatalogRubros(clonedRubros);
      const totalH = calculateTemplateTotalHours(clonedRubros);
      setTotalBudgetHours(totalH);
      setName(formatSuggestedServiceName(srv.name));
    }
  };

  // Ajuste en vivo de horas estimadas de un rubro en la pre-alta
  const handleRubroHoursChange = (rubroNum: number, newHours: number) => {
    const validHours = Math.max(0, Number(newHours) || 0);
    setCatalogRubros((prev) => {
      const updated = prev.map((r) => {
        if (r.number !== rubroNum) return r;
        const currentSum = r.activities.reduce(
          (acc, a) => acc + (a.budgetedHours || 0),
          0
        );
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

  // Si aún no había empresa seleccionada y aparece la primera, seleccionarla
  useEffect(() => {
    if (isOpen && !isEditing && !clientId && clients.length > 0) {
      setClientId(clients[0].id);
    }
  }, [isOpen, isEditing, clientId, clients]);

  // Autogenerar código sugerido si cambia el nombre del proyecto
  const handleAutoGenerateCode = () => {
    const selectedClient = clients.find((c) => c.id === clientId);
    const clientPrefix = selectedClient
      ? selectedClient.name.substring(0, 3).toUpperCase()
      : 'CLI';
    const words = name.trim().split(' ').filter(Boolean);
    const namePrefix =
      words.length >= 2
        ? words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
        : 'PRJ';
    const year = new Date().getFullYear();
    setCode(`${namePrefix}-${year}-${clientPrefix}`);
  };

  // -------------------------------------------------------------
  // Listas de Miembros Filtradas para el Paso 2
  // -------------------------------------------------------------
  // Socio Institucional (vinculado automáticamente)
  const socioMember = useMemo(() => {
    return (
      teamMembers.find(
        (m) =>
          normalizeRole(m.role) === 'Socio' ||
          (m.roleTitle || '').toLowerCase().includes('socio') ||
          (m.email || '').toLowerCase().includes('socio.')
      ) || null
    );
  }, [teamMembers]);

  // Candidatos para Encargado del Servicio (Supervisores y Gerentes)
  const eligibleLeaders = useMemo(() => {
    return teamMembers.filter((m) => {
      const r = normalizeRole(m.role);
      const title = (m.roleTitle || '').toLowerCase();
      const rawRole = (m.role || '').toLowerCase();
      const isRH = r === 'RH' || rawRole.includes('rh') || title.includes('recursos');
      const isTI = r === 'TI' || rawRole.includes('ti') || title.includes('tecnolog');
      if (isRH || isTI) return false;

      return (
        r === 'Supervisor' ||
        r === 'Gerente' ||
        title.includes('supervisor') ||
        title.includes('gerent') ||
        title.includes('manager')
      );
    });
  }, [teamMembers]);

  // Candidatos para Segundo Colaborador y Adicionales (Operativos, excluye RH y TI)
  const eligibleOperativeMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const r = normalizeRole(m.role);
      const rawRole = (m.role || '').toLowerCase();
      const title = (m.roleTitle || '').toLowerCase();
      const isRH = r === 'RH' || rawRole.includes('rh') || title.includes('recursos');
      const isTI = r === 'TI' || rawRole.includes('ti') || title.includes('tecnolog');
      const isSocio = r === 'Socio' || rawRole.includes('socio');

      return !isRH && !isTI && !isSocio;
    });
  }, [teamMembers]);

  // Colaboradores operativos disponibles para segundo colaborador (excluye al líder elegido)
  const secondMemberOptions = useMemo(() => {
    return eligibleOperativeMembers.filter((m) => m.id !== leadUserId);
  }, [eligibleOperativeMembers, leadUserId]);

  // Colaboradores operativos disponibles para miembros adicionales
  const additionalMemberOptions = useMemo(() => {
    const selectedSet = new Set([leadUserId, secondMemberId, ...additionalMemberIds]);
    return eligibleOperativeMembers.filter((m) => !selectedSet.has(m.id));
  }, [eligibleOperativeMembers, leadUserId, secondMemberId, additionalMemberIds]);

  const handleAddAdditionalMember = () => {
    const nextAvailable = additionalMemberOptions[0];
    if (nextAvailable) {
      setAdditionalMemberIds((prev) => [...prev, nextAvailable.id]);
    } else {
      addToast('No hay más colaboradores operativos disponibles para asignar.', 'info');
    }
  };

  const handleRemoveAdditionalMember = (indexToRemove: number) => {
    setAdditionalMemberIds((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateAdditionalMember = (indexToUpdate: number, newId: string) => {
    setAdditionalMemberIds((prev) => {
      const updated = [...prev];
      updated[indexToUpdate] = newId;
      return updated;
    });
  };

  // -------------------------------------------------------------
  // Navegación de Pasos
  // -------------------------------------------------------------
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast('El nombre del proyecto o servicio es obligatorio.', 'error');
      return;
    }
    if (!clientId) {
      addToast('Debes seleccionar una empresa o cliente para este servicio.', 'error');
      return;
    }
    if (!code.trim()) {
      addToast('El código del proyecto es obligatorio.', 'error');
      return;
    }
    if (!deadline) {
      addToast('La fecha límite de entrega es obligatoria.', 'error');
      return;
    }

    setCurrentStep(2);
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // Guardado Final (Paso 2 Confirmado)
  // -------------------------------------------------------------
  const handleFinalSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!leadUserId) {
      addToast('Debes asignar un Encargado del Servicio (Supervisor o Gerente).', 'error');
      return;
    }

    if (!secondMemberId) {
      addToast('Debes asignar al menos un Segundo Colaborador operativo.', 'error');
      return;
    }

    const leadMember = teamMembers.find((m) => m.id === leadUserId);
    const secondMember = teamMembers.find((m) => m.id === secondMemberId);

    const leadName = leadMember
      ? leadMember.name.trim()
      : 'Encargado';
    const secondName = secondMember
      ? secondMember.name.trim()
      : 'Colaborador';

    // Lista consolidada de participantes operativos asignados
    const allAssignedIds = Array.from(
      new Set(
        [leadUserId, secondMemberId, ...additionalMemberIds].filter(Boolean)
      )
    );

    const plannedMinutes = Math.max(
      0,
      Math.round((Number(totalBudgetHours) || 0) * 60)
    );

    const selectedCatalogItem = catalogServices.find((s) => s.id === selectedCatalogId);
    const isUsingCatalog = !isEditing && creationMode === 'catalog';

    const projectPayload: Omit<Project, 'id'> = {
      clientId,
      name: name.trim(),
      code: code.trim().toUpperCase() || `PRJ-${Date.now()}`,
      leadUserId,
      leadUserName: leadName,
      managerId: leadUserId,
      managerName: leadName,
      partnerId: socioMember?.id || '',
      deadline,
      totalBudgetHours: Number((plannedMinutes / 60).toFixed(4)),
      plannedMinutes,
      notes: notes.trim(),
      isActive,
      assignedUserIds: allAssignedIds,
      assignedToIds: allAssignedIds,
      templateId: isUsingCatalog ? selectedCatalogId : undefined,
      templateName: isUsingCatalog ? selectedCatalogItem?.name : undefined,
      isFromTemplate: isUsingCatalog,
    };

    if (isEditing && existingProject) {
      updateProject(existingProject.id, projectPayload);
      addToast(`Servicio "${name.trim()}" actualizado con éxito`, 'success');
    } else if (isUsingCatalog && catalogRubros.length > 0) {
      // Auto-asignación a todas las actividades generadas desde el Catálogo:
      // - Todos los miembros quedan en assignedUserIds
      // - Segundo Colaborador queda como el Responsable inicial por defecto
      const flatActivities: ServiceTemplateActivity[] = catalogRubros
        .flatMap((r) => r.activities)
        .map((act) => {
          // Si el perfil sugerido de la actividad es explícitamente Gerente y el líder es Gerente, puede quedar el líder;
          // de lo contrario, el Segundo Colaborador toma la responsabilidad operativa de la actividad.
          const isLeadLevel = act.perfilSugerido === 'Gerente';
          const assignedLeadId = isLeadLevel ? leadUserId : secondMemberId;
          const assignedLeadName = isLeadLevel ? leadName : secondName;

          return {
            ...act,
            assignedUserIds: allAssignedIds,
            leadUserId: assignedLeadId,
            leadUserName: assignedLeadName,
            status: 'pending',
          } as ServiceTemplateActivity & { leadUserName: string };
        });

      addProjectWithActivities(projectPayload, flatActivities);
      addToast(
        `Servicio "${name.trim()}" creado desde el Catálogo de Servicios con ${flatActivities.length} actividades auto-asignadas.`,
        'success'
      );
    } else {
      addProject(projectPayload);
      addToast(`Servicio en blanco "${name.trim()}" creado con éxito.`, 'success');
    }

    onClose();
  };

  const handleDelete = () => {
    if (!existingProject) return;
    const projectTasksCount = tasks.filter(
      (t) => t.projectId === existingProject.id
    ).length;
    const confirmMsg =
      projectTasksCount > 0
        ? `¿Estás seguro de eliminar el servicio "${existingProject.name}"? Se eliminarán también sus ${projectTasksCount} actividades asociadas.`
        : `¿Estás seguro de eliminar el servicio "${existingProject.name}"?`;

    if (window.confirm(confirmMsg)) {
      deleteProject(existingProject.id);
      addToast('Servicio eliminado con éxito', 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-8 flex flex-col">
        {/* Cabecera del Modal con Navegación de Pasos */}
        <div className="px-6 py-4.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                {isEditing ? 'Gestión de Servicio' : 'Nuevo Servicio'}
              </span>
              {!isEditing && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  Paso {currentStep} de 2
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight mt-0.5">
              {currentStep === 1
                ? isEditing
                  ? 'Editar Parámetros del Servicio'
                  : 'Nuevo Servicio'
                : 'Paso 2: Equipo y Asignación Inicial'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentStep === 1
                ? 'Define la empresa, el tipo de servicio y las horas estimadas de ejecución.'
                : 'Asigna al Encargado del Servicio y al Segundo Colaborador para auto-asignar las actividades.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PASO 1: DEFINICIÓN DEL SERVICIO Y CATÁLOGO */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 1 && (
          <form onSubmit={handleProceedToStep2} className="p-6 space-y-5">
            {/* Modalidad: Catálogo de Servicios (Rediseño Compacto: Bloque A y Bloque B) */}
            {!isEditing && (
              <div className="space-y-3">
                {/* Bloque A: Lista Seleccionable Compacta (Filas de 1 línea) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                      Catálogo de Servicios de la Firma
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Selecciona una plantilla o servicio en blanco
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-850 shadow-xs">
                    {/* Filas 1 a 4: Plantillas Institucionales */}
                    {catalogServices.map((srv) => {
                      const isSelected = creationMode === 'catalog' && selectedCatalogId === srv.id;
                      const rubrosCount = srv.rubros?.length || 0;
                      const activitiesCount = srv.totalActivities || (srv.rubros ? srv.rubros.reduce((acc, r) => acc + (r.activities?.length || 0), 0) : 0);
                      const displayHours = Number(
                        isSelected
                          ? totalBudgetHours
                          : (srv.totalBudgetHours || calculateTemplateTotalHours(srv.rubros))
                      ).toFixed(1);
                      const badgeText = CATALOG_ITEM_BADGES[srv.id] || 'Oficial';

                      return (
                        <div
                          key={srv.id}
                          onClick={() => handleSelectCatalogService(srv.id)}
                          className={`flex items-center gap-2.5 py-2.5 px-3.5 transition-all cursor-pointer ${isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-700'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }`}
                        >
                          {/* Radio indicador */}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                              }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          {/* Nombre del Servicio */}
                          <span
                            className={`text-xs truncate ${isSelected
                              ? 'text-blue-950 dark:text-blue-100 font-semibold'
                              : 'text-slate-800 dark:text-slate-200 font-medium'
                              }`}
                          >
                            {srv.name}
                          </span>

                          {/* Etiqueta corta de enfoque */}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 shrink-0">
                            {badgeText}
                          </span>

                          {/* Métricas alineadas a la derecha */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0 ml-auto">
                            <span>{rubrosCount} rubros</span>
                            <span>•</span>
                            <span>{activitiesCount} act.</span>
                            <span>•</span>
                            <span
                              className={`font-bold ${isSelected ? 'text-blue-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300'
                                }`}
                            >
                              {displayHours}h
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Fila 5: Servicio en Blanco (Personalizado) */}
                    {(() => {
                      const isBlankSelected = creationMode === 'blank';
                      return (
                        <div
                          onClick={() => {
                            setCreationMode('blank');
                            setSelectedCatalogId('blank');
                            setTotalBudgetHours(60);
                            setName('');
                          }}
                          className={`flex items-center gap-2.5 py-2.5 px-3.5 transition-all cursor-pointer ${isBlankSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-700'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }`}
                        >
                          {/* Radio indicador */}
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isBlankSelected
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                              }`}
                          >
                            {isBlankSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          {/* Nombre del Servicio */}
                          <span
                            className={`text-xs truncate ${isBlankSelected
                              ? 'text-blue-950 dark:text-blue-100 font-semibold'
                              : 'text-slate-800 dark:text-slate-200 font-medium'
                              }`}
                          >
                            Servicio en Blanco (Personalizado)
                          </span>

                          {/* Etiqueta corta de enfoque */}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                            0 actividades
                          </span>

                          {/* Métricas alineadas a la derecha */}
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto">
                            Personalizable
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Bloque B: Ficha Técnica de la Plantilla Seleccionada (Detalles Claros) */}
                {creationMode === 'catalog' && catalogRubros.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5">
                    {/* Resumen superior en una línea */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 flex-wrap">
                        <span className="font-medium text-slate-500 dark:text-slate-400">Estructura incluida:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {catalogRubros.length} Rubros
                        </span>
                        <span>•</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {catalogRubros.reduce((acc, r) => acc + (r.activities?.length || 0), 0)} Actividades predeterminadas
                        </span>
                        <span>•</span>
                        <span className="font-bold text-blue-700 dark:text-sky-400 tabular-nums">
                          Total: {totalBudgetHours.toFixed(1)}h estimadas
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowRubrosEstimation(!showRubrosEstimation)}
                        className="text-xs font-semibold text-blue-700 dark:text-sky-400 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto shrink-0"
                      >
                        <span>
                          {showRubrosEstimation
                            ? `Ocultar rubros (${catalogRubros.length})`
                            : `Ver y ajustar rubros (${catalogRubros.length})`}
                        </span>
                        {showRubrosEstimation ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Acordeón Desplegable de Rubros y Horas */}
                    {showRubrosEstimation && (
                      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700">
                        <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                          {catalogRubros.map((rubro) => {
                            const rubroHours = rubro.activities.reduce(
                              (acc, a) => acc + (a.budgetedHours || 0),
                              0
                            );
                            const cleanRubroName = rubro.name.replace(/^Rubro \d+\s*—\s*/i, '');
                            const rubroTitle = rubro.number === 0
                              ? '0. Planeación General y Cierre'
                              : `${rubro.number}. ${cleanRubroName}`;

                            return (
                              <div
                                key={rubro.number}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <span
                                    className="font-semibold text-slate-800 dark:text-slate-200 truncate block"
                                    title={rubro.name}
                                  >
                                    {rubroTitle}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {rubro.activities.length} actividades
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={rubroHours}
                                    onChange={(e) =>
                                      handleRubroHoursChange(
                                        rubro.number,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-16 px-2 py-1 text-right text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 tabular-nums"
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
                )}
              </div>
            )}

            {/* Fila 1: Empresa y Código */}
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
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <span>Registrar empresa</span>
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
                        className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
                      >
                        Registrar empresa
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
                  >
                    <option value="">-- Seleccionar empresa --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : c.taxId ? `(${c.taxId})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Código del Servicio */}
              <div className="sm:col-span-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Código del Servicio *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateCode}
                    className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline flex items-center cursor-pointer"
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
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-sans font-medium tabular-nums text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
                />
              </div>
            </div>

            {/* Fila 2: Nombre del Servicio */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Nombre del Servicio *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Auditoría de Estados Financieros 2026 / Dictamen Fiscal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
              />
            </div>

            {/* Fila 3: Fecha Límite y Horas Presupuestadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Fecha Límite / Entrega *
                </label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
                />
              </div>

              <div>
                <TimeInputSexagesimal
                  label="Total de Horas Estimadas *"
                  totalHours={totalBudgetHours}
                  onChange={(newH) => setTotalBudgetHours(newH)}
                />
              </div>
            </div>

            {/* Fila 4: Notas */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Notas u Observaciones del Proyecto
              </label>
              <textarea
                rows={2}
                placeholder="Alcance operativo, requerimientos técnicos o instrucciones al equipo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none resize-none"
              />
            </div>

            {/* Fila 5: Estado Activo / Inactivo */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                  Proyecto Activo
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Solo se puede registrar tiempo en proyectos activos.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${isActive ? 'bg-blue-700' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Botones de Navegación del Paso 1 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              {isEditing ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Eliminar Servicio
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              )}

              <button
                type="submit"
                className="flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer gap-1.5"
              >
                <span>Continuar a Asignación de Equipo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PASO 2: EQUIPO Y ASIGNACIÓN INICIAL */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 2 && (
          <form onSubmit={handleFinalSave} className="p-6 space-y-5">
            {/* Tarjeta de Resumen del Servicio */}
            <div className="flex items-center justify-between p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-xl">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  {code} • {name}
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {creationMode === 'catalog'
                    ? `${catalogRubros.length} rubros • ${catalogRubros.reduce((acc, r) => acc + r.activities.length, 0)} actividades de catálogo`
                    : 'Servicio en blanco (0 actividades iniciales)'}{' '}
                  • Entrega: {deadline}
                </p>
              </div>
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg">
                {totalBudgetHours}h estimadas
              </span>
            </div>

            {/* 1. Socio Institucional (Automático) */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold text-xs flex items-center justify-center border border-blue-200 dark:border-blue-900">
                  SP
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {socioMember ? socioMember.name : 'Socio Prueba (Institucional)'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      <ShieldCheck className="w-3 h-3" />
                      Acceso Directivo por Defecto
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {socioMember?.email || 'socio.prueba@russellbedford.mx'} • Supervisión ejecutiva y firma
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Encargado del Servicio (Obligatorio) */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>Encargado del Servicio * (Obligatorio)</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Supervisor o Gerente
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Líder técnico responsable de coordinar el encargo, supervisar papeles de trabajo y validar avances.
              </p>
              <select
                value={leadUserId}
                onChange={(e) => setLeadUserId(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
              >
                <option value="">-- Seleccionar Encargado del Servicio --</option>
                {eligibleLeaders.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.roleTitle || m.role}) • {m.email}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Segundo Colaborador (Obligatorio - mínimo 1) */}
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>Segundo Colaborador * (Obligatorio - mínimo 1)</span>
                </label>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  Responsable Inicial de Actividades
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Colaborador operativo que ejecutará los procedimientos sustantivos y quedará como Responsable por defecto de las actividades generadas.
              </p>
              <select
                value={secondMemberId}
                onChange={(e) => setSecondMemberId(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 outline-none"
              >
                <option value="">-- Seleccionar Segundo Colaborador --</option>
                {secondMemberOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.roleTitle || m.role}) • {m.email}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Colaboradores Adicionales (Opcional) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Colaboradores Adicionales (Opcional)
                </label>
                <button
                  type="button"
                  onClick={handleAddAdditionalMember}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir otro colaborador</span>
                </button>
              </div>

              {additionalMemberIds.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No se han agregado colaboradores adicionales. Puedes sumar más integrantes según el tamaño del encargo.
                </div>
              ) : (
                <div className="space-y-2">
                  {additionalMemberIds.map((memberId, idx) => {
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                      >
                        <select
                          value={memberId}
                          onChange={(e) => handleUpdateAdditionalMember(idx, e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-blue-700"
                        >
                          <option value="">-- Seleccionar colaborador --</option>
                          {eligibleOperativeMembers
                            .filter(
                              (m) =>
                                m.id === memberId ||
                                (m.id !== leadUserId &&
                                  m.id !== secondMemberId &&
                                  !additionalMemberIds.includes(m.id))
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.roleTitle || m.role}) • {m.email}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalMember(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Remover de la cuadrilla"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aviso de Auto-Asignación */}
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
              <span className="leading-snug">
                Al confirmar, el sistema vinculará a los participantes seleccionados en <strong>todas las actividades generadas</strong> del servicio y establecerá al Segundo Colaborador como el <strong>Responsable</strong> inicial, pudiendo reasignar actividades individualmente en cualquier momento.
              </span>
            </div>

            {/* Botones de Navegación del Paso 2 */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al Paso 1</span>
              </button>

              <button
                type="submit"
                className="flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isEditing ? 'Guardar Cambios del Servicio' : 'Crear Servicio y Asignar Actividades'}</span>
              </button>
            </div>
          </form>
        )}
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
