import type { Project, Client, TaskNode, TaskAssignment } from '../types/rayoner';

export interface ProjectReportExportData {
  project: Project;
  client?: Client | null;
  tasks: TaskNode[];
  assignments: TaskAssignment[];
  taskActualHours: Record<string, number>;
  userTaskActualHours: Record<string, number>;
  generatedBy?: string;
  generatedRole?: string;
}

/**
 * Genera y descarga un archivo de Excel nativo (.xls XML Spreadsheet 2003)
 * con diseño corporativo Russell Bedford, estilos, tipografías, colores de celda y columnas formateadas.
 */
export function exportProjectReportToExcel(data: ProjectReportExportData) {
  const {
    project,
    client,
    tasks,
    assignments,
    taskActualHours,
    userTaskActualHours,
    generatedBy = 'Supervisor de Auditoría',
  } = data;

  const totalPlannedHours = project.totalBudgetHours || 0;
  const totalActualHours = tasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  const totalRemainingHours = Math.max(0, totalPlannedHours - totalActualHours);
  const percentConsumed = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;
  const hourlyRate = project.hourlyRate || 1500;
  const budgetCost = totalPlannedHours * hourlyRate;
  const estimatedCost = totalActualHours * hourlyRate;
  const remainingCost = totalRemainingHours * hourlyRate;

  const todayStr = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date());

  // Generar XML Spreadsheet 2003 para compatibilidad nativa total con Excel en Windows/Mac
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Informe Ejecutivo - ${project.name}</Title>
  <Subject>Control de Tiempos y Rentabilidad Russell Bedford</Subject>
  <Author>${generatedBy}</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Cabeceras y Títulos Corporativos -->
  <Style ss:ID="TitleHeader">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#002D42" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubHeader">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#E0F2FE"/>
   <Interior ss:Color="#0D5C75" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0D5C75"/>
   <Interior ss:Color="#F0F9FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/>
   </Borders>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <!-- KPIs -->
  <Style ss:ID="KpiHeader">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#004B6E" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KpiValue">
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#002D42"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <!-- Tablas -->
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#002D42" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#001824"/>
   </Borders>
  </Style>
  <Style ss:ID="TableSubHeader">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#002D42"/>
   <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="$#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0%"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <!-- Totales -->
  <Style ss:ID="TotalRow">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D5C75" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Double" ss:Weight="3" ss:Color="#002D42"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#002D42"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalRowNumber">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D5C75" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.0"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Double" ss:Weight="3" ss:Color="#002D42"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#002D42"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalRowCurrency">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D5C75" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="$#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Double" ss:Weight="3" ss:Color="#002D42"/>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#002D42"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Informe Ejecutivo">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="160"/>
   <Column ss:Width="260"/>
   <Column ss:Width="170"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>

   <!-- TÍTULO CORPORATIVO -->
   <Row ss:Height="30">
    <Cell ss:MergeAcross="8" ss:StyleID="TitleHeader">
     <Data ss:Type="String">  RUSSELL BEDFORD MÉXICO • INFORME EJECUTIVO DE PROYECTO</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="8" ss:StyleID="SubHeader">
     <Data ss:Type="String">  Control de Tiempos, Rentabilidad Presupuestal y Desglose por Colaborador</Data>
    </Cell>
   </Row>
   <Row ss:Height="12"><Cell ss:MergeAcross="8"/></Row>

   <!-- METADATOS DEL PROYECTO -->
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Proyecto:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.name)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Código de Proyecto:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.code)}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Líder / Responsable:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.leadUserName)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Cliente / Razón Social:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(client?.name || 'Cliente Particular')}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">RFC Cliente:</Data></Cell>
    <Cell ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(client?.taxId || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Fecha Límite / Entrega:</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaValue"><Data ss:Type="String">${escapeXml(project.deadline || 'En curso')}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Tarifa por Hora:</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${hourlyRate}</Data></Cell>
    <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">Emisión del Informe:</Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="MetaValue"><Data ss:Type="String">${todayStr} (Por ${escapeXml(generatedBy)})</Data></Cell>
   </Row>
   <Row ss:Height="14"><Cell ss:MergeAcross="8"/></Row>

   <!-- RESUMEN EJECUTIVO (KPIS) -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHeader"><Data ss:Type="String">PRESUPUESTO PLANEADO</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHeader"><Data ss:Type="String">HORAS CONSUMIDAS (DEVENGADO)</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHeader"><Data ss:Type="String">SALDO DISPONIBLE</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">RENTABILIDAD / DESVIACIÓN</Data></Cell>
   </Row>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValue"><Data ss:Type="String">${totalPlannedHours.toFixed(1)} hrs ($${budgetCost.toLocaleString('es-MX')})</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValue"><Data ss:Type="String">${totalActualHours.toFixed(1)} hrs ($${estimatedCost.toLocaleString('es-MX')})</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValue"><Data ss:Type="String">${totalRemainingHours.toFixed(1)} hrs ($${remainingCost.toLocaleString('es-MX')})</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValue"><Data ss:Type="String">${percentConsumed.toFixed(1)}% (${percentConsumed >= 100 ? 'EXCEDIDO' : percentConsumed >= 80 ? 'ALERTA 80%' : 'ÓPTIMO'})</Data></Cell>
   </Row>
   <Row ss:Height="16"><Cell ss:MergeAcross="8"/></Row>

   <!-- SECCIÓN 1: DETALLE DE TAREAS Y SUBTAREAS -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="8" ss:StyleID="TitleHeader">
     <Data ss:Type="String">  1. DESGLOSE DE TIEMPOS POR TAREA Y ASIGNACIÓN</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Concepto / Nombre de Tarea</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Colaborador Principal</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Planeado (hrs)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Actual (hrs)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Restante (hrs)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">% Consumo</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tarifa/hr</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Costo Imputado</Data></Cell>
   </Row>
   ${generateTaskRowsXml(tasks, assignments, taskActualHours, userTaskActualHours, hourlyRate)}
   <!-- Fila Total de Tareas -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="TotalRow"><Data ss:Type="String">TOTAL CONSOLIDADO:</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${totalPlannedHours}</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${totalActualHours}</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${totalRemainingHours}</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${percentConsumed / 100}</Data></Cell>
    <Cell ss:StyleID="TotalRowCurrency"><Data ss:Type="Number">${hourlyRate}</Data></Cell>
    <Cell ss:StyleID="TotalRowCurrency"><Data ss:Type="Number">${estimatedCost}</Data></Cell>
   </Row>
   <Row ss:Height="16"><Cell ss:MergeAcross="8"/></Row>

   <!-- SECCIÓN 2: DESGLOSE POR COLABORADOR -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="8" ss:StyleID="TitleHeader">
     <Data ss:Type="String">  2. PARTICIPACIÓN Y HORAS IMPUTADAS POR COLABORADOR</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="TableHeader"><Data ss:Type="String">Colaborador / Especialista</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Rol / Categoría</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tareas Asignadas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Horas Asignadas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Horas Reales</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">% Participación</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tarifa Base</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Importe Generado</Data></Cell>
   </Row>
   ${generateCollaboratorRowsXml(tasks, assignments, taskActualHours, userTaskActualHours, totalActualHours, hourlyRate)}

  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Landscape"/>
    <Header x:Margin="0.3"/>
    <Footer x:Margin="0.3"/>
   </PageSetup>
   <Print>
    <ValidPrinterInfo/>
    <PaperSizeIndex>9</PaperSizeIndex>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>1</ActiveRow>
    </Pane>
   </Panes>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanCode = (project.code || 'PROY').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `RussellBedford_Informe_${cleanCode}_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Genera el documento PDF corporativo Russell Bedford de alta resolución
 * con hoja membretada, resumen financiero, desglose por tarea y resumen por colaborador.
 */
export function exportProjectReportToPDF(data: ProjectReportExportData) {
  const {
    project,
    client,
    tasks,
    assignments,
    taskActualHours,
    userTaskActualHours,
    generatedBy = 'Supervisor de Auditoría',
  } = data;

  const totalPlannedHours = project.totalBudgetHours || 0;
  const totalActualHours = tasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  const totalRemainingHours = Math.max(0, totalPlannedHours - totalActualHours);
  const percentConsumed = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;
  const hourlyRate = project.hourlyRate || 1500;
  const budgetCost = totalPlannedHours * hourlyRate;
  const estimatedCost = totalActualHours * hourlyRate;
  const remainingCost = totalRemainingHours * hourlyRate;

  const todayStr = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());

  // Generar HTML optimizado para renderizado e impresión PDF directo
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor habilita las ventanas emergentes en tu navegador para generar el PDF.');
    return;
  }

  // Desglose de tareas
  const taskRowsHtml = tasks
    .filter((t) => !t.parentTaskId)
    .map((task) => {
      const actualH = taskActualHours[task.id] || 0;
      const remH = Math.max(0, task.plannedHours - actualH);
      const pct = task.plannedHours > 0 ? (actualH / task.plannedHours) * 100 : 0;
      const cost = actualH * hourlyRate;
      const taskAsgs = assignments.filter((a) => a.taskId === task.id);
      const subtasks = tasks.filter((st) => st.parentTaskId === task.id);

      const statusBadge =
        pct >= 100
          ? '<span class="badge badge-red">Excedido</span>'
          : pct >= 80
          ? '<span class="badge badge-amber">Alerta 80%</span>'
          : '<span class="badge badge-green">En Presupuesto</span>';

      let rowHtml = `
        <tr class="task-row">
          <td>
            <div class="task-title">${escapeHtml(task.title || task.name)}</div>
            ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
            ${
              taskAsgs.length > 0
                ? `<div class="task-assignees">${taskAsgs.map((a) => `<span>👤 ${escapeHtml(a.userName)} (${(userTaskActualHours[`${task.id}_${a.userId}`] || actualH / taskAsgs.length).toFixed(1)}h)</span>`).join(' ')}</div>`
                : ''
            }
          </td>
          <td class="text-center font-mono font-bold">${task.plannedHours.toFixed(1)}h</td>
          <td class="text-center font-mono font-bold">${actualH.toFixed(1)}h</td>
          <td class="text-center font-mono">${remH.toFixed(1)}h</td>
          <td class="text-center font-mono font-bold">${pct.toFixed(0)}%</td>
          <td class="text-right font-mono">$${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
          <td class="text-center">${statusBadge}</td>
        </tr>
      `;

      // Subtareas si existen
      subtasks.forEach((st) => {
        const stActual = taskActualHours[st.id] || 0;
        const stRem = Math.max(0, st.plannedHours - stActual);
        const stPct = st.plannedHours > 0 ? (stActual / st.plannedHours) * 100 : 0;
        const stCost = stActual * hourlyRate;
        rowHtml += `
          <tr class="subtask-row">
            <td style="padding-left: 28px;">
              <span class="subtask-bullet">↳</span> ${escapeHtml(st.name)}
            </td>
            <td class="text-center font-mono">${st.plannedHours.toFixed(1)}h</td>
            <td class="text-center font-mono">${stActual.toFixed(1)}h</td>
            <td class="text-center font-mono">${stRem.toFixed(1)}h</td>
            <td class="text-center font-mono">${stPct.toFixed(0)}%</td>
            <td class="text-right font-mono">$${stCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td class="text-center"><span class="badge badge-sub">Subtarea</span></td>
          </tr>
        `;
      });

      return rowHtml;
    })
    .join('');

  // Desglose de colaboradores
  const collaboratorMap = new Map<
    string,
    { name: string; role: string; taskCount: number; plannedHours: number; actualHours: number }
  >();

  assignments.forEach((asg) => {
    const existing = collaboratorMap.get(asg.userId) || {
      name: asg.userName,
      role: asg.userRoleTitle || 'Colaborador',
      taskCount: 0,
      plannedHours: 0,
      actualHours: 0,
    };
    existing.taskCount += 1;
    existing.plannedHours += asg.allocatedHours;
    const taskActual = userTaskActualHours ? (userTaskActualHours[`${asg.taskId}_${asg.userId}`] || 0) : 0;
    existing.actualHours += taskActual;
    collaboratorMap.set(asg.userId, existing);
  });

  const collaboratorRowsHtml = Array.from(collaboratorMap.values())
    .map((c) => {
      const share = totalActualHours > 0 ? (c.actualHours / totalActualHours) * 100 : 0;
      const cost = c.actualHours * hourlyRate;
      return `
        <tr>
          <td class="font-bold">👤 ${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.role)}</td>
          <td class="text-center font-mono">${c.taskCount}</td>
          <td class="text-center font-mono">${c.plannedHours.toFixed(1)}h</td>
          <td class="text-center font-mono font-bold">${c.actualHours.toFixed(1)}h</td>
          <td class="text-center font-mono">${share.toFixed(1)}%</td>
          <td class="text-right font-mono font-bold">$${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe Ejecutivo - ${escapeHtml(project.name)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
      background: #FFFFFF;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #002D42;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #002D42;
      letter-spacing: -0.5px;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 10px;
      font-weight: 700;
      color: #0D5C75;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .project-code-pill {
      display: inline-block;
      background: #002D42;
      color: #00E5FF;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .date-str {
      font-size: 9px;
      color: #64748B;
      margin-top: 4px;
    }

    /* Meta Info Card */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748B;
      letter-spacing: 0.5px;
    }
    .meta-val {
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }

    /* KPI Cards */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
      background: #F0F9FF;
    }
    .kpi-card.alert {
      background: #FEF3C7;
      border-color: #F59E0B;
    }
    .kpi-card.danger {
      background: #FEE2E2;
      border-color: #EF4444;
    }
    .kpi-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0D5C75;
      letter-spacing: 0.5px;
    }
    .kpi-number {
      font-size: 18px;
      font-weight: 900;
      color: #002D42;
      margin: 4px 0 2px 0;
      font-family: monospace;
    }
    .kpi-sub {
      font-size: 9px;
      color: #475569;
    }

    /* Tables */
    .section-title {
      font-size: 12px;
      font-weight: 900;
      color: #002D42;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-left: 4px solid #0D5C75;
      padding-left: 8px;
      margin: 16px 0 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10px;
    }
    th {
      background: #002D42;
      color: #FFFFFF;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      padding: 6px 8px;
      border: 1px solid #002D42;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #E2E8F0;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background: #F8FAFC;
    }
    .task-title {
      font-weight: 700;
      color: #0F172A;
    }
    .task-desc {
      font-size: 9px;
      color: #64748B;
    }
    .task-assignees {
      font-size: 9px;
      color: #0D5C75;
      margin-top: 2px;
    }
    .subtask-row td {
      background: #FAFBFD;
      font-size: 9.5px;
      color: #334155;
    }
    .subtask-bullet {
      color: #0D5C75;
      font-weight: bold;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
    .font-bold { font-weight: bold; }

    /* Badges */
    .badge {
      display: inline-block;
      font-size: 8.5px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .badge-green { background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; }
    .badge-amber { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
    .badge-red { background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; }
    .badge-sub { background: #E2E8F0; color: #475569; }

    /* Totales */
    .total-row {
      background: #0D5C75 !important;
      color: #FFFFFF !important;
      font-weight: 900;
      font-size: 10.5px;
    }
    .total-row td {
      border: 1px solid #0A485C;
      color: #FFFFFF !important;
    }

    /* Footer y Firmas */
    .footer-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 30px;
      page-break-inside: avoid;
    }
    .signature-box {
      border-top: 1px solid #64748B;
      padding-top: 6px;
      text-align: center;
      font-size: 9.5px;
      color: #475569;
    }
    .signature-name {
      font-weight: bold;
      color: #0F172A;
      font-size: 11px;
    }
    .disclaimer {
      margin-top: 25px;
      text-align: center;
      font-size: 8px;
      color: #94A3B8;
      border-top: 1px dashed #CBD5E1;
      padding-top: 8px;
    }
    .no-print-bar {
      background: #002D42;
      color: white;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-radius: 6px;
    }
    @media print {
      .no-print-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span><strong>Informe Ejecutivo Generado</strong> — Listo para imprimir o guardar como PDF</span>
    <button onclick="window.print()" style="background: #00E5FF; color: #002D42; border: none; padding: 6px 14px; font-weight: bold; border-radius: 4px; cursor: pointer;">
      Imprimir / Guardar como PDF
    </button>
  </div>

  <div class="header-bar">
    <div>
      <h1 class="brand-title">Russell Bedford</h1>
      <div class="brand-subtitle">Control de Tiempos, Rentabilidad y Auditoría Corporativa</div>
    </div>
    <div class="header-right">
      <div class="project-code-pill">${escapeHtml(project.code)}</div>
      <div class="date-str">Emisión: ${todayStr}</div>
    </div>
  </div>

  <!-- Metadatos -->
  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Proyecto</span>
      <span class="meta-val">${escapeHtml(project.name)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Cliente</span>
      <span class="meta-val">${escapeHtml(client?.name || 'Cliente Particular')}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Líder del Proyecto</span>
      <span class="meta-val">👤 ${escapeHtml(project.leadUserName)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Fecha Límite / Entrega</span>
      <span class="meta-val">📅 ${escapeHtml(project.deadline || 'En curso')}</span>
    </div>
  </div>

  <!-- KPIs Financieros y de Tiempo -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-title">Presupuesto Planeado</div>
      <div class="kpi-number">${totalPlannedHours.toFixed(1)}h</div>
      <div class="kpi-sub">$${budgetCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
    </div>
    <div class="kpi-card ${percentConsumed >= 100 ? 'danger' : percentConsumed >= 80 ? 'alert' : ''}">
      <div class="kpi-title">Horas Consumidas</div>
      <div class="kpi-number">${totalActualHours.toFixed(1)}h</div>
      <div class="kpi-sub">$${estimatedCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Horas Restantes</div>
      <div class="kpi-number">${totalRemainingHours.toFixed(1)}h</div>
      <div class="kpi-sub">$${remainingCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
    </div>
    <div class="kpi-card ${percentConsumed >= 100 ? 'danger' : percentConsumed >= 80 ? 'alert' : ''}">
      <div class="kpi-title">Consumo de Presupuesto</div>
      <div class="kpi-number">${percentConsumed.toFixed(1)}%</div>
      <div class="kpi-sub">${percentConsumed >= 100 ? 'SOBREPRESUPUESTO' : percentConsumed >= 80 ? 'ALERTA PREVENTIVA' : 'RANGO ÓPTIMO'}</div>
    </div>
  </div>

  <!-- Tabla de Tareas -->
  <div class="section-title">1. Desglose Operativo por Tarea y Asignación</div>
  <table>
    <thead>
      <tr>
        <th style="width: 38%;">Concepto / Tarea</th>
        <th class="text-center" style="width: 10%;">Plan (h)</th>
        <th class="text-center" style="width: 10%;">Real (h)</th>
        <th class="text-center" style="width: 10%;">Saldo (h)</th>
        <th class="text-center" style="width: 10%;">% Avance</th>
        <th class="text-right" style="width: 12%;">Costo Devengado</th>
        <th class="text-center" style="width: 10%;">Estatus</th>
      </tr>
    </thead>
    <tbody>
      ${taskRowsHtml}
      <tr class="total-row">
        <td>TOTAL CONSOLIDADO DEL PROYECTO</td>
        <td class="text-center font-mono">${totalPlannedHours.toFixed(1)}h</td>
        <td class="text-center font-mono">${totalActualHours.toFixed(1)}h</td>
        <td class="text-center font-mono">${totalRemainingHours.toFixed(1)}h</td>
        <td class="text-center font-mono">${percentConsumed.toFixed(1)}%</td>
        <td class="text-right font-mono">$${estimatedCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td class="text-center">${percentConsumed >= 100 ? 'CRÍTICO' : percentConsumed >= 80 ? 'ALERTA' : 'ÓPTIMO'}</td>
      </tr>
    </tbody>
  </table>

  <!-- Tabla de Colaboradores -->
  <div class="section-title">2. Participación y Horas Imputadas por Colaborador</div>
  <table>
    <thead>
      <tr>
        <th>Colaborador</th>
        <th>Rol / Cargo</th>
        <th class="text-center">Tareas</th>
        <th class="text-center">Horas Plan</th>
        <th class="text-center">Horas Reales</th>
        <th class="text-center">% Participación</th>
        <th class="text-right">Importe Imputado</th>
      </tr>
    </thead>
    <tbody>
      ${collaboratorRowsHtml || '<tr><td colspan="7" class="text-center" style="padding: 12px; color: #64748B;">Sin asignaciones individuales registradas en este proyecto</td></tr>'}
    </tbody>
  </table>

  <!-- Firmas -->
  <div class="footer-signatures">
    <div class="signature-box">
      <div class="signature-name">${escapeHtml(project.leadUserName)}</div>
      <div>Socio / Supervisor Responsable de Proyecto</div>
    </div>
    <div class="signature-box">
      <div class="signature-name">${escapeHtml(generatedBy)}</div>
      <div>Auditoría y Control de Calidad Interna</div>
    </div>
  </div>

  <div class="disclaimer">
    Este informe contiene información confidencial de Russell Bedford México. Generado electrónicamente a través de la plataforma corporativa de control de horas y rentabilidad.
  </div>

  <script>
    // Auto abrir diálogo de impresión después de renderizar
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function generateTaskRowsXml(
  tasks: TaskNode[],
  assignments: TaskAssignment[],
  taskActualHours: Record<string, number>,
  _userTaskActualHours: Record<string, number> | undefined,
  hourlyRate: number
): string {
  let xml = '';

  tasks
    .filter((t) => !t.parentTaskId)
    .forEach((task) => {
      const actualH = taskActualHours[task.id] || 0;
      const remH = Math.max(0, task.plannedHours - actualH);
      const pct = task.plannedHours > 0 ? actualH / task.plannedHours : 0;
      const cost = actualH * hourlyRate;
      const taskAsgs = assignments.filter((a) => a.taskId === task.id);
      const subtasks = tasks.filter((st) => st.parentTaskId === task.id);

      xml += `
   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">Tarea</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escapeXml(task.title || task.name)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escapeXml(taskAsgs.map((a) => a.userName).join(', ') || 'Sin asignar')}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${task.plannedHours}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${actualH}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${remH}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${pct}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${hourlyRate}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${cost}</Data></Cell>
   </Row>`;

      subtasks.forEach((st) => {
        const stActual = taskActualHours[st.id] || 0;
        const stRem = Math.max(0, st.plannedHours - stActual);
        const stPct = st.plannedHours > 0 ? stActual / st.plannedHours : 0;
        const stCost = stActual * hourlyRate;

        xml += `
   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">Subtarea</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">  ↳ ${escapeXml(st.name)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${st.plannedHours}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${stActual}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${stRem}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${stPct}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${hourlyRate}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${stCost}</Data></Cell>
   </Row>`;
      });
    });

  return xml;
}

function generateCollaboratorRowsXml(
  _tasks: TaskNode[],
  assignments: TaskAssignment[],
  _taskActualHours: Record<string, number>,
  userTaskActualHours: Record<string, number> | undefined,
  totalActualHours: number,
  hourlyRate: number
): string {
  const map = new Map<
    string,
    { name: string; role: string; taskCount: number; plannedHours: number; actualHours: number }
  >();

  assignments.forEach((asg) => {
    const existing = map.get(asg.userId) || {
      name: asg.userName,
      role: asg.userRoleTitle || 'Colaborador',
      taskCount: 0,
      plannedHours: 0,
      actualHours: 0,
    };
    existing.taskCount += 1;
    existing.plannedHours += asg.allocatedHours;
    const taskActual = userTaskActualHours ? (userTaskActualHours[`${asg.taskId}_${asg.userId}`] || 0) : 0;
    existing.actualHours += taskActual;
    map.set(asg.userId, existing);
  });

  let xml = '';
  Array.from(map.values()).forEach((c) => {
    const share = totalActualHours > 0 ? c.actualHours / totalActualHours : 0;
    const cost = c.actualHours * hourlyRate;

    xml += `
   <Row>
    <Cell ss:MergeAcross="1" ss:StyleID="CellLeft"><Data ss:Type="String">👤 ${escapeXml(c.name)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escapeXml(c.role)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${c.taskCount}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${c.plannedHours}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${c.actualHours}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${share}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${hourlyRate}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${cost}</Data></Cell>
   </Row>`;
  });

  return xml;
}

function escapeXml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
