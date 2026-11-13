import { useState, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useHelpTourStore } from '../../store/useHelpTourStore';
import { normalizeRole } from '../../services/rbac';
import { getInteractiveGuidesForRole } from '../../config/interactiveGuidesConfig';
import { Search, ChevronRight, X } from 'lucide-react';

export function HelpDrawer() {
  const { user } = useCheckinStore();
  const { isHelpDrawerOpen, closeHelpDrawer, startTour } = useHelpTourStore();
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedRole = normalizeRole(user?.role);
  const questionsForRole = useMemo(() => {
    return getInteractiveGuidesForRole(user?.role);
  }, [user?.role]);

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questionsForRole;
    const q = searchQuery.toLowerCase();
    return questionsForRole.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [questionsForRole, searchQuery]);

  if (!isHelpDrawerOpen) return null;

  return (
    <>
      {/* Fondo translúcido sutil para cerrar */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9980] animate-fade-in"
        onClick={closeHelpDrawer}
        aria-hidden="true"
      />

      {/* Drawer Lateral de Asistencia y Guías */}
      <div 
        id="helpDrawer" 
        className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white text-slate-800 p-6 shadow-2xl z-[9985] border-l border-slate-200 flex flex-col justify-between animate-slide-left overflow-hidden font-sans"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Cabecera Limpia y Corporativa (Sin Iconos Pesados en Título) */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Asistencia y Guías Interactivas
              </h3>
              <p className="text-xs font-semibold text-blue-700 mt-0.5">
                Rol: {normalizedRole}
              </p>
            </div>
            <button 
              id="closeHelpDrawer" 
              onClick={closeHelpDrawer}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Cerrar panel de ayuda"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buscador Rápido de Guías */}
          <div className="mt-4 shrink-0">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                id="searchHelpInput" 
                placeholder="Buscar guía interactiva o función..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 text-xs sm:text-sm text-slate-900 border border-slate-300 pl-9 pr-3 py-2 rounded-lg focus:outline-hidden focus:border-blue-700 transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Lista de Recorridos Interactivos Segmentados */}
          <div 
            id="helpQuestionsList" 
            className="mt-5 space-y-2.5 overflow-y-auto flex-1 pr-1"
          >
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No encontramos guías para "<strong className="text-slate-800">{searchQuery}</strong>". Intenta con otra palabra o explora las opciones de tu perfil.
              </div>
            ) : (
              filteredQuestions.map((guide) => (
                <button
                  key={guide.id}
                  onClick={() => startTour(guide)}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/60 hover:border-blue-600 transition-all cursor-pointer group flex items-start justify-between space-x-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-800 transition-colors leading-snug">
                      {guide.title}
                    </h4>
                    {guide.description && (
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {guide.description}
                      </p>
                    )}
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      {guide.steps.length} {guide.steps.length === 1 ? 'Paso guiado' : 'Pasos guiados'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>

          {/* Footer Informativo Corporativo */}
          <div className="pt-3 mt-3 border-t border-slate-200 text-[11px] text-slate-500 shrink-0">
            El recorrido interactivo resaltará los elementos directamente en pantalla sin bloquear tus clics ni la interacción con la plataforma.
          </div>
        </div>
      </div>
    </>
  );
}
