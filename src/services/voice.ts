import { apiFetch } from '@/lib/api-client';

/**
 * ICE server configuration for WebRTC.
 */
export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

/**
 * Voice configuration returned by the backend.
 */
export interface VoiceConfig {
  voiceServerUrl: string;
  signalUrl: string;
  iceServers: IceServer[];
  requiresToken: boolean;
}

/**
 * Voice session metadata required to join a meeting. Token typically expires in 5 minutes.
 */
export interface VoiceSession {
  meetingId: string;
  voiceRoomId: string;
  userId: string;
  voiceServerUrl: string;
  signalUrl: string;
  iceServers: IceServer[];
  token?: string;
  expiresAt: string;
}

/**
 * Builds ICE server configuration from env variables; used as fallback when backend is unavailable.
 */
export function getLocalIceServers(): IceServer[] {
  const iceUrl = import.meta.env.VITE_ICE_SERVER_URL;
  const iceUsername = import.meta.env.VITE_ICE_SERVER_USERNAME;
  const iceCredential = import.meta.env.VITE_ICE_SERVER_CREDENTIAL;

  if (!iceUrl) {
    return [];
  }

  return [
    {
      urls: `turn:${iceUrl}`,
      username: iceUsername,
      credential: iceCredential,
    },
    {
      urls: `stun:${iceUrl}`,
    },
  ];
}

/**
 * Returns WebRTC server base URL from env with a localhost fallback.
 */
export function getWebRTCServerUrl(): string {
  return import.meta.env.VITE_WEBRTC_URL ?? 'http://localhost:9000';
}

/**
 * Fetches voice configuration from the backend, falling back to local env values on error.
 * @returns Voice configuration including signaling endpoints and ICE servers.
 */
export async function getVoiceConfig(): Promise<VoiceConfig> {
  try {
    const config = await apiFetch<VoiceConfig>('/api/voice/config');
    return config;
  } catch (error) {
    // Fallback a configuración local si el backend falla
    console.warn('No se pudo obtener config de voz del backend, usando fallback local', error);
    
    const webrtcUrl = getWebRTCServerUrl();
    return {
      voiceServerUrl: webrtcUrl,
      signalUrl: `${webrtcUrl}/ws`,
      iceServers: getLocalIceServers(),
      requiresToken: true,
    };
  }
}

/**
 * Creates a voice session for a meeting; token is typically valid for ~5 minutes.
 * @param meetingId Meeting identifier to join.
 * @returns Session payload containing token and connection settings.
 */
export async function createVoiceSession(meetingId: string): Promise<VoiceSession> {
  const session = await apiFetch<VoiceSession>('/api/voice/session', {
    method: 'POST',
    body: JSON.stringify({ meetingId }),
  });

  return session;
}

/**
 * Computes remaining lifetime for a voice session token.
 * @returns Milliseconds until expiration (0 when already expired).
 */
export function getTokenExpirationMs(session: VoiceSession): number {
  const expiresAt = new Date(session.expiresAt).getTime();
  const remaining = expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Checks whether a voice session token is about to expire.
 * @param session Session to inspect.
 * @param bufferMs Safety buffer in ms (default 60s).
 */
export function isTokenExpiringSoon(session: VoiceSession, bufferMs = 60_000): boolean {
  return getTokenExpirationMs(session) < bufferMs;
}
