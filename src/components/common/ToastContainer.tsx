import { useCheckinStore } from '../../store/useCheckinStore';
import { X, Check, Info, AlertCircle } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useCheckinStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none space-y-2 w-auto max-w-lg px-4">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className="pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#001E2E]/95 text-white shadow-2xl backdrop-blur-md animate-fade-in transition-all select-none border-0"
        >
          {/* Icono flotante sin marcos */}
          <div className="shrink-0 flex items-center justify-center">
            {toast.type === 'success' && (
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            )}
            {toast.type === 'error' && (
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            )}
            {toast.type === 'info' && (
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Info className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            )}
          </div>

          {/* Mensaje directo */}
          <p className="text-xs font-semibold text-slate-100 pr-1 tracking-wide">
            {toast.message}
          </p>

          {/* Botón X flotante sin recuadros */}
          <button 
            type="button"
            onClick={() => removeToast(toast.id)} 
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded-full ml-1"
            title="Cerrar notificación"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
