import { useState, useEffect, useRef } from 'react';
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
import { saveOrUpdateUserProfile } from '../../services/userService';
import { 
  loadFaceApiModels, 
  detectSingleFaceDescriptor,
  DEFAULT_BIOMETRIC_THRESHOLD 
} from '../../services/facialBiometrics';
import type { Invitation } from '../../types/invitation';
import { 
  AlertCircle, 
  RefreshCw, 
  ScanFace, 
  CheckCircle2, 
  Camera, 
  CameraOff,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const { loginWithFirebaseUser, updateProfile, enrollBiometrics, addToast, isAuthenticated, user } = useCheckinStore();
  const navigate = useNavigate();

  // Si ya tiene sesión activa con perfil completo, redirigir automáticamente al dashboard
  const isProfileComplete = Boolean(user?.isProfileComplete || (user?.name && user?.role));
  useEffect(() => {
    if (isAuthenticated && isProfileComplete) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isProfileComplete, navigate]);

  // Estados de Validación de Invitación
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Control de Paso: 1 = Datos Personales y Acceso | 2 = Registro Biométrico Facial
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Paso 1: Datos Personales
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Paso 2: Cámara y Enrolamiento Facial
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionQuality, setDetectionQuality] = useState(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);

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
          setTokenError(
            result.error ||
              'Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.'
          );
        }
      } catch {
        setTokenError(
          'Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.'
        );
      } finally {
        setIsValidatingToken(false);
      }
    }

    checkToken();
  }, [inviteToken, emailParam]);

  // Inicialización de la Cámara al entrar al Paso 2
  useEffect(() => {
    if (currentStep !== 2) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    async function initCamera() {
      setIsLoadingModels(true);
      setCameraActive(false);
      setCameraError(null);
      setFaceDetected(false);
      setDetectionQuality(0);

      const modelsLoaded = await loadFaceApiModels();
      if (isCancelled) return;
      setIsLoadingModels(false);

      if (!modelsLoaded) {
        setCameraError('No se pudieron inicializar los modelos biométricos.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }

        // Bucle de detección facial continua en tiempo real
        intervalId = setInterval(async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
          try {
            const res = await detectSingleFaceDescriptor(videoRef.current);
            if (res) {
              setFaceDetected(true);
              const quality = Math.min(100, Math.round(res.detection.score * 100));
              setDetectionQuality(quality);
            } else {
              setFaceDetected(false);
              setDetectionQuality(0);
            }
          } catch {
            setFaceDetected(false);
            setDetectionQuality(0);
          }
        }, 220);
      } catch (err) {
        console.error('Error al inicializar cámara:', err);
        if (!isCancelled) {
          setCameraActive(false);
          setCameraError(
            'No se detectó cámara web o se denegaron los permisos. Puedes continuar y registrar tu biometría posteriormente.'
          );
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [currentStep]);

  // Completar Registro y Creación de Cuenta (Paso 1 -> Paso 2)
  const handleProceedToBiometrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!invitation) {
      setErrorMsg('No se cuenta con una invitación válida.');
      return;
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast) {
      setErrorMsg('Por favor ingresa tu nombre y apellido.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      const supervisorCode = useRayonerStore.getState().getSupervisorCode(invitation.supervisorId);
      const targetRole = invitation.targetRole || invitation.role || 'Empleado';

      const invitationPayload = {
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        supervisorCode,
        team: invitation.team,
        roleTitle: invitation.roleTitle,
        role: targetRole,
        created_by_ti_id: invitation.created_by_ti_id || null,
        token: invitation.token,
      };

      let userUid = '';

      if (firebaseReady) {
        const res = await registerWithEmail(email, password);
        if (!res.success || !res.user) {
          setErrorMsg(res.error || 'No se pudo crear la cuenta institucional.');
          setIsLoading(false);
          return;
        }
        userUid = res.user.uid;
      } else {
        userUid = `usr-local-${Date.now()}`;
      }

      // 1. Invalidación INMEDIATA de la invitación (One-Time Token)
      await consumeInvitationToken(invitation.token, {
        uid: userUid,
        email: invitation.email,
        name: `${cleanFirst} ${cleanLast}`,
      });

      // 2. Inicio de sesión y asignación jerárquica automática
      loginWithFirebaseUser(
        {
          uid: userUid,
          email: invitation.email,
          displayName: `${cleanFirst} ${cleanLast}`,
        },
        invitationPayload
      );

      // 3. Actualizar perfil institucional base y persistir en BD
      const isSupervisor = targetRole === 'Supervisor' || targetRole === 'TI';
      await saveOrUpdateUserProfile(userUid, {
        uid: userUid,
        email: invitation.email,
        name: `${cleanFirst} ${cleanLast}`,
        firstName: cleanFirst,
        lastName: cleanLast,
        role: targetRole,
        team: invitation.team,
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        isProfileComplete: isSupervisor,
      });

      updateProfile({
        name: cleanFirst,
        lastName: cleanLast,
        email: invitation.email,
        role: targetRole,
        team: invitation.team,
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        isProfileComplete: isSupervisor,
      });

      // 4. Determinar si se requiere paso biométrico o paso directo
      if (isSupervisor) {
        addToast('¡Cuenta activada con éxito! Bienvenido a tu consola.', 'success');
        navigate('/');
      } else {
        // Empleados y colaboradores avanzan a Paso 2 (Biometría Facial Inicial)
        setCurrentStep(2);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error al procesar la activación de la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  // Registro Alternativo con Google bajo la misma Invitación
  const handleGoogleSignUp = async () => {
    setErrorMsg('');
    if (!invitation) {
      setErrorMsg('No se cuenta con una invitación válida.');
      return;
    }

    setIsGoogleLoading(true);

    try {
      if (!firebaseReady) {
        setErrorMsg('Google Sign-In requiere credenciales de Firebase configuradas en .env');
        setIsGoogleLoading(false);
        return;
      }

      const res = await loginWithGoogle();
      if (!res.success || !res.user) {
        setErrorMsg(res.error || 'No se pudo conectar con Google.');
        setIsGoogleLoading(false);
        return;
      }

      const googleEmail = (res.user.email || '').toLowerCase().trim();
      const targetEmail = invitation.email.toLowerCase().trim();

      if (googleEmail !== targetEmail) {
        await logoutFirebase();
        setErrorMsg(
          `La cuenta de Google seleccionada (${googleEmail}) no coincide con el correo autorizado en tu invitación (${targetEmail}).`
        );
        setIsGoogleLoading(false);
        return;
      }

      const rawDisplayName = res.user.displayName || targetEmail.split('@')[0];
      const nameParts = rawDisplayName.split(' ');
      const gFirst = nameParts[0] || 'Usuario';
      const gLast = nameParts.slice(1).join(' ') || '';

      const supervisorCode = useRayonerStore.getState().getSupervisorCode(invitation.supervisorId);
      const targetRole = invitation.targetRole || invitation.role || 'Empleado';

      // Invalidación Inmediata del token
      await consumeInvitationToken(invitation.token, {
        uid: res.user.uid,
        email: targetEmail,
        name: rawDisplayName,
      });

      loginWithFirebaseUser(res.user, {
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        supervisorCode,
        team: invitation.team,
        roleTitle: invitation.roleTitle,
        role: targetRole,
        created_by_ti_id: invitation.created_by_ti_id || null,
        token: invitation.token,
      });

      const isSupervisor = targetRole === 'Supervisor' || targetRole === 'TI';

      // Persistir en Firestore / Base de datos capturando la foto de Google
      await saveOrUpdateUserProfile(res.user.uid, {
        uid: res.user.uid,
        email: targetEmail,
        name: rawDisplayName,
        firstName: gFirst,
        lastName: gLast,
        photoURL: res.user.photoURL || null,
        profileImage: res.user.photoURL || undefined,
        role: targetRole,
        team: invitation.team,
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        isProfileComplete: isSupervisor,
      });

      updateProfile({
        name: gFirst,
        lastName: gLast,
        email: targetEmail,
        photoURL: res.user.photoURL || null,
        profileImage: res.user.photoURL || undefined,
        role: targetRole,
        team: invitation.team,
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        isProfileComplete: isSupervisor,
      });

      if (isSupervisor) {
        addToast('¡Cuenta verificada con Google! Bienvenido.', 'success');
        navigate('/');
      } else {
        setCurrentStep(2);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || 'Error al autenticar con Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Captura y Enrolamiento de Biometría Facial (Paso 2)
  const handleCaptureFaceVector = async () => {
    if (!videoRef.current || isEnrolling) return;

    setIsEnrolling(true);
    try {
      const result = await detectSingleFaceDescriptor(videoRef.current);

      if (!result) {
        addToast('No se detectó un rostro centrado. Mira a la cámara e inténtalo de nuevo.', 'error');
        setIsEnrolling(false);
        return;
      }

      // Extracción limpia del vector de 128 floats reales
      const descriptorArray = Array.from(result.descriptor).map((v) => Number(v.toFixed(6)));

      // Guardar descriptor en user.biometrics
      await enrollBiometrics(descriptorArray, 'me', DEFAULT_BIOMETRIC_THRESHOLD);

      // Marcar perfil 100% completo en store y en BD
      updateProfile({ isProfileComplete: true });
      if (user?.id) {
        await saveOrUpdateUserProfile(user.id, { isProfileComplete: true });
      }

      // Detener cámara
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setEnrollmentSuccess(true);
      addToast('¡Registro facial completado exitosamente!', 'success');

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Error al capturar vector facial:', err);
      addToast('Ocurrió un error al procesar el vector facial.', 'error');
      setIsEnrolling(false);
    }
  };

  // Omitir biometría si la cámara no está disponible o el usuario no puede usarla
  const handleSkipBiometrics = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    updateProfile({ isProfileComplete: true });
    if (user?.id) {
      await saveOrUpdateUserProfile(user.id, { isProfileComplete: true });
    }
    addToast('Cuenta activada. Podrás registrar tu biometría facial más adelante.', 'info');
    navigate('/');
  };

  // VISTA A: Verificando Token
  if (isValidatingToken) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl p-8 text-center animate-fade-in space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-sky-400 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Verificando Invitación...</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Validando token de acceso institucional.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // VISTA B: Token Inválido, Usado o Expirado (Estado de Advertencia Sobrio)
  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl p-8 text-center space-y-5 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Enlace de Invitación No Disponible
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.
            </p>
          </div>

          <Link
            to="/login"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <span>Ir al Inicio de Sesión</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL: FLUJO DIRECTO DE 2 PASOS
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans animate-fade-in">
      
      {/* Tarjeta Centralizada */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl p-8">
        
        {/* PASO 1: Datos Personales y Acceso */}
        {currentStep === 1 && (
          <>
            {/* Encabezado Corporativo */}
            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Activa tu Cuenta Institucional
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Completa tus datos para incorporarte al despacho.
              </p>
            </div>

            {/* Badge Informativo de Asignación Automática (Sin campos manuales) */}
            {invitation && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 mb-6 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Vinculación Confirmada</span>
                  <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-sky-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                    {invitation.roleTitle || invitation.targetRole || invitation.role || 'Colaborador'}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  Equipo: <strong className="text-slate-700 dark:text-slate-200">{invitation.team}</strong> • Supervisor: <strong className="text-slate-700 dark:text-slate-200">{invitation.supervisorName}</strong>
                </p>
              </div>
            )}

            {/* Botón Alternativo Continuar con Google */}
            {firebaseReady && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
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
                  <span>{isGoogleLoading ? 'Autenticando...' : 'Activar con Google'}</span>
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                    o con contraseña
                  </span>
                  <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
                </div>
              </div>
            )}

            {/* Formulario Limpio */}
            <form id="invite-register-form" onSubmit={handleProceedToBiometrics} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Nombre(s) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Flavio"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Apellido(s) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Covarrubias"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Correo Electrónico Autorizado
                </label>
                <input
                  type="email"
                  readOnly
                  value={email}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none font-medium select-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Crear Contraseña *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Confirmar Contraseña *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-medium flex items-start gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full mt-2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando datos...</span>
                  </>
                ) : (
                  <>
                    <span>Guardar y Continuar a Biometría</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* PASO 2: Registro Biométrico Facial Inicial */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fade-in">
            {/* Encabezado del Paso 2 */}
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3">
                <ScanFace className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Registro Biométrico Facial Inicial
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Captura tu vector facial institucional por única vez para habilitar el registro de jornada express.
              </p>
            </div>

            {/* Cuadro de Video de Cámara */}
            <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Guía Ovalada Facial Sobria */}
              {cameraActive && !enrollmentSuccess && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-44 h-56 rounded-[45%] border-2 transition-colors duration-300 ${
                      faceDetected
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'border-slate-400/60 border-dashed'
                    }`}
                  />
                </div>
              )}

              {/* Estado: Cargando Modelos */}
              {isLoadingModels && (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span>Inicializando motor facial...</span>
                </div>
              )}

              {/* Estado: Error de Cámara */}
              {cameraError && !isLoadingModels && (
                <div className="p-4 text-center text-slate-300 text-xs space-y-2">
                  <CameraOff className="w-8 h-8 mx-auto text-amber-400" />
                  <p>{cameraError}</p>
                </div>
              )}

              {/* Estado: Éxito Confirmado */}
              {enrollmentSuccess && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-sm">¡Vector Calibrado con Éxito!</h3>
                  <p className="text-xs text-slate-300">Entrando a tu espacio de trabajo...</p>
                </div>
              )}
            </div>

            {/* Barra de Calidad / Detección */}
            {cameraActive && !enrollmentSuccess && (
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Estado de Rostro:</span>
                {faceDetected ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Rostro Centrado ({detectionQuality}%)
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Buscando rostro...
                  </span>
                )}
              </div>
            )}

            {/* Aviso de Privacidad Estricta */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 leading-tight">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Privacidad garantizada: Únicamente se almacena el vector matemático numérico. Jamás se guardan fotografías.</span>
            </div>

            {/* Botones de Acción */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCaptureFaceVector}
                disabled={!faceDetected || isEnrolling || enrollmentSuccess}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEnrolling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando vector biométrico...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capturar Rostro y Finalizar</span>
                  </>
                )}
              </button>

              {/* Botón de Contingencia */}
              <button
                type="button"
                onClick={handleSkipBiometrics}
                disabled={isEnrolling || enrollmentSuccess}
                className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors text-center cursor-pointer"
              >
                Continuar sin cámara por ahora
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
