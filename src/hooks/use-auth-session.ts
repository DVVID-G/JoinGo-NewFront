import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { refreshAuthTokens } from '@/services/token';

const REFRESH_BUFFER_MS = 60_000; // Refresh 1 minute before expiration

export function useAuthSession() {
  const tokens = useAuthStore((state) => state.tokens);
  const setTokens = useAuthStore((state) => state.setTokens);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!tokens?.refreshToken || !tokens.expiresAt) {
      return undefined;
    }

    const delay = Math.max(tokens.expiresAt - Date.now() - REFRESH_BUFFER_MS, 5_000);
    const timer = window.setTimeout(async () => {
      try {
        const nextTokens = await refreshAuthTokens(tokens.refreshToken);
        setTokens(nextTokens);
      } catch (error) {
        console.error('No se pudo refrescar la sesión automáticamente', error);
        logout();
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [tokens?.refreshToken, tokens?.expiresAt, setTokens, logout]);
}
