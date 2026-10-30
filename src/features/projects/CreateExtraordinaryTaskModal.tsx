import { useState } from 'react';
import { X, Zap, Clock, FileText, Tag, Sparkles } from 'lucide-react';

interface CreateExtraordinaryTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    plannedHours: number;
    category: string;
  }) => void;
}

const CATEGORIES = [
  { id: 'Soporte / Incidencia Urgente', label: 'Soporte / Incidencia Urgente' },
  { id: 'Capacitación y Formación', label: 'Capacitación y Formación' },
  { id: 'Administración y Gestión Interna', label: 'Administración y Gestión Interna' },
  { id: 'Trámite / Contingencia Especial', label: 'Trámite / Contingencia Especial' },
  { id: 'Actividad General Sin Empresa', label: 'Actividad General Sin Empresa' },
];

export function CreateExtraordinaryTaskModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateExtraordinaryTaskModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [plannedHours, setPlannedHours] = useState<number>(3);
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      plannedHours: Math.max(0.5, plannedHours),
      category,
    });

    // Limpiar estado
    setName('');
    setDescription('');
    setPlannedHours(3);
    setCategory(CATEGORIES[0].id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-[#131D31] rounded-md shadow-2xl w-full max-w-lg overflow-hidden border border-[#233354] flex flex-col max-h-[90vh]">
        
        {/* Encabezado sobrio corporativo */}
        <div className="px-6 py-4.5 bg-[#0F172A] border-b border-[#233354] text-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-md bg-[#1A2742] flex items-center justify-center border border-[#233354] text-[#38BDF8]">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-[#F8FAFC]">Nueva Tarea Extraordinaria</h3>
              <p className="text-xs text-[#94A3B8]">Actividad independiente sin empresa asignada</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-md hover:bg-[#1A2742] transition-colors cursor-pointer border border-transparent hover:border-[#233354]"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* Mensaje de Ayuda */}
          <div className="bg-[#1A2742]/70 border border-[#233354] rounded-md p-3.5 flex items-start space-x-3 text-xs text-[#94A3B8]">
            <Sparkles className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Las tareas extraordinarias computan horas de actividades imprevistas, soportes o capacitaciones que no pertenecen a ninguna de las empresas regulares.
            </p>
          </div>

          {/* Nombre de la Tarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <span>Nombre de la Tarea Extraordinaria</span>
              <span className="text-[#E11D48]">*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Soporte urgente de servidores, Capacitación fiscal, etc."
              className="w-full px-3.5 py-2.5 bg-[#1A2742] border border-[#233354] rounded-md text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-hidden transition-all placeholder:text-[#64748B]"
            />
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <Tag className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Categoría de Actividad</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`text-left px-3 py-2 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                    category === cat.id
                      ? 'border-[#38BDF8] bg-[#1E40AF] text-[#F8FAFC] shadow-xs'
                      : 'border-[#233354] bg-[#1A2742] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#38BDF8]/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horas Estimadas */}
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Tiempo Estimado Planificado (Horas)</span>
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="0.5"
                max="80"
                step="0.5"
                value={plannedHours}
                onChange={(e) => setPlannedHours(parseFloat(e.target.value) || 1)}
                className="w-24 px-3 py-2 bg-[#1A2742] border border-[#233354] rounded-md text-xs font-bold text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-hidden"
              />
              <div className="flex items-center space-x-1.5">
                {[1, 2, 4, 8].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setPlannedHours(h)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      plannedHours === h
                        ? 'bg-[#1E40AF] text-[#F8FAFC] border-[#38BDF8]'
                        : 'bg-[#1A2742] text-[#94A3B8] border-[#233354] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Descripción / Justificación */}
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-semibold text-[#F8FAFC] flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Descripción / Justificación (Opcional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalla brevemente el motivo o contexto de esta actividad extraordinaria..."
              className="w-full px-3.5 py-2.5 bg-[#1A2742] border border-[#233354] rounded-md text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-hidden transition-all placeholder:text-[#64748B]"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-3 border-t border-[#233354] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742] transition-colors cursor-pointer border border-[#233354]"
            >
              Cancelar
            </button>
            <button
              id="task-submit-btn"
              type="submit"
              className="px-4.5 py-2 rounded-md text-xs font-heading font-semibold text-white bg-[#1E40AF] hover:bg-[#1D4ED8] transition-colors cursor-pointer flex items-center space-x-2 shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Crear Tarea Extraordinaria</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
