import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  BookmarkPlus,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { normalizeRole } from '../../../services/rbac';
import type { Project, TaskNode, TeamMember } from '../../../types/rayoner';
import type { ActivityReviewStatus, ServiceTemplate, AuditPhase } from '../../../types/serviceTemplate';
import { exportAuditPlanToExcel } from '../../../services/auditPlanExportService';
import { saveServiceTemplate } from '../../../services/serviceTemplateService';

interface AuditServiceAccordionViewProps {
  project: Project;
  onOpenTaskModal?: (taskId?: string | null, projectId?: string | null) => void;
}

export function AuditServiceAccordionView({
  project,
}: AuditServiceAccordionViewProps) {
  const {
    tasks,
    clients,
    teamMembers,
    updateTask,
    taskActualHours,
  } = useRayonerStore();

  const addToast = useCheckinStore((state) => state.addToast);
  const client = clients.find((c) => c.id === project.clientId);

  // Tareas de este servicio
  const serviceTasks = useMemo(() => {
    return tasks.filter((t) => t.projectId === project.id);
  }, [tasks, project.id]);

  // Filtros interactivos
  const [rubroFilter, setRubroFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Estado de rubros colapsados/expandidos
  const [expandedRubros, setExpandedRubros] = useState<Set<number>>(new Set([0, 1]));

  // Modal para asignación de colaboradores a una actividad específica
  const [assigningTask, setAssigningTask] = useState<TaskNode | null>(null);

  // Modal para guardar estructura como plantilla
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState(
    `Plantilla Personalizada - ${project.name}`
  );
  const [newTemplateDesc, setNewTemplateDesc] = useState(
    `Estructura optimizada basada en el proyecto ${project.name}`
  );

  // Colaboradores operativos elegibles (excluye RH y TI)
  const eligibleMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const r = normalizeRole(m.role);
      return r !== 'RH' && r !== 'TI';
    });
  }, [teamMembers]);

  // Toggle de un rubro en el acordeón
  const toggleRubro = (rubroNum: number) => {
    setExpandedRubros((prev) => {
      const next = new Set(prev);
      if (next.has(rubroNum)) next.delete(rubroNum);
      else next.add(rubroNum);
      return next;
    });
  };

  // Expandir o colapsar todos
  const expandAll = () => {
    const allNums = new Set(groupedRubros.map((g) => g.number));
    setExpandedRubros(allNums);
  };
  const collapseAll = () => setExpandedRubros(new Set());

  // Métricas superiores consolidadas del servicio
  const metrics = useMemo(() => {
    let budgetedTotal = 0;
    let actualTotal = 0;
    let previaTotal = 0;
    let finalTotal = 0;
    let completedCount = 0;

    serviceTasks.forEach((t) => {
      const bHours = Number(t.budgetedHours || t.plannedHours || 0);
      const aHours = Number(
        t.totalActualHours ||
        (taskActualHours[t.id] || 0) ||
        (t.loggedMinutes ? t.loggedMinutes / 60 : 0)
      );

      budgetedTotal += bHours;
      actualTotal += aHours;

      if (t.fase === 'Previa') previaTotal += bHours;
      if (t.fase === 'Final') finalTotal += bHours;

      if (t.reviewStatus === 'completed' || t.reviewStatus === 'lead_reviewed') {
        completedCount++;
      }
    });

    const variation = Number((budgetedTotal - actualTotal).toFixed(2));
    const percentDone = serviceTasks.length > 0
      ? Math.round((completedCount / serviceTasks.length) * 100)
      : 0;

    return {
      budgetedTotal: Number(budgetedTotal.toFixed(1)),
      actualTotal: Number(actualTotal.toFixed(1)),
      variation,
      previaTotal: Number(previaTotal.toFixed(1)),
      finalTotal: Number(finalTotal.toFixed(1)),
      completedCount,
      totalCount: serviceTasks.length,
      percentDone,
    };
  }, [serviceTasks, taskActualHours]);

  // Agrupación de tareas por Rubro (Rubro 0 al 18)
  const groupedRubros = useMemo(() => {
    const map = new Map<number, { number: number; name: string; tasks: TaskNode[] }>();

    serviceTasks.forEach((t) => {
      const num = typeof t.rubroNumber === 'number' ? t.rubroNumber : 99;
      const name = t.rubro || (num === 0 ? 'Planeación General y Cierre' : `Rubro ${num}`);

      if (!map.has(num)) {
        map.set(num, { number: num, name, tasks: [] });
      }
      map.get(num)!.tasks.push(t);
    });

    // Ordenar de 0 a 18
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [serviceTasks]);

  // Filtrado de actividades dentro de cada rubro
  const filteredRubros = useMemo(() => {
    return groupedRubros.map((grp) => {
      // Si hay filtro de rubro y no coincide, filtrar
      if (rubroFilter !== 'all' && String(grp.number) !== rubroFilter) {
        return { ...grp, tasks: [] };
      }

      const filteredTasks = grp.tasks.filter((t) => {
        if (phaseFilter !== 'all' && t.fase !== phaseFilter) return false;
        if (statusFilter !== 'all') {
          const s = t.reviewStatus || 'pending';
          if (statusFilter === 'pending' && s !== 'pending') return false;
          if (statusFilter === 'staff_pt_done' && s !== 'staff_pt_done') return false;
          if (statusFilter === 'lead_reviewed' && s !== 'lead_reviewed' && s !== 'completed') return false;
        }
        if (memberFilter !== 'all') {
          const assigned = t.assignedUserIds || t.assignedToIds || [];
          if (!assigned.includes(memberFilter) && t.leadUserId !== memberFilter) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const p = (t.procedimiento || t.name || t.title || '').toLowerCase();
          const pt = (t.papelTrabajo || '').toLowerCase();
          const cc = (t.cuentaContable || '').toLowerCase();
          if (!p.includes(q) && !pt.includes(q) && !cc.includes(q)) return false;
        }
        return true;
      });

      return {
        ...grp,
        tasks: filteredTasks,
      };
    }).filter((grp) => grp.tasks.length > 0 || rubroFilter === 'all');
  }, [groupedRubros, rubroFilter, phaseFilter, statusFilter, memberFilter, searchQuery]);

  // Edición inline de horas presupuestadas
  const handleUpdateBudgetHours = (taskId: string, newHours: number) => {
    const val = Math.max(0, Number(newHours) || 0);
    const mins = Math.round(val * 60);
    updateTask(taskId, {
      budgetedHours: val,
      plannedHours: val,
      plannedMinutes: mins,
    });
  };

  // Cambio de estatus de revisión
  const handleUpdateReviewStatus = (taskId: string, status: ActivityReviewStatus) => {
    updateTask(taskId, {
      reviewStatus: status,
      status: status === 'completed' || status === 'lead_reviewed' ? 'completed' : 'in_progress',
    });
    addToast('Estatus de revisión actualizado', 'info');
  };

  // Guardar asignación de la actividad en modal
  const handleSaveTaskAssignment = (
    taskId: string,
    assignedUserIds: string[],
    leadUserId: string | null
  ) => {
    const leadMember = teamMembers.find((m) => m.id === leadUserId);
    updateTask(taskId, {
      assignedUserIds,
      assignedToIds: assignedUserIds,
      assigned_to: leadUserId || assignedUserIds[0] || '',
      assignedToId: leadUserId || assignedUserIds[0] || '',
      leadUserId: leadUserId || undefined,
      leadUserName: leadMember ? leadMember.name : undefined,
    });
    addToast('Asignación de actividad guardada', 'success');
    setAssigningTask(null);
  };

  // Guardar estructura como nueva plantilla
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      addToast('Ingresa un nombre para la plantilla', 'error');
      return;
    }

    const templateRubros = groupedRubros.map((grp) => {
      return {
        number: grp.number,
        name: grp.name,
        activities: grp.tasks.map((t, idx) => ({
          activityNumber: t.activityNumber || idx + 1,
          rubro: grp.name,
          rubroNumber: grp.number,
          cuentaContable: t.cuentaContable,
          procedimiento: t.procedimiento || t.name || t.title || 'Procedimiento Oficial',
          papelTrabajo: t.papelTrabajo || 'PT diseñado por auditor',
          fase: (t.fase || 'Previa') as AuditPhase,
          perfilSugerido: (t.perfilSugerido || 'Staff') as any,
          budgetedHours: Number(t.budgetedHours || t.plannedHours || 0),
          unbudgetedHours: 0,
          status: 'pending' as const,
          reviewStatus: 'pending' as const,
          assignedUserIds: [],
          leadUserId: null,
          hoursByUser: {},
          totalActualHours: 0,
          comments: '',
        })),
      };
    });

    const newTemplate: ServiceTemplate = {
      id: `template-custom-${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim(),
      version: '1.0',
      totalActivities: serviceTasks.length,
      totalBudgetHours: metrics.budgetedTotal,
      rubros: templateRubros,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveServiceTemplate(newTemplate);
      addToast(`Plantilla "${newTemplate.name}" guardada con éxito`, 'success');
      setIsTemplateModalOpen(false);
    } catch {
      addToast('Error al guardar la plantilla', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* 1. RESUMEN SUPERIOR DEL SERVICIO (MÉTRICAS Y ACCIONES) */}
      {/* ============================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
        
        {/* Cabecera con Título, Botón Exportar y Botón Guardar Plantilla */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-sky-400">
                Plan de Auditoría y Supervisión Operativa
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-sky-300 dark:border-blue-900">
                {serviceTasks.length} Actividades Oficiales
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {project.name}
            </h4>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón Discreto: Guardar Estructura como Plantilla */}
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
              <span>Guardar como Plantilla</span>
            </button>

            {/* Botón Primario: Exportar Plan de Trabajo .xlsx */}
            <button
              type="button"
              onClick={() => exportAuditPlanToExcel(project, client, serviceTasks, teamMembers)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Plan de Trabajo .xlsx</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas en Azul Corporativo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* Horas Presupuestadas vs Ejercidas */}
          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
              Horas Presupuestadas
            </span>
            <div className="text-lg font-bold text-blue-950 dark:text-white mt-0.5 tabular-nums">
              {metrics.budgetedTotal}h
            </div>
            <div className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-0.5">
              Ejercidas: <strong className="text-blue-900 dark:text-blue-200">{metrics.actualTotal}h</strong>
            </div>
          </div>

          {/* Variación (Presupuestadas - Ejercidas) */}
          <div className={`p-3 rounded-lg border ${
            metrics.variation < 0
              ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              Variación de Horas
            </span>
            <div className={`text-lg font-bold mt-0.5 tabular-nums ${
              metrics.variation < 0 ? 'text-amber-700 dark:text-amber-400' : 'text-blue-800 dark:text-sky-400'
            }`}>
              {metrics.variation > 0 ? `+${metrics.variation}h` : `${metrics.variation}h`}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
              {metrics.variation < 0 ? 'Sobrepresupuesto' : 'Saldo disponible'}
            </span>
          </div>

          {/* Horas Previas vs Finales */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              Fases de Auditoría
            </span>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Previa:</span>
                <span className="font-bold">{metrics.previaTotal}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Final:</span>
                <span className="font-bold">{metrics.finalTotal}h</span>
              </div>
            </div>
          </div>

          {/* Avance de Revisión */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              Avance de PT Revisados
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {metrics.percentDone}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {metrics.completedCount} de {metrics.totalCount} concluidos
            </div>
          </div>

        </div>

        {/* Barra de Filtros Rápidos */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
          
          {/* Búsqueda por texto */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar procedimiento, PT o cuenta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Filtro por Rubro */}
          <select
            value={rubroFilter}
            onChange={(e) => setRubroFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="all">Todos los Rubros (19)</option>
            {groupedRubros.map((g) => (
              <option key={g.number} value={String(g.number)}>
                {g.number === 0 ? '0. Planeación General' : `${g.number}. ${g.name}`} ({g.tasks.length})
              </option>
            ))}
          </select>

          {/* Filtro por Fase */}
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="all">Todas las Fases</option>
            <option value="Previa">Fase Previa</option>
            <option value="Final">Fase Final</option>
            <option value="Especialista">Especialista</option>
          </select>

          {/* Filtro por Estatus */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="all">Todos los Estatus</option>
            <option value="pending">Pendiente</option>
            <option value="staff_pt_done">PT Hecho Staff (75%)</option>
            <option value="lead_reviewed">Revisado (100%)</option>
          </select>

          {/* Filtro por Colaborador */}
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="all">Cualquier Colaborador</option>
            {eligibleMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Controles de expansión masiva */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={expandAll}
              className="text-[11px] font-semibold text-blue-700 dark:text-sky-400 hover:underline px-1.5 py-1 cursor-pointer"
            >
              Expandir todos
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[11px] font-semibold text-slate-500 hover:underline px-1.5 py-1 cursor-pointer"
            >
              Colapsar
            </button>
          </div>

        </div>

      </div>

      {/* ============================================================ */}
      {/* 2. AGRUPACIÓN COLAPSABLE POR RUBRO (19 SECCIONES) */}
      {/* ============================================================ */}
      <div className="space-y-3">
        {filteredRubros.map((grp) => {
          const isExpanded = expandedRubros.has(grp.number);
          const rubroBudget = grp.tasks.reduce(
            (acc, t) => acc + Number(t.budgetedHours || t.plannedHours || 0),
            0
          );
          const rubroActual = grp.tasks.reduce(
            (acc, t) =>
              acc +
              Number(
                t.totalActualHours ||
                (taskActualHours[t.id] || 0) ||
                (t.loggedMinutes ? t.loggedMinutes / 60 : 0)
              ),
            0
          );
          const rubroVariation = Number((rubroBudget - rubroActual).toFixed(2));

          return (
            <div
              key={grp.number}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs"
            >
              {/* Encabezado del Rubro (Acordeón) */}
              <button
                type="button"
                onClick={() => toggleRubro(grp.number)}
                className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50/70 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {grp.number === 0
                          ? '0. Planeación General y Cierre'
                          : `${grp.number}. ${grp.name}`}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300">
                        {grp.tasks.length} actividades
                      </span>
                    </div>

                    {/* Etiquetas neutras de Riesgo Operativo según tipo de rubro */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Riesgo Inherente: Medio
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Riesgo Control: Bajo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Métricas del Rubro */}
                <div className="flex items-center gap-4 text-xs shrink-0 pl-3">
                  <div className="text-right">
                    <div className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {rubroBudget.toFixed(1)}h est.
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Real: {rubroActual.toFixed(1)}h (
                      <span className={rubroVariation < 0 ? 'text-amber-600 font-bold' : 'text-blue-700 dark:text-sky-400'}>
                        {rubroVariation >= 0 ? `+${rubroVariation}h` : `${rubroVariation}h`}
                      </span>)
                    </div>
                  </div>
                </div>
              </button>

              {/* Contenido Desplegado: Tabla de Procedimientos */}
              {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 dark:bg-slate-800/60 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-3 w-10 text-center">No.</th>
                        <th className="py-2.5 px-3 min-w-[280px]">Procedimiento y Papel de Trabajo</th>
                        <th className="py-2.5 px-2.5 w-24">Fase / Perfil</th>
                        <th className="py-2.5 px-2.5 w-24 text-right">Hrs. Presup.</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Encargado / Equipo</th>
                        <th className="py-2.5 px-2.5 w-24 text-right">Hrs. Reales</th>
                        <th className="py-2.5 px-3 w-40 text-center">Estatus Revisión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {grp.tasks.map((task, idx) => {
                        const actNum = task.activityNumber || idx + 1;
                        const budgeted = Number(task.budgetedHours || task.plannedHours || 0);
                        const actual = Number(
                          task.totalActualHours ||
                          (taskActualHours[task.id] || 0) ||
                          (task.loggedMinutes ? task.loggedMinutes / 60 : 0)
                        );
                        const diff = Number((budgeted - actual).toFixed(2));

                        // Colaboradores y Encargado
                        const rawAssigned = task.assignedUserIds || task.assignedToIds || [];
                        const assignedMembers = teamMembers.filter((m) => rawAssigned.includes(m.id));
                        const leadMember = teamMembers.find((m) => m.id === task.leadUserId);
                        const leadName = task.leadUserName || leadMember?.name;

                        // Desglose por usuario si existe
                        const userHoursEntries = Object.entries(task.hoursByUser || {}).filter(
                          ([_, h]) => Number(h) > 0
                        );

                        return (
                          <tr
                            key={task.id}
                            className="hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* No. */}
                            <td className="py-2.5 px-3 text-center font-bold text-slate-400 tabular-nums">
                              {actNum}
                            </td>

                            {/* Procedimiento + Papel de Trabajo + Cuenta Contable */}
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                {task.procedimiento || task.name || task.title}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="italic truncate max-w-[200px]" title={task.papelTrabajo}>
                                  PT: {task.papelTrabajo || 'PT diseñado por auditor'}
                                </span>
                                {task.cuentaContable && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[10px] text-blue-700 dark:text-sky-400">
                                      {task.cuentaContable}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Fase y Perfil Sugerido */}
                            <td className="py-2.5 px-2.5">
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {task.fase || 'Previa'}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {task.perfilSugerido || 'Staff'}
                              </div>
                            </td>

                            {/* Horas Presupuestadas (Editable Inline) */}
                            <td className="py-2.5 px-2.5 text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={budgeted}
                                  onChange={(e) =>
                                    handleUpdateBudgetHours(task.id, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-14 px-1.5 py-0.5 text-right font-bold text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 tabular-nums"
                                />
                                <span className="text-[10px] text-slate-400 font-bold">h</span>
                              </div>
                            </td>

                            {/* Encargado Variable + Colaboradores Asignados */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {leadName ? (
                                    <div className="text-[11px] font-bold text-blue-900 dark:text-sky-300 flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3 text-blue-700 dark:text-sky-400 shrink-0" />
                                      <span className="truncate">{leadName}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">
                                      Sin encargado
                                    </span>
                                  )}

                                  {/* Avatares de Colaboradores asignados */}
                                  <div className="flex -space-x-1 items-center mt-1">
                                    {assignedMembers.length > 0 ? (
                                      assignedMembers.map((m) => (
                                        <div
                                          key={m.id}
                                          title={m.name}
                                          className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950 border border-white dark:border-slate-900 text-[9px] font-bold text-blue-800 dark:text-sky-300 flex items-center justify-center shrink-0"
                                        >
                                          {m.name.charAt(0).toUpperCase()}
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-slate-400">Sin equipo</span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setAssigningTask(task)}
                                  className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer shrink-0"
                                  title="Gestionar asignaciones de esta actividad"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Horas Reales Ejercidas y Variación */}
                            <td className="py-2.5 px-2.5 text-right">
                              <div className="font-bold text-slate-900 dark:text-white tabular-nums">
                                {actual.toFixed(2)}h
                              </div>
                              <div className={`text-[10px] font-medium tabular-nums ${
                                diff < 0 ? 'text-amber-600 font-bold' : 'text-blue-700 dark:text-sky-400'
                              }`}>
                                {diff >= 0 ? `+${diff}h` : `${diff}h`}
                              </div>

                              {/* Tooltip o popup de desglose por colaborador si hay horas */}
                              {userHoursEntries.length > 0 && (
                                <div className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[90px]" title={
                                  userHoursEntries
                                    .map(([uid, h]) => `${teamMembers.find(m => m.id === uid)?.name || uid}: ${h}h`)
                                    .join(' • ')
                                }>
                                  {userHoursEntries.length} collab.
                                </div>
                              )}
                            </td>

                            {/* Estatus de Revisión */}
                            <td className="py-2.5 px-3 text-center">
                              <select
                                value={task.reviewStatus || 'pending'}
                                onChange={(e) =>
                                  handleUpdateReviewStatus(task.id, e.target.value as ActivityReviewStatus)
                                }
                                className={`w-full py-1 px-2 text-[11px] font-bold rounded-lg border focus:outline-none cursor-pointer transition-colors ${
                                  task.reviewStatus === 'completed' || task.reviewStatus === 'lead_reviewed'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-sky-300 dark:border-blue-800'
                                    : task.reviewStatus === 'staff_pt_done'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}
                              >
                                <option value="pending">Pendiente</option>
                                <option value="staff_pt_done">PT Hecho (75%)</option>
                                <option value="lead_reviewed">Revisado (100%)</option>
                              </select>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 3. MODAL: ASIGNACIÓN DE COLABORADORES Y ENCARGADO */}
      {/* ============================================================ */}
      {assigningTask && (
        <TaskAssignmentModal
          task={assigningTask}
          eligibleMembers={eligibleMembers}
          onClose={() => setAssigningTask(null)}
          onSave={(assignedIds, leadId) => handleSaveTaskAssignment(assigningTask.id, assignedIds, leadId)}
        />
      )}

      {/* ============================================================ */}
      {/* 4. MODAL: GUARDAR ESTRUCTURA COMO NUEVA PLANTILLA */}
      {/* ============================================================ */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-blue-700 dark:text-sky-400" />
                <span>Guardar estructura como Plantilla</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Conserva los {serviceTasks.length} procedimientos y la calibración de horas ajustadas para este cliente como una nueva plantilla reutilizable en futuros servicios.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nombre de la Plantilla *
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Descripción u Objetivo
                </label>
                <textarea
                  rows={2}
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm cursor-pointer"
              >
                Guardar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Subcomponente de Modal para asignación ágil de Encargado y Colaboradores por actividad
 */
function TaskAssignmentModal({
  task,
  eligibleMembers,
  onClose,
  onSave,
}: {
  task: TaskNode;
  eligibleMembers: TeamMember[];
  onClose: () => void;
  onSave: (assignedIds: string[], leadId: string | null) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    task.assignedUserIds || task.assignedToIds || []
  );
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    task.leadUserId || null
  );

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((mId) => mId !== id));
      if (selectedLeadId === id) setSelectedLeadId(null);
    } else {
      setSelectedIds([...selectedIds, id]);
      if (!selectedLeadId) setSelectedLeadId(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-sky-400">
              Asignación de Actividad
            </span>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-xs">
              {task.procedimiento || task.name || task.title}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Selecciona los colaboradores que ejecutarán esta actividad y designa quién fungirá como Encargado principal de su papel de trabajo.
        </p>

        {/* Lista de colaboradores */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {eligibleMembers.map((m) => {
            const isAssigned = selectedIds.includes(m.id);
            const isLead = selectedLeadId === m.id;

            return (
              <div
                key={m.id}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                  isAssigned
                    ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div
                  onClick={() => toggleMember(m.id)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isAssigned
                        ? 'bg-blue-700 border-blue-700 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isAssigned && <CheckCircle2 className="w-3 h-3" />}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {m.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {m.role || 'Staff'} • {m.email}
                    </div>
                  </div>
                </div>

                {/* Botón para marcar como Encargado */}
                {isAssigned && (
                  <button
                    type="button"
                    onClick={() => setSelectedLeadId(isLead ? null : m.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer shrink-0 ${
                      isLead
                        ? 'bg-blue-700 text-white shadow-2xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-100'
                    }`}
                  >
                    {isLead ? 'Encargado Principal' : 'Hacer Encargado'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(selectedIds, selectedLeadId)}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm cursor-pointer"
          >
            Guardar Asignaciones
          </button>
        </div>
      </div>
    </div>
  );
}
