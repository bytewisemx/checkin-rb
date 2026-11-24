import { useState } from 'react';
import { CheckCircle2, X, ShieldCheck } from 'lucide-react';
import type { TaskNode } from '../../types/rayoner';
import { useCheckinStore } from '../../store/useCheckinStore';
import { finalizeTaskReviewInFirestore } from '../../services/taskService';

interface FinalizeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode | null;
  projectName?: string;
  companyName?: string;
  onSuccess?: () => void;
}

export function FinalizeReviewModal({
  isOpen,
  onClose,
  task,
  projectName,
  companyName,
  onSuccess,
}: FinalizeReviewModalProps) {
  const { user, addToast } = useCheckinStore();
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !task) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await finalizeTaskReviewInFirestore({
        taskId: task.id,
        projectId: task.projectId,
        taskTitle: task.name,
        projectName,
        companyName,
        reviewer: {
          uid: user?.id || 'uid_revisor',
          name: user?.name || 'Supervisor',
          role: user?.role || 'supervisor',
        },
        reviewNotes,
      });

      if (res.success) {
        addToast(`Revisión finalizada y aprobada para "${task.name}".`, 'success');
        setReviewNotes('');
        onSuccess?.();
        onClose();
      } else {
        addToast(res.error || 'Ocurrió un error al finalizar la revisión.', 'error');
      }
    } catch (err: any) {
      console.error('Error al finalizar revisión:', err);
      addToast('Error de red al registrar la aprobación.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Finalizar Revisión de Tarea
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aprobación de trabajo y cierre oficial al 100%
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Actividad / Tarea a Aprobar
            </span>
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
              {task.name}
            </p>
            {(projectName || companyName) && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {companyName ? `${companyName} • ` : ''}
                {projectName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Observaciones de Revisión <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Ej. Papeles de trabajo cotejados con evidencia. Aprobado sin hallazgos."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-none"
            />
          </div>

          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-lg border border-blue-200/80 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-300 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              Al confirmar, la tarea quedará marcada con estado <strong>Completada</strong> y <strong>Revisión Finalizada</strong>, se detendrá cualquier cronómetro activo y se actualizará el avance del servicio.
            </span>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Aprobando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                  <span>Finalizar Revisión</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
