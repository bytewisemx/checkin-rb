import { useState, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';
import { RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ResetPasswordPage() {
  const { resetPassword, pendingEmail, verificationType } = useCheckinStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Validación de seguridad (debe haber pasado por verificationPage antes y estar en recovery pero el OTP ya verificado... wait, verificationType sigue activo si no se borró).
  // Si no hay pendingEmail, lo sacamos.
  useEffect(() => {
    if (!pendingEmail || verificationType !== 'recovery') {
      navigate('/login');
    }
  }, [pendingEmail, verificationType, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
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
      resetPassword(password);
      setIsLoading(false);
      navigate('/login');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="glass w-full max-w-md p-8 rounded-2xl shadow-xl z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-md mb-3 text-white">
            <RefreshCcw className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center">Nueva Contraseña</h1>
          <p className="text-sm text-slate-500 text-center mt-2 px-2">
            Ingresa tu nueva contraseña para la cuenta <br/> <span className="font-semibold text-slate-700">{pendingEmail}</span>
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise bg-white/50"
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
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise bg-white/50"
              placeholder="Repite tu contraseña"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full mt-4" isLoading={isLoading}>
            Restablecer Acceso
          </Button>
        </form>
      </div>
    </div>
  );
}
