import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService, ChatConnectionState, ChatMessage, UsersOnlinePayload } from '@/services/chat';
import { useAuthStore } from '@/store/authStore';

interface UseChatOptions {
  /** ID de la reunión */
  meetingId: string;
  /** Si debe conectar automáticamente al montar */
  autoConnect?: boolean;
  /** Límite de mensajes del historial */
  historyLimit?: number;
  /** Callback cuando llega un nuevo mensaje */
  onNewMessage?: (message: ChatMessage) => void;
  /** Callback cuando cambia la lista de usuarios online */
  onUsersOnline?: (payload: UsersOnlinePayload) => void;
  /** Callback cuando hay un error */
  onError?: (error: { code: string; message: string }) => void;
}

interface UseChatReturn {
  /** Lista de mensajes (historial + nuevos) */
  messages: ChatMessage[];
  /** Estado de la conexión */
  connectionState: ChatConnectionState;
  /** Si está cargando el historial */
  isLoadingHistory: boolean;
  /** Error si ocurrió alguno */
  error: Error | null;
  /** Usuarios online en la sala */
  usersOnline: UsersOnlinePayload | null;
  /** Enviar un mensaje */
  sendMessage: (message: string) => void;
  /** Conectar manualmente */
  connect: () => void;
  /** Desconectar manualmente */
  disconnect: () => void;
  /** Recargar historial */
  reloadHistory: () => Promise<void>;
}

/**
 * Hook para gestionar el chat en una reunión
 * 
 * - Carga el historial de mensajes
 * - Se conecta a Socket.IO para mensajes en tiempo real
 * - Mantiene la lista de mensajes actualizada
 * 
 * @example
 * ```tsx
 * const { messages, sendMessage, connectionState } = useChat({
 *   meetingId: 'abc123',
 *   autoConnect: true,
 * });
 * 
 * // Enviar mensaje
 * sendMessage('Hola a todos!');
 * 
 * // Mostrar mensajes
 * messages.map(msg => <ChatBubble key={msg.messageId} {...msg} />)
 * ```
 */
export function useChat({
  meetingId,
  autoConnect = false,
  historyLimit = 50,
  onNewMessage,
  onUsersOnline,
  onError,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>('disconnected');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [usersOnline, setUsersOnline] = useState<UsersOnlinePayload | null>(null);
  
  const { isAuthenticated } = useAuthStore();
  const isMountedRef = useRef(true);
  
  // Usar ref para mantener meetingId actualizado sin causar re-renders
  const meetingIdRef = useRef(meetingId);
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // Cargar historial de mensajes
  const loadHistory = useCallback(async () => {
    if (!meetingId) return;

    setIsLoadingHistory(true);
    setError(null);

    try {
      const history = await chatService.loadHistory(meetingId, historyLimit);
      if (isMountedRef.current) {
        setMessages(history);
      }
    } catch (err) {
      console.error('Error cargando historial de chat:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Error cargando historial'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingHistory(false);
      }
    }
  }, [meetingId, historyLimit]);

  // Conectar al chat
  const connect = useCallback(() => {
    const currentMeetingId = meetingIdRef.current;
    console.log('[useChat] connect() llamado con meetingId:', currentMeetingId);
    
    if (!currentMeetingId || !isAuthenticated) {
      console.warn('[useChat] ⚠️ No se puede conectar: meetingId=', currentMeetingId, 'isAuthenticated=', isAuthenticated);
      return;
    }
    chatService.connect(currentMeetingId);
  }, [isAuthenticated]);

  // Desconectar del chat
  const disconnect = useCallback(() => {
    chatService.disconnect();
  }, []);

  // Enviar mensaje
  const sendMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    chatService.sendMessage(message.trim());
  }, []);

  // Suscribirse a eventos del chat
  useEffect(() => {
    // Listener para nuevos mensajes
    const unsubMessage = chatService.onMessage((message) => {
      if (isMountedRef.current) {
        setMessages((prev) => {
          // Evitar duplicados
          if (prev.some((m) => m.messageId === message.messageId)) {
            return prev;
          }
          return [...prev, message];
        });
        onNewMessage?.(message);
      }
    });

    // Listener para usuarios online (spec: usersOnline event)
    const unsubUsersOnline = chatService.onUsersOnline((payload) => {
      if (isMountedRef.current) {
        setUsersOnline(payload);
        onUsersOnline?.(payload);
      }
    });

    // Listener para cambios de estado
    const unsubState = chatService.onConnectionStateChange((state) => {
      if (isMountedRef.current) {
        setConnectionState(state);
      }
    });

    // Listener para errores
    const unsubError = chatService.onError((err) => {
      if (isMountedRef.current) {
        setError(new Error(err.message));
        onError?.(err);
      }
    });

    return () => {
      unsubMessage();
      unsubUsersOnline();
      unsubState();
      unsubError();
    };
  }, [onNewMessage, onUsersOnline, onError]);

  // Cargar historial y auto-conectar si está habilitado
  useEffect(() => {
    if (meetingId && isAuthenticated) {
      loadHistory();

      if (autoConnect) {
        connect();
      }
    }

    return () => {
      // Desconectar al desmontar
      disconnect();
    };
  }, [meetingId, isAuthenticated, autoConnect, loadHistory, connect, disconnect]);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    messages,
    connectionState,
    isLoadingHistory,
    error,
    usersOnline,
    sendMessage,
    connect,
    disconnect,
    reloadHistory: loadHistory,
  };
}
