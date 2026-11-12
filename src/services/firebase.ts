import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  updateProfile as updateFirebaseProfile,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Verificación de credenciales de entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey && 
    firebaseConfig.apiKey.length > 5 && 
    firebaseConfig.projectId
  );
};

// Inicialización condicional segura para evitar caídas si faltan variables en .env
const app = isFirebaseConfigured()
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
const googleProvider = new GoogleAuthProvider();

/**
 * Listener en tiempo real de cambios en el estado de autenticación de Firebase
 */
export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export interface AuthResult {
  success: boolean;
  user?: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  error?: string;
  isSimulated?: boolean;
}

/**
 * Iniciar sesión con correo y contraseña en Firebase
 */
export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase aún no está configurado con tus credenciales reales en el archivo .env. Por favor ingresa tu VITE_FIREBASE_API_KEY.',
    };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const fbUser = credential.user;
    return {
      success: true,
      user: {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      },
    };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    let msg = 'Error al iniciar sesión.';
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      msg = 'Correo electrónico o contraseña incorrectos.';
    } else if (error.code === 'auth/user-not-found') {
      msg = 'No existe una cuenta registrada con este correo.';
    } else if (error.code === 'auth/too-many-requests') {
      msg = 'Demasiados intentos fallidos. Intenta más tarde.';
    } else if (error.message) {
      msg = error.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Registro de cuenta real con correo y contraseña en Firebase
 */
export async function registerWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase aún no está configurado en .env. Agrega tus credenciales para registrar cuentas reales.',
    };
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = credential.user;
    return {
      success: true,
      user: {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      },
    };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    let msg = 'Error al crear la cuenta.';
    if (error.code === 'auth/email-already-in-use') {
      msg = 'Este correo electrónico ya está registrado. Por favor inicia sesión.';
    } else if (error.code === 'auth/weak-password') {
      msg = 'La contraseña es muy débil (mínimo 6 caracteres).';
    } else if (error.code === 'auth/invalid-email') {
      msg = 'Formato de correo electrónico inválido.';
    } else if (error.message) {
      msg = error.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Inicio de sesión o registro rápido con cuenta de Google
 */
export async function loginWithGoogle(): Promise<AuthResult> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase aún no está configurado en .env. Agrega tus credenciales para habilitar Google Auth.',
    };
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    return {
      success: true,
      user: {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      },
    };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    let msg = 'Error al conectar con Google.';
    if (error.code === 'auth/popup-closed-by-user') {
      msg = 'La ventana de inicio de sesión de Google fue cerrada.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      msg = 'Solicitud de autenticación cancelada.';
    } else if (error.code === 'auth/unauthorized-domain') {
      msg = 'El dominio "bytewisemx.github.io" no está autorizado en Firebase. Añádelo en la consola de Firebase: Authentication > Configuración > Dominios autorizados.';
    } else if (error.message) {
      msg = error.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Cerrar sesión en Firebase
 */
export async function logoutFirebase(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      // Ignorar errores al cerrar sesión
    }
  }
}

/**
 * Actualizar nombre y foto de perfil en Firebase
 */
export async function updateFirebaseUserProfile(displayName?: string, photoURL?: string): Promise<boolean> {
  if (!auth || !auth.currentUser) return false;
  try {
    await updateFirebaseProfile(auth.currentUser, {
      displayName: displayName || auth.currentUser.displayName,
      photoURL: photoURL || auth.currentUser.photoURL,
    });
    return true;
  } catch {
    return false;
  }
}
