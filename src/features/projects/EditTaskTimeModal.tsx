import { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle2, X, AlertCircle, Building2, 
  Briefcase, Lock, AlertTriangle, ArrowLeft
} from 'lucide-react';
import type { TaskNode } from '../../types/rayoner';

interface EditTaskTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode | null;
  clientName: string;
  projectName: string;
  currentHours: number;
  allocatedHours: number;
  onSaveHours: (newHours: number) => void;
  onFinalizeTask: (finalHours: number) => void;
}

export function EditTaskTimeModal({
  isOpen,
  onClose,
  task,
  clientName,
  projectName,
  currentHours,
  allocatedHours,
  onSaveHours,
  onFinalizeTask,
}: EditTaskTimeModalProps) {
  const [hoursInput, setHoursInput] = useState<string>('');
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isConfirmingFinalize, setIsConfirmingFinalize] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && task) {
      setHoursInput(currentHours.toString());
      setAdjustmentNote('');
      setErrorMsg('');
      setIsConfirmingFinalize(false);
    }
  }, [isOpen, task, currentHours]);

  if (!isOpen || !task) return null;

  const isAlreadyCompleted = task.status === 'completed';

  const parsedHours = parseFloat(hoursInput);
  const isValidNumber = !isNaN(parsedHours) && parsedHours >= 0;

  const handleSaveOnly = () => {
    if (isAlreadyCompleted) return;
    if (!isValidNumber) {
      setErrorMsg('Por favor ingresa un número de horas válido (mayor o igual a 0).');
      return;
    }
    onSaveHours(parsedHours);
    onClose();
  };

  const handlePromptFinalize = () => {
    if (isAlreadyCompleted) return;
    if (!isValidNumber) {
      setErrorMsg('Por favor ingresa un número de horas válido antes de finalizar.');
      return;
    }
    setIsConfirmingFinalize(true);
  };

  const handleConfirmFinalize = () => {
    if (isAlreadyCompleted) return;
    if (!isValidNumber) {
      setErrorMsg('Por favor ingresa un número de horas válido.');
      return;
    }
    onFinalizeTask(parsedHours);
    onClose();
  };

  // Cálculo de diferencia con respecto al valor previo
  const diff = isValidNumber ? Number((parsedHours - currentHours).toFixed(2)) : 0;
  const isOverAllocated = isValidNumber && allocatedHours > 0 && parsedHours > allocatedHours;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
        
        {/* Cabecera */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-md flex items-center justify-center border ${
              isAlreadyCompleted
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : isConfirmingFinalize
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-blue-900/40 text-blue-300 border-blue-700/40'
            }`}>
              {isAlreadyCompleted ? (
                <Lock className="w-4 h-4 text-slate-300" />
              ) : isConfirmingFinalize ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <Clock className="w-4 h-4 text-blue-300" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight">
                {isAlreadyCompleted 
                  ? 'Tarea Finalizada (Tiempo Bloqueado)' 
                  : isConfirmingFinalize 
                    ? 'Confirmar Cierre Definitivo' 
                    : 'Ajustar Tiempo Invertido'}
              </h3>
              <p className="text-xs text-slate-300">
                {isAlreadyCompleted
                  ? 'El registro de horas es definitivo y no admite cambios'
                  : isConfirmingFinalize
                    ? 'Una vez finalizada ya no se podrá modificar el tiempo'
                    : 'Ajusta las horas trabajadas en esta tarea'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          
          {/* Caso 1: Tarea ya completada (Bloqueo absoluto) */}
          {isAlreadyCompleted && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-start space-x-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-700 shrink-0">
                <Lock className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                  Registro Bloqueado y Auditado
                </h5>
                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                  Esta tarea ya fue finalizada. Por políticas de auditoría y control de tiempos, <strong>el tiempo invertido ya no puede ser modificado</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Caso 2: Confirmación previa a la finalización definitiva */}
          {isConfirmingFinalize && !isAlreadyCompleted && (
            <div className="bg-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 flex items-start space-x-3 animate-scale-up">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center">
                  <span>Confirmación de Cierre Definitivo</span>
                  <Lock className="w-3 h-3 ml-1.5 text-amber-700" />
                </h5>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  Una vez finalizada la tarea, <strong>ya no se podrá modificar el tiempo</strong>. El registro final quedará sellado con <strong>{parsedHours} horas</strong>. ¿Estás seguro de que deseas concluirla ahora?
                </p>
              </div>
            </div>
          )}

          {/* Tarjeta de Resumen de la Tarea y Empresa */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <span className="flex items-center font-bold text-[#0D5C75] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                <Building2 className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" />
                {clientName}
              </span>
              <span>•</span>
              <span className="flex items-center text-slate-500 font-medium truncate">
                <Briefcase className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {projectName}
              </span>
            </div>

            <h4 className="font-bold text-slate-800 text-sm leading-snug">
              {task.name}
            </h4>

            {task.description && (
              <p className="text-xs text-slate-500 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Presupuesto Asignado */}
            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200/60">
              <span className="text-slate-500">Horas Presupuestadas:</span>
              <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {allocatedHours > 0 ? `${allocatedHours}h` : 'Sin límite fijado'}
              </span>
            </div>
          </div>

          {/* Campo de Edición de Horas (Oculto o bloqueado si ya está finalizada) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isAlreadyCompleted ? 'Horas Totales Invertidas (Inmutables)' : 'Horas Reales Invertidas en esta Tarea'}
            </label>
            
            <div className="relative">
              <input
                type="number"
                step="0.25"
                min="0"
                disabled={isAlreadyCompleted}
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                placeholder="0.0"
                className={`w-full pl-4 pr-16 py-3 rounded-xl text-lg font-bold transition-all ${
                  isAlreadyCompleted
                    ? 'bg-slate-100 text-slate-500 border border-slate-300 cursor-not-allowed'
                    : 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75]'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                horas
              </span>
            </div>

            {/* Comparativa y Explicación rápida */}
            {!isAlreadyCompleted && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-500">
                  Horas previas registradas: <strong className="text-slate-700">{currentHours}h</strong>
                </span>
                {isValidNumber && diff !== 0 && (
                  <span className={`font-bold ${diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {diff > 0 ? `+${diff}h adicionales` : `${diff}h reducidas`}
                  </span>
                )}
              </div>
            )}

            {isOverAllocated && !isAlreadyCompleted && (
              <div className="flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Atención: El tiempo ingresado ({parsedHours}h) excede el presupuesto ({allocatedHours}h).
                </span>
              </div>
            )}

            {errorMsg && (
              <p className="text-xs font-semibold text-rose-600">{errorMsg}</p>
            )}
          </div>

            {/* Justificación o Nota Opcional */}
          {!isAlreadyCompleted && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">
                Motivo o Nota del Ajuste <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                placeholder="Ej. Terminé la conciliación antes de lo previsto"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
              />

              {/* Advertencia Informativa de Gamificación */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 flex items-start space-x-2 text-[11px] text-amber-800 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso de Puntos:</strong> Las horas agregadas por ajuste manual no generan el bono de tiempo en vivo (+40 pts) en tu medalla mensual. Procura registrar tu jornada usando el cronómetro en vivo.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Botones de Acción */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {isAlreadyCompleted ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto ml-auto px-5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          ) : isConfirmingFinalize ? (
            <>
              <button
                type="button"
                onClick={() => setIsConfirmingFinalize(false)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition rounded-md shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Volver a Editar</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmFinalize}
                className="inline-flex items-center justify-center space-x-2 px-4.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition rounded-md shadow-2xs cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sí, Confirmar y Finalizar Definitivamente</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition rounded-md shadow-2xs cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                {/* Guardar solo ajuste de tiempo sin finalizar */}
                <button
                  type="button"
                  onClick={handleSaveOnly}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition rounded-md shadow-2xs cursor-pointer"
                >
                  Guardar Tiempo
                </button>

                {/* Abrir Confirmación para Finalizar Tarea */}
                <button
                  type="button"
                  onClick={handlePromptFinalize}
                  className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-300 hover:bg-slate-200 transition rounded-md shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                  <span>Finalizar Tarea</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
