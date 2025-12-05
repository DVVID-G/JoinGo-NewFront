import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService, ChatConnectionState, ChatMessage, UsersOnlinePayload } from '@/services/chat';
import { useAuthStore } from '@/store/authStore';

interface UseChatOptions {
  /** Meeting identifier used to scope messages. */
  meetingId: string;
  /** Whether to auto-connect on mount. */
  autoConnect?: boolean;
  /** Max number of historical messages to load. */
  historyLimit?: number;
  /** Called for each incoming message. */
  onNewMessage?: (message: ChatMessage) => void;
  /** Called when the server reports online users. */
  onUsersOnline?: (payload: UsersOnlinePayload) => void;
  /** Called when the chat service emits an error. */
  onError?: (error: { code: string; message: string }) => void;
}

interface UseChatReturn {
  /** Messages (history + new ones) for the current room. */
  messages: ChatMessage[];
  /** Connection state reported by chat service. */
  connectionState: ChatConnectionState;
  /** Indicates when message history is loading. */
  isLoadingHistory: boolean;
  /** Last error, if any. */
  error: Error | null;
  /** Users online payload for the room. */
  usersOnline: UsersOnlinePayload | null;
  /** Sends a chat message. */
  sendMessage: (message: string) => void;
  /** Connects manually to the chat service. */
  connect: () => void;
  /** Disconnects manually from the chat service. */
  disconnect: () => void;
  /** Reloads history from backend. */
  reloadHistory: () => Promise<void>;
}

/**
 * Chat hook that loads history and wires Socket.IO real-time messaging for a meeting room.
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, connectionState } = useChat({
 *   meetingId: 'abc123',
 *   autoConnect: true,
 * });
 * 
 * sendMessage('Hola a todos!');
 * messages.map(msg => <ChatBubble key={msg.messageId} {...msg} />);
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
