import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCheckinStore, type Task, type TaskTag } from '../../store/useCheckinStore';
import { useNotificationStore } from '../../store/useNotificationStore';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultColumn?: Task['status'];
}

export function TaskModal({ isOpen, onClose, defaultColumn = 'pending' }: TaskModalProps) {
  const addTask = useCheckinStore(state => state.addTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<Task['status']>(defaultColumn);
  
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Etiquetas iniciales según la columna o por defecto (contraste óptimo)
    const tagColors: Record<Task['status'], { text: string; colorClass: string }> = {
      pending: { text: 'En Espera', colorClass: 'bg-slate-100 text-slate-700 border border-slate-200' },
      progress: { text: 'En Proceso', colorClass: 'bg-blue-50 text-blue-900 border border-blue-200' },
      review: { text: 'En Revisión', colorClass: 'bg-amber-50 text-amber-900 border border-amber-200' },
      completed: { text: 'Finalizado', colorClass: 'bg-slate-100 text-slate-700 border border-slate-200' }
    };

    const dummyTags: TaskTag[] = [
      tagColors[status] || { text: 'En Espera', colorClass: 'bg-slate-100 text-slate-700 border border-slate-200' }
    ];

    const assigneeName = assignee.trim() || 'Colaborador';

    addTask({
      title,
      description,
      status,
      timeSpent: '00:00:00',
      estimatedTime: '60m',
      assignee: assigneeName,
      dueDate: dueDate || 'Sin fecha',
      tags: dummyTags,
      subtasksCount: 0
    });

    // Notificación en la bandeja para el colaborador
    useNotificationStore.getState().addNotification({
      type: 'new_task',
      title: 'Nueva Tarea Asignada',
      message: `El supervisor te ha asignado la tarea "${title}". Asignado a: ${assigneeName}.`,
      taskTitle: title,
      projectName: 'Proyectos Corporativos',
      authorName: 'Supervisor',
    });

    useCheckinStore.getState().addToast(`Tarea "${title}" asignada y notificada a ${assigneeName}`, 'success');

    // Reset y cerrar
    setTitle('');
    setDescription('');
    setAssignee('');
    setDueDate('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-[#131D31] rounded-md shadow-2xl w-full max-w-lg overflow-hidden border border-[#233354]">
        <div className="flex justify-between items-center p-4 border-b border-[#233354] bg-[#0F172A]">
          <h3 className="font-heading font-semibold text-sm text-[#F8FAFC]">Agregar Nueva Tarea</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-md hover:bg-[#1A2742] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors border border-transparent hover:border-[#233354] cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-heading font-semibold text-[#F8FAFC] mb-1">Título de la Tarea</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#1A2742] border border-[#233354] rounded-md px-3.5 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8] outline-hidden transition-colors"
              placeholder="Ej: Auditoría preliminar de estados financieros..."
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-heading font-semibold text-[#F8FAFC] mb-1">Descripción</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#1A2742] border border-[#233354] rounded-md px-3.5 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8] outline-hidden transition-colors min-h-[80px]"
              placeholder="Detalles y objetivos de la tarea..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-heading font-semibold text-[#F8FAFC] mb-1">Asignado a</label>
              <input 
                type="text" 
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                className="w-full bg-[#1A2742] border border-[#233354] rounded-md px-3.5 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8] outline-hidden transition-colors"
                placeholder="Ej: Ana Gómez"
              />
            </div>
            <div>
              <label className="block text-xs font-heading font-semibold text-[#F8FAFC] mb-1">Fecha Límite</label>
              <input 
                type="text" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-[#1A2742] border border-[#233354] rounded-md px-3.5 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#38BDF8] outline-hidden transition-colors"
                placeholder="Ej: 20 Feb"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-heading font-semibold text-[#F8FAFC] mb-1">Etapa de Avance</label>
            <select 
              value={status}
              onChange={e => setStatus(e.target.value as Task['status'])}
              className="w-full bg-[#1A2742] border border-[#233354] rounded-md px-3.5 py-2 text-xs text-[#F8FAFC] focus:border-[#38BDF8] outline-hidden transition-colors"
            >
              <option value="pending">Espera</option>
              <option value="progress">En Proceso</option>
              <option value="review">En Revisión</option>
              <option value="completed">Finalizado</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-[#233354] mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-md text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742] border border-[#233354] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4.5 py-2 rounded-md text-xs font-heading font-semibold text-white bg-[#1E40AF] hover:bg-[#1D4ED8] transition-colors cursor-pointer shadow-xs"
            >
              Guardar Tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
