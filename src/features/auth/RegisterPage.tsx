import { useState } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function RegisterPage() {
  const registerUser = useCheckinStore(state => state.registerUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      registerUser(email, password);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-rb-navy/20 rounded-full blur-[120px]" />
      
      <div className="glass w-full max-w-md p-8 rounded-2xl z-10 animate-fade-in shadow-xl">
        <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-rb-navy mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al Login
        </Link>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-rb-turquoise to-blue-400 rounded-full flex items-center justify-center shadow-md mb-3">
            <UserPlus className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Crear Cuenta</h1>
          <p className="text-sm text-slate-500 text-center mt-1">Regístrate para acceder al panel de asistencia.</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/50"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/50"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Contraseña</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise focus:border-transparent bg-white/50"
              placeholder="Repite tu contraseña"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full mt-4" isLoading={isLoading}>
            Registrarme
          </Button>
        </form>
      </div>
    </div>
  );
}
