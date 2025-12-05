import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Camera, Trash2, Save, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/store/authStore';
import type { ApiError } from '@/lib/api-client';
import { deleteUserAccount, updateUserProfile } from '@/services/user';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser, logout } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [age, setAge] = useState(user?.age?.toString() || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setAge(user.age?.toString() || '');
  }, [user]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    if (!lastName.trim()) {
      toast.error('El apellido no puede estar vacío');
      return;
    }

    const parsedAge = age ? parseInt(age, 10) : undefined;
    const normalizedAge = Number.isNaN(parsedAge) ? undefined : parsedAge;

    setIsLoading(true);

    try {
      const updated = await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phone.trim() || undefined,
        age: normalizedAge,
      });
      updateUser(updated);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      toast.error(translateApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUserAccount({ full: true });
      toast.success('Cuenta eliminada correctamente');
      logout();
      navigate('/');
    } catch (error) {
      toast.error(translateApiError(error));
    }
  };

  const translateApiError = (error: unknown) => {
    if (isApiError(error)) {
      if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
      if (error.status === 403) return 'No tienes permisos para esta acción.';
      if (error.status === 409) return 'Ya existe un usuario con estos datos.';
      return error.message || 'No pudimos actualizar tu perfil. Intenta más tarde.';
    }
    return 'Ocurrió un error inesperado. Intenta nuevamente.';
  };

  const isApiError = (error: unknown): error is ApiError =>
    typeof error === 'object' && error !== null && 'status' in error && 'message' in error;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-foreground">Mi perfil</h1>
          <p className="mt-2 text-muted-foreground">
            Administra tu información personal y preferencias
          </p>

          <div className="mt-8 space-y-8">
            {/* Avatar section */}
            <div className="card-elevated p-6">
              <h2 className="text-lg font-semibold text-foreground">Foto de perfil</h2>
              <div className="mt-4 flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.avatar} alt={`${user.firstName} ${user.lastName}`} />
                  <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                    {user.firstName.charAt(0).toUpperCase()}
                    {user.lastName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" className="gap-2">
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    Cambiar foto
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    JPG, PNG o GIF. Máximo 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Personal info form */}
            <form onSubmit={handleSave} className="card-elevated p-6">
              <h2 className="text-lg font-semibold text-foreground">Información personal</h2>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">Nombre</Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="lastName">Apellido</Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <div className="relative mt-2">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        placeholder="+1 234 567 890"
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
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="pl-10"
                        placeholder="25"
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="btn-gradient gap-2" disabled={isLoading}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {isLoading ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>

            {/* Danger zone */}
            <div className="card-elevated border-destructive/30 p-6">
              <h2 className="text-lg font-semibold text-destructive">Zona de peligro</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, asegúrate de estar seguro.
              </p>
              <Separator className="my-4" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Eliminar mi cuenta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Esto eliminará permanentemente tu cuenta
                      y todos los datos asociados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sí, eliminar mi cuenta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
