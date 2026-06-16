import { useState } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';
import { LogIn, Briefcase, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AuthPage() {
  const login = useCheckinStore(state => state.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      const success = login(email, password);
      setIsLoading(false);
      if (success) {
        navigate('/'); // ¡Faltaba esta línea crucial!
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rb-turquoise/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rb-navy/20 rounded-full blur-[120px]" />

      <div className="glass w-full max-w-md p-8 rounded-2xl z-10 animate-fade-in shadow-xl border border-white/50">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-rb-navy rounded-xl flex items-center justify-center shadow-lg mb-4">
            <Briefcase className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Checkin</h1>
          <p className="text-sm text-slate-500 font-medium tracking-widest uppercase mt-1">Russell Bedford</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 text-blue-800 text-xs p-3 rounded-xl mb-6 font-medium">
          <strong>Cuentas Activas:</strong>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-blue-700/80 mb-2">
            <li><strong>Empleado:</strong> empleado@russellbedford.mx</li>
            <li><strong>Supervisor:</strong> supervisor@russellbedford.mx</li>
          </ul>
          <div className="pt-2 border-t border-blue-200">
            Contraseña para ambas: <span className="font-mono bg-white px-1.5 py-0.5 rounded text-blue-900 border border-blue-200">admin123</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent transition-all bg-white/50 backdrop-blur-sm"
              placeholder="nombre@russellbedford.mx"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700 flex items-center">
                <Lock className="w-3 h-3 mr-1" /> Contraseña
              </label>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent transition-all bg-white/50 backdrop-blur-sm"
              placeholder="No verificada en esta prueba"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full group mt-2" isLoading={isLoading}>
            <LogIn className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Acceder al Sistema
          </Button>
        </form>
      </div>
    </div>
  );
}
