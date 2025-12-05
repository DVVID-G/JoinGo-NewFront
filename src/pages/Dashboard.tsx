import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, UserPlus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layout } from '@/components/layout/Layout';
import { CreateMeetingForm } from '@/components/CreateMeetingForm';
import { UpcomingMeetings } from '@/components/UpcomingMeetings';
import { useAuthStore } from '@/store/authStore';
import { useMeetingStore } from '@/store/meetingStore';
import { toast } from 'sonner';

/**
 * Dashboard page for authenticated users to create or join meetings and view upcoming ones.
 */
export default function Dashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const { getUpcomingMeetings } = useMeetingStore();
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');

  const upcomingMeetings = getUpcomingMeetings();

  const joinMeeting = () => {
    if (meetingCode.trim()) {
      navigate(`/meeting/${meetingCode.trim()}`);
    } else {
      toast.error('Por favor ingresa un código de reunión');
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-20">
          <div className="card-elevated max-w-md p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Video className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-foreground">Accede a tu cuenta</h1>
            <p className="mt-2 text-muted-foreground">
              Inicia sesión para crear o unirte a reuniones
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild className="btn-gradient">
                <a href="/login">Iniciar sesión</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/register">Crear cuenta</a>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 lg:px-8">
        {/* Welcome */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-foreground">
            Hola, {user?.firstName || 'Usuario'} 👋
          </h1>
          <p className="mt-2 text-muted-foreground">
            Crea una nueva reunión o únete a una existente
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Create Meeting */}
          <div className="card-elevated p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Video className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Crear reunión</h2>
                <p className="text-sm text-muted-foreground">Programa una nueva videollamada</p>
              </div>
            </div>

            <div className="mt-6">
              <CreateMeetingForm />
            </div>
          </div>

          {/* Join Meeting */}
          <div className="card-elevated p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <UserPlus className="h-6 w-6 text-accent" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Unirse a reunión</h2>
                <p className="text-sm text-muted-foreground">Ingresa el código de la reunión</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="meeting-code">Código de reunión</Label>
                <Input
                  id="meeting-code"
                  placeholder="Ej: FRTKiUW8Ig"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  className="mt-2 font-mono tracking-wider"
                  aria-describedby="meeting-code-hint"
                />
                <p id="meeting-code-hint" className="mt-1 text-xs text-muted-foreground">
                  Pide el código a quien organizó la reunión (respeta mayúsculas y minúsculas)
                </p>
              </div>
              <Button
                onClick={joinMeeting}
                disabled={!meetingCode.trim()}
                className="btn-accent w-full"
              >
                <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Unirse a la reunión
              </Button>
            </div>
          </div>
        </div>

        {/* Upcoming meetings */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Reuniones próximas ({upcomingMeetings.length})
            </h2>
          </div>
          <UpcomingMeetings meetings={upcomingMeetings} />
        </div>
      </div>
    </Layout>
  );
}
