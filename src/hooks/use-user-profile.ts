import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { fetchCurrentUser } from '@/services/user';
import type { ApiError } from '@/lib/api-client';

function isApiError(error: unknown): error is ApiError {
  return Boolean(error) && typeof error === 'object' && 'status' in error;
}

export function useUserProfile() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const tokens = useAuthStore((state) => state.tokens);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);
  const isFetching = useRef(false);
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !tokens?.idToken) {
      lastToken.current = null;
      isFetching.current = false;
      return;
    }

    if (lastToken.current === tokens.idToken || isFetching.current) {
      return;
    }

    isFetching.current = true;

    fetchCurrentUser()
      .then((profile) => {
        updateUser(profile);
        lastToken.current = tokens.idToken ?? null;
      })
      .catch((error) => {
        if (isApiError(error) && error.status === 401) {
          toast.error('Tu sesión expiró, por favor inicia sesión nuevamente.');
          logout();
          return;
        }
        console.error('No se pudo obtener el perfil del usuario', error);
      })
      .finally(() => {
        isFetching.current = false;
      });
  }, [isAuthenticated, tokens?.idToken, updateUser, logout]);
}
