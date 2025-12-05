import { apiFetch } from '@/lib/api-client';

/**
 * Configuración de servidor ICE para WebRTC
 */
export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

/**
 * Configuración de voz devuelta por el backend
 */
export interface VoiceConfig {
  voiceServerUrl: string;
  signalUrl: string;
  iceServers: IceServer[];
  requiresToken: boolean;
}

/**
 * Sesión de voz para unirse a una reunión
 * El token expira en 5 minutos
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
 * Configuración local de ICE servers desde variables de entorno
 * Se usa como fallback si el backend no responde
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
 * URL del servidor WebRTC desde variables de entorno
 */
export function getWebRTCServerUrl(): string {
  return import.meta.env.VITE_WEBRTC_URL ?? 'http://localhost:9000';
}

/**
 * Obtiene la configuración de voz del backend
 * Incluye URLs del servidor y configuración de ICE servers
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
 * Crea una sesión de voz para unirse a una reunión
 * El token devuelto es válido por 5 minutos
 * 
 * @param meetingId - ID de la reunión a la que se quiere unir
 * @returns Sesión con token y configuración para conectar
 */
export async function createVoiceSession(meetingId: string): Promise<VoiceSession> {
  const session = await apiFetch<VoiceSession>('/api/voice/session', {
    method: 'POST',
    body: JSON.stringify({ meetingId }),
  });

  return session;
}

/**
 * Calcula el tiempo restante antes de que expire el token de voz
 * @returns milisegundos hasta expiración, o 0 si ya expiró
 */
export function getTokenExpirationMs(session: VoiceSession): number {
  const expiresAt = new Date(session.expiresAt).getTime();
  const remaining = expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Verifica si un token de sesión de voz está por expirar
 * @param session - Sesión de voz a verificar
 * @param bufferMs - Margen de seguridad en ms (default: 60 segundos)
 */
export function isTokenExpiringSoon(session: VoiceSession, bufferMs = 60_000): boolean {
  return getTokenExpirationMs(session) < bufferMs;
}
