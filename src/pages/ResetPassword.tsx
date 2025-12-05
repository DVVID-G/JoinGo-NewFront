import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') || '';

  const [isVerifying, setIsVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        toast.error('Código inválido');
        setIsVerifying(false);
        return;
      }
      try {
        const email = await verifyPasswordResetCode(firebaseAuth, oobCode);
        setVerifiedEmail(email);
      } catch (error) {
        const message = error instanceof FirebaseError ? translateFirebaseError(error) : 'El enlace no es válido o expiró.';
        toast.error(message);
      } finally {
        setIsVerifying(false);
      }
    };
    verifyCode();
  }, [oobCode]);

  const translateFirebaseError = (error: FirebaseError) => {
    switch (error.code) {
      case 'auth/expired-action-code':
        return 'El enlace de recuperación expiró. Solicita uno nuevo.';
      case 'auth/invalid-action-code':
        return 'El enlace de recuperación no es válido.';
      case 'auth/user-disabled':
        return 'La cuenta está deshabilitada.';
      default:
        return 'No pudimos validar el enlace.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      toast.error('Código inválido');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, password);
      toast.success('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
      navigate('/login');
    } catch (error) {
      const message = error instanceof FirebaseError ? translateFirebaseError(error) : 'No pudimos actualizar tu contraseña.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
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

          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Shield className="h-4 w-4" />
            Recuperación de acceso
          </div>

          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Restablecer contraseña</h1>
          <p className="mt-2 text-muted-foreground">
            Ingresa una nueva contraseña para {verifiedEmail || 'tu cuenta'}.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="password">Nueva contraseña</Label>
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
                  disabled={isVerifying || isSubmitting}
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

            <div>
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  autoComplete="new-password"
                  disabled={isVerifying || isSubmitting}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="btn-gradient w-full"
              disabled={isVerifying || isSubmitting}
            >
              {isVerifying ? 'Validando enlace...' : isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              ¿Recordaste tu contraseña?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden bg-secondary lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
            <Lock className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-secondary-foreground">
            Mantén tu cuenta protegida
          </h2>
          <p className="mt-4 text-secondary-foreground/80">
            Usa un enlace seguro enviado a tu correo para restablecer tu acceso.
          </p>
        </div>
      </div>
    </div>
  );
}
