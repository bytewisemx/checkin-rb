import { useState } from 'react';
import { X } from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import type { Task, TaskTag } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';

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

    // Etiquetas dummy dependiendo del título o simplemente un set por defecto para que se vea bien
    const dummyTags: TaskTag[] = [
      { text: 'In Progress', colorClass: 'bg-blue-100 text-blue-800' }
    ];

    addTask({
      title,
      description,
      status,
      timeSpent: '00:00:00',
      estimatedTime: '60m',
      assignee: assignee || 'Unassigned',
      dueDate: dueDate || 'No date',
      tags: dummyTags,
      subtasksCount: 0
    });

    // Reset y cerrar
    setTitle('');
    setDescription('');
    setAssignee('');
    setDueDate('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800">Agregar Nueva Tarea</h3>
          <button onClick={onClose} className="p-1.5 bg-white rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título de la Tarea</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rb-navy/20 focus:border-rb-navy outline-none transition-all"
              placeholder="Ej: Revisar campaña de anuncios..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rb-navy/20 focus:border-rb-navy outline-none transition-all min-h-[80px]"
              placeholder="Detalles de la tarea..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Asignado a</label>
              <input 
                type="text" 
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rb-navy/20 outline-none"
                placeholder="Nombre"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha</label>
              <input 
                type="text" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rb-navy/20 outline-none"
                placeholder="Ej: 20 Feb"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Columna Inicial</label>
            <select 
              value={status}
              onChange={e => setStatus(e.target.value as Task['status'])}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rb-navy/20 outline-none"
            >
              <option value="pending">Pendientes</option>
              <option value="progress">En Progreso</option>
              <option value="review">En Revisión</option>
              <option value="completed">Completado</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Guardar Tarea</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
