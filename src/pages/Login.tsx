import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import {
  completeProviderRedirect,
  isProviderRedirectError,
  loginWithEmail,
  loginWithProvider,
  requestPasswordReset,
} from '@/services/auth';
import type { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Login page handling email/password and OAuth flows plus password reset trigger.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resumeProviderLogin = async () => {
      try {
        const payload = await completeProviderRedirect();
        if (!payload || !isMounted) {
          return;
        }

        setIsLoading(true);
        login(payload);
        toast.success('¡Bienvenido!');
        navigate('/dashboard');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof FirebaseError
            ? translateFirebaseError(error)
            : 'No pudimos completar el inicio de sesión con el proveedor seleccionado.';
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    resumeProviderLogin();

    return () => {
      isMounted = false;
    };
  }, [login, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      const payload = await loginWithEmail({
        email: email.trim(),
        password,
      });
      login(payload);
      toast.success('¡Bienvenido de vuelta!');
      navigate('/dashboard');
    } catch (error) {
      const message = isApiError(error)
        ? translateApiError(error)
        : error instanceof FirebaseError
          ? translateFirebaseError(error)
          : 'No pudimos iniciar sesión. Intenta nuevamente.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      const payload = await loginWithProvider(provider);
      login(payload);
      toast.success('¡Bienvenido!');
      navigate('/dashboard');
    } catch (error) {
      if (isProviderRedirectError(error)) {
        toast.info('Redirigiendo para continuar el inicio de sesión...');
        return;
      }
      const message =
        error instanceof FirebaseError
          ? translateFirebaseError(error)
          : 'No pudimos completar el inicio de sesión con el proveedor seleccionado.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const translateFirebaseError = (error: FirebaseError) => {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/invalid-email':
      case 'auth/user-not-found':
        return 'Credenciales inválidas. Verifica tu correo y contraseña.';
      case 'auth/wrong-password':
        return 'La contraseña ingresada es incorrecta.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Intenta más tarde.';
      default:
        return 'Ocurrió un error al iniciar sesión.';
    }
  };

  const isApiError = (error: unknown): error is ApiError =>
    typeof error === 'object' && error !== null && 'status' in error && 'message' in error;

  const translateApiError = (error: ApiError) => {
    switch (error.status) {
      case 400:
        return 'Datos inválidos. Revisa tu correo y contraseña.';
      case 401:
        return 'Credenciales incorrectas. Intenta nuevamente.';
      case 429:
        return 'Demasiados intentos. Espera unos segundos e inténtalo de nuevo.';
      case 500:
        return 'Tenemos problemas en el servidor. Intenta más tarde.';
      default:
        return error.message || 'No pudimos iniciar sesión. Intenta nuevamente.';
    }
  };

  const handlePasswordReset = async () => {
    const targetEmail = (resetEmail || email).trim();

    if (!targetEmail) {
      toast.error('Ingresa tu correo para restablecer la contraseña');
      return;
    }

    setIsSendingReset(true);
    try {
      await requestPasswordReset(targetEmail);
      toast.success('Te enviamos un correo para restablecer tu contraseña');
    } catch (error) {
      const message = error instanceof FirebaseError
        ? translateFirebaseError(error)
        : 'No pudimos enviar el correo. Intenta nuevamente.';
      toast.error(message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 lg:w-1/2 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2" aria-label="JoinGo - Inicio">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Video className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold text-foreground">JoinGo</span>
          </Link>

          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Iniciar sesión</h1>
          <p className="mt-2 text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Regístrate gratis
            </Link>
          </p>

          {/* OAuth buttons */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('google')}
              className="h-11"
              type="button"
              disabled={isLoading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('github')}
              className="h-11"
              type="button"
              disabled={isLoading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Button>
          </div>

          <div className="relative my-8">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
              o continúa con email
            </span>
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowReset((prev) => !prev);
                  setResetEmail((current) => current || email);
                }}
                disabled={isLoading || isSendingReset}
                className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {showReset && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                <Label htmlFor="resetEmail" className="text-sm font-medium text-muted-foreground">
                  Ingresa el correo para enviar el enlace de recuperación
                </Label>
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="tu@email.com"
                  value={resetEmail || email}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoComplete="email"
                />
                <Button
                  type="button"
                  className="w-full"
                  variant="secondary"
                  onClick={handlePasswordReset}
                  disabled={isSendingReset || isLoading}
                >
                  {isSendingReset ? 'Enviando correo...' : 'Enviar enlace de recuperación'}
                </Button>
              </div>
            )}

            <Button type="submit" className="btn-gradient w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden bg-secondary lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
            <Video className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-secondary-foreground">
            Conecta con tu equipo desde cualquier lugar
          </h2>
          <p className="mt-4 text-secondary-foreground/80">
            Videoconferencias de alta calidad, chat en tiempo real y colaboración sin límites.
          </p>
        </div>
      </div>
    </div>
  );
}
