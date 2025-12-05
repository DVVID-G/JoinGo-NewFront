import { AuthTokens } from '@/store/authStore';

const SECURE_TOKEN_ENDPOINT = 'https://securetoken.googleapis.com/v1/token';

interface RefreshResponse {
  id_token: string;
  refresh_token: string;
  expires_in: string;
}

function ensureApiKey(): string {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('La variable VITE_FIREBASE_API_KEY no está configurada.');
  }
  return apiKey;
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthTokens> {
  const apiKey = ensureApiKey();
  const response = await fetch(`${SECURE_TOKEN_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const payload: RefreshResponse | { error?: { message?: string } } = await response
    .json()
    .catch(() => ({} as RefreshResponse));

  if (!response.ok || !('id_token' in payload)) {
    const message =
      (payload as { error?: { message?: string } }).error?.message ?? response.statusText;
    throw new Error(`No se pudo refrescar el token: ${message}`);
  }

  return {
    idToken: payload.id_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiresAt: Date.now() + Number(payload.expires_in) * 1000,
  };
}
