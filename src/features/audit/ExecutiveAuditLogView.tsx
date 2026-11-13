import { useState, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  Clock,
  Activity,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';
import { useAuditStore, type AuditEventType } from '../../store/useAuditStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { UserAvatar } from '../../components/common/UserAvatar';

export function ExecutiveAuditLogView() {
  const { logs } = useAuditStore();
  const { addToast } = useCheckinStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<'ALL' | AuditEventType>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<'ALL' | 'PDF' | 'Excel'>('ALL');

  // Métricas de Resumen
  const metrics = useMemo(() => {
    const total = logs.length;
    const downloads = logs.filter((l) => l.eventType === 'REPORT_DOWNLOADED').length;
    const budgets = logs.filter((l) => l.eventType === 'PROJECT_BUDGET_EDITED').length;
    const adjustments = logs.filter((l) => l.eventType === 'ATTENDANCE_ADJUSTED').length;
    return { total, downloads, budgets, adjustments };
  }, [logs]);

  // Filtrado de Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedEventType !== 'ALL' && log.eventType !== selectedEventType) return false;
      if (selectedFormat !== 'ALL' && log.format !== selectedFormat) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.actorName.toLowerCase().includes(q) ||
          log.actorEmail.toLowerCase().includes(q) ||
          log.targetResource.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          (log.targetUserName && log.targetUserName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, selectedEventType, selectedFormat, searchQuery]);

  // Exportar registros a formato CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      addToast('No hay registros para exportar.', 'info');
      return;
    }

    const headers = [
      'ID',
      'Fecha',
      'Hora',
      'Evento',
      'Usuario Actor',
      'Email',
      'Rol',
      'Recurso Afectado',
      'Formato',
      'Detalles',
      'Valor Anterior',
      'Valor Nuevo',
    ];

    const rows = filteredLogs.map((l) => {
      const d = new Date(l.timestamp);
      return [
        l.id,
        d.toLocaleDateString('es-MX'),
        d.toLocaleTimeString('es-MX'),
        l.eventType,
        `"${l.actorName}"`,
        l.actorEmail,
        l.actorRole,
        `"${l.targetResource}"`,
        l.format || 'N/A',
        `"${l.details}"`,
        `"${l.previousValue || ''}"`,
        `"${l.newValue || ''}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Bitacora_Auditoria_Ejecutiva_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Bitácora de movimientos exportada en CSV exitosamente.', 'success');
  };

  const getEventBadge = (type: AuditEventType) => {
    switch (type) {
      case 'REPORT_DOWNLOADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
            <Download className="w-3 h-3" />
            Descarga de Informe
          </span>
        );
      case 'PROJECT_BUDGET_EDITED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
            <DollarSign className="w-3 h-3" />
            Ajuste de Presupuesto
          </span>
        );
      case 'STATUS_CHANGED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
            <Activity className="w-3 h-3" />
            Cambio de Estado
          </span>
        );
      case 'ATTENDANCE_ADJUSTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
            <Clock className="w-3 h-3" />
            Ajuste Asistencia / RH
          </span>
        );
      case 'INVITATION_CREATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
            <User className="w-3 h-3" />
            Invitación Emitida
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Editorial */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#101726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Bitácora de Auditoría Ejecutiva (Socio / Jefatura)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Registro inmutable de movimientos críticos: descargas de informes financieros, cambios presupuestales y ajustes de jornadas.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Exportar Bitácora CSV
        </button>
      </div>

      {/* 4 Métricas de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#101726] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Eventos
            </span>
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {metrics.total}
          </p>
          <span className="text-[11px] text-slate-400">Registrados en el sistema</span>
        </div>

        <div className="bg-white dark:bg-[#101726] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Informes Descargados
            </span>
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.downloads}
          </p>
          <span className="text-[11px] text-slate-400">Por Gerencia y Socios</span>
        </div>

        <div className="bg-white dark:bg-[#101726] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ajustes de Presupuesto
            </span>
            <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {metrics.budgets}
          </p>
          <span className="text-[11px] text-slate-400">Horas y costos de proyectos</span>
        </div>

        <div className="bg-white dark:bg-[#101726] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ajustes de Asistencia
            </span>
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
            {metrics.adjustments}
          </p>
          <span className="text-[11px] text-slate-400">Incidencias y justificaciones RH</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-[#101726] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por usuario, proyecto, recurso o detalle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value as 'ALL' | AuditEventType)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Todos los Movimientos</option>
              <option value="REPORT_DOWNLOADED">Descargas de Informes</option>
              <option value="PROJECT_BUDGET_EDITED">Ajustes de Presupuesto</option>
              <option value="STATUS_CHANGED">Cambios de Estado</option>
              <option value="ATTENDANCE_ADJUSTED">Ajustes de Asistencia / RH</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as 'ALL' | 'PDF' | 'Excel')}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Todos los Formatos</option>
              <option value="Excel">Excel (.xlsx)</option>
              <option value="PDF">PDF Institucional</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div data-tour="audit-log-table" className="bg-white dark:bg-[#101726] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Fecha y Hora</th>
                <th className="py-3.5 px-4">Tipo de Movimiento</th>
                <th className="py-3.5 px-4">Usuario Responsable</th>
                <th className="py-3.5 px-4">Recurso / Proyecto</th>
                <th className="py-3.5 px-4">Detalle / Modificación</th>
                <th className="py-3.5 px-4">Formato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No se encontraron movimientos registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const dateStr = dateObj.toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const timeStr = dateObj.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      {/* Fecha y Hora */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 ml-5">{timeStr}</span>
                      </td>

                      {/* Tipo de Evento */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getEventBadge(log.eventType)}
                      </td>

                      {/* Usuario Responsable */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={log.actorName}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.actorName}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {log.actorRole} • {log.actorEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Recurso / Proyecto */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {log.targetResource}
                        </span>
                        {log.targetUserName && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Colaborador: {log.targetUserName}
                          </p>
                        )}
                      </td>

                      {/* Detalle / Modificación */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-600 dark:text-slate-300 text-xs">
                          {log.details}
                        </p>
                        {log.previousValue && log.newValue && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                            <span className="line-through text-slate-400">
                              {log.previousValue}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {log.newValue}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Formato */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.format ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.format === 'Excel'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            }`}
                          >
                            {log.format}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
