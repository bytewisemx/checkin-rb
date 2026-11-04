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
  UserPlus, ArrowLeft, AlertCircle, 
  Lock, Mail, KeyRound, Sparkles, ShieldCheck, 
  Clock, Ban
} from 'lucide-react';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') || '';

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
          setEmail(result.invitation.email);
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
  }, [inviteToken]);

  // 2. Registro con Correo y Contraseña
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!invitation) {
      setErrorMsg('No se cuenta con una invitación válida.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
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

          loginWithFirebaseUser({
            ...res.user,
            email,
          }, invitationPayload);

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

        loginWithFirebaseUser({
          uid: localUid,
          email: invitation.email,
          displayName: invitation.email.split('@')[0],
        }, invitationPayload);

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
      <div className="min-h-screen bg-[#0B111E] flex items-center justify-center p-4 text-[#F8FAFC]">
        <div className="bg-[#131D31] rounded-md p-8 max-w-md w-full text-center shadow-2xl border border-[#233354] animate-pulse">
          <div className="w-12 h-12 rounded-md bg-[#1A2742] text-[#38BDF8] border border-[#233354] flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-base font-heading font-bold text-[#F8FAFC]">Verificando Invitación...</h2>
          <p className="text-xs text-[#94A3B8] mt-1">Validando token criptográfico en la lista blanca corporativa.</p>
        </div>
      </div>
    );
  }

  // VISTA B: Bloqueo de Registro Público (Sin Token)
  if (tokenError === 'NO_TOKEN') {
    return (
      <div className="min-h-screen bg-[#0B111E] flex items-center justify-center p-4 text-[#F8FAFC]">
        <div className="bg-[#131D31] rounded-md p-8 max-w-lg w-full text-center shadow-2xl border border-[#233354] animate-fade-in space-y-4">
          <div className="w-12 h-12 rounded-md bg-[#1A2742] text-[#E11D48] border border-[#E11D48]/30 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#E11D48] bg-[#1A2742] px-2.5 py-0.5 rounded-sm border border-[#E11D48]/30">
              ACCESO RESTRINGIDO • WHITELIST
            </span>
            <h1 className="text-xl font-heading font-bold text-[#F8FAFC] tracking-tight mt-1">
              Registro Público Deshabilitado
            </h1>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              La plataforma opera bajo un modelo privado de lista blanca. El registro abierto no está permitido.
            </p>
          </div>

          <div className="bg-[#1A2742] rounded-md p-3.5 border border-[#233354] text-left space-y-1.5 text-xs text-[#94A3B8]">
            <div className="flex items-start space-x-2 text-[#F8FAFC] font-heading font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
              <span>¿Cómo crear una cuenta de colaborador?</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] pl-6">
              Debes solicitar a tu Supervisor que emita una invitación para tu correo electrónico institucional.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/login"
              className="w-full py-2.5 px-4 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold tracking-wide uppercase transition-colors text-center flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
              <span>Volver al Inicio de Sesión</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // VISTA C: Token Inválido o Expirado
  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#0B111E] flex items-center justify-center p-4 text-[#F8FAFC]">
        <div className="bg-[#131D31] rounded-md p-8 max-w-lg w-full text-center shadow-2xl border border-[#233354] animate-fade-in space-y-4">
          <div className="w-12 h-12 rounded-md bg-[#1A2742] text-[#F59E0B] border border-[#F59E0B]/30 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#F59E0B] bg-[#1A2742] px-2.5 py-0.5 rounded-sm border border-[#F59E0B]/30">
              INVITACIÓN NO VÁLIDA
            </span>
            <h1 className="text-xl font-heading font-bold text-[#F8FAFC] tracking-tight mt-1">
              Enlace de Invitación No Disponible
            </h1>
            <p className="text-xs text-[#E11D48] font-medium max-w-md mx-auto bg-[#1A2742] p-2.5 rounded-md border border-[#E11D48]/30">
              {tokenError}
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/login"
              className="w-full py-2.5 px-4 bg-[#1A2742] hover:bg-[#233354] text-[#F8FAFC] rounded-md text-xs font-heading font-semibold tracking-wide uppercase transition-colors text-center flex items-center justify-center space-x-2 border border-[#233354]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ir a Pantalla de Inicio</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // VISTA D: Formulario de Registro Autorizado
  return (
    <div className="min-h-screen bg-[#0B111E] flex items-center justify-center p-4 text-[#F8FAFC]">
      <div className="bg-[#131D31] rounded-md shadow-2xl border border-[#233354] max-w-md w-full p-6 sm:p-7 animate-fade-in relative overflow-hidden">
        {/* Botón Volver */}
        <Link
          to="/login"
          className="inline-flex items-center text-xs font-heading font-semibold text-[#94A3B8] hover:text-[#38BDF8] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Volver al Inicio de Sesión
        </Link>

        {/* Tarjeta de Invitación Verificada */}
        {invitation && (
          <div className="bg-[#1A2742] border border-[#233354] rounded-md p-3.5 mb-4 text-xs text-[#94A3B8] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 text-[10px] font-heading font-bold text-[#38BDF8] uppercase tracking-wider bg-[#0F172A] px-2 py-0.5 rounded-sm border border-[#233354]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Invitación Verificada</span>
              </span>
              <span className="text-[10px] text-[#38BDF8] font-heading font-bold bg-[#0F172A] px-2 py-0.5 rounded-sm border border-[#233354]">
                Lista Blanca Activa
              </span>
            </div>

            <div className="pt-1 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">Nivel de Alta:</span>
                <span className="font-heading font-bold text-[#38BDF8] uppercase">
                  {(invitation.targetRole || invitation.role) === 'Supervisor'
                    ? 'Alta de Supervisor (TI)'
                    : 'Alta de Empleado'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">Autorizado por:</span>
                <span className="font-semibold text-[#F8FAFC]">{invitation.supervisorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">Equipo:</span>
                <span className="font-semibold text-[#F8FAFC]">{invitation.team}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cabecera del Formulario */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-10 h-10 bg-[#1E40AF] rounded-md flex items-center justify-center text-white mb-2 shadow-xs">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-heading font-bold text-[#F8FAFC] tracking-tight">Completar Registro</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Crea tu contraseña para activar tu cuenta vinculada.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3.5 p-3 bg-[#1A2742] border border-[#E11D48]/40 text-[#E11D48] rounded-md text-xs font-medium flex items-start space-x-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E11D48] mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Botón Google */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading || isLoading}
          className="w-full mb-3.5 py-2 px-3 bg-[#1A2742] hover:bg-[#233354] border border-[#233354] rounded-md text-xs font-heading font-semibold text-[#F8FAFC] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continuar con Google ({invitation?.email})</span>
        </button>

        <div className="relative flex py-2 items-center mb-3">
          <div className="flex-grow border-t border-[#233354]"></div>
          <span className="flex-shrink mx-2 text-[10px] font-heading font-semibold text-[#64748B] uppercase tracking-wider">o con contraseña</span>
          <div className="flex-grow border-t border-[#233354]"></div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="block text-xs font-heading font-semibold text-[#94A3B8] mb-1">
              Correo Electrónico Autorizado
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                readOnly
                value={email}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[#233354] bg-[#0F172A] text-[#94A3B8] text-xs font-medium cursor-not-allowed outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-heading font-semibold text-[#94A3B8] mb-1">
              Nueva Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[#233354] focus:border-[#38BDF8] bg-[#1A2742] text-[#F8FAFC] text-xs font-medium placeholder-[#64748B] outline-none"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-heading font-semibold text-[#94A3B8] mb-1">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[#233354] focus:border-[#38BDF8] bg-[#1A2742] text-[#F8FAFC] text-xs font-medium placeholder-[#64748B] outline-none"
                placeholder="Repite tu contraseña"
              />
            </div>
          </div>

          <div className="pt-1.5">
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold tracking-wide uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 shadow-xs"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>{isLoading ? 'Activando Cuenta...' : 'Activar Cuenta y Continuar'}</span>
            </button>
          </div>
        </form>

        <div className="mt-4 p-2.5 bg-[#1A2742] rounded-md border border-[#233354] flex items-start space-x-2 text-[11px] text-[#94A3B8]">
          <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
          <p>
            Al activar tu cuenta quedarás vinculado a <b>{invitation?.supervisorName}</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
