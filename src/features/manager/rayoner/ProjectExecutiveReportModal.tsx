import { useMemo } from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  Printer,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  DollarSign,
} from 'lucide-react';
import type { Project } from '../../../types/rayoner';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import {
  exportProjectReportToExcel,
  exportProjectReportToPDF,
} from '../../../services/reportExportService';
import { formatHoursToSexagesimal } from '../../../utils/timeFormat';

interface ProjectExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export function ProjectExecutiveReportModal({
  isOpen,
  onClose,
  project,
}: ProjectExecutiveReportModalProps) {
  const { clients, tasks, assignments, taskActualHours, userTaskActualHours } = useRayonerStore();
  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);

  const client = useMemo(() => {
    if (!project) return null;
    return clients.find((c) => c.id === project.clientId) || null;
  }, [project, clients]);

  const projectTasks = useMemo(() => {
    if (!project) return [];
    return tasks.filter((t) => t.projectId === project.id);
  }, [project, tasks]);

  // Cálculos de horas y costos
  const totalPlannedHours = project?.totalBudgetHours || 0;
  const totalActualHours = useMemo(() => {
    return projectTasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  }, [projectTasks, taskActualHours]);

  const totalRemainingHours = Math.max(0, totalPlannedHours - totalActualHours);
  const percentConsumed = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;
  const hourlyRate = project?.hourlyRate || 1500;
  const budgetCost = totalPlannedHours * hourlyRate;
  const estimatedCost = totalActualHours * hourlyRate;
  const remainingCost = totalRemainingHours * hourlyRate;

  // Desglose consolidado por colaborador
  const collaboratorStats = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; role: string; taskCount: number; plannedHours: number; actualHours: number }
    >();

    assignments.forEach((asg) => {
      const task = projectTasks.find((t) => t.id === asg.taskId);
      if (!task) return;

      const existing = map.get(asg.userId) || {
        id: asg.userId,
        name: asg.userName,
        role: asg.userRoleTitle || 'Colaborador',
        taskCount: 0,
        plannedHours: 0,
        actualHours: 0,
      };

      existing.taskCount += 1;
      existing.plannedHours += asg.allocatedHours;
      const actual = userTaskActualHours[`${asg.taskId}_${asg.userId}`] || 0;
      existing.actualHours += actual;
      map.set(asg.userId, existing);
    });

    return Array.from(map.values());
  }, [assignments, projectTasks, userTaskActualHours]);

  if (!isOpen || !project) return null;

  const exportData = {
    project,
    client,
    tasks: projectTasks,
    assignments,
    taskActualHours,
    userTaskActualHours,
    generatedBy: user?.name ? `${user.name} ${user.lastName || ''}`.trim() : 'Supervisor',
  };

  const handleDownloadExcel = () => {
    exportProjectReportToExcel(exportData);
    addToast('Archivo Excel descargado con formato corporativo', 'success');
  };

  const handleDownloadPDF = () => {
    exportProjectReportToPDF(exportData);
    addToast('Documento PDF corporativo preparado para imprimir/descargar', 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-white dark:bg-[#131D31] text-slate-800 dark:text-[#F8FAFC] border border-slate-200 dark:border-[#233354] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up"
      >
        {/* Cabecera del Recuadro del Informe */}
        <div className="px-6 py-4.5 bg-slate-50 dark:bg-[#0F172A] border-b border-slate-200 dark:border-[#233354] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-[#38BDF8] flex items-center justify-center shrink-0 border border-blue-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase bg-blue-50 dark:bg-[#002D42] text-blue-700 dark:text-[#00E5FF] px-2 py-0.5 rounded border border-blue-200 dark:border-[#00E5FF]/30">
                  {project.code}
                </span>
                <span className="text-xs text-slate-500 dark:text-[#94A3B8]">•</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {client?.name || 'Cliente Particular'}
                </span>
              </div>
              <h2 className="text-lg font-heading font-extrabold text-slate-900 dark:text-white mt-0.5">
                {project.name}
              </h2>
            </div>
          </div>

          {/* Acciones de Descarga */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Descargar PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-heading font-medium transition-colors cursor-pointer"
              title="Descargar documento PDF con formato corporativo Russell Bedford"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>PDF</span>
            </button>

            {/* Descargar Excel */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-heading font-medium transition-colors cursor-pointer"
              title="Descargar hoja de cálculo Excel con estilos y fórmulas"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
              <span>Excel</span>
            </button>

            {/* Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:text-[#94A3B8] dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-[#1A2742] transition-colors cursor-pointer"
              title="Cerrar informe"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido del Informe con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Ficha Resumen de Metadatos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-[#1A2742]/70 p-4 rounded-xl border border-slate-200 dark:border-[#233354] text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Socio / Líder
              </span>
              <span className="font-semibold text-slate-800 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-[#38BDF8]" />
                {project.leadUserName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Fecha Límite
              </span>
              <span className="font-semibold text-slate-800 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-[#38BDF8]" />
                {project.deadline || 'En curso'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tarifa por Hora
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-[#F8FAFC] flex items-center gap-1 mt-0.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                ${hourlyRate.toLocaleString('es-MX')} {project.currency || 'MXN'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Estado Presupuestal
              </span>
              <span className="mt-0.5 inline-flex items-center">
                {percentConsumed >= 100 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-300 dark:border-red-500/40">
                    <AlertTriangle className="w-3 h-3" />
                    Sobrepresupuesto ({percentConsumed.toFixed(0)}%)
                  </span>
                ) : percentConsumed >= 80 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    <AlertTriangle className="w-3 h-3" />
                    Alerta Preventiva ({percentConsumed.toFixed(0)}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3" />
                    Rango Óptimo ({percentConsumed.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* 4 KPIs Financieros y Operativos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Presupuesto */}
            <div className="bg-slate-50 dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-heading font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Presupuesto Planeado
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-heading font-bold text-slate-900 dark:text-white font-mono">
                  {formatHoursToSexagesimal(totalPlannedHours)}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                ${budgetCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>

            {/* Consumido */}
            <div className="bg-slate-50 dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-heading font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Tiempo Consumido
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-heading font-bold font-mono text-[#1D4ED8] dark:text-sky-400">
                  {formatHoursToSexagesimal(totalActualHours)}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                ${estimatedCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>

            {/* Horas Restantes */}
            <div className="bg-slate-50 dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-heading font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Tiempo Restante
              </span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-heading font-bold font-mono text-slate-700 dark:text-slate-300">
                  {formatHoursToSexagesimal(totalRemainingHours)}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                ${remainingCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>

            {/* Desviación Presupuestal */}
            <div className="bg-slate-50 dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-heading font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Desviación Presupuestal
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-2xl font-heading font-bold font-mono ${
                  percentConsumed > 100 ? 'text-rose-400' : 'text-slate-900 dark:text-slate-200'
                }`}>
                  {percentConsumed.toFixed(1)}%
                </span>
                {percentConsumed > 100 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
                    Excedido
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono mt-0.5 block">
                {percentConsumed > 100 ? 'Requiere reasignación' : 'Dentro de límite'}
              </span>
            </div>
          </div>

          {/* TABLA 1: Desglose de Tareas y Subtareas */}
          <div className="bg-white dark:bg-[#131D31] rounded-xl border border-slate-200 dark:border-[#233354] overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-[#0F172A] border-b border-slate-200 dark:border-[#233354] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-[#0D5C75] dark:text-[#38BDF8]" />
                <h3 className="text-xs font-heading font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Desglose de Tareas y Asignaciones ({projectTasks.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                Tiempos auditados por tarea
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-[#0B111E] text-slate-600 dark:text-[#94A3B8] font-heading font-bold text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-[#233354]">
                    <th className="py-2.5 px-4 min-w-[260px]">Concepto / Tarea</th>
                    <th className="py-2.5 px-3 text-right">Planeado</th>
                    <th className="py-2.5 px-3 text-right">Actual</th>
                    <th className="py-2.5 px-3 text-right">Restante</th>
                    <th className="py-2.5 px-3 text-center min-w-[120px]">% Consumido</th>
                    <th className="py-2.5 px-3 text-right">Costo Imputado</th>
                    <th className="py-2.5 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#233354]">
                  {projectTasks
                    .filter((t) => !t.parentTaskId)
                    .map((task) => {
                      const actualH = taskActualHours[task.id] || 0;
                      const remH = Math.max(0, task.plannedHours - actualH);
                      const pct = task.plannedHours > 0 ? (actualH / task.plannedHours) * 100 : 0;
                      const taskAsgs = assignments.filter((a) => a.taskId === task.id);
                      const subtasks = projectTasks.filter((st) => st.parentTaskId === task.id);

                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-slate-50 dark:hover:bg-[#1A2742]/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                              <span>{task.title || task.name}</span>
                              {subtasks.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({subtasks.length} subtareas)
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {task.description}
                              </div>
                            )}
                            {taskAsgs.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {taskAsgs.map((asg) => {
                                  const uActual =
                                    userTaskActualHours[`${task.id}_${asg.userId}`] ||
                                    actualH / taskAsgs.length;
                                  return (
                                    <span
                                      key={asg.id}
                                      className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-[#0F172A] px-2 py-0.5 rounded border border-slate-200 dark:border-[#233354] text-slate-700 dark:text-slate-300"
                                    >
                                      <span>👤 {asg.userName}</span>
                                      <span className="font-mono font-bold text-blue-600 dark:text-[#38BDF8]">
                                        ({formatHoursToSexagesimal(uActual)})
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatHoursToSexagesimal(task.plannedHours)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                            {formatHoursToSexagesimal(actualH)}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono font-bold ${
                              remH <= 2 ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {formatHoursToSexagesimal(remH)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center space-x-1.5 justify-center">
                              <div className="w-16 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                  className={`h-full rounded-full ${
                                    pct >= 100
                                      ? 'bg-rose-500'
                                      : pct >= 80
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-bold font-mono ${
                                  pct >= 100
                                    ? 'text-rose-600'
                                    : pct >= 80
                                    ? 'text-amber-600'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            ${(actualH * hourlyRate).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {pct >= 100 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-300">
                                Excedido
                              </span>
                            ) : pct >= 80 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300">
                                Alerta 80%
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300">
                                En Rango
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {/* Fila Total */}
                  <tr className="bg-slate-100/90 dark:bg-[#0B111E] font-heading font-extrabold text-xs border-t-2 border-slate-300 dark:border-[#233354]">
                    <td className="py-3 px-4 uppercase text-[#0D5C75] dark:text-[#38BDF8]">
                      Total del Proyecto
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatHoursToSexagesimal(totalPlannedHours)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-[#38BDF8]">
                      {formatHoursToSexagesimal(totalActualHours)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatHoursToSexagesimal(totalRemainingHours)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {percentConsumed.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      ${estimatedCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          percentConsumed >= 100
                            ? 'bg-rose-600 text-white'
                            : percentConsumed >= 80
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {percentConsumed >= 100
                          ? 'Crítico'
                          : percentConsumed >= 80
                          ? 'Alerta'
                          : 'Óptimo'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 2: Desglose por Colaborador */}
          <div className="bg-white dark:bg-[#131D31] rounded-xl border border-slate-200 dark:border-[#233354] overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-[#0F172A] border-b border-slate-200 dark:border-[#233354] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-[#0D5C75] dark:text-[#38BDF8]" />
                <h3 className="text-xs font-heading font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Horas Imputadas por Colaborador ({collaboratorStats.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                Participación individual en el proyecto
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-[#0B111E] text-slate-600 dark:text-[#94A3B8] font-heading font-bold text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-[#233354]">
                    <th className="py-2.5 px-4">Colaborador</th>
                    <th className="py-2.5 px-3">Rol / Cargo</th>
                    <th className="py-2.5 px-3 text-center">Tareas</th>
                    <th className="py-2.5 px-3 text-right">Horas Asignadas</th>
                    <th className="py-2.5 px-3 text-right">Horas Trabajadas</th>
                    <th className="py-2.5 px-3 text-center">% Participación</th>
                    <th className="py-2.5 px-4 text-right">Importe Devengado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#233354]">
                  {collaboratorStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                        Sin colaboradores asignados individualmente aún
                      </td>
                    </tr>
                  ) : (
                    collaboratorStats.map((c) => {
                      const share =
                        totalActualHours > 0 ? (c.actualHours / totalActualHours) * 100 : 0;
                      const cost = c.actualHours * hourlyRate;

                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50 dark:hover:bg-[#1A2742]/50 transition-colors"
                        >
                          <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                            👤 {c.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {c.role}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {c.taskCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                            {formatHoursToSexagesimal(c.plannedHours)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-[#38BDF8]">
                            {formatHoursToSexagesimal(c.actualHours)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {share.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anotaciones de Supervisión */}
          {project.notes && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1A2742]/70 border border-slate-200 dark:border-[#233354] text-xs">
              <span className="font-heading font-bold text-slate-800 dark:text-white block mb-1">
                Anotaciones de Supervisión y Alcance:
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-[#233354] bg-slate-50 dark:bg-[#0F172A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-[#94A3B8]">
          <span>
            Generado automáticamente • <strong>Russell Bedford México</strong>
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3.5 py-1.5 bg-[#0D5C75] hover:bg-[#0A485C] text-white rounded-lg font-heading font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-heading font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#1A2742] dark:hover:bg-[#233354] text-slate-700 dark:text-slate-200 rounded-lg font-heading font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
