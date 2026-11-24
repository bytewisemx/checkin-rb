import { useState } from 'react';
import {
  X,
  Send,
  ExternalLink,
  Calendar,
  MapPin,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import type { TaskNode, TaskNote } from '../../types/rayoner';
import { CompanyLogoBadge } from '../../components/common/CompanyLogoBadge';
import { formatMinutesSexagesimal } from '../../services/attendanceService';
import { useCheckinStore } from '../../store/useCheckinStore';

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode | null;
  companyName: string;
  projectName: string;
  companyLogoUrl?: string;
  allocatedMinutes: number;
  actualMinutes: number;
  isCurrentlyActive: boolean;
  activeSecondsRunning?: number;
  onAddNote: (note: { text: string; linkUrl?: string }) => void;
  onFinalizeTask?: () => void;
  onAdjustTime?: (newMinutes: number, reason: string) => Promise<void> | void;
}

export function TaskDetailDrawer({
  isOpen,
  onClose,
  task,
  companyName,
  projectName,
  companyLogoUrl,
  allocatedMinutes,
  actualMinutes,
  isCurrentlyActive,
  activeSecondsRunning = 0,
  onAddNote,
  onFinalizeTask,
  onAdjustTime,
}: TaskDetailDrawerProps) {
  const activeCheckin = useCheckinStore((state) => state.activeCheckin);
  const addToast = useCheckinStore((state) => state.addToast);

  const [noteText, setNoteText] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados del formulario de modificación manual de tiempo
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editHours, setEditHours] = useState(0);
  const [editMins, setEditMins] = useState(0);
  const [editReason, setEditReason] = useState('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [showAdjustmentDetails, setShowAdjustmentDetails] = useState(false);

  if (!isOpen || !task) return null;

  const liveMinutes = isCurrentlyActive ? Math.floor(activeSecondsRunning / 60) : 0;
  const totalDisplayActualMinutes = actualMinutes + liveMinutes;
  const percentConsumed =
    allocatedMinutes > 0
      ? Math.round((totalDisplayActualMinutes / allocatedMinutes) * 100)
      : 0;

  // Horas sin asignar en la jornada general (informativo de referencia)
  const shiftElapsedMinutes = activeCheckin?.checkInTimeMs
    ? Math.floor((Date.now() - activeCheckin.checkInTimeMs) / 60000)
    : activeCheckin?.workdayTotalSeconds
    ? Math.floor(activeCheckin.workdayTotalSeconds / 60)
    : (activeCheckin?.totalDurationMinutes || 0);
  const unassignedShiftMinutes = Math.max(0, shiftElapsedMinutes - totalDisplayActualMinutes);

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    try {
      onAddNote({
        text: noteText.trim(),
        linkUrl: noteUrl.trim() || undefined,
      });
      setNoteText('');
      setNoteUrl('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditTime = () => {
    setIsEditingTime(true);
    setEditHours(Math.floor(totalDisplayActualMinutes / 60));
    setEditMins(totalDisplayActualMinutes % 60);
    setEditReason('');
  };

  const handleSaveAdjustment = async () => {
    if (!editReason.trim()) {
      addToast('Debes ingresar un motivo obligatorio para el ajuste.', 'error');
      return;
    }

    const newTotalMinutes = Math.max(0, editHours * 60 + editMins);
    setIsSavingAdjustment(true);
    try {
      if (onAdjustTime) {
        await onAdjustTime(newTotalMinutes, editReason.trim());
      }
      setIsEditingTime(false);
    } catch {
      addToast('Error al guardar el ajuste de tiempo.', 'error');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const notesList: TaskNote[] = Array.isArray(task.notes) ? task.notes : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl bg-white dark:bg-[#0B111E] border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-left text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CompanyLogoBadge
                name={companyName}
                logoUrl={companyLogoUrl}
                size="md"
                className="mt-1 shrink-0"
              />
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-sky-400 block">
                  Expediente de Tarea
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {task.title || task.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {companyName} • {projectName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ============================================================ */}
          {/* DESGLOSE CLARO DE HORAS Y BOTÓN MODIFICAR TIEMPO */}
          {/* ============================================================ */}
          <div className={`p-4 rounded-xl border transition-all space-y-3 ${
            isCurrentlyActive
              ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-600/40'
              : 'bg-slate-50 dark:bg-[#0D1320] border-slate-200 dark:border-slate-800/80'
          }`}>
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Desglose de Horas Invertidas
                </span>
                {isCurrentlyActive && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-700 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En curso ahora
                  </span>
                )}
              </div>

              {/* Botón Modificar Tiempo Invertido */}
              {onAdjustTime && !isEditingTime && (
                <button
                  type="button"
                  onClick={handleOpenEditTime}
                  className="border border-blue-300 text-blue-800 hover:bg-blue-50 dark:border-blue-700 dark:text-sky-300 dark:hover:bg-blue-950/40 text-xs font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Modificar Tiempo Invertido
                </button>
              )}
            </div>

            {/* Cuadrícula de Desglose de Horas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              
              {/* 1. Tiempo registrado por cronómetro */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold uppercase tracking-wider">
                  Cronometrado Directo
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                  {formatMinutesSexagesimal(actualMinutes)}
                </span>
              </div>

              {/* 2. Horas sin asignar en la jornada (Referencia) */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold uppercase tracking-wider flex items-center gap-1">
                  <span>Sin Asignar (Jornada)</span>
                  <span title="Tiempo de jornada general no vinculado a tareas específicas">
                    <Info className="w-3 h-3 text-slate-400 cursor-help" />
                  </span>
                </span>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums block mt-0.5">
                  {formatMinutesSexagesimal(unassignedShiftMinutes)}
                </span>
              </div>

              {/* 3. Tiempo Total Contabilizado en la Tarea */}
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900">
                <span className="text-[10px] text-blue-800 dark:text-sky-300 block font-bold uppercase tracking-wider">
                  Total Contabilizado
                </span>
                <span className="text-sm font-bold text-blue-950 dark:text-white tabular-nums block mt-0.5">
                  {formatMinutesSexagesimal(totalDisplayActualMinutes)}
                </span>
              </div>

            </div>

            {/* Barra de Progreso y Presupuesto */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Avance frente al presupuesto estimado:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {formatMinutesSexagesimal(totalDisplayActualMinutes)}{' '}
                  <span className="text-slate-400 font-normal">
                    / {allocatedMinutes > 0 ? formatMinutesSexagesimal(allocatedMinutes) : 'Sin estimación'}
                  </span>
                  {' '}({percentConsumed}%)
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    percentConsumed > 100
                      ? 'bg-rose-600'
                      : 'bg-blue-700 dark:bg-sky-400'
                  }`}
                  style={{ width: `${Math.min(100, percentConsumed || 4)}%` }}
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/* ETIQUETA OBLIGATORIA: Modificado de manera manual */}
            {/* ============================================================ */}
            {task.isManuallyModified && task.manualAdjustment && (
              <div className="mt-2 p-2.5 rounded-lg bg-blue-50/90 dark:bg-slate-800/90 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 font-bold text-blue-900 dark:text-sky-300 text-[11px]">
                    <FileEdit className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400 shrink-0" />
                    <span>Modificado de manera manual</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentDetails(!showAdjustmentDetails)}
                    className="text-[10px] font-semibold text-blue-700 dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{showAdjustmentDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
                    {showAdjustmentDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showAdjustmentDetails && (
                  <div className="pt-2 border-t border-blue-200/60 dark:border-slate-700 space-y-1 text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tiempo original:</span>
                      <span className="font-semibold tabular-nums">
                        {formatMinutesSexagesimal(Math.round(task.manualAdjustment.previousSeconds / 60))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tiempo ajustado:</span>
                      <span className="font-semibold text-blue-800 dark:text-sky-300 tabular-nums">
                        {formatMinutesSexagesimal(Math.round(task.manualAdjustment.adjustedSeconds / 60))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modificado por:</span>
                      <span className="font-semibold">{task.manualAdjustment.modifiedByName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha de modificación:</span>
                      <span className="tabular-nums">
                        {new Date(task.manualAdjustment.modifiedAt).toLocaleString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-slate-500 block">Motivo:</span>
                      <p className="italic text-slate-800 dark:text-slate-200 mt-0.5 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                        "{task.manualAdjustment.reason}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* FORMULARIO DE AJUSTE MANUAL DE TIEMPO */}
            {/* ============================================================ */}
            {isEditingTime && (
              <div className="mt-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-700 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 dark:text-sky-300 uppercase tracking-wider">
                    Captura de Tiempo Real Invertido
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingTime(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Horas
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editHours}
                      onChange={(e) => setEditHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Minutos
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editMins}
                      onChange={(e) => setEditMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Motivo del Ajuste (Obligatorio) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Ej. Olvidé cambiar de actividad en el cronómetro al revisar balanza..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditingTime(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingAdjustment || !editReason.trim()}
                    onClick={handleSaveAdjustment}
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    {isSavingAdjustment ? 'Guardando...' : 'Guardar Tiempo Ajustado'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Metadatos de la Tarea y Responsable de Actividad */}
        <div className="grid grid-cols-2 gap-3.5 my-3 text-xs border-y border-slate-200 dark:border-slate-800/80 py-3.5">
          <div>
            <span className="text-xs text-slate-400 block mb-1">
              Responsable de Actividad
            </span>
            <span className="font-bold text-blue-900 dark:text-sky-300 flex items-center gap-1.5 truncate">
              <span className="truncate">
                {task.leadUserName || task.assignedToName || 'Colaborador asignado'}
              </span>
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">
              Fase y Perfil
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {(task as any).fase || 'Operativa'} • {(task as any).perfilSugerido || 'Staff'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">
              Ubicación Asignada
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {task.locationMode === 'client_site'
                  ? `Oficina de Cliente${task.locationAddress ? ` (${task.locationAddress})` : ''}`
                  : 'En Oficina (Despacho)'}
              </span>
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">
              Prioridad
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
              {task.priority === 'urgent'
                ? 'Urgente'
                : task.priority === 'high'
                ? 'Alta'
                : task.priority === 'low'
                ? 'Baja'
                : 'Media'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">
              Fecha Límite
            </span>
            <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{task.dueDate || 'No definida'}</span>
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">
              Estado de Flujo
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
              {task.status === 'completed'
                ? 'Finalizada'
                : task.status === 'review'
                ? 'En Revisión (Supervisor)'
                : task.status === 'progress' || task.status === 'in_progress'
                ? 'En Proceso'
                : 'Nueva Tarea Asignada'}
            </span>
          </div>
        </div>

        {/* Descripción de la Tarea si existe */}
        {task.description && (
          <div className="mb-3 text-xs bg-slate-50 dark:bg-[#0D1320] p-3 rounded-md border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">
              Descripción / Alcance
            </span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Alerta de Retorno por el Supervisor */}
        {task.status === 'review' && task.supervisorReviewNote && (
          <div className="mb-3 p-3 rounded-md border-l-2 border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <span className="font-bold block">Observación del Supervisor:</span>
            <p className="text-xs leading-relaxed">{task.supervisorReviewNote}</p>
          </div>
        )}

        {/* Bitácora de Avances y Notas de Seguimiento */}
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Bitácora de Avances y Evidencias ({notesList.length})
            </span>
          </div>

          {/* Formulario para Agregar Nota / Evidencia */}
          <form onSubmit={handleSubmitNote} className="space-y-2 bg-slate-50 dark:bg-[#0D1320] p-3 rounded-md border border-slate-200 dark:border-slate-800">
            <textarea
              rows={2}
              required
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribe un avance, observación o resumen del trabajo realizado..."
              className="w-full text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 p-2.5 rounded-md outline-none focus:border-blue-700 resize-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={noteUrl}
                onChange={(e) => setNoteUrl(e.target.value)}
                placeholder="Enlace de evidencia (Drive, OneDrive, PR... opcional)"
                className="flex-1 text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 rounded-md outline-none focus:border-blue-700"
              />
              <button
                type="submit"
                disabled={isSubmitting || !noteText.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Registrar</span>
              </button>
            </div>
          </form>

          {/* Lista de Notas Históricas */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {notesList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No hay notas registradas en esta bitácora aún.
              </div>
            ) : (
              notesList.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#101726] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {note.authorName} {note.authorRole ? `(${note.authorRole})` : ''}
                    </span>
                    <span className="text-xs tabular-nums">
                      {new Date(note.createdAt).toLocaleString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {note.text}
                  </p>
                  {note.linkUrl && (
                    <a
                      href={note.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-sky-400 hover:underline pt-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver enlace de evidencia</span>
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {onFinalizeTask && task.status !== 'completed' && task.status !== 'review' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onFinalizeTask();
              }}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Finalizar y Enviar a Revisión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
