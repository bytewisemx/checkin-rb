import { useCheckinStore } from '../../store/useCheckinStore';
import { X, CheckCircle, Info, AlertCircle } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useCheckinStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm w-full">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`p-4 rounded-xl shadow-lg border flex items-start animate-fade-in bg-white ${
            toast.type === 'success' ? 'border-green-200' :
            toast.type === 'error' ? 'border-red-200' : 'border-blue-200'
          }`}
        >
          <div className="mr-3 mt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              toast.type === 'success' ? 'text-green-800' :
              toast.type === 'error' ? 'text-red-800' : 'text-blue-800'
            }`}>
              {toast.message}
            </p>
          </div>
          <button 
            onClick={() => removeToast(toast.id)} 
            className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
