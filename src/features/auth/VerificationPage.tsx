import { useState, useRef, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Button } from '../../components/common/Button';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function VerificationPage() {
  const { verifyCode, pendingEmail, verificationType } = useCheckinStore();
  const navigate = useNavigate();
  // Supabase manda PIN de 6 dígitos por defecto
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Si no hay correo pendiente, no debería estar aquí
  useEffect(() => {
    if (!pendingEmail) navigate('/login');
  }, [pendingEmail, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);

    // Auto focus next
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) return;

    setIsLoading(true);
    setTimeout(async () => {
      const isValid = await verifyCode(fullCode);
      setIsLoading(false);
      
      if (isValid) {
        if (verificationType === 'recovery') navigate('/reset-password');
        else navigate('/'); // register success
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="glass w-full max-w-md p-8 rounded-2xl shadow-xl text-center">
        <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-rb-navy mb-6 absolute top-6 left-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
        
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Verifica tu Correo</h2>
        <p className="text-sm text-slate-500 mb-6 px-4">
          Hemos enviado un código de seguridad a <br/>
          <span className="font-semibold text-slate-700">{pendingEmail}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center space-x-2 mb-8">
            {code.map((digit, idx) => (
              <input
                key={idx}
                ref={el => { inputsRef.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 border-slate-200 focus:border-rb-turquoise focus:ring-4 focus:ring-rb-turquoise/20 transition-all bg-white"
              />
            ))}
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            className="w-full" 
            isLoading={isLoading}
            disabled={code.join('').length < 6}
          >
            Verificar Código
          </Button>
        </form>
      </div>
    </div>
  );
}
