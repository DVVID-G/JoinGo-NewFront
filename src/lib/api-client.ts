import { useAuthStore } from '@/store/authStore';
import { refreshAuthTokens } from '@/services/token';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Normalized error shape returned by `apiFetch`.
 */
export interface ApiError {
  /** Machine-readable error code when provided by the backend. */
  code: string;
  /** Human-readable description of the error. */
  message: string;
  /** HTTP status associated with the failure. */
  status: number;
}

let refreshPromise: Promise<boolean> | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return (await response.text()) as unknown as T;
  }

  const payload = await response.json();
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

async function buildApiError(response: Response): Promise<ApiError> {
  let errorMessage = response.statusText;
  let errorCode = 'UNKNOWN_ERROR';

  try {
    const body = await response.json();
    if (body?.error) {
      errorCode = body.error.code ?? errorCode;
      errorMessage = body.error.message ?? errorMessage;
    }
  } catch (_) {
    // Ignore parsing issues and fall back to defaults
  }

  return {
    code: errorCode,
    message: errorMessage,
    status: response.status,
  };
}

function prepareRequest(path: string, options: RequestInit = {}) {
  const { tokens } = useAuthStore.getState();
  const headers = new Headers(options.headers ?? {});

  if (tokens?.idToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${tokens.idToken}`);
  }

  const isJsonBody = options.body && !(options.body instanceof FormData);
  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return {
    url: `${API_BASE_URL}${path}`,
    init: {
      ...options,
      headers,
    } as RequestInit,
  };
}

async function tryRefreshTokens(): Promise<boolean> {
  const { tokens, setTokens, logout } = useAuthStore.getState();
  if (!tokens?.refreshToken) {
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAuthTokens(tokens.refreshToken)
      .then((nextTokens) => {
        setTokens(nextTokens);
        return true;
      })
      .catch((error) => {
        console.error('Error refrescando tokens', error);
        logout();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

/**
 * Wrapper over `fetch` that injects auth headers, parses `{ data: T }` payloads,
 * and retries once on 401 by refreshing Firebase tokens.
 * @param path Relative API path (prefixed with `VITE_API_URL`).
 * @param options Request init options; JSON body automatically sets `Content-Type`.
 * @param retry Internal flag to avoid infinite loops after a refresh attempt.
 * @returns Parsed response payload, unwrapped from `{ data: T }` when present.
 * @throws ApiError when the response is not ok after optional refresh.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const { url, init } = prepareRequest(path, options);
  const response = await fetch(url, init);

  if (response.ok) {
    return parseResponse<T>(response);
  }

  if (response.status === 401 && retry) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    }
  }

  throw await buildApiError(response);
}
