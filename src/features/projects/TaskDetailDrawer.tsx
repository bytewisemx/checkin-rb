import { useState } from 'react';
import { X, Send, ExternalLink, Calendar, MapPin } from 'lucide-react';
import type { TaskNode, TaskNote } from '../../types/rayoner';
import { CompanyLogoBadge } from '../../components/common/CompanyLogoBadge';
import { formatMinutesSexagesimal } from '../../services/attendanceService';

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
}: TaskDetailDrawerProps) {
  const [noteText, setNoteText] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !task) return null;

  const liveMinutes = isCurrentlyActive ? Math.floor(activeSecondsRunning / 60) : 0;
  const totalDisplayActualMinutes = actualMinutes + liveMinutes;
  const percentConsumed =
    allocatedMinutes > 0
      ? Math.round((totalDisplayActualMinutes / allocatedMinutes) * 100)
      : 0;

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

  const notesList: TaskNote[] = Array.isArray(task.notes) ? task.notes : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl bg-white dark:bg-[#0B111E] border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-left text-slate-900 dark:text-slate-100"
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
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-blue-700 dark:text-sky-400 block">
                  Expediente de Tarea
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
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
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Estado de Tiempo en Vivo y Avance */}
          <div className={`p-4 rounded-xl border transition-all space-y-3 ${
            isCurrentlyActive
              ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-600/40'
              : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Avance de tiempo:</span>
                {isCurrentlyActive && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-700 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En curso ahora
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
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
        </div>

        {/* Metadatos de la Tarea */}
        <div className="grid grid-cols-2 gap-3 my-3 text-xs border-y border-slate-200 dark:border-slate-800 py-3">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
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
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
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
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
              Fecha Límite
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{task.dueDate || 'No definida'}</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
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
          <div className="mb-3 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Descripción / Alcance
            </span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Alerta de Retorno por el Supervisor */}
        {task.status === 'review' && task.supervisorReviewNote && (
          <div className="mb-3 p-3 rounded-lg border-l-2 border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <span className="font-bold block">Observación del Supervisor:</span>
            <p className="text-[11px] leading-relaxed">{task.supervisorReviewNote}</p>
          </div>
        )}

        {/* Bitácora de Avances y Notas de Seguimiento */}
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Bitácora de Avances y Evidencias ({notesList.length})
            </span>
          </div>

          {/* Formulario para Agregar Nota / Evidencia */}
          <form onSubmit={handleSubmitNote} className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <textarea
              rows={2}
              required
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribe un avance, observación o resumen del trabajo realizado..."
              className="w-full text-xs bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 p-2.5 rounded-lg outline-none focus:border-blue-700 dark:focus:border-sky-400 resize-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={noteUrl}
                onChange={(e) => setNoteUrl(e.target.value)}
                placeholder="Enlace de evidencia (Drive, OneDrive, PR... opcional)"
                className="flex-1 text-xs font-mono bg-white dark:bg-[#101726] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 rounded-lg outline-none focus:border-blue-700 dark:focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={isSubmitting || !noteText.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
                  className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#101726] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {note.authorName} {note.authorRole ? `(${note.authorRole})` : ''}
                    </span>
                    <span className="font-mono text-[10px]">
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
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700 dark:text-sky-400 hover:underline pt-0.5"
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
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Finalizar y Enviar a Revisión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
