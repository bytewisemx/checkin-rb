import React, { useState, useRef } from 'react';
import { Menu, Plus, Search, HelpCircle, Sparkles, User, LogOut, Camera } from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';

export function GlobalHeader() {
  const { user, logout, updateProfile, addToast, addTask } = useCheckinStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({ profileImage: reader.result as string });
        addToast('Imagen de perfil actualizada correctamente', 'success');
        setIsProfileOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateTask = () => {
    addTask({
      title: 'Nueva Tarea Creada desde el Menú',
      description: '',
      status: 'pending',
      timeSpent: '00:00',
      estimatedTime: '60m',
      assignee: user?.name,
      dueDate: new Date().toLocaleDateString(),
    });
    addToast('Tarea creada exitosamente. Revisa tu tablero.', 'success');
  };

  return (
    <header className="bg-[#2B2B2B] text-slate-300 h-14 flex items-center justify-between px-4 sticky top-0 z-50">
      
      {/* Lado Izquierdo */}
      <div className="flex items-center space-x-4 w-1/4">
        <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400">
          <Menu className="w-5 h-5" />
        </button>
        <button 
          onClick={handleCreateTask}
          className="flex items-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full transition-colors text-sm font-medium text-slate-200"
        >
          <div className="bg-[#FF5A5A] rounded-full p-0.5">
            <Plus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
          <span>Create</span>
        </button>
      </div>

      {/* Centro (Buscador) */}
      <div className="flex-1 flex justify-center max-w-2xl">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Phoenix" 
            className="w-full bg-[#3B3B3B] text-slate-200 placeholder:text-slate-400 text-sm rounded-full py-1.5 pl-9 pr-4 border border-transparent focus:border-slate-500 focus:outline-none focus:bg-[#444] transition-all"
          />
        </div>
      </div>

      {/* Lado Derecho */}
      <div className="flex items-center justify-end space-x-4 w-1/4">
        
        <button 
          onClick={() => addToast('Centro de ayuda en construcción', 'info')}
          className="w-7 h-7 rounded-full border border-slate-500 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        
        <button 
          onClick={() => addToast('Características IA próximamente', 'info')}
          className="text-pink-400 hover:text-pink-300 transition-colors"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        {/* Perfil Pill */}
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center bg-white rounded-full p-0.5 pl-2 shadow-sm border border-slate-200 hover:shadow-md transition-shadow h-9"
          >
            {/* Ilustración de decoración */}
            <div className="mr-2 hidden sm:block">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15 8L22 9L17 14L18.5 21L12 17.5L5.5 21L7 14L2 9L9 8L12 2Z" fill="#FFC75F" />
                <path d="M12 2L15 8L22 9L17 14L18.5 21L12 17.5V2Z" fill="#FF9671" />
              </svg>
            </div>
            
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 border border-slate-100 flex items-center justify-center">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-slate-500" />
              )}
            </div>
          </button>

          {/* Menú Desplegable */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in text-slate-800">
              <div className="px-4 py-3 border-b border-slate-100 mb-2">
                <p className="font-semibold text-sm truncate">{user?.name} {user?.lastName}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
              >
                <Camera className="w-4 h-4 mr-3 text-slate-400" />
                Cambiar Imagen
              </button>
              
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
              />
              
              <button 
                onClick={logout}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
        
      </div>
    </header>
  );
}
