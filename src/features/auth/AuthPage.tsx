import { useState, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useNavigate, Link } from 'react-router-dom';
import { 
  loginWithEmail, 
  loginWithGoogle, 
  isFirebaseConfigured 
} from '../../services/firebase';
import { AlertCircle, LogIn, ChevronDown, Lock, X } from 'lucide-react';
import { AuthMinimalistHills } from './AuthMinimalistHills';
import { AuthModalSideIllustration } from './AuthModalSideIllustration';
import './AuthPage.css';

export function AuthPage() {
  const { login, loginWithFirebaseUser, addToast } = useCheckinStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isOpened, setIsOpened] = useState(false);
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > window.innerHeight / 3 && !isOpened) {
        setIsOpened(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpened(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpened]);

  // Manejar bloqueo de scroll
  useEffect(() => {
    if (isOpened) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'initial';
    }
    return () => {
      document.body.style.overflow = 'initial';
    };
  }, [isOpened]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      // 1. Cuentas de prueba preconfiguradas o clave de demo (admin123)
      if (password === 'admin123' || email.toLowerCase().includes('russellbedford.mx')) {
        const success = login(email, password);
        if (success) {
          const lower = email.toLowerCase();
          const roleLabel = lower.includes('ti')
            ? 'Administrador TI (Root)'
            : lower.includes('rh')
            ? 'Recursos Humanos (Perfil Restringido)'
            : lower.includes('supervisor')
            ? 'Supervisor de Equipo'
            : 'Empleado Operativo';
          addToast(`Bienvenido: ${roleLabel}`, 'success');
          navigate('/');
          return;
        }
      }

      // 2. Si hay Firebase configurado, intentar autenticación con cuenta real
      if (firebaseReady) {
        const res = await loginWithEmail(email, password);
        if (res.success && res.user) {
          loginWithFirebaseUser(res.user);
          addToast('Inicio de sesión exitoso con Firebase', 'success');
          navigate('/');
          return;
        } else {
          // Si falló en Firebase, verificar si es demo local
          const localSuccess = login(email, password);
          if (localSuccess) {
            navigate('/');
            return;
          }
          setErrorMsg(res.error || 'Credenciales inválidas.');
          return;
        }
      } else {
        // 3. Fallback general sin Firebase
        const success = login(email, password);
        if (success) {
          navigate('/');
        } else {
          setErrorMsg('Contraseña o correo demo incorrecto. (Usa admin123)');
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);

    try {
      if (firebaseReady) {
        const res = await loginWithGoogle();
        if (res.success && res.user) {
          loginWithFirebaseUser(res.user);
          addToast(`¡Bienvenido! Conectado con ${res.user.email}`, 'success');
          navigate('/');
        } else {
          setErrorMsg(res.error || 'No se pudo iniciar con Google.');
        }
      } else {
        // Simulación guiada si aún no están las variables en .env
        setErrorMsg(
          'Para habilitar Google Sign-In con cuentas reales, agrega tus credenciales de Firebase en el archivo .env (ver .env.example).'
        );
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error al conectar con Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="auth-body">
      {/* Indicador Flotante sin ningún encuadre ni fondo: Animación pura de deslizar */}
      {!isOpened && (
        <div 
          className="auth-scroll-down" 
          onClick={() => setIsOpened(true)}
          role="button"
          tabIndex={0}
          title="Desliza hacia abajo o haz clic para ingresar"
        >
          <span className="auth-scroll-tag">RUSSELL BEDFORD</span>
          <span className="auth-scroll-text">DESLIZA HACIA ABAJO</span>
          
          {/* Animación fluida de deslizamiento */}
          <div className="auth-scroll-animation">
            <div className="auth-scroll-mouse">
              <div className="auth-scroll-wheel"></div>
            </div>
            <div className="auth-scroll-arrows">
              <ChevronDown className="auth-arrow-icon auth-arrow-1" />
              <ChevronDown className="auth-arrow-icon auth-arrow-2" />
            </div>
          </div>
        </div>
      )}
      
      {/* Paisaje Minimalista de Colinas en Azul y Blanco */}
      <div className="auth-container">
        <AuthMinimalistHills />
      </div>
      
      {/* Modal de Inicio de Sesión */}
      <div className={`auth-modal ${isOpened ? 'is-open' : ''}`}>
        <div className="auth-modal-container">
          <div className="auth-modal-left">
            <h1 className="auth-modal-title">¡Bienvenido!</h1>
            <p className="auth-modal-desc">Inicia sesión con tu cuenta para acceder a la plataforma.</p>
            
            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón de Inicio Rápido con Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full mb-4 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center space-x-2.5 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isGoogleLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            </button>

            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">o con correo</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleLogin}>
              <div className="auth-input-block">
                <label htmlFor="email" className="auth-input-label">Correo Electrónico</label>
                <input 
                  type="email" 
                  name="email" 
                  id="email" 
                  placeholder="ejemplo@russellbedford.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="auth-input-block">
                <label htmlFor="password" className="auth-input-label">Contraseña</label>
                <input 
                  type="password" 
                  name="password" 
                  id="password" 
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {/* Accesos Rápidos de Prueba de los 4 Niveles RBAC (Ocultos por defecto con botón sutil) */}
              <div className="mb-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDemoProfiles(!showDemoProfiles)}
                  className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400 hover:text-[#0D5C75] transition-colors cursor-pointer select-none py-1"
                >
                  <span>{showDemoProfiles ? '▾ Ocultar perfiles de prueba' : '▸ Perfiles de prueba rápida'}</span>
                </button>

                {showDemoProfiles && (
                  <div className="mt-2 space-y-1.5 animate-fade-in">
                    <span className="font-medium text-slate-400 text-[10px] block">
                      Contraseña: <code className="font-mono text-slate-600 font-semibold">admin123</code>
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('ti.root@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-bold border border-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="TI (Root): Audita todo el sistema y emite links para Supervisores"
                      >
                        <span>👑 TI (Root Admin)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('supervisor.prueba@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-[#0D5C75] text-[10px] font-bold border border-cyan-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Supervisor: Invita a su equipo, asigna tareas y recibe notificaciones"
                      >
                        <span>🛡️ Supervisor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('colaborador.prueba@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Empleado / Operativo: Visualiza sus tareas asignadas y registra tiempo"
                      >
                        <span>👤 Empleado</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('rh.prueba@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10px] font-bold border border-teal-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="RH (Restringido): Solo métricas de personal y horas; 403 en Tareas y Clientes"
                      >
                        <span>📊 RH (Restringido)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="auth-modal-buttons">
                <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
                <button type="submit" className="auth-input-button" disabled={isLoading}>
                  {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
                </button>
              </div>
            </form>
            
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center space-x-1.5 text-slate-400 text-[10px]">
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Acceso no público</span>
            </div>
          </div>

          <div className="auth-modal-right">
            <AuthModalSideIllustration />
            
            {/* Tachita flotante blanca sin recuadros */}
            <button
              type="button"
              onClick={() => setIsOpened(false)}
              title="Cerrar ventana"
              className="absolute top-4 right-4 p-1.5 text-white/90 hover:text-white transition-all cursor-pointer z-30 rounded-full hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        <button type="button" className="auth-modal-button" onClick={() => setIsOpened(true)}>
          <LogIn className="w-4 h-4 text-[#0D5C75]" />
          <span>Acceder a Russell Bedford Checkin</span>
        </button>
      </div>
    </div>
  );
}
