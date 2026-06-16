import { useState } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function ForgotPasswordPage() {
  const requestPasswordReset = useCheckinStore(state => state.requestPasswordReset);
  const pendingEmail = useCheckinStore(state => state.pendingEmail);
  const verificationType = useCheckinStore(state => state.verificationType);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Si ya se solicitó y estamos en modo recovery, vamos directo a verification
  if (pendingEmail && verificationType === 'recovery') {
    navigate('/verification');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      requestPasswordReset(email);
      setIsLoading(false);
      navigate('/verification'); // Vamos a que ingrese el PIN
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-rb-coral/10 rounded-full blur-[100px]" />
      
      <div className="glass w-full max-w-md p-8 rounded-2xl z-10 shadow-xl">
        <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-rb-navy mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al Login
        </Link>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center shadow-md mb-3 text-white">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center">Recuperar Contraseña</h1>
          <p className="text-sm text-slate-500 text-center mt-2 px-2">
            Ingresa tu correo corporativo y te enviaremos un código para restablecer tu acceso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-rb-turquoise bg-white/50"
              placeholder="tu@correo.com"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
            Enviar Código
          </Button>
        </form>
      </div>
    </div>
  );
}
