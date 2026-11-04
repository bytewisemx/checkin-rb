import { useState, useEffect, useRef } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useInvitationStore } from '../../store/useInvitationStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useNavigate, Link } from 'react-router-dom';
import { 
  loginWithEmail, 
  loginWithGoogle, 
  logoutFirebase,
  isFirebaseConfigured 
} from '../../services/firebase';
import { ArrowDown, ChevronUp } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './AuthPage.css';

// Registrar ScrollTrigger con GSAP
gsap.registerPlugin(ScrollTrigger);

// 100 cajas para cubrir 100vh exactos (1.2vh con margin-bottom -0.2vh = 1.0vh por caja)
const BOX_COUNT = 100;
const BOX_ARRAY = Array.from({ length: BOX_COUNT }, (_, i) => i);

export function AuthPage() {
  const { login, loginWithFirebaseUser, addToast } = useCheckinStore();
  const navigate = useNavigate();

  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const firebaseReady = isFirebaseConfigured();

  // Animación de GSAP con ScrollTrigger para la transición de hoja
  useEffect(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: triggerEl,
          scrub: 0.5,
          pin: true,
          start: 'top top',
          end: '+=150%'
        }
      });

      // 1. Transición de las 100 cajas volteándose hacia la derecha
      tl.to('.box', {
        force3D: true,
        duration: 1,
        xPercent: 100,
        ease: 'power1.inOut',
        stagger: { amount: 1 }
      })
      .to('.box', { 
        ease: 'power1.out', 
        duration: 1, 
        rotation: '45deg', 
        stagger: { amount: 1 } 
      }, 0)
      .to('.box', { 
        ease: 'power1.in', 
        duration: 1, 
        rotation: '0deg', 
        stagger: { amount: 1 } 
      }, 1);

      // 2. Desvanecer suavemente el panel de bienvenida de la derecha al scrollear
      if (introRef.current) {
        tl.to(introRef.current, {
          autoAlpha: 0,
          y: -25,
          duration: 0.7,
          ease: 'power1.out'
        }, 0.2);
      }

      // 3. Revelar el formulario de acceso en la mitad izquierda
      if (formRef.current) {
        tl.fromTo(formRef.current,
          { autoAlpha: 0, scale: 0.96, y: 15 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.8, ease: 'power2.out' },
          0.35
        );
      }

      // 4. Panel artístico corporativo visible al asentarse las cajas en el lado derecho
      if (backdropRef.current) {
        tl.fromTo(backdropRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.8, ease: 'power2.out' },
          1.2
        );
      }
    }, triggerRef);

    return () => {
      ctx.revert();
    };
  }, []);

  // Función para avanzar suavemente al formulario mediante clic
  const handleScrollToForm = () => {
    const scrollTarget = window.innerHeight * 1.5;
    window.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    });
  };

  // Función para regresar suavemente a la portada inicial
  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Validación de Lista Blanca / Invitación Corporativa Previa y Estado de Revocación TI
  const verifyAccessAndGetInvitation = (emailAddress: string) => {
    const cleanEmail = emailAddress.trim().toLowerCase();
    const { mockEmployeesData, userPermissionsDirectory } = useCheckinStore.getState();
    const { isEmailWhitelisted, findInvitationForEmail } = useInvitationStore.getState();
    const { getSupervisorCode } = useRayonerStore.getState();

    // 0. Verificar si TI revocó los permisos de esta cuenta (incluso Socios / Supervisores)
    const dirEntry = Object.values(userPermissionsDirectory).find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (dirEntry?.accessRevoked) {
      return {
        allowed: false,
        error: `Acceso revocado por TI: Los permisos de la cuenta "${cleanEmail}" (${dirEntry.name}) fueron revocados por el administrador de TI.`,
        invitationData: undefined,
      };
    }

    // 1. Cuentas maestras de TI Root
    const isTiRoot = cleanEmail.includes('ti.root') || cleanEmail.startsWith('ti@') || cleanEmail.includes('root');
    if (isTiRoot) {
      return { allowed: true, invitationData: undefined };
    }

    // 2. Colaboradores existentes con perfil ya completado
    const existingCompleted = mockEmployeesData.find(
      (e) => e.email.toLowerCase() === cleanEmail && e.isProfileComplete
    );
    if (existingCompleted) {
      return { allowed: true, invitationData: undefined };
    }

    // 3. Verificación de Invitación Corporativa previa emitida por un Supervisor o TI
    const hasWhitelist = isEmailWhitelisted(cleanEmail);
    const invitation = findInvitationForEmail(cleanEmail);

    if (!hasWhitelist && !invitation) {
      return {
        allowed: false,
        error: `Acceso restringido: La cuenta "${cleanEmail}" no cuenta con una invitación previa en la lista blanca de la firma. Para poder registrarte y crear tu perfil, solicita previamente a tu supervisor o a TI que emita tu invitación.`,
        invitationData: undefined,
      };
    }

    // 4. Si cuenta con invitación previa, recuperar datos jerárquicos y código de supervisor en automático
    let invitationData = undefined;
    if (invitation) {
      const supervisorCode = getSupervisorCode(invitation.supervisorId);
      invitationData = {
        role: invitation.targetRole || invitation.role,
        team: invitation.team,
        roleTitle: invitation.roleTitle,
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        supervisorCode,
        created_by_ti_id: invitation.created_by_ti_id,
        token: invitation.token,
      };
    }

    return { allowed: true, invitationData };
  };

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
            ? 'TI Prueba (Nivel Más Alto)'
            : lower.includes('rh')
            ? 'RH Prueba'
            : lower.includes('supervisor')
            ? 'Supervisor Prueba'
            : 'Empleado Prueba';
          addToast(`Bienvenido: ${roleLabel}`, 'success');
          navigate('/');
          return;
        }
      }

      // 2. Si hay Firebase configurado, intentar autenticación con cuenta real
      if (firebaseReady) {
        const res = await loginWithEmail(email, password);
        if (res.success && res.user) {
          const access = verifyAccessAndGetInvitation(res.user.email || email);
          if (!access.allowed) {
            await logoutFirebase();
            setErrorMsg(access.error || 'Acceso restringido por lista blanca corporativa.');
            return;
          }

          loginWithFirebaseUser(res.user, access.invitationData);
          if (access.invitationData) {
            addToast(`¡Invitación validada para ${access.invitationData.supervisorName}! Redirigiendo a completar tu perfil...`, 'success');
          } else {
            addToast('Inicio de sesión exitoso con Firebase', 'success');
          }
          navigate('/');
          return;
        } else {
          // Fallback a demo local si no hubo éxito en Firebase
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
          const userEmail = res.user.email || '';
          const access = verifyAccessAndGetInvitation(userEmail);

          if (!access.allowed) {
            // Se bloquea el acceso si no hay invitación previa
            await logoutFirebase();
            setErrorMsg(access.error || 'Acceso no autorizado por lista blanca.');
            return;
          }

          // Iniciar sesión inyectando automáticamente la invitación y el código del supervisor
          loginWithFirebaseUser(res.user, access.invitationData);
          if (access.invitationData) {
            addToast(
              `¡Invitación validada con ${access.invitationData.supervisorName}! Asignación automática cargada.`,
              'success'
            );
          } else {
            addToast(`¡Bienvenido! Conectado con ${res.user.email}`, 'success');
          }
          navigate('/');
        } else {
          setErrorMsg(res.error || 'No se pudo iniciar con Google.');
        }
      } else {
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
    <div className="auth-page-root">
      {/* Contenedor fijado durante el scroll */}
      <section className="trigger" ref={triggerRef}>

        {/* 1. MITAD IZQUIERDA: FORMULARIO DE ACCESO (REVELADO AL PASAR LA HOJA) */}
        <div className="auth-login-panel">
          <div className="auth-login-card" ref={formRef}>
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center space-x-2 text-xs font-bold text-[#0D5C75]">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>RUSSELL BEDFORD</span>
              </div>
              <button
                type="button"
                onClick={handleScrollToTop}
                title="Volver a la portada"
                className="text-[11px] font-semibold text-slate-400 hover:text-[#0D5C75] inline-flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            </div>

            <div className="auth-card-header">
              <h1 className="auth-card-title">¡Bienvenido!</h1>
              <p className="auth-card-subtitle">Inicia sesión con tu cuenta para acceder a la plataforma.</p>
            </div>

            {errorMsg && (
              <div className="mb-4 py-2 border-b border-slate-300 text-[#0F172A] text-xs font-semibold">
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón de Inicio con Google */}
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
              <div className="auth-input-group">
                <label htmlFor="email" className="auth-input-label">Correo Electrónico</label>
                <input 
                  type="email" 
                  name="email" 
                  id="email" 
                  placeholder="ejemplo@russellbedford.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input-field"
                  required
                />
              </div>

              <div className="auth-input-group">
                <label htmlFor="password" className="auth-input-label">Contraseña</label>
                <input 
                  type="password" 
                  name="password" 
                  id="password" 
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input-field"
                  required
                />
              </div>

              {/* Accesos Rápidos de Prueba de los 4 Niveles RBAC (Ocultos por defecto con botón sutil) */}
              <div className="mb-4 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDemoProfiles(!showDemoProfiles)}
                  className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400 hover:text-[#0D5C75] transition-colors cursor-pointer select-none py-1"
                >
                  <span>{showDemoProfiles ? '▾ Ocultar equipo de prueba' : '▸ Equipo de Prueba (Acceso directo)'}</span>
                </button>

                {showDemoProfiles && (
                  <div className="mt-2 space-y-2 animate-fade-in">
                    <span className="font-medium text-slate-500 text-[10px] block">
                      Equipo de Prueba • Contraseña: <code className="font-mono text-slate-700 font-semibold">admin123</code>
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('ti.root@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2.5 py-1.5 bg-[#0F172A] hover:bg-[#1E40AF] text-[#F8FAFC] text-[10px] font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                        title="TI Prueba (Nivel más alto)"
                      >
                        <span>TI Prueba</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('supervisor.prueba@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2.5 py-1.5 border border-slate-300 hover:border-[#1E40AF] text-[#0F172A] text-[10px] font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                        title="Supervisor Prueba (Socio / Líder)"
                      >
                        <span>Supervisor Prueba</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('colaborador.prueba@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2.5 py-1.5 border border-slate-300 hover:border-[#1E40AF] text-[#0F172A] text-[10px] font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                        title="Empleado Prueba"
                      >
                        <span>Empleado Prueba</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('rh.prueba@russellbedford.mx');
                          setPassword('admin123');
                        }}
                        className="inline-flex items-center justify-center px-2.5 py-1.5 border border-slate-300 hover:border-[#1E40AF] text-[#0F172A] text-[10px] font-heading font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                        title="RH Prueba"
                      >
                        <span>RH Prueba</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <Link to="/forgot-password" className="text-xs text-[#1E40AF] hover:underline font-medium">
                  ¿Olvidaste tu contraseña?
                </Link>
                <button type="submit" className="auth-submit-btn !w-auto !py-2 !px-5" disabled={isLoading}>
                  {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
                </button>
              </div>
            </form>

            <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-center text-slate-400 text-[10px] uppercase tracking-widest font-heading">
              <span>Acceso no público</span>
            </div>
          </div>
        </div>

        {/* 2. MITAD DERECHA INICIAL: TEXTO "RUSSELL BEDFORD - DESLICE PARA CONTINUAR" */}
        <div 
          className="auth-intro-panel" 
          ref={introRef}
          onClick={handleScrollToForm}
          role="button"
          tabIndex={0}
          title="Haz clic o desliza hacia abajo para continuar"
        >
          <div className="auth-intro-content">
            <div className="auth-brand-badge">
              <span>Plataforma Corporativa</span>
            </div>

            {/* Palomita Azul Limpia (Sin recuadro ni círculo contenedor) */}
            <div className="mb-3">
              <svg className="w-14 h-14" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="checkmarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" />
                    <stop offset="50%" stopColor="#0D5C75" />
                    <stop offset="100%" stopColor="#002538" />
                  </linearGradient>
                </defs>
                <path 
                  d="M14 33L26 45L50 19" 
                  stroke="url(#checkmarkGrad)" 
                  strokeWidth="6.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </svg>
            </div>

            <h1 className="auth-intro-title">
              Russell<br />Bedford
            </h1>

            <div className="auth-intro-action">
              <span>Deslice para continuar</span>
              <ArrowDown className="w-5 h-5 auth-scroll-arrow text-[#0D5C75]" />
            </div>

            <p className="auth-intro-desc">
              Control integral de asistencia, gestión inteligente de tareas y registro biométrico seguro.
            </p>

            <div className="auth-scroll-prompt">
              <div className="auth-mouse-pill">
                <div className="auth-mouse-wheel"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CAPA DE 100 CAJAS (HOJA QUE SE VOLTEA CON SCROLLTRIGGER) */}
        <div className="auth-boxes-layer" aria-hidden="true">
          {BOX_ARRAY.map((i) => (
            <div key={i} className="box" />
          ))}
        </div>

        {/* 4. MITAD DERECHA POSTERIOR: ARTE CORPORATIVO REVELADO AL VOLTEAR LA HOJA */}
        <div className="auth-right-backdrop" ref={backdropRef}>
          <div className="auth-backdrop-decoration"></div>
          <div className="auth-backdrop-brand">
            <svg className="w-14 h-14 mx-auto mb-4" viewBox="0 0 64 64" fill="none">
              <path 
                d="M14 33L26 45L50 19" 
                stroke="#00E5FF" 
                strokeWidth="6" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
            <h2 className="auth-backdrop-title">Russell Bedford</h2>
            <p className="auth-backdrop-tagline">
              Sistema corporativo de control de tiempo, presencia y productividad.
            </p>
          </div>
        </div>

      </section>
    </div>
  );
}
