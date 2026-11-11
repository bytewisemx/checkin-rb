import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { 
  registerWithEmail, 
  loginWithGoogle, 
  logoutFirebase, 
  isFirebaseConfigured 
} from '../../services/firebase';
import { 
  validateInvitationToken, 
  consumeInvitationToken 
} from '../../services/invitations';
import type { Invitation } from '../../types/invitation';
import { 
  ArrowLeft, 
  AlertCircle, 
  Lock, 
  Clock, 
  Ban, 
  RefreshCw 
} from 'lucide-react';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const { loginWithFirebaseUser, addToast } = useCheckinStore();
  const navigate = useNavigate();

  // Estados de Validación de Invitación
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Estados del Formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const firebaseReady = isFirebaseConfigured();

  // 1. Validación Inmediata del Token al cargar la pantalla
  useEffect(() => {
    async function checkToken() {
      if (!inviteToken) {
        setIsValidatingToken(false);
        setTokenError('NO_TOKEN');
        return;
      }

      setIsValidatingToken(true);
      try {
        const result = await validateInvitationToken(inviteToken);
        if (result.valid && result.invitation) {
          setInvitation(result.invitation);
          setEmail(result.invitation.email || emailParam || '');
          setTokenError(null);
        } else {
          setTokenError(result.error || 'Token de invitación no válido o expirado.');
        }
      } catch {
        setTokenError('Ocurrió un error al verificar la validez de tu invitación.');
      } finally {
        setIsValidatingToken(false);
      }
    }

    checkToken();
  }, [inviteToken, emailParam]);

  // 2. Registro con Correo y Contraseña
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!invitation) {
      setErrorMsg('No se cuenta con una invitación válida.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      const supervisorCode = useRayonerStore.getState().getSupervisorCode(invitation.supervisorId);
      const invitationPayload = {
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        supervisorCode,
        team: invitation.team,
        roleTitle: invitation.roleTitle,
        role: invitation.targetRole || invitation.role || 'Empleado',
        created_by_ti_id: invitation.created_by_ti_id || null,
        token: invitation.token,
      };

      if (firebaseReady) {
        const res = await registerWithEmail(email, password);
        if (res.success && res.user) {
          await consumeInvitationToken(invitation.token, {
            uid: res.user.uid,
            email: invitation.email,
            name: invitation.email.split('@')[0],
          });

          loginWithFirebaseUser(
            {
              ...res.user,
              email,
            },
            invitationPayload
          );

          addToast('¡Registro completado! Por favor configura tus datos de perfil.', 'success');
          navigate('/complete-profile');
        } else {
          setErrorMsg(res.error || 'No se pudo completar el registro en este momento.');
        }
      } else {
        const localUid = `usr-local-${Date.now()}`;
        await consumeInvitationToken(invitation.token, {
          uid: localUid,
          email: invitation.email,
          name: invitation.email.split('@')[0],
        });

        loginWithFirebaseUser(
          {
            uid: localUid,
            email: invitation.email,
            displayName: invitation.email.split('@')[0],
          },
          invitationPayload
        );

        addToast('Invitación aceptada exitosamente. Completa tus datos.', 'success');
        navigate('/complete-profile');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error al procesar el registro de usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Registro con Google validando contra Lista Blanca
  const handleGoogleSignUp = async () => {
    setErrorMsg('');
    if (!invitation) {
      setErrorMsg('No se cuenta con una invitación válida.');
      return;
    }

    setIsGoogleLoading(true);

    try {
      if (firebaseReady) {
        const res = await loginWithGoogle();
        if (res.success && res.user) {
          const googleEmail = res.user.email?.toLowerCase();
          const targetEmail = invitation.email.toLowerCase();

          if (googleEmail !== targetEmail) {
            await logoutFirebase();
            setErrorMsg(
              `La cuenta de Google seleccionada (${googleEmail}) no coincide con el correo autorizado en la invitación (${targetEmail}).`
            );
            return;
          }

          const supervisorCode = useRayonerStore.getState().getSupervisorCode(invitation.supervisorId);
          await consumeInvitationToken(invitation.token, {
            uid: res.user.uid,
            email: targetEmail,
            name: res.user.displayName || targetEmail.split('@')[0],
          });
          loginWithFirebaseUser(res.user, {
            supervisorId: invitation.supervisorId,
            supervisorName: invitation.supervisorName,
            supervisorCode,
            team: invitation.team,
            roleTitle: invitation.roleTitle,
            role: invitation.targetRole || invitation.role || 'Empleado',
            created_by_ti_id: invitation.created_by_ti_id || null,
            token: invitation.token,
          });

          addToast('¡Autenticado con Google bajo lista blanca! Completa tu perfil.', 'success');
          navigate('/complete-profile');
        } else {
          setErrorMsg(res.error || 'No se pudo conectar con Google.');
        }
      } else {
        setErrorMsg('Para habilitar Google Sign-In, configura tus credenciales de Firebase en .env');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error al autenticar con Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // VISTA A: Verificando Token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-800 dark:text-slate-100">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl p-8 text-center animate-fade-in space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Verificando Invitación...</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Validando token de acceso en la lista blanca institucional.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // VISTA B: Bloqueo de Registro Público (Sin Token)
  if (tokenError === 'NO_TOKEN') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-800 dark:text-slate-100">
        <div className="w-full max-w-md mb-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio de sesión
          </Link>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl p-8 text-center space-y-5 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Registro Público Deshabilitado
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              La plataforma opera bajo un modelo privado de lista blanca. Para crear una cuenta, solicita a tu Supervisor o Administrador que emita una invitación para tu correo.
            </p>
          </div>

          <Link
            to="/login"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir al Inicio de Sesión</span>
          </Link>
        </div>
      </div>
    );
  }

  // VISTA C: Token Inválido o Expirado
  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-800 dark:text-slate-100">
        <div className="w-full max-w-md mb-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio de sesión
          </Link>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl p-8 text-center space-y-5 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Invitación No Válida o Expirada
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {tokenError}
            </p>
          </div>

          <Link
            to="/login"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Regresar al Inicio de Sesión</span>
          </Link>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL: Formulario de Registro con Diseño Minimalista Homologado
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 animate-fade-in">
      {/* Enlace Superior de Retorno */}
      <div className="w-full max-w-md mb-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio de sesión
        </Link>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl p-8">
        
        {/* Contexto de Invitación Sutil */}
        {invitation && (
          <div className="bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100/80 dark:border-blue-900/50 rounded-xl p-3.5 mb-6 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-blue-900 dark:text-blue-300">Invitación Validada</span>
              <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                {invitation.roleTitle || 'Colaborador'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight">
              Autorizado por <strong className="text-slate-700 dark:text-slate-200">{invitation.supervisorName}</strong> para integrarse al equipo <strong className="text-slate-700 dark:text-slate-200">{invitation.team}</strong>.
            </p>
          </div>
        )}

        {/* Título Principal */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Activar Cuenta
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Establece tus credenciales para acceder al equipo.
          </p>
        </div>

        {/* Botón Continuar con Google */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading || isLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-xs mb-5 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isGoogleLoading ? 'Autenticando con Google...' : 'Continuar con Google'}</span>
        </button>

        {/* Separador */}
        <div className="relative flex py-2 items-center mb-5">
          <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
          <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            o con contraseña
          </span>
          <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
        </div>

        {/* Formulario Tradicional */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Correo Electrónico Autorizado
            </label>
            <input
              type="email"
              readOnly
              value={email}
              className="w-full py-2.5 px-3.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none select-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Nueva Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full py-2.5 px-3.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              className="w-full py-2.5 px-3.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-medium flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full mt-2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Activando Cuenta...</span>
              </>
            ) : (
              <span>Activar Cuenta y Continuar</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
