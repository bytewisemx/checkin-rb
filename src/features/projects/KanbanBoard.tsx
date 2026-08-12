import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, Plus, MoreHorizontal, Filter, 
  ArrowUpDown, LayoutList, Calendar as CalendarIcon, Users, List, 
  CheckSquare, Activity, MessageSquare, FileText, 
  PieChart, GitMerge, ChevronDown, User, Construction
} from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import type { Task } from '../../store/useCheckinStore';
import { TaskModal } from './TaskModal';

type TabType = 'overview' | 'list' | 'board' | 'timeline' | 'calendar' | 'workflow' | 'dashboard' | 'messages' | 'files';
type SortOrder = 'none' | 'asc' | 'desc';

export function KanbanBoard() {
  const { tasks, moveTask } = useCheckinStore();
  
  // Estados UI
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultColumn, setDefaultColumn] = useState<Task['status']>('pending');

  // Estados de Filtro y Orden
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Derivar asignados únicos para el menú de filtros
  const assignees = useMemo(() => {
    const list = tasks.map(t => t.assignee).filter(Boolean) as string[];
    return ['All', ...Array.from(new Set(list))];
  }, [tasks]);

  // Aplicar Filtros y Orden a las tareas
  const processedTasks = useMemo(() => {
    let result = [...tasks];
    
    // Aplicar Filtro
    if (filterAssignee !== 'All') {
      result = result.filter(t => t.assignee === filterAssignee);
    }
    
    // Aplicar Orden
    if (sortOrder === 'asc') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === 'desc') {
      result.sort((a, b) => b.title.localeCompare(a.title));
    }

    return result;
  }, [tasks, filterAssignee, sortOrder]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleOpenModal = (column: Task['status'] = 'pending') => {
    setDefaultColumn(column);
    setIsModalOpen(true);
  };

  // -------------------------
  // SUBCOMPONENTES DE VISTA
  // -------------------------

  // 1. Vista de Tablero (Board)
  const BoardView = () => {
    const pendingTasks = processedTasks.filter(t => t.status === 'pending');
    const progressTasks = processedTasks.filter(t => t.status === 'progress');
    const reviewTasks = processedTasks.filter(t => t.status === 'review');
    const completedTasks = processedTasks.filter(t => t.status === 'completed');

    const Column = ({ title, status, columnTasks }: { title: string, status: Task['status'], columnTasks: Task[] }) => {
      const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
      const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) moveTask(taskId, status);
      };

      return (
        <div className="min-w-[300px] max-w-[300px] flex flex-col" onDragOver={onDragOver} onDrop={onDrop}>
          <div className="flex justify-between items-center mb-3 group px-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
              <span className="text-slate-500 text-sm">{columnTasks.length}</span>
            </div>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleOpenModal(status)} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 space-y-2.5 min-h-[150px]">
            {columnTasks.map(task => (
              <div 
                key={task.id} draggable onDragStart={(e) => onDragStart(e, task.id)}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative"
              >
                <div className="flex items-start space-x-2 mb-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 transition-colors ${task.status === 'completed' ? 'text-green-500' : 'text-slate-300 group-hover:text-green-400'}`} />
                  <h4 className={`font-medium text-[15px] leading-snug ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</h4>
                </div>

                {task.tags && task.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 pl-7">
                    {task.tags.map((tag, idx) => (
                      <span key={idx} className={`text-[11px] font-semibold px-2 py-0.5 rounded-sm ${tag.colorClass}`}>{tag.text}</span>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pl-7 mt-2">
                  <div className="flex items-center space-x-2">
                    {task.assignee ? (
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm" title={task.assignee}>
                        {task.assignee.substring(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center"><User className="w-3 h-3 text-slate-400" /></div>
                    )}
                    {task.dueDate && <span className="text-xs text-slate-500 font-medium">{task.dueDate}</span>}
                  </div>
                  {task.subtasksCount !== undefined && task.subtasksCount > 0 && (
                    <div className="flex items-center text-slate-400 text-xs font-medium">{task.subtasksCount} <List className="w-3.5 h-3.5 ml-1" /></div>
                  )}
                </div>
              </div>
            ))}
            {columnTasks.length === 0 && (
              <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-sm">
                Arrastra una tarea aquí
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="flex-1 overflow-x-auto px-6 pb-8">
        <div className="flex space-x-4 items-start min-h-[500px]">
          <Column title="Ads" status="pending" columnTasks={pendingTasks} />
          <Column title="Web" status="progress" columnTasks={progressTasks} />
          <Column title="Content" status="review" columnTasks={reviewTasks} />
          <Column title="Email" status="completed" columnTasks={completedTasks} />
        </div>
      </div>
    );
  };

  // 2. Vista de Lista (List)
  const ListView = () => (
    <div className="px-6 pb-8 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
            <th className="font-semibold p-3 w-8"></th>
            <th className="font-semibold p-3 min-w-[300px]">Nombre de Tarea</th>
            <th className="font-semibold p-3">Asignado a</th>
            <th className="font-semibold p-3">Fecha Límite</th>
            <th className="font-semibold p-3">Estado</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-slate-100">
          {processedTasks.map(task => (
            <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
              <td className="p-3">
                <CheckCircle2 className={`w-4 h-4 ${task.status === 'completed' ? 'text-green-500' : 'text-slate-300 group-hover:text-green-400'}`} />
              </td>
              <td className={`p-3 font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {task.title}
              </td>
              <td className="p-3 text-slate-600 flex items-center space-x-2">
                {task.assignee ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                      {task.assignee.substring(0, 2).toUpperCase()}
                    </div>
                    <span>{task.assignee}</span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">Sin asignar</span>
                )}
              </td>
              <td className="p-3 text-slate-600">{task.dueDate || '-'}</td>
              <td className="p-3">
                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold capitalize">
                  {task.status}
                </span>
              </td>
            </tr>
          ))}
          {processedTasks.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-500">No se encontraron tareas.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // 3. Vista de Calendario (Mockup visual sencillo)
  const CalendarView = () => (
    <div className="px-6 pb-8 h-full flex flex-col">
      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden flex-1 min-h-[500px]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-slate-50 p-2 font-semibold text-xs text-slate-500 text-center uppercase tracking-wider">{day}</div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-white p-2 h-32 hover:bg-slate-50 transition-colors relative">
            <span className="text-sm font-medium text-slate-400">{i + 1 > 31 ? (i + 1) - 31 : i + 1}</span>
            {/* Simulando que caen tareas en el día 16, 17 y 20 */}
            {i + 1 === 16 && <div className="mt-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded truncate">Community ads</div>}
            {i + 1 === 17 && <div className="mt-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded truncate">Help site app</div>}
            {i + 1 === 20 && <div className="mt-1 text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded truncate">App announcement</div>}
          </div>
        ))}
      </div>
    </div>
  );

  // 4. Vista de Estado Vacío (Próximamente)
  const EmptyStateView = ({ title }: { title: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-fade-in">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Vista de {title} en construcción</h2>
      <p className="text-slate-500 max-w-md">
        Actualmente hemos implementado List, Board y Calendar. La vista de {title} estará disponible en futuras actualizaciones como parte del desarrollo del Gestor de Proyectos.
      </p>
    </div>
  );


  // Renderizar la pestaña activa
  const renderContent = () => {
    switch (activeTab) {
      case 'board': return <BoardView />;
      case 'list': return <ListView />;
      case 'calendar': return <CalendarView />;
      default: 
        const tabNames: Record<string, string> = {
          overview: 'Resumen',
          timeline: 'Cronograma',
          workflow: 'Flujo de Trabajo',
          dashboard: 'Panel',
          messages: 'Mensajes',
          files: 'Archivos'
        };
        return <EmptyStateView title={tabNames[activeTab] || activeTab} />;
    }
  };

  const TabButton = ({ id, icon: Icon, label }: { id: TabType, icon: any, label: string }) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center px-1 py-2 transition-colors relative ${isActive ? 'text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
      >
        <Icon className="w-4 h-4 mr-1.5" /> {label}
        {isActive && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-slate-800 rounded-t" />}
      </button>
    );
  };

  return (
    <div className="w-full mt-4 animate-fade-in flex flex-col min-h-[70vh] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* 1. Header (Tabs) */}
      <div className="flex items-center space-x-6 border-b border-slate-200 px-6 overflow-x-auto text-sm">
        <TabButton id="overview" icon={Activity} label="Resumen" />
        <TabButton id="list" icon={List} label="Lista" />
        <TabButton id="board" icon={LayoutList} label="Tablero" />
        <TabButton id="timeline" icon={GitMerge} label="Cronograma" />
        <TabButton id="calendar" icon={CalendarIcon} label="Calendario" />
        <TabButton id="workflow" icon={CheckSquare} label="Flujo de Trabajo" />
        <TabButton id="dashboard" icon={PieChart} label="Panel" />
        <TabButton id="messages" icon={MessageSquare} label="Mensajes" />
        <TabButton id="files" icon={FileText} label="Archivos" />
        <button className="flex items-center text-slate-600 hover:text-slate-900 px-1 py-2 transition-colors ml-auto"><Plus className="w-4 h-4" /></button>
      </div>

      {/* 2. Toolbar (Filtros y Acciones) */}
      <div className="flex justify-between items-center px-6 py-4">
        <div>
          <button 
            onClick={() => handleOpenModal('pending')}
            className="flex items-center bg-white border border-slate-200 text-slate-700 font-medium text-sm px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all"
          >
            <Plus className="w-4 h-4 mr-1.5 text-slate-500" />
            Añadir tarea
            <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
          </button>
        </div>
        
        <div className="flex items-center space-x-4 text-sm font-medium text-slate-600 relative">
          
          {/* Botón Filtro */}
          <div className="relative">
            <button 
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className={`flex items-center transition-colors px-2 py-1 rounded ${filterAssignee !== 'All' ? 'bg-rb-navy/10 text-rb-navy' : 'hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Filter className="w-3.5 h-3.5 mr-1.5" /> 
              {filterAssignee !== 'All' ? `Filtro: ${filterAssignee}` : 'Filtrar'}
            </button>
            {isFilterMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">Por Asignado</div>
                {assignees.map(a => (
                  <button 
                    key={a}
                    onClick={() => { setFilterAssignee(a); setIsFilterMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${filterAssignee === a ? 'font-bold text-rb-navy' : 'text-slate-700'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botón Orden */}
          <div className="relative">
            <button 
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className={`flex items-center transition-colors px-2 py-1 rounded ${sortOrder !== 'none' ? 'bg-rb-navy/10 text-rb-navy' : 'hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" /> 
              {sortOrder === 'asc' ? 'Orden A-Z' : sortOrder === 'desc' ? 'Orden Z-A' : 'Ordenar'}
            </button>
            {isSortMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                <button onClick={() => { setSortOrder('none'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Ninguno</button>
                <button onClick={() => { setSortOrder('asc'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">A a la Z</button>
                <button onClick={() => { setSortOrder('desc'); setIsSortMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Z a la A</button>
              </div>
            )}
          </div>

          <button className="flex items-center hover:bg-slate-100 hover:text-slate-900 transition-colors px-2 py-1 rounded">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Agrupar
          </button>
          <button className="flex items-center hover:bg-slate-100 hover:text-slate-900 transition-colors px-2 py-1 rounded">
            <MoreHorizontal className="w-4 h-4 mr-1.5" /> Opciones
          </button>
        </div>
      </div>

      {/* 3. Render Area */}
      {renderContent()}

      {/* Modal */}
      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        defaultColumn={defaultColumn} 
      />
    </div>
  );
}
