import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useMeetingStore } from '@/store/meetingStore';
import { fetchMeetings } from '@/services/meetings';
import type { ApiError } from '@/lib/api-client';

function isApiError(error: unknown): error is ApiError {
  return Boolean(error) && typeof error === 'object' && 'status' in error;
}

export function useMeetings() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.tokens?.idToken ?? null);
  const setMeetings = useMeetingStore((state) => state.setMeetings);
  const clearMeetings = useMeetingStore((state) => state.clearMeetings);
  const isFetching = useRef(false);
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      lastToken.current = null;
      clearMeetings();
      return;
    }

    if (isFetching.current || lastToken.current === token) {
      return;
    }

    isFetching.current = true;

    fetchMeetings()
      .then((meetings) => {
        setMeetings(meetings);
        lastToken.current = token;
      })
      .catch((error) => {
        if (isApiError(error) && error.status === 401) {
          toast.error('Tu sesión expiró. Por favor vuelve a iniciar sesión.');
          return;
        }
        console.error('No se pudieron cargar las reuniones', error);
        toast.error('No pudimos cargar tus reuniones. Intenta más tarde.');
      })
      .finally(() => {
        isFetching.current = false;
      });
  }, [isAuthenticated, token, setMeetings, clearMeetings]);
}
