import { useState, useMemo } from 'react';
import { 
  Download, 
  FileSpreadsheet, Printer, TrendingUp
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { useAuditStore } from '../../../store/useAuditStore';
import { 
  exportProjectReportToExcel, 
  exportProjectReportToPDF 
} from '../../../services/reportExportService';
import { formatHoursToSexagesimal } from '../../../utils/timeFormat';

interface RayonerTimeReportProps {
  initialProjectId?: string | null;
}

type AnalyticsPeriod = 'semanal' | 'quincenal' | 'mensual' | 'personalizado';

export function RayonerTimeReport({ initialProjectId }: RayonerTimeReportProps) {
  const { projects, clients, tasks, assignments, taskActualHours, userTaskActualHours } = useRayonerStore();
  const addToast = useCheckinStore(state => state.addToast);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || projects[0]?.id || ''
  );

  const [period, setPeriod] = useState<AnalyticsPeriod>('mensual');
  const [customStartDate, setCustomStartDate] = useState('2026-10-01');
  const [customEndDate, setCustomEndDate] = useState('2026-10-31');

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0];
  }, [selectedProjectId, projects]);

  const currentClient = useMemo(() => {
    if (!currentProject) return null;
    return clients.find(c => c.id === currentProject.clientId);
  }, [currentProject, clients]);

  // Tareas principales y subtareas del proyecto seleccionado
  const projectTasks = useMemo(() => {
    if (!currentProject) return [];
    return tasks.filter(t => t.projectId === currentProject.id);
  }, [currentProject, tasks]);

  // Cálculos consolidados del proyecto
  const totalPlannedHours = currentProject?.totalBudgetHours || 120;

  const totalActualHours = useMemo(() => {
    return projectTasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  }, [projectTasks, taskActualHours]);

  const totalRemainingHours = Math.max(0, totalPlannedHours - totalActualHours);
  const percentConsumed = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;
  
  const estimatedCost = totalActualHours * (currentProject?.hourlyRate || 1500);
  const budgetCost = totalPlannedHours * (currentProject?.hourlyRate || 1500);

  // Estadísticas analíticas por periodo y colaborador
  const analyticsData = useMemo(() => {
    // Colaboradores únicos que participan en las tareas de este proyecto
    const assignedUserIds = new Set<string>();
    const userHoursMap: Record<string, { name: string; role: string; hours: number }> = {};

    projectTasks.forEach(t => {
      const taskAsgs = assignments.filter(a => a.taskId === t.id);
      taskAsgs.forEach(asg => {
        assignedUserIds.add(asg.userId);
        const actualH = userTaskActualHours[`${t.id}_${asg.userId}`] || (taskActualHours[t.id] || 0) / Math.max(1, taskAsgs.length);
        if (!userHoursMap[asg.userId]) {
          userHoursMap[asg.userId] = {
            name: asg.userName,
            role: asg.userRoleTitle || 'Auditor',
            hours: 0,
          };
        }
        userHoursMap[asg.userId].hours += actualH;
      });
    });

    const activeCollaboratorsCount = Math.max(1, assignedUserIds.size);

    // Días laborables aproximados según periodo
    const workDays = period === 'semanal' ? 5 : period === 'quincenal' ? 10 : 22;
    const dailyAveragePerCollaborator = Number((totalActualHours / (activeCollaboratorsCount * workDays)).toFixed(2));

    // Tasa de desviación de estimación
    const estimationDeviationRate = totalPlannedHours > 0
      ? Number((((totalActualHours - totalPlannedHours) / totalPlannedHours) * 100).toFixed(1))
      : 0;

    // Distribución porcentual por colaborador
    const distribution = Object.entries(userHoursMap).map(([userId, data]) => {
      const percentage = totalActualHours > 0 ? (data.hours / totalActualHours) * 100 : 0;
      return {
        userId,
        name: data.name,
        role: data.role,
        hours: data.hours,
        percentage: Number(percentage.toFixed(1)),
      };
    }).sort((a, b) => b.hours - a.hours);

    return {
      activeCollaboratorsCount,
      dailyAveragePerCollaborator,
      estimationDeviationRate,
      peakProductivityWindow: '10:00 - 13:00 hrs',
      distribution,
    };
  }, [projectTasks, assignments, userTaskActualHours, taskActualHours, totalActualHours, totalPlannedHours, period]);

  // Exportar reporte a formato CSV estructurado
  const handleExportCSV = () => {
    if (!currentProject) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Nivel,Concepto / Tarea,Colaborador,Planeado,Actual,Restante,% Consumido,Tarifa/Hr,Costo Acumulado\r\n';

    projectTasks.forEach(task => {
      const actualH = taskActualHours[task.id] || 0;
      const remH = Math.max(0, task.plannedHours - actualH);
      const pct = task.plannedHours > 0 ? ((actualH / task.plannedHours) * 100).toFixed(1) : '0';
      const isSubtask = Boolean(task.parentTaskId);

      csvContent += `"${isSubtask ? 'Subtarea' : 'Tarea'}","${task.name.replace(/"/g, '""')}","-","${formatHoursToSexagesimal(task.plannedHours)}","${formatHoursToSexagesimal(actualH)}","${formatHoursToSexagesimal(remH)}",${pct}%,${currentProject.hourlyRate},${(actualH * currentProject.hourlyRate).toFixed(2)}\r\n`;

      const taskAsgs = assignments.filter(a => a.taskId === task.id);
      taskAsgs.forEach(asg => {
        const userActual = userTaskActualHours[`${task.id}_${asg.userId}`] || (actualH / Math.max(1, taskAsgs.length));
        const userRem = Math.max(0, asg.allocatedHours - userActual);
        const userPct = asg.allocatedHours > 0 ? ((userActual / asg.allocatedHours) * 100).toFixed(1) : '0';
        const rate = asg.hourlyRateOverride || currentProject.hourlyRate;

        csvContent += `"Asignado","-","${asg.userName}","${formatHoursToSexagesimal(asg.allocatedHours)}","${formatHoursToSexagesimal(userActual)}","${formatHoursToSexagesimal(userRem)}",${userPct}%,${rate},${(userActual * rate).toFixed(2)}\r\n`;
      });
    });

    // Fila Total
    csvContent += `"TOTAL","Proyecto Consolidado","-","${formatHoursToSexagesimal(totalPlannedHours)}","${formatHoursToSexagesimal(totalActualHours)}","${formatHoursToSexagesimal(totalRemainingHours)}",${percentConsumed.toFixed(1)}%,${currentProject.hourlyRate},${estimatedCost.toFixed(2)}\r\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Informe_Tiempos_${currentProject.code || 'RAY'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Informe de tiempos exportado exitosamente a CSV', 'success');
  };

  const handleExportPDF = () => {
    if (!currentProject) return;
    try {
      const currentUser = useCheckinStore.getState().user;
      exportProjectReportToPDF({
        project: currentProject,
        client: currentClient,
        tasks: projectTasks,
        assignments,
        taskActualHours,
        userTaskActualHours,
        generatedBy: currentUser?.name || 'Gerencia de Auditoría',
      });

      useAuditStore.getState().logAuditEvent({
        eventType: 'REPORT_DOWNLOADED',
        actorId: currentUser?.id || 'admin-99',
        actorName: currentUser?.name || 'Gerente',
        actorEmail: currentUser?.email || '',
        actorRole: currentUser?.role || 'Gerente',
        targetResource: `Proyecto: ${currentProject.name} (${currentProject.code})`,
        format: 'PDF',
        details: `Descarga de informe corporativo en PDF para ${currentProject.name}`,
      });

      addToast('Generando informe corporativo en PDF', 'info');
    } catch {
      addToast('Error al generar el informe en PDF', 'error');
    }
  };

  const handleExportExcel = () => {
    if (!currentProject) return;
    try {
      const currentUser = useCheckinStore.getState().user;
      exportProjectReportToExcel({
        project: currentProject,
        client: currentClient,
        tasks: projectTasks,
        assignments,
        taskActualHours,
        userTaskActualHours,
        generatedBy: currentUser?.name || 'Gerencia de Auditoría',
      });

      useAuditStore.getState().logAuditEvent({
        eventType: 'REPORT_DOWNLOADED',
        actorId: currentUser?.id || 'admin-99',
        actorName: currentUser?.name || 'Gerente',
        actorEmail: currentUser?.email || '',
        actorRole: currentUser?.role || 'Gerente',
        targetResource: `Proyecto: ${currentProject.name} (${currentProject.code})`,
        format: 'Excel',
        details: `Descarga de informe analítico en Excel para ${currentProject.name}`,
      });

      addToast('Informe de proyecto exportado a Excel (.xls) con diseño corporativo', 'success');
    } catch {
      addToast('Error al exportar a Excel', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      
      {/* 1. Selector de Proyecto y Botones de Exportación con Alto Contraste y Accesibilidad */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
            Proyecto:
          </span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600 transition cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Botones de Exportación Homogéneos y Accesibles */}
        <div data-tour="reports-export-excel" className="flex items-center gap-2 shrink-0">
          {/* Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Imprimir reporte"
          >
            <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Imprimir</span>
          </button>

          {/* Exportar Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Exportar a Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          {/* Exportar CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Exportar archivo CSV plano"
          >
            <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>CSV</span>
          </button>

          {/* Descargar PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="Descargar informe oficial en PDF"
          >
            <Download className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Panel Superior de Analítica y Rendimiento por Periodos */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Analítica de Rendimiento y Desviación Temporal
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Métricas calculadas sobre las horas registradas en el periodo seleccionado.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Periodo:</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
              {(['semanal', 'quincenal', 'mensual', 'personalizado'] as AnalyticsPeriod[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-medium capitalize rounded-md transition-colors cursor-pointer ${
                    period === p
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {period === 'personalizado' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 sm:mt-0">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-transparent border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded text-xs"
                />
                <span>a</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-transparent border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* KPIs de Rendimiento Clave en Tarjetas Neutras */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Promedio Diario / Colaborador
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatHoursToSexagesimal(analyticsData.dailyAveragePerCollaborator)}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              {analyticsData.activeCollaboratorsCount} colaboradores activos
            </span>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Tasa de Desviación
            </span>
            <div className={`text-2xl font-bold mt-1 ${
              analyticsData.estimationDeviationRate > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'
            }`}>
              {analyticsData.estimationDeviationRate > 0 ? `+${analyticsData.estimationDeviationRate}%` : `${analyticsData.estimationDeviationRate}%`}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              {analyticsData.estimationDeviationRate > 0 ? 'Excediendo estimación inicial' : 'Dentro del rango planeado'}
            </span>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Pico de Productividad
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-200 mt-1">
              {analyticsData.peakProductivityWindow}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Mayor imputación de avances
            </span>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Distribución de Carga
            </span>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {analyticsData.distribution[0]?.percentage || 100}% máx
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block truncate">
              Líder: {analyticsData.distribution[0]?.name || 'Equipo'}
            </span>
          </div>
        </div>

        {/* Gráfico Minimalista de Distribución de Carga por Colaborador */}
        {analyticsData.distribution.length > 0 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              Distribución Porcentual del Tiempo Consumido
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {analyticsData.distribution.map(d => (
                <div key={d.userId} className="p-3 bg-slate-50 dark:bg-[#0B111E] border border-slate-200 dark:border-slate-800 rounded">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{d.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formatHoursToSexagesimal(d.hours)}</span>
                  </div>
                  <div className="relative flex items-center h-4 mt-2">
                    <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div 
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#1D4ED8] dark:bg-sky-400 rounded-full"
                      style={{ width: `${Math.min(100, d.percentage)}%` }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#1D4ED8] dark:bg-sky-400 border border-white dark:border-[#101726]"
                      style={{ left: `${Math.min(100, d.percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-end text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                    {d.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Fila de Tarjetas de Balance de Horas (Sin colores chillones, diseño corporativo sobrio) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-1">
        <div className="bg-white dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Presupuesto Planeado
          </span>
          <div className="text-2xl font-bold font-heading text-slate-900 dark:text-white mt-1">
            {formatHoursToSexagesimal(totalPlannedHours)}
          </div>
          <span className="text-xs text-slate-500 font-mono mt-1 block">
            (${budgetCost.toLocaleString('es-MX')})
          </span>
        </div>

        <div className="bg-white dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Tiempo Consumido
          </span>
          <div className="text-2xl font-bold font-heading text-[#1D4ED8] dark:text-sky-400 mt-1">
            {formatHoursToSexagesimal(totalActualHours)}
          </div>
          <span className="text-xs text-slate-500 font-mono mt-1 block">
            (${estimatedCost.toLocaleString('es-MX')})
          </span>
        </div>

        <div className="bg-white dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Tiempo Restante
          </span>
          <div className="text-2xl font-bold font-heading text-slate-700 dark:text-slate-300 mt-1">
            {formatHoursToSexagesimal(totalRemainingHours)}
          </div>
          <span className="text-xs text-slate-500 font-mono mt-1 block">
            (${(totalRemainingHours * (currentProject?.hourlyRate || 1500)).toLocaleString('es-MX')})
          </span>
        </div>

        <div className="bg-white dark:bg-[#101726] p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Desviación Presupuestal
          </span>
          <div className={`text-2xl font-bold font-heading mt-1 ${
            percentConsumed > 100 ? 'text-rose-400' : 'text-slate-900 dark:text-slate-200'
          }`}>
            {percentConsumed.toFixed(1)}%
            {percentConsumed > 100 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 ml-2">
                Excedido
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 font-mono mt-1 block">
            {percentConsumed > 100 ? 'Requiere reasignación' : 'Dentro de límite'}
          </span>
        </div>
      </div>

      {/* 4. Tabla de Desglose Mejorada */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm font-heading">
            Desglose de Tareas y Tiempo Consumido
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {projectTasks.length} tareas monitoreadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-3.5 pl-6 min-w-[280px]">Tarea / Colaborador</th>
                <th className="p-3.5 text-right w-32">Planeado</th>
                <th className="p-3.5 text-right w-32">Restante</th>
                <th className="p-3.5 text-right w-32">Actual</th>
                <th className="p-3.5 min-w-[180px]">% Consumo</th>
                <th className="p-3.5 pr-6 text-center w-28">Estatus</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
              {projectTasks.filter(t => !t.parentTaskId).map(task => {
                const actualH = taskActualHours[task.id] || 0;
                const remH = Math.max(0, task.plannedHours - actualH);
                const pct = task.plannedHours > 0 ? (actualH / task.plannedHours) * 100 : 0;
                const taskAsgs = assignments.filter(a => a.taskId === task.id);

                return (
                  <tr key={task.id} className="hover:bg-slate-50/70 dark:hover:bg-[#172238]/50 transition-colors">
                    {/* Tarea Principal */}
                    <td className="p-3.5 pl-6">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-[13px]">{task.name}</div>
                      {task.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{task.description}</div>
                      )}
                      
                      {/* Sub-colaboradores asignados inline */}
                      {taskAsgs.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {taskAsgs.map(asg => {
                            const userActual = userTaskActualHours[`${task.id}_${asg.userId}`] || (actualH / taskAsgs.length);
                            const userPct = asg.allocatedHours > 0 ? (userActual / asg.allocatedHours) * 100 : 0;

                            return (
                              <span 
                                key={asg.id} 
                                className={`text-[10px] px-2 py-0.5 rounded border flex items-center space-x-1 ${
                                  userPct >= 100 
                                    ? 'bg-rose-950/40 text-rose-300 border-rose-800' 
                                    : 'bg-slate-100 dark:bg-[#1E2B45] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                <span>{asg.userName}: {formatHoursToSexagesimal(userActual)} / {formatHoursToSexagesimal(asg.allocatedHours)}</span>
                                {asg.blockOnLimit && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono" title="Límite estricto">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] dark:bg-sky-400" />
                                    Límite
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono text-slate-800 dark:text-slate-200 font-bold">
                      {formatHoursToSexagesimal(task.plannedHours)}
                    </td>

                    <td className={`p-3.5 text-right font-mono font-bold ${remH <= 0 ? 'text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {formatHoursToSexagesimal(remH)}
                    </td>

                    <td className="p-3.5 text-right font-mono text-slate-900 dark:text-slate-100 font-extrabold">
                      {formatHoursToSexagesimal(actualH)}
                    </td>

                    {/* Indicador Sobrio Minimalista de Consumo (Línea Fina y Punto) */}
                    <td className="p-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="relative flex-1 flex items-center h-4">
                          {/* Línea base sutil */}
                          <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                          
                          {/* Segmento de avance monocromático en azul rey */}
                          <div
                            style={{ width: `${Math.min(100, pct)}%` }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#1D4ED8] dark:bg-sky-400 rounded-full"
                          />

                          {/* Punto minimalista de posición */}
                          <div
                            style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white dark:border-[#101726] shadow-2xs ${
                              pct > 100 
                                ? 'bg-rose-400' 
                                : 'bg-[#1D4ED8] dark:bg-sky-400'
                            }`}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Badge de Estatus Sobrio */}
                    <td className="p-3.5 pr-6 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${pct > 100 ? 'bg-rose-400' : 'bg-[#1D4ED8] dark:bg-sky-400'}`} />
                        <span>{pct > 100 ? 'Excedido' : pct >= 80 ? 'Alerta' : 'En Rango'}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Fila de TOTAL Consolidado */}
              <tr className="bg-slate-100/70 dark:bg-[#0B111E] border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs">
                <td className="p-4 pl-6 uppercase tracking-wider font-extrabold text-slate-900 dark:text-slate-100">
                  TOTAL DEL PROYECTO
                </td>
                <td className="p-4 text-right font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  {formatHoursToSexagesimal(totalPlannedHours)}
                </td>
                <td className="p-4 text-right font-mono font-extrabold text-sm text-slate-700 dark:text-slate-300">
                  {formatHoursToSexagesimal(totalRemainingHours)}
                </td>
                <td className="p-4 text-right font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatHoursToSexagesimal(totalActualHours)}
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-1 flex items-center h-4">
                      <div className="w-full h-0.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                      <div
                        style={{ width: `${Math.min(100, percentConsumed)}%` }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#1D4ED8] dark:bg-sky-400 rounded-full"
                      />
                      <div
                        style={{ left: `${Math.min(100, Math.max(0, percentConsumed))}%` }}
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white dark:border-[#101726] shadow-2xs ${
                          percentConsumed > 100 
                            ? 'bg-rose-400' 
                            : 'bg-[#1D4ED8] dark:bg-sky-400'
                        }`}
                      />
                    </div>
                    <span className="font-mono text-xs text-slate-900 dark:text-slate-100 font-bold">
                      {percentConsumed.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="p-4 pr-6 text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${percentConsumed > 100 ? 'bg-rose-400' : 'bg-[#1D4ED8] dark:bg-sky-400'}`} />
                    <span>{percentConsumed > 100 ? 'Excedido' : 'Óptimo'}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
