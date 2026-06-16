import { useState } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';
import { UserCircle, Calendar, Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CompleteProfilePage() {
  const { user, updateProfile } = useCheckinStore();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    lastName: '',
    birthDate: '',
    team: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-rb-turquoise/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[40%] h-[40%] bg-rb-navy/20 rounded-full blur-[120px]" />

      <div className="glass w-full max-w-lg p-8 rounded-2xl z-10 animate-fade-in shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-rb-navy to-rb-turquoise rounded-full flex items-center justify-center shadow-lg mb-4 text-white">
            <UserCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center">Completa tu Perfil</h1>
          <p className="text-sm text-slate-500 text-center mt-2">
            Antes de comenzar, necesitamos un poco más de información sobre ti.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Nombre</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/70"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Apellido</label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/70"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> Fecha de Nacimiento
            </label>
            <input
              type="date"
              name="birthDate"
              required
              value={formData.birthDate}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/70"
            />
            <p className="text-[10px] text-slate-400 mt-1">Calcularemos tu edad automáticamente de forma segura.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 flex items-center">
              <Users className="w-3 h-3 mr-1" /> Equipo / Área
            </label>
            <select
              name="team"
              required
              value={formData.team}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/70"
            >
              <option value="" disabled>Selecciona tu área</option>
              <option value="Auditoría">Auditoría</option>
              <option value="Contabilidad">Contabilidad</option>
              <option value="Impuestos">Impuestos</option>
              <option value="Consultoría">Consultoría</option>
              <option value="Legal">Legal</option>
              <option value="Recursos Humanos">Recursos Humanos</option>
              <option value="Tecnología">Tecnología / IT</option>
            </select>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-4 group">
            Guardar y Continuar
            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>
      </div>
    </div>
  );
}
