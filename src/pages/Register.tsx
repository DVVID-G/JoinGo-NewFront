import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Mail, Lock, User, Eye, EyeOff, Phone, Calendar } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/store/authStore';
import {
  completeProviderRedirect,
  isProviderRedirectError,
  loginWithProvider,
  registerWithEmail,
} from '@/services/auth';
import { syncUserProfile } from '@/services/user';
import type { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Registration page supporting email/password sign-up and OAuth onboarding.
 */
export default function Register() {
  const navigate = useNavigate();
  const { login, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resumeProviderRegister = async () => {
      try {
        const payload = await completeProviderRedirect();
        if (!payload || !isMounted) {
          return;
        }

        setIsLoading(true);
        login(payload);
        toast.success('¡Cuenta creada exitosamente!');
        navigate('/dashboard');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof FirebaseError
            ? translateFirebaseError(error)
            : 'No pudimos completar el registro con el proveedor seleccionado.';
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    resumeProviderRegister();

    return () => {
      isMounted = false;
    };
  }, [login, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (!acceptTerms) {
      toast.error('Debes aceptar los términos y condiciones');
      return;
    }

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const parsedAge = age ? parseInt(age, 10) : undefined;
    const normalizedAge = Number.isNaN(parsedAge) ? undefined : parsedAge;

    setIsLoading(true);
    try {
      const payload = await registerWithEmail({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phoneNumber: phone.trim() || undefined,
        age: normalizedAge,
      });
      login(payload);

      try {
        const synced = await syncUserProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phone.trim() || undefined,
          age: normalizedAge,
        });
        updateUser(synced);
      } catch (syncError) {
        console.warn('No se pudo sincronizar el perfil después del registro', syncError);
      }
      toast.success('¡Cuenta creada exitosamente!');
      navigate('/dashboard');
    } catch (error) {
      const message = isApiError(error)
        ? translateApiError(error)
        : error instanceof FirebaseError
          ? translateFirebaseError(error)
          : 'No pudimos crear tu cuenta. Intenta nuevamente.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthRegister = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      const payload = await loginWithProvider(provider);
      login(payload);
      toast.success('¡Cuenta creada exitosamente!');
      navigate('/dashboard');
    } catch (error) {
      if (isProviderRedirectError(error)) {
        toast.info('Redirigiendo para continuar el registro...');
        return;
      }
      const message =
        error instanceof FirebaseError
          ? translateFirebaseError(error)
          : 'No pudimos completar el registro con el proveedor seleccionado.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const translateFirebaseError = (error: FirebaseError) => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con este correo.';
      case 'auth/invalid-email':
        return 'El correo ingresado no es válido.';
      case 'auth/weak-password':
        return 'La contraseña es demasiado débil.';
      default:
        return 'Ocurrió un error al procesar tu solicitud.';
    }
  };

  const isApiError = (error: unknown): error is ApiError =>
    typeof error === 'object' && error !== null && 'status' in error && 'message' in error;

  const translateApiError = (error: ApiError) => {
    if (error.status === 409 || error.code === 'CONFLICT') {
      return 'Ya existe una cuenta con este correo.';
    }
    if (error.status === 400) {
      return 'Los datos enviados no son válidos. Revisa e inténtalo de nuevo.';
    }
    if (error.status === 500) {
      return 'Tenemos un problema en el servidor. Intenta nuevamente más tarde.';
    }
    return error.message || 'No pudimos crear tu cuenta. Intenta nuevamente.';
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

          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Crear cuenta</h1>
          <p className="mt-2 text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>

          {/* OAuth buttons */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => handleOAuthRegister('google')}
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
              onClick={() => handleOAuthRegister('github')}
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

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label htmlFor="firstName">Nombre *</Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Juan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="pl-10"
                    autoComplete="given-name"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="lastName">Apellido *</Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Pérez"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="pl-10"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="email">Correo electrónico *</Label>
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

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative mt-2">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 234 567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="age">Edad</Label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="120"
                    placeholder="25"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
              <p className="mt-1 text-xs text-muted-foreground">Mínimo 8 caracteres</p>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
                Acepto los{' '}
                <Link to="#" className="text-primary hover:underline">
                  términos de servicio
                </Link>{' '}
                y la{' '}
                <Link to="#" className="text-primary hover:underline">
                  política de privacidad
                </Link>
              </Label>
            </div>

            <Button type="submit" className="btn-gradient w-full" disabled={isLoading}>
              {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
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
            Únete a miles de equipos que ya usan JoinGo
          </h2>
          <p className="mt-4 text-secondary-foreground/80">
            Empieza a conectar con tu equipo hoy mismo. Sin instalaciones, sin complicaciones.
          </p>
        </div>
      </div>
    </div>
  );
}
