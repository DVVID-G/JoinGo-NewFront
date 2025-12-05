import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Copy, Trash2, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMeetingStore, Meeting } from '@/store/meetingStore';
import { toast } from 'sonner';

interface UpcomingMeetingsProps {
  meetings: Meeting[];
}

/**
 * Card list showing upcoming meetings with quick actions to join, copy code, or remove.
 */
export function UpcomingMeetings({ meetings }: UpcomingMeetingsProps) {
  const navigate = useNavigate();
  const { removeMeeting } = useMeetingStore();

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success('Código copiado al portapapeles');
  };

  const handleJoinMeeting = (meeting: Meeting) => {
    // Usar el ID real del backend, no el código de acceso
    // Esto garantiza que el endpoint GET /api/meetings/:id funcione
    navigate(`/meeting/${meeting.id}`);
  };

  const handleDeleteMeeting = (id: string, name: string) => {
    removeMeeting(id);
    toast.success(`Reunión "${name}" eliminada`);
  };

  if (meetings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">
          No tienes reuniones próximas
        </p>
        <p className="text-sm text-muted-foreground/70">
          Crea una nueva reunión para empezar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meetings.map((meeting) => (
        <div
          key={meeting.id}
          className="card-elevated flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {meeting.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(meeting.date), 'dd MMM yyyy', { locale: es })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {meeting.startTime} - {meeting.endTime}
              </span>
            </div>
            <button
              onClick={() => handleCopyCode(meeting.code)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="font-mono">{meeting.code}</span>
              <Copy className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Copiar código de la reunión</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleJoinMeeting(meeting)}
              className="btn-gradient focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              size="sm"
            >
              <Video className="mr-2 h-4 w-4" />
              Unirse
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteMeeting(meeting.id, meeting.name)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Eliminar reunión"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
