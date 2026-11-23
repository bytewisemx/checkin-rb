import * as XLSX from 'xlsx';
import type { Project, Client, TaskNode, TeamMember } from '../types/rayoner';

/**
 * Servicio de exportación oficial del Plan de Trabajo de Auditoría Russell Bedford
 * a un archivo Excel (.xlsx) con dos hojas nativas:
 * 1. "Resumen& General": Planeación General y Cierre (Bloque 0)
 * 2. "Plan de auditoria": Rubros 1 al 18 con columnas dinámicas por colaborador
 */
export function exportAuditPlanToExcel(
  project: Project,
  client: Client | null | undefined,
  tasks: TaskNode[],
  teamMembers: TeamMember[]
): void {
  const wb = XLSX.utils.book_new();

  const companyName = client?.commercialName || client?.name || (project as any).clientName || 'Empresa Cliente';
  const projectName = project.name || 'Auditoría de Estados Financieros';
  const projectCode = project.code || 'PRJ-AUD';
  const exportDate = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Identificar los colaboradores únicos que tienen horas registradas o están asignados
  const involvedUserIds = new Set<string>();
  tasks.forEach((t) => {
    if (t.hoursByUser) {
      Object.keys(t.hoursByUser).forEach((uid) => {
        if (Number(t.hoursByUser![uid]) > 0) involvedUserIds.add(uid);
      });
    }
    if (Array.isArray(t.assignedUserIds)) {
      t.assignedUserIds.forEach((uid) => involvedUserIds.add(uid));
    }
  });

  // Lista ordenada de colaboradores para las columnas dinámicas
  const activeCollabs = teamMembers
    .filter((m) => involvedUserIds.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name || m.email || 'Colaborador',
      role: m.role || 'Staff',
    }));

  // Si no hay colaboradores con horas, incluir al menos el encargado o gerente
  if (activeCollabs.length === 0) {
    const lead = teamMembers.find((m) => m.id === project.leadUserId);
    if (lead) {
      activeCollabs.push({ id: lead.id, name: lead.name, role: lead.role || 'Encargado' });
    }
  }

  // ==========================================
  // HOJA 1: Resumen& General (Bloque 0)
  // ==========================================
  const generalTasks = tasks.filter((t) => t.rubroNumber === 0 || t.rubro === 'Planeación General y Cierre');

  const sheet1Data: any[][] = [];

  // Encabezado corporativo Russell Bedford
  sheet1Data.push(['RUSSELL BEDFORD - PLAN DE TRABAJO Y SUPERVISIÓN DE AUDITORÍA']);
  sheet1Data.push(['RESUMEN GENERAL Y ACTIVIDADES DE PLANEACIÓN Y CIERRE']);
  sheet1Data.push([]);
  sheet1Data.push(['Cliente / Empresa:', companyName, '', 'Código Proyecto:', projectCode]);
  sheet1Data.push(['Servicio:', projectName, '', 'Fecha de Exportación:', exportDate]);
  sheet1Data.push(['Gerente / Responsable:', project.managerName || project.leadUserName || 'Gerente Asignado']);
  sheet1Data.push([]);

  // Fila de encabezados de la tabla
  const sheet1Headers = [
    'No.',
    'Procedimiento / Actividad',
    'Papel de Trabajo (PT)',
    'Fase',
    'Perfil Sugerido',
    'Encargado',
    'Hrs. Presupuestadas',
  ];

  // Columnas dinámicas de colaboradores
  activeCollabs.forEach((collab) => {
    sheet1Headers.push(`Hrs. ${collab.name}`);
  });

  sheet1Headers.push('Total Hrs. Reales', 'Variación (Presup - Real)', 'Estatus de Revisión');
  sheet1Data.push(sheet1Headers);

  // Filas de datos de la Hoja 1
  let totalPresupSheet1 = 0;
  let totalRealSheet1 = 0;
  const collabTotalsSheet1: Record<string, number> = {};
  activeCollabs.forEach((c) => (collabTotalsSheet1[c.id] = 0));

  generalTasks.forEach((t, idx) => {
    const presup = Number(t.budgetedHours || t.plannedHours || 0);
    totalPresupSheet1 += presup;

    // Calcular horas reales de cada colaborador
    const collabHours: number[] = activeCollabs.map((c) => {
      const h = Number(t.hoursByUser?.[c.id] || 0);
      collabTotalsSheet1[c.id] = (collabTotalsSheet1[c.id] || 0) + h;
      return h;
    });

    const realTotal = Number(
      t.totalActualHours ||
      (t.loggedMinutes ? t.loggedMinutes / 60 : 0) ||
      collabHours.reduce((acc, h) => acc + h, 0)
    );
    totalRealSheet1 += realTotal;

    const variacion = Number((presup - realTotal).toFixed(2));

    const statusLabel =
      t.reviewStatus === 'completed' || t.reviewStatus === 'lead_reviewed'
        ? 'Revisado (100%)'
        : t.reviewStatus === 'staff_pt_done'
        ? 'PT Concluido Staff (75%)'
        : 'Pendiente';

    const row: any[] = [
      t.activityNumber || idx + 1,
      t.procedimiento || t.name || t.title,
      t.papelTrabajo || 'PT diseñado por auditor',
      t.fase || 'Previa',
      t.perfilSugerido || 'Staff',
      t.leadUserName || 'Sin asignar',
      presup,
      ...collabHours,
      Number(realTotal.toFixed(2)),
      variacion,
      statusLabel,
    ];
    sheet1Data.push(row);
  });

  // Fila de Totales Hoja 1
  const totalsRow1: any[] = [
    'TOTALES',
    `${generalTasks.length} Actividades`,
    '',
    '',
    '',
    '',
    Number(totalPresupSheet1.toFixed(2)),
  ];
  activeCollabs.forEach((c) => {
    totalsRow1.push(Number((collabTotalsSheet1[c.id] || 0).toFixed(2)));
  });
  totalsRow1.push(
    Number(totalRealSheet1.toFixed(2)),
    Number((totalPresupSheet1 - totalRealSheet1).toFixed(2)),
    ''
  );
  sheet1Data.push([]);
  sheet1Data.push(totalsRow1);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Autoajuste de anchos de columna para Hoja 1
  ws1['!cols'] = [
    { wch: 6 },  // No.
    { wch: 45 }, // Procedimiento
    { wch: 25 }, // PT
    { wch: 10 }, // Fase
    { wch: 15 }, // Perfil
    { wch: 20 }, // Encargado
    { wch: 18 }, // Hrs Presup
    ...activeCollabs.map(() => ({ wch: 16 })),
    { wch: 16 }, // Total Real
    { wch: 22 }, // Variacion
    { wch: 25 }, // Estatus
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen& General');

  // ==========================================
  // HOJA 2: Plan de auditoria (Rubros 1 al 18)
  // ==========================================
  const planTasks = tasks.filter((t) => t.rubroNumber !== 0 && t.rubro !== 'Planeación General y Cierre');

  const sheet2Data: any[][] = [];

  sheet2Data.push(['RUSSELL BEDFORD - PLAN DE AUDITORÍA DETALLADO POR RUBROS']);
  sheet2Data.push(['PROGRAMAS DE AUDITORÍA Y PROCEDIMIENTOS SUSTANTIVOS (RUBROS 1 AL 18)']);
  sheet2Data.push([]);
  sheet2Data.push(['Cliente / Empresa:', companyName, '', 'Código Proyecto:', projectCode]);
  sheet2Data.push(['Servicio:', projectName, '', 'Fecha de Exportación:', exportDate]);
  sheet2Data.push([]);

  // Encabezados Hoja 2
  const sheet2Headers = [
    'No.',
    'Rubro / Área',
    'Cuenta Contable',
    'Procedimiento Oficial',
    'Papel de Trabajo (PT)',
    'Fase',
    'Perfil',
    'Encargado',
    'Hrs. Presupuestadas',
  ];

  activeCollabs.forEach((collab) => {
    sheet2Headers.push(`Hrs. ${collab.name}`);
  });

  sheet2Headers.push('Total Hrs. Reales', 'Variación (Presup - Real)', 'Estatus de Revisión');
  sheet2Data.push(sheet2Headers);

  let totalPresupSheet2 = 0;
  let totalRealSheet2 = 0;
  const collabTotalsSheet2: Record<string, number> = {};
  activeCollabs.forEach((c) => (collabTotalsSheet2[c.id] = 0));

  planTasks.forEach((t, idx) => {
    const presup = Number(t.budgetedHours || t.plannedHours || 0);
    totalPresupSheet2 += presup;

    const collabHours: number[] = activeCollabs.map((c) => {
      const h = Number(t.hoursByUser?.[c.id] || 0);
      collabTotalsSheet2[c.id] = (collabTotalsSheet2[c.id] || 0) + h;
      return h;
    });

    const realTotal = Number(
      t.totalActualHours ||
      (t.loggedMinutes ? t.loggedMinutes / 60 : 0) ||
      collabHours.reduce((acc, h) => acc + h, 0)
    );
    totalRealSheet2 += realTotal;

    const variacion = Number((presup - realTotal).toFixed(2));

    const statusLabel =
      t.reviewStatus === 'completed' || t.reviewStatus === 'lead_reviewed'
        ? 'Revisado (100%)'
        : t.reviewStatus === 'staff_pt_done'
        ? 'PT Concluido Staff (75%)'
        : 'Pendiente';

    const row: any[] = [
      t.activityNumber || idx + 1,
      t.rubro || 'General',
      t.cuentaContable || '',
      t.procedimiento || t.name || t.title,
      t.papelTrabajo || 'PT diseñado por auditor',
      t.fase || 'Previa',
      t.perfilSugerido || 'Staff',
      t.leadUserName || 'Sin asignar',
      presup,
      ...collabHours,
      Number(realTotal.toFixed(2)),
      variacion,
      statusLabel,
    ];
    sheet2Data.push(row);
  });

  // Fila de Totales Hoja 2
  const totalsRow2: any[] = [
    'TOTALES',
    `${planTasks.length} Actividades`,
    '',
    '',
    '',
    '',
    '',
    '',
    Number(totalPresupSheet2.toFixed(2)),
  ];
  activeCollabs.forEach((c) => {
    totalsRow2.push(Number((collabTotalsSheet2[c.id] || 0).toFixed(2)));
  });
  totalsRow2.push(
    Number(totalRealSheet2.toFixed(2)),
    Number((totalPresupSheet2 - totalRealSheet2).toFixed(2)),
    ''
  );
  sheet2Data.push([]);
  sheet2Data.push(totalsRow2);

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

  ws2['!cols'] = [
    { wch: 6 },  // No.
    { wch: 28 }, // Rubro
    { wch: 22 }, // Cuenta contable
    { wch: 45 }, // Procedimiento
    { wch: 25 }, // PT
    { wch: 10 }, // Fase
    { wch: 12 }, // Perfil
    { wch: 20 }, // Encargado
    { wch: 18 }, // Hrs Presup
    ...activeCollabs.map(() => ({ wch: 16 })),
    { wch: 16 }, // Total Real
    { wch: 22 }, // Variacion
    { wch: 25 }, // Estatus
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'Plan de auditoria');

  // Generar y descargar archivo en el navegador
  const sanitizedClient = companyName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const fileName = `Plan_de_Trabajo_${sanitizedClient}_${projectCode}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
