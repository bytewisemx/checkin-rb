import { useState, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useHelpTourStore } from '../../store/useHelpTourStore';
import { normalizeRole } from '../../services/rbac';
import { HELP_CATALOG } from '../../config/helpGuides';
import { Search, Compass, ChevronRight, Sparkles, X } from 'lucide-react';

export function HelpDrawer() {
  const { user } = useCheckinStore();
  const { isHelpDrawerOpen, closeHelpDrawer, startTour } = useHelpTourStore();
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedRole = normalizeRole(user?.role);
  const questionsForRole = useMemo(() => {
    return HELP_CATALOG[normalizedRole] || [];
  }, [normalizedRole]);

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questionsForRole;
    const q = searchQuery.toLowerCase();
    return questionsForRole.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [questionsForRole, searchQuery]);

  if (!isHelpDrawerOpen) return null;

  return (
    <>
      {/* Backdrop con desenfoque suave */}
      <div 
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-xs z-50 animate-fade-in"
        onClick={closeHelpDrawer}
        aria-hidden="true"
      />

      {/* Drawer Lateral de Ayuda */}
      <div 
        id="helpDrawer" 
        className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-[#131D31] text-slate-800 dark:text-slate-100 p-6 shadow-2xl z-50 border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between animate-slide-left overflow-hidden"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Cabecera del Drawer */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Guías y Asistencia
                </h3>
                <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-blue-700 dark:text-sky-400">
                  Rol Activo: {normalizedRole}
                </span>
              </div>
            </div>
            <button 
              id="closeHelpDrawer" 
              onClick={closeHelpDrawer}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A2742] transition-colors cursor-pointer"
              aria-label="Cerrar panel de ayuda"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buscador Rápido de Preguntas Frecuentes */}
          <div className="mt-4 shrink-0">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                id="searchHelpInput" 
                placeholder="¿Qué necesitas hacer?..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0B111E] text-xs sm:text-sm text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 pl-9 pr-3 py-2 rounded-lg focus:outline-hidden focus:border-blue-600 dark:focus:border-sky-400 transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Lista de Preguntas por Rol (Área scrolleable) */}
          <div 
            id="helpQuestionsList" 
            className="mt-5 space-y-2.5 overflow-y-auto flex-1 pr-1"
          >
            {filteredQuestions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No encontramos guías para "<strong className="text-slate-700 dark:text-slate-200">{searchQuery}</strong>". Intenta con otra palabra clave.
              </div>
            ) : (
              filteredQuestions.map((guide) => (
                <button
                  key={guide.id}
                  onClick={() => startTour(guide)}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-[#233354] bg-slate-50/60 dark:bg-[#1A2742]/40 hover:bg-blue-50/60 dark:hover:bg-[#1E40AF]/20 hover:border-blue-400 dark:hover:border-sky-400/50 transition-all cursor-pointer group flex items-start justify-between space-x-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-heading font-semibold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-sky-300 transition-colors leading-snug">
                      {guide.question}
                    </h4>
                    {guide.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {guide.description}
                      </p>
                    )}
                    <span className="inline-flex items-center space-x-1 mt-2 text-[10px] font-heading font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400">
                      <Sparkles className="w-3 h-3 text-current" />
                      <span>{guide.steps.length} {guide.steps.length === 1 ? 'Paso guiado' : 'Pasos guiados'}</span>
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-sky-300 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                </button>
              ))
            )}
          </div>

          {/* Footer Informativo del Drawer */}
          <div className="pt-4 mt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            Al seleccionar una pregunta, se iniciará un recorrido visual en vivo guiándote directamente sobre los controles de la pantalla.
          </div>
        </div>
      </div>
    </>
  );
}

