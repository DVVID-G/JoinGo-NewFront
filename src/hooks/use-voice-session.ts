import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVoiceSession,
  getVoiceConfig,
  isTokenExpiringSoon,
  VoiceConfig,
  VoiceSession,
} from '@/services/voice';

interface UseVoiceSessionOptions {
  /** ID de la reunión */
  meetingId: string;
  /** Si debe conectar automáticamente al montar */
  autoConnect?: boolean;
  /** Callback cuando la sesión se establece */
  onSessionReady?: (session: VoiceSession) => void;
  /** Callback cuando hay un error */
  onError?: (error: Error) => void;
}

interface UseVoiceSessionReturn {
  /** Configuración de voz (ICE servers, URLs) */
  config: VoiceConfig | null;
  /** Sesión activa con token */
  session: VoiceSession | null;
  /** Si está cargando la configuración o sesión */
  isLoading: boolean;
  /** Error si ocurrió alguno */
  error: Error | null;
  /** Conectar manualmente */
  connect: () => Promise<void>;
  /** Desconectar y limpiar */
  disconnect: () => void;
  /** Renovar el token de sesión */
  refreshSession: () => Promise<void>;
}

/** Margen de seguridad para renovar token (1 minuto antes de expirar) */
const REFRESH_BUFFER_MS = 60_000;

/**
 * Hook para gestionar la sesión de voz en una reunión
 * 
 * - Obtiene la configuración de ICE servers
 * - Crea y mantiene la sesión de voz
 * - Renueva automáticamente el token antes de que expire
 * 
 * @example
 * ```tsx
 * const { config, session, connect, disconnect, isLoading, error } = useVoiceSession({
 *   meetingId: 'abc123',
 *   autoConnect: true,
 *   onSessionReady: (session) => console.log('Conectado:', session.voiceRoomId),
 * });
 * ```
 */
export function useVoiceSession({
  meetingId,
  autoConnect = false,
  onSessionReady,
  onError,
}: UseVoiceSessionOptions): UseVoiceSessionReturn {
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  
  // Usar ref para mantener meetingId actualizado sin causar re-renders
  const meetingIdRef = useRef(meetingId);
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // Limpiar timer de refresh
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Programar renovación automática del token
  const scheduleRefresh = useCallback((voiceSession: VoiceSession) => {
    clearRefreshTimer();

    const expiresAt = new Date(voiceSession.expiresAt).getTime();
    const delay = Math.max(expiresAt - Date.now() - REFRESH_BUFFER_MS, 5_000);

    refreshTimerRef.current = window.setTimeout(async () => {
      if (!isMountedRef.current) return;

      const currentMeetingId = meetingIdRef.current;
      if (!currentMeetingId) {
        console.warn('[useVoiceSession] No meetingId para renovar sesión');
        return;
      }

      try {
        const newSession = await createVoiceSession(currentMeetingId);
        if (isMountedRef.current) {
          setSession(newSession);
          scheduleRefresh(newSession);
        }
      } catch (err) {
        console.error('Error renovando sesión de voz:', err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Error renovando sesión'));
          onError?.(err instanceof Error ? err : new Error('Error renovando sesión'));
        }
      }
    }, delay);
  }, [clearRefreshTimer, onError]);

  // Obtener configuración de voz
  const fetchConfig = useCallback(async () => {
    try {
      const voiceConfig = await getVoiceConfig();
      if (isMountedRef.current) {
        setConfig(voiceConfig);
      }
      return voiceConfig;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error obteniendo configuración de voz');
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
      throw error;
    }
  }, [onError]);

  // Crear sesión de voz
  const createSession = useCallback(async () => {
    const currentMeetingId = meetingIdRef.current;
    if (!currentMeetingId) {
      throw new Error('No hay meetingId para crear sesión');
    }
    
    try {
      const voiceSession = await createVoiceSession(currentMeetingId);
      if (isMountedRef.current) {
        setSession(voiceSession);
        scheduleRefresh(voiceSession);
        onSessionReady?.(voiceSession);
      }
      return voiceSession;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error creando sesión de voz');
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
      throw error;
    }
  }, [scheduleRefresh, onSessionReady, onError]);

  // Conectar: obtener config + crear sesión
  const connect = useCallback(async () => {
    const currentMeetingId = meetingIdRef.current;
    console.log('[useVoiceSession] Iniciando conexión para meetingId:', currentMeetingId);
    
    if (!currentMeetingId) {
      console.warn('[useVoiceSession] ⚠️ No hay meetingId, abortando conexión');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useVoiceSession] Obteniendo configuración de voz...');
      const voiceConfig = await fetchConfig();
      console.log('[useVoiceSession] ✅ Config obtenida:', voiceConfig);
      
      console.log('[useVoiceSession] Creando sesión de voz...');
      const voiceSession = await createSession();
      console.log('[useVoiceSession] ✅ Sesión creada:', voiceSession);
    } catch (err) {
      console.error('[useVoiceSession] ❌ Error en conexión:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchConfig, createSession]);

  // Desconectar y limpiar
  const disconnect = useCallback(() => {
    clearRefreshTimer();
    setSession(null);
    setError(null);
  }, [clearRefreshTimer]);

  // Renovar sesión manualmente
  const refreshSession = useCallback(async () => {
    if (!session || !isTokenExpiringSoon(session, REFRESH_BUFFER_MS * 2)) {
      return;
    }

    try {
      const newSession = await createVoiceSession(meetingId);
      if (isMountedRef.current) {
        setSession(newSession);
        scheduleRefresh(newSession);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error renovando sesión');
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
    }
  }, [session, meetingId, scheduleRefresh, onError]);

  // Auto-conectar al montar si está habilitado
  useEffect(() => {
    if (autoConnect && meetingId) {
      connect();
    }
  }, [autoConnect, meetingId, connect]);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearRefreshTimer();
    };
  }, [clearRefreshTimer]);

  return {
    config,
    session,
    isLoading,
    error,
    connect,
    disconnect,
    refreshSession,
  };
}
