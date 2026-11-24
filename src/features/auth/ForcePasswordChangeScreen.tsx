import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../services/firebase';
import { useCheckinStore } from '../../store/useCheckinStore';
import { logSystemMovement } from '../../services/auditLogger';

export function ForcePasswordChangeScreen() {
  const { user, updateProfile, addToast } = useCheckinStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Validaciones de seguridad de contraseña
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValid = hasMinLength && hasNumber && hasLetter && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isValid) {
      setErrorMessage('Asegúrate de que la nueva contraseña cumpla con todos los requisitos de seguridad.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Actualizar contraseña en Firebase Auth
      if (auth && auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
      }

      // 2. Actualizar flag en Firestore users/{uid}
      if (isFirebaseConfigured() && db && user?.id) {
        try {
          await updateDoc(doc(db, 'users', user.id), {
            mustChangePassword: false,
            passwordUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (dbErr) {
          console.warn('[ForcePasswordChangeScreen] Error al actualizar flag en Firestore:', dbErr);
        }
      }

      // 3. Registrar auditoría del primer cambio de contraseña
      await logSystemMovement({
        eventType: 'USER_PASSWORD_INITIALIZED',
        actorId: user?.id || 'auth_user',
        actorName: user?.name || 'Usuario',
        actorEmail: user?.email || '',
        actorRole: user?.role || 'Colaborador',
        targetResource: `Perfil de Usuario: ${user?.email}`,
        details: 'Contraseña temporal reemplazada exitosamente por la contraseña personal en el primer inicio de sesión.',
      });

      // 4. Actualizar estado en Zustand para desbloquear inmediatamente la vista
      updateProfile({
        mustChangePassword: false,
      });

      addToast('¡Contraseña actualizada con éxito! Bienvenido a tu espacio de trabajo.', 'success');
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      const code = err?.code || '';
      if (code === 'auth/requires-recent-login') {
        setErrorMessage('La sesión ha expirado. Por favor cierra sesión e ingresa nuevamente con tu clave temporal.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('La contraseña ingresada es demasiado débil. Usa una combinación más compleja.');
      } else {
        setErrorMessage(err?.message || 'Ocurrió un error al actualizar tu contraseña.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 animate-fade-in">
        {/* Cabecera Corporativa */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-400 rounded-xl border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-center mx-auto shadow-2xs">
            <Lock className="w-6 h-6 stroke-[2]" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Actualiza tu Contraseña Temporal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Por protocolo corporativo de Russell Bedford, debes definir tu contraseña personal antes de ingresar a tu tablero.
          </p>
        </div>

        {/* Alerta de Error si aplica */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nueva Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nueva Contraseña Personal <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full h-10 px-3.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar Nueva Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Confirmar Nueva Contraseña <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Vuelve a escribir la contraseña"
              className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>

          {/* Checklist de Requisitos de Seguridad */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-[11px]">
            <div className={`flex items-center space-x-2 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Mínimo 8 caracteres</span>
            </div>
            <div className={`flex items-center space-x-2 ${hasLetter ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Al menos una letra</span>
            </div>
            <div className={`flex items-center space-x-2 ${hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Al menos un número</span>
            </div>
            <div className={`flex items-center space-x-2 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Ambas contraseñas coinciden</span>
            </div>
          </div>

          {/* Botón de Actualización */}
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="w-full h-10 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-semibold rounded-lg transition-all shadow-xs hover:shadow cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Actualizando Contraseña...</span>
              </>
            ) : (
              <>
                <span>Guardar y Entrar a mi Tablero</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
