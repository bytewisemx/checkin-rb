import { useState, useMemo } from 'react';
import { 
  Download, Calendar, AlertTriangle, 
  User, FileText, Filter
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';

interface RayonerTimeReportProps {
  initialProjectId?: string | null;
}

export function RayonerTimeReport({ initialProjectId }: RayonerTimeReportProps) {
  const { projects, clients, tasks, assignments, taskActualHours, userTaskActualHours } = useRayonerStore();
  const addToast = useCheckinStore(state => state.addToast);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || projects[0]?.id || ''
  );

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

  // Cálculos consolidados del encabezado
  const totalPlannedHours = currentProject?.totalBudgetHours || 120;

  const totalActualHours = useMemo(() => {
    return projectTasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  }, [projectTasks, taskActualHours]);

  const totalRemainingHours = Math.max(0, totalPlannedHours - totalActualHours);
  const percentConsumed = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;
  
  const estimatedCost = totalActualHours * (currentProject?.hourlyRate || 1500);
  const budgetCost = totalPlannedHours * (currentProject?.hourlyRate || 1500);

  // Exportar reporte a formato CSV estructurado
  const handleExportCSV = () => {
    if (!currentProject) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Nivel,Concepto / Tarea,Colaborador,Planeado (hrs),Actual (hrs),Restante (hrs),% Consumido,Tarifa/Hr,Costo Acumulado\r\n';

    projectTasks.forEach(task => {
      const actualH = taskActualHours[task.id] || 0;
      const remH = Math.max(0, task.plannedHours - actualH);
      const pct = task.plannedHours > 0 ? ((actualH / task.plannedHours) * 100).toFixed(1) : '0';
      const isSubtask = Boolean(task.parentTaskId);

      csvContent += `"${isSubtask ? 'Subtarea' : 'Tarea'}","${task.name.replace(/"/g, '""')}","-",${task.plannedHours},${actualH},${remH},${pct}%,${currentProject.hourlyRate},${(actualH * currentProject.hourlyRate).toFixed(2)}\r\n`;

      // Colaboradores asignados
      const taskAsgs = assignments.filter(a => a.taskId === task.id);
      taskAsgs.forEach(asg => {
        const userActual = userTaskActualHours[`${task.id}_${asg.userId}`] || (actualH / Math.max(1, taskAsgs.length));
        const userRem = Math.max(0, asg.allocatedHours - userActual);
        const userPct = asg.allocatedHours > 0 ? ((userActual / asg.allocatedHours) * 100).toFixed(1) : '0';
        const rate = asg.hourlyRateOverride || currentProject.hourlyRate;

        csvContent += `"Asignado","-","${asg.userName}",${asg.allocatedHours},${userActual.toFixed(1)},${userRem.toFixed(1)},${userPct}%,${rate},${(userActual * rate).toFixed(2)}\r\n`;
      });
    });

    // Fila Total
    csvContent += `"TOTAL","Proyecto Consolidado","-",${totalPlannedHours},${totalActualHours.toFixed(1)},${totalRemainingHours.toFixed(1)},${percentConsumed.toFixed(1)}%,${currentProject.hourlyRate},${estimatedCost.toFixed(2)}\r\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Informe_Tiempos_${currentProject.code || 'RAY'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Informe de tiempos exportado exitosamente a CSV', 'success');
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      
      {/* 1. Selector de Proyecto y Barra de Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase">Proyecto Seleccionado:</span>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 outline-none bg-slate-50"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-[#0D5C75] hover:bg-[#0E7490] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Exportar Informe (CSV)
          </button>
        </div>
      </div>

      {/* 2. Encabezado Ejecutivo del Proyecto (Scorecard) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente: {currentClient?.name || 'Cliente'}</span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {currentProject?.code}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">{currentProject?.name}</h2>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1.5 text-slate-400" />
              <span>Líder: <b>{currentProject?.leadUserName}</b></span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
              <span>Fecha Límite: <b>{currentProject?.deadline || 'Sin fecha'}</b></span>
            </div>
          </div>
        </div>

        {/* Tarjetas de Métricas de Control de Desviaciones */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          {/* Presupuesto Total */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">Presupuesto Planeado</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-slate-800">{totalPlannedHours.toFixed(1)}h</span>
              <span className="text-xs text-slate-400">(${(budgetCost).toLocaleString('es-MX')})</span>
            </div>
          </div>

          {/* Consumido */}
          <div className={`border rounded-xl p-4 ${
            percentConsumed >= 100 
              ? 'bg-red-50/50 border-red-200 text-red-900' 
              : percentConsumed >= 80 
                ? 'bg-amber-50/50 border-amber-200 text-amber-900' 
                : 'bg-slate-50 border-slate-200/80 text-slate-800'
          }`}>
            <span className="text-xs font-medium block opacity-80">Horas Consumidas</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold">{totalActualHours.toFixed(1)}h</span>
              <span className="text-xs opacity-70">(${(estimatedCost).toLocaleString('es-MX')})</span>
            </div>
          </div>

          {/* Restante */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">Horas Restantes</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-2xl font-bold ${totalRemainingHours <= 5 ? 'text-red-600' : 'text-slate-800'}`}>
                {totalRemainingHours.toFixed(1)}h
              </span>
              <span className="text-xs text-slate-400">
                (${(totalRemainingHours * (currentProject?.hourlyRate || 1500)).toLocaleString('es-MX')})
              </span>
            </div>
          </div>

          {/* % Consumido con Semáforo */}
          <div className={`border rounded-xl p-4 ${
            percentConsumed >= 100 
              ? 'bg-red-50 border-red-300' 
              : percentConsumed >= 80 
                ? 'bg-amber-50 border-amber-300' 
                : 'bg-emerald-50 border-emerald-200'
          }`}>
            <span className="text-xs font-semibold block text-slate-600">Estado de Desviación</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`text-2xl font-black ${
                percentConsumed >= 100 ? 'text-red-600' : percentConsumed >= 80 ? 'text-[#FF6B35]' : 'text-emerald-700'
              }`}>
                {percentConsumed.toFixed(1)}%
              </span>
              {percentConsumed >= 100 && (
                <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
                  SOBREPRESUPUESTO
                </span>
              )}
              {percentConsumed >= 80 && percentConsumed < 100 && (
                <span className="text-[10px] font-bold bg-[#FF6B35] text-white px-2 py-0.5 rounded-full flex items-center">
                  <AlertTriangle className="w-2.5 h-2.5 mr-1" /> ALERTA 80%
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Anotaciones del Supervisor */}
        {currentProject?.notes && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-2.5">
            <FileText className="w-4 h-4 text-[#0D5C75] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <b className="text-slate-800">Anotaciones de Supervisión:</b> {currentProject.notes}
            </div>
          </div>
        )}
      </div>

      {/* 3. Tabla Multinivel de Control de Tiempos y Desviaciones */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm">
            Desglose de Tiempos por Tarea y Colaborador
          </h3>
          <span className="text-xs text-slate-500">
            {projectTasks.length} tareas monitoreadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50 font-bold">
                <th className="p-3.5 pl-6 min-w-[280px]">Tarea / Colaborador</th>
                <th className="p-3.5 text-right w-28">Planeado</th>
                <th className="p-3.5 text-right w-28">Restante</th>
                <th className="p-3.5 text-right w-28">Actual</th>
                <th className="p-3.5 min-w-[180px]">% Consumido</th>
                <th className="p-3.5 pr-6 text-center w-28">Estado</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 font-medium">
              {projectTasks.filter(t => !t.parentTaskId).map(task => {
                const actualH = taskActualHours[task.id] || 0;
                const remH = Math.max(0, task.plannedHours - actualH);
                const pct = task.plannedHours > 0 ? (actualH / task.plannedHours) * 100 : 0;
                const taskAsgs = assignments.filter(a => a.taskId === task.id);

                return (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Tarea Principal */}
                    <td className="p-3.5 pl-6">
                      <div className="font-bold text-slate-800 text-[13px]">{task.name}</div>
                      {task.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-1">{task.description}</div>
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
                                className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center space-x-1 ${
                                  userPct >= 100 ? 'bg-red-50 text-red-700 border-red-200 font-bold' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <span>{asg.userName}: {userActual.toFixed(1)}/{asg.allocatedHours}h</span>
                                {asg.blockOnLimit && <span title="Bloqueo al límite activo">🔒</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 text-right font-mono text-slate-700 font-bold">
                      {task.plannedHours.toFixed(1)}h
                    </td>

                    <td className={`p-3.5 text-right font-mono font-bold ${remH <= 2 ? 'text-red-600' : 'text-slate-600'}`}>
                      {remH.toFixed(1)}h
                    </td>

                    <td className="p-3.5 text-right font-mono text-slate-900 font-extrabold">
                      {actualH.toFixed(1)}h
                    </td>

                    {/* Barra de Porcentaje */}
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, pct)}%` }}
                            className={`h-full rounded-full transition-all ${
                              pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-[#FF6B35]' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                        <span className={`w-12 text-right font-bold text-xs ${
                          pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-[#FF6B35]' : 'text-slate-700'
                        }`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Badge de Estado con Alerta */}
                    <td className="p-3.5 pr-6 text-center">
                      {pct >= 100 ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full font-bold text-[10px]">
                          Excedido
                        </span>
                      ) : pct >= 80 ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px] flex items-center justify-center">
                          <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Alerta
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                          En Rango
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Fila de TOTAL Consolidado */}
              <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                <td className="p-4 pl-6 uppercase tracking-wider font-extrabold text-[#0D5C75]">
                  TOTAL DEL PROYECTO
                </td>
                <td className="p-4 text-right font-mono font-extrabold text-sm">
                  {totalPlannedHours.toFixed(1)}h
                </td>
                <td className="p-4 text-right font-mono font-extrabold text-sm text-slate-700">
                  {totalRemainingHours.toFixed(1)}h
                </td>
                <td className="p-4 text-right font-mono font-extrabold text-sm text-slate-900">
                  {totalActualHours.toFixed(1)}h
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, percentConsumed)}%` }}
                        className={`h-full rounded-full ${
                          percentConsumed >= 100 ? 'bg-red-500' : percentConsumed >= 80 ? 'bg-[#FF6B35]' : 'bg-emerald-600'
                        }`}
                      />
                    </div>
                    <span className="font-extrabold text-sm">
                      {percentConsumed.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="p-4 pr-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    percentConsumed >= 100 
                      ? 'bg-red-600 text-white' 
                      : percentConsumed >= 80 
                        ? 'bg-[#FF6B35] text-white' 
                        : 'bg-emerald-600 text-white'
                  }`}>
                    {percentConsumed >= 100 ? 'Crítico' : percentConsumed >= 80 ? 'Alerta 80%' : 'Óptimo'}
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
