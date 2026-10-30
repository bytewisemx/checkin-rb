import { useState, useEffect } from 'react';
import { 
  CheckCircle2, X, AlertTriangle, Building2, 
  Briefcase, Lock, Sparkles, Plus, Minus
} from 'lucide-react';
import type { TaskNode } from '../../types/rayoner';

interface FinalizeTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode | null;
  clientName: string;
  projectName: string;
  currentHours: number;
  allocatedHours: number;
  onConfirmFinalize: (finalHours: number, note?: string) => void;
}

export function FinalizeTaskModal({
  isOpen,
  onClose,
  task,
  clientName,
  projectName,
  currentHours,
  allocatedHours,
  onConfirmFinalize,
}: FinalizeTaskModalProps) {
  const [hoursInput, setHoursInput] = useState<string>('');
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen && task) {
      setHoursInput(currentHours.toString());
      setDeliveryNote('');
      setErrorMsg('');
    }
  }, [isOpen, task, currentHours]);

  if (!isOpen || !task) return null;

  const parsedHours = parseFloat(hoursInput);
  const isValidNumber = !isNaN(parsedHours) && parsedHours >= 0;

  const handleAdjustStep = (delta: number) => {
    const currentVal = isValidNumber ? parsedHours : 0;
    const nextVal = Math.max(0, Number((currentVal + delta).toFixed(2)));
    setHoursInput(nextVal.toString());
    setErrorMsg('');
  };

  const handleConfirm = () => {
    if (!isValidNumber) {
      setErrorMsg('Por favor ingresa un número válido de horas (0 o superior).');
      return;
    }

    onConfirmFinalize(parsedHours, deliveryNote.trim());
    onClose();
  };

  const diff = isValidNumber ? Number((parsedHours - currentHours).toFixed(2)) : 0;
  const isOverAllocated = isValidNumber && allocatedHours > 0 && parsedHours > allocatedHours;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col animate-scale-up">
        
        {/* Encabezado con Identidad Russell Bedford y Énfasis de Cierre Definitivo */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-md bg-blue-900/40 text-blue-300 flex items-center justify-center border border-blue-700/40">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-white tracking-tight">
                  Finalizar Tarea
                </h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                  Cierre Final
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Revisa y confirma los últimos ajustes de tiempo invertido
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            title="Cancelar y volver"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          
          {/* Recuadro de Advertencia Crucial: Inmutabilidad Posterior */}
          <div className="bg-amber-500/10 border-2 border-amber-400/60 rounded-2xl p-4 flex items-start space-x-3 shadow-xs">
            <div className="p-1.5 bg-amber-500/20 rounded-xl text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center">
                <span>Aviso de Irreversibilidad</span>
                <Lock className="w-3 h-3 ml-1.5 text-amber-700" />
              </h5>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Una vez que finalices esta tarea, <strong>ya no se podrá modificar el tiempo invertido</strong> ni regresar su estado. Dale aquí los últimos ajustes necesarios antes de archivarla como concluida.
              </p>
            </div>
          </div>

          {/* Ficha Resumen de la Tarea */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-2">
            <div className="flex items-center space-x-2 text-xs">
              <span className="flex items-center font-bold text-[#0D5C75] bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                <Building2 className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" />
                {clientName}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center text-slate-600 font-semibold truncate">
                <Briefcase className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {projectName}
              </span>
            </div>

            <h4 className="font-bold text-slate-900 text-sm leading-snug">
              {task.name}
            </h4>

            {task.description && (
              <p className="text-xs text-slate-500 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Presupuesto Asignado vs Consumido */}
            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200/80">
              <span className="text-slate-500 font-medium">Presupuesto Asignado:</span>
              <span className="font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                {allocatedHours > 0 ? `${allocatedHours}h autorizadas` : 'Sin límite fijado'}
              </span>
            </div>
          </div>

          {/* Sección de Últimos Ajustes de Tiempo */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <span>Últimos Ajustes de Tiempo</span>
                <Sparkles className="w-3.5 h-3.5 text-[#0D5C75]" />
              </label>
              <span className="text-xs text-slate-500">
                Tiempo actual: <strong className="text-slate-800">{currentHours}h</strong>
              </span>
            </div>

            {/* Input Numérico con botones de Micro-Ajuste */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleAdjustStep(-0.25)}
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0 border border-slate-200"
                title="Restar 15 minutos (-0.25h)"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={hoursInput}
                  onChange={(e) => {
                    setHoursInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="0.0"
                  className="w-full pl-4 pr-16 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-lg font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                  Horas
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleAdjustStep(0.25)}
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0 border border-slate-200"
                title="Añadir 15 minutos (+0.25h)"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Comparativa y Feedback de Ajuste */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-500">
                {diff === 0 ? (
                  'Sin cambios respecto al cronómetro'
                ) : diff > 0 ? (
                  <span className="text-amber-700 font-semibold">
                    +{diff}h adicionales sobre lo medido
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold">
                    {diff}h descontadas (terminaste antes)
                  </span>
                )}
              </span>

              {isOverAllocated && (
                <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Excede presupuesto en {(parsedHours - allocatedHours).toFixed(2)}h
                </span>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Entregable o Nota Final Opcional */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Comentario de Entrega o Cierre <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Ej. Tarea concluida satisfactoriamente, conciliación bancaria enviada al supervisor."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all resize-none"
            />
          </div>

        </div>

        {/* Footer con Acciones */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition rounded-md shadow-2xs cursor-pointer w-full sm:w-auto"
          >
            Cancelar / Continuar Trabajando
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center justify-center space-x-2 px-4.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition rounded-md shadow-2xs cursor-pointer w-full sm:w-auto"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Confirmar y Finalizar Definitivamente</span>
          </button>
        </div>

      </div>
    </div>
  );
}
