import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Clock, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useMeetingStore } from '@/store/meetingStore';
import type { ApiError } from '@/lib/api-client';
import { createMeeting } from '@/services/meetings';
import { toast } from 'sonner';

const generateTimeOptions = () => {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

export function CreateMeetingForm() {
  const { user } = useAuthStore();
  const { upsertMeeting } = useMeetingStore();
  
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [errors, setErrors] = useState({
    name: '',
    date: '',
    startTime: '',
    endTime: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = {
      name: '',
      date: '',
      startTime: '',
      endTime: '',
    };

    if (!name.trim()) {
      nextErrors.name = 'Ingresa el nombre de la reunión.';
    }

    if (!date) {
      nextErrors.date = 'Selecciona una fecha.';
    }

    if (!startTime) {
      nextErrors.startTime = 'Selecciona la hora de inicio.';
    }

    if (!endTime) {
      nextErrors.endTime = 'Selecciona la hora de fin.';
    }

    if (startTime && endTime && startTime >= endTime) {
      nextErrors.endTime = 'La hora de fin debe ser posterior a la hora de inicio.';
    }

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      setFormMessage('Revisa y corrige los campos marcados.');
      toast.error('Faltan datos requeridos');
      return;
    }

    if (!date) {
      // Type guard for date-fns usage; covered by validation above.
      return;
    }

    setFormMessage('');

    setIsLoading(true);

    try {
      const meeting = await createMeeting({
        meetingName: name.trim(),
        date: format(date, 'yyyy-MM-dd'),
        startTime,
        endTime,
        participants: user?.email ? [user.email] : [],
      });

      upsertMeeting(meeting);
      toast.success('Reunión creada exitosamente');
      setName('');
      setDate(undefined);
      setStartTime('');
      setEndTime('');
    } catch (error) {
      toast.error(translateApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const translateApiError = (error: unknown) => {
    if (isApiError(error)) {
      switch (error.status) {
        case 400:
          return 'Los datos de la reunión no son válidos.';
        case 401:
          return 'Tu sesión expiró. Inicia sesión nuevamente.';
        case 403:
          return 'No tienes permisos para crear reuniones.';
        default:
          return error.message || 'No pudimos crear la reunión. Intenta más tarde.';
      }
    }
    return 'Ocurrió un error inesperado. Intenta nuevamente.';
  };

  const isApiError = (error: unknown): error is ApiError =>
    typeof error === 'object' && error !== null && 'status' in error && 'message' in error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div aria-live="polite" className="sr-only">
        {formMessage}
      </div>
      <div>
        <Label htmlFor="meeting-name">Nombre de la reunión</Label>
        <Input
          id="meeting-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Reunión de equipo"
          className="mt-2"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'meeting-name-error' : undefined}
          required
        />
        {errors.name && (
          <p id="meeting-name-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <Label>Fecha</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'mt-2 w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? 'meeting-date-error' : undefined}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP', { locale: es }) : 'Selecciona una fecha'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p id="meeting-date-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.date}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Hora de inicio</Label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger
              className="mt-2"
              aria-invalid={Boolean(errors.startTime)}
              aria-describedby={errors.startTime ? 'meeting-start-error' : undefined}
            >
              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Inicio" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={`start-${time}`} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.startTime && (
            <p id="meeting-start-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.startTime}
            </p>
          )}
        </div>

        <div>
          <Label>Hora de fin</Label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger
              className="mt-2"
              aria-invalid={Boolean(errors.endTime)}
              aria-describedby={errors.endTime ? 'meeting-end-error' : undefined}
            >
              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Fin" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={`end-${time}`} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.endTime && (
            <p id="meeting-end-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.endTime}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="btn-gradient w-full"
        disabled={isLoading}
      >
        <Video className="mr-2 h-4 w-4" />
        {isLoading ? 'Creando...' : 'Crear reunión'}
      </Button>
    </form>
  );
}
