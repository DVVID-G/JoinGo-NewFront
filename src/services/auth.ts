import { FirebaseError } from 'firebase/app';
import {
  AuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api-client';
import { AuthTokens, User } from '@/store/authStore';

export interface AuthPayload {
  user: User;
  tokens: AuthTokens;
}

interface AuthResponsePayload {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  uid: string;
  email: string;
  displayName?: string;
}

interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  age?: number;
}

type ProviderName = 'google' | 'github';

const POPUP_FALLBACK_ERRORS = new Set<string>([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/operation-not-supported-in-this-environment',
  'auth/internal-error',
  'auth/cancelled-popup-request',
  'auth/network-request-failed',
]);

export class ProviderRedirectError extends Error {
  provider: ProviderName;

  constructor(provider: ProviderName) {
    super('PROVIDER_REDIRECT');
    this.name = 'ProviderRedirectError';
    this.provider = provider;
  }
}

/**
 * Registers a user via backend and then logs in to return auth payload.
 * @param params User profile and credentials.
 * @returns Normalized user and tokens.
 */
export async function registerWithEmail(params: RegisterPayload): Promise<AuthPayload> {
  await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      password: params.password,
      phoneNumber: params.phoneNumber,
      age: params.age,
    }),
  });

  return loginWithEmail(
    { email: params.email, password: params.password },
    { firstName: params.firstName, lastName: params.lastName }
  );
}

/**
 * Logs in using email/password against backend auth.
 * @param params Email and password.
 * @param overrides Optional first/last name overrides for mapping.
 */
export async function loginWithEmail(
  params: { email: string; password: string },
  overrides?: Partial<Pick<User, 'firstName' | 'lastName'>>
): Promise<AuthPayload> {
  const data = await apiFetch<AuthResponsePayload>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  return {
    user: mapAuthResponseToUser(data, overrides),
    tokens: mapAuthResponseToTokens(data),
  };
}

/**
 * Initiates OAuth login with the given provider, handling popup fallback to redirect.
 * @param providerName Provider identifier (google | github).
 * @returns Auth payload with normalized user and tokens.
 * @throws ProviderRedirectError to signal redirect flow continuation.
 */
export async function loginWithProvider(providerName: ProviderName): Promise<AuthPayload> {
  const provider = buildAuthProvider(providerName);

  // Detectar si hay problemas conocidos con popup (ej. COOP policy)
  const useRedirectDirectly = shouldUseRedirectDirectly();

  if (useRedirectDirectly) {
    await triggerProviderRedirect(providerName, provider);
  }

  try {
    // Intentar popup con timeout para evitar bloqueo indefinido
    const popupPromise = signInWithPopup(firebaseAuth, provider);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('POPUP_TIMEOUT')), 120000); // 2 minutos
    });

    const { user } = await Promise.race([popupPromise, timeoutPromise]);
    const payload = await buildFirebaseUserPayload(user);
    await syncProviderProfile(payload, user.providerData[0]?.providerId);
    return payload;
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      console.info('Popup falló, usando redirect como alternativa...');
      await triggerProviderRedirect(providerName, provider);
    }
    throw error;
  }
}

/**
 * Detecta si el navegador tiene problemas conocidos con popups
 * (ej. políticas COOP estrictas en ciertos navegadores)
 */
function shouldUseRedirectDirectly(): boolean {
  // Verificar si ya tuvimos un fallo previo con popup (guardado en sessionStorage)
  try {
    return sessionStorage.getItem('auth_popup_failed') === 'true';
  } catch {
    return false;
  }
}

/**
 * Marca que el popup falló para futuras autenticaciones
 */
function markPopupFailed(): void {
  try {
    sessionStorage.setItem('auth_popup_failed', 'true');
  } catch {
    // Ignorar errores de sessionStorage
  }
}

export async function completeProviderRedirect(): Promise<AuthPayload | null> {
  try {
    const result = await getRedirectResult(firebaseAuth);
    if (!result?.user) {
      return null;
    }

    const payload = await buildFirebaseUserPayload(result.user);
    await syncProviderProfile(payload, result.providerId ?? result.user.providerData[0]?.providerId);
    return payload;
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/no-auth-event') {
      return null;
    }
    throw error;
  }
}

export function isProviderRedirectError(error: unknown): error is ProviderRedirectError {
  return error instanceof ProviderRedirectError;
}

/**
 * Sends a password reset email using Firebase, falling back to backend endpoint if needed.
 * The handler URL points to `/reset-password` in this frontend.
 * @param email Target account email.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const resetUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/reset-password`
    : undefined;

  try {
    await sendPasswordResetEmail(firebaseAuth, email, resetUrl ? { url: resetUrl, handleCodeInApp: true } : undefined);
  } catch (_) {
    // Fallback al backend por compatibilidad
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

/**
 * Logs out the current user in backend (best effort) and Firebase Auth.
 */
export async function logoutUser(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.warn('Error cerrando sesión en backend', error);
  } finally {
    await signOut(firebaseAuth);
  }
}

/**
 * Cambia el email del usuario en Firebase Auth
 * Requiere que el usuario esté autenticado
 * @param newEmail - El nuevo email a establecer
 */
export async function changeEmail(newEmail: string): Promise<void> {
  await apiFetch('/api/auth/change-email', {
    method: 'POST',
    body: JSON.stringify({ email: newEmail }),
  });
}

/**
 * Cambia la contraseña del usuario en Firebase Auth
 * Requiere que el usuario esté autenticado
 * @param newPassword - La nueva contraseña (mínimo 6 caracteres)
 */
export async function changePassword(newPassword: string): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  
  await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ password: newPassword }),
  });
}

function mapAuthResponseToTokens(data: AuthResponsePayload): AuthTokens {
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
}

function mapAuthResponseToUser(
  data: AuthResponsePayload,
  overrides?: Partial<Pick<User, 'firstName' | 'lastName'>>
): User {
  const display = data.displayName?.trim() ?? '';
  const [first = '', ...rest] = display.split(' ');
  const fallbackName = data.email.split('@')[0] ?? 'Usuario';

  return {
    id: data.uid,
    email: data.email,
    firstName: overrides?.firstName ?? (first || fallbackName),
    lastName: overrides?.lastName ?? rest.join(' ').trim(),
  };
}

function normalizeFirebaseUser(user: FirebaseUser): User {
  const display = user.displayName?.trim() ?? '';
  const [first = '', ...rest] = display.split(' ');
  return {
    id: user.uid,
    firstName: first || user.email?.split('@')[0] || 'Usuario',
    lastName: rest.join(' ').trim(),
    email: user.email || '',
    avatar: user.photoURL || undefined,
    phone: user.phoneNumber || undefined,
  };
}

async function buildFirebaseUserPayload(user: FirebaseUser): Promise<AuthPayload> {
  const idTokenResult = await user.getIdTokenResult(true);
  return {
    user: normalizeFirebaseUser(user),
    tokens: {
      idToken: idTokenResult.token,
      refreshToken: user.refreshToken,
      expiresAt: new Date(idTokenResult.expirationTime).getTime(),
    },
  };
}

async function syncProviderProfile(payload: AuthPayload, provider?: string) {
  try {
    await apiFetch('/api/auth/provider-sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${payload.tokens.idToken}`,
      },
      body: JSON.stringify({
        provider,
        displayName: `${payload.user.firstName} ${payload.user.lastName}`.trim(),
        avatarUrl: payload.user.avatar,
        phoneNumber: payload.user.phone,
        firstName: payload.user.firstName,
        lastName: payload.user.lastName,
        email: payload.user.email,
      }),
    });
  } catch (error) {
    console.warn('No se pudo sincronizar el perfil del proveedor', error);
  }
}

function shouldFallbackToRedirect(error: unknown): boolean {
  let shouldFallback = false;

  if (error instanceof FirebaseError) {
    shouldFallback = POPUP_FALLBACK_ERRORS.has(error.code);
  } else if (error instanceof DOMException) {
    shouldFallback = error.name === 'SecurityError' || error.name === 'InvalidAccessError' ||
      error.message.includes('Cross-Origin-Opener-Policy');
  } else if (error instanceof Error) {
    const msg = error.message || '';
    shouldFallback = msg.includes('Cross-Origin-Opener-Policy') || 
                     msg.includes('POPUP_TIMEOUT') ||
                     msg.includes('window.closed');
  } else if (error && typeof error === 'object' && 'message' in error) {
    try {
      const msg = String((error as { message?: unknown }).message ?? '');
      shouldFallback = msg.includes('Cross-Origin-Opener-Policy') || msg.includes('POPUP_TIMEOUT');
    } catch (_) {
      shouldFallback = false;
    }
  }

  if (shouldFallback) {
    markPopupFailed();
  }

  return shouldFallback;
}

function buildAuthProvider(providerName: ProviderName): AuthProvider {
  return providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
}

async function triggerProviderRedirect(
  providerName: ProviderName,
  provider: AuthProvider
): Promise<never> {
  await signInWithRedirect(firebaseAuth, provider);
  throw new ProviderRedirectError(providerName);
}

export { refreshAuthTokens } from './token';
