import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { ChatMessage, fetchMeetingMessages } from './meetings';

const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL ?? '';

/**
 * Eventos emitidos por el cliente (según spec eisc-chat)
 */
export type ClientChatEvent = 
  | 'newUser'      // Registrar userId después de conectar
  | 'joinRoom'     // Suscribirse a sala de reunión
  | 'chat:message'; // Enviar mensaje

/**
 * Eventos recibidos del servidor (según spec eisc-chat)
 */
export type ServerChatEvent = 
  | 'chat:message'  // Mensaje entrante
  | 'usersOnline'   // Lista de usuarios o conteo por sala
  | 'error';

/**
 * Payload para enviar un mensaje (según spec eisc-chat)
 */
export interface SendMessagePayload {
  meetingId: string;
  userId: string;
  userName?: string;
  messageId: string;
  message: string;
  timestamp: string;
}

/**
 * Payload de usersOnline por sala
 */
export interface UsersOnlinePayload {
  meetingId: string;
  users: Array<{ odId: string; odName?: string }>;
  count: number;
}

/**
 * Callback para usuarios online
 */
export type UsersOnlineCallback = (payload: UsersOnlinePayload) => void;

/**
 * Callback para recibir mensajes
 */
export type MessageCallback = (message: ChatMessage) => void;

/**
 * Callback para errores
 */
export type ErrorCallback = (error: { code: string; message: string }) => void;

/**
 * Estado de conexión del chat
 */
export type ChatConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Real-time chat client backed by Socket.IO for meeting rooms.
 *
 * @example
 * ```ts
 * chatService.connect('meeting123');
 * const offMessage = chatService.onMessage((msg) => console.log(msg.message));
 * chatService.sendMessage('Hola a todos!');
 * offMessage();
 * chatService.disconnect();
 * ```
 */
class ChatService {
  private socket: Socket | null = null;
  private currentMeetingId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private usersOnlineCallbacks: Set<UsersOnlineCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private connectionState: ChatConnectionState = 'disconnected';
  private stateChangeCallbacks: Set<(state: ChatConnectionState) => void> = new Set();

  /**
   * Returns the current connection state.
   */
  getConnectionState(): ChatConnectionState {
    return this.connectionState;
  }

  /**
   * Checks whether the socket is connected.
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.socket?.connected === true;
  }

  /**
   * Connects to the chat service and joins the given meeting room.
   * @param meetingId Meeting identifier used to scope messages and presence.
   * @remarks Requires an authenticated user with an idToken present in `authStore`.
   */
  connect(meetingId: string): void {
    console.log('[ChatService] Intentando conectar a sala:', meetingId);
    console.log('[ChatService] CHAT_SERVICE_URL:', CHAT_SERVICE_URL);
    
    if (!CHAT_SERVICE_URL) {
      console.error('[ChatService] ❌ VITE_CHAT_SERVICE_URL no está configurada');
      this.setConnectionState('error');
      return;
    }

    if (this.socket?.connected && this.currentMeetingId === meetingId) {
      console.log('[ChatService] Ya conectado a la sala:', meetingId);
      return;
    }

    // Desconectar si hay una conexión existente
    if (this.socket) {
      this.disconnect();
    }

    const { tokens, user } = useAuthStore.getState();
    console.log('[ChatService] Usuario:', user?.id, user?.firstName);
    console.log('[ChatService] Token disponible:', !!tokens?.idToken);
    
    if (!tokens?.idToken || !user) {
      console.error('[ChatService] ❌ No hay usuario autenticado para conectar al chat');
      this.setConnectionState('error');
      return;
    }

    this.setConnectionState('connecting');
    this.currentMeetingId = meetingId;

    console.log('[ChatService] Creando conexión Socket.IO a:', CHAT_SERVICE_URL);
    
    this.socket = io(CHAT_SERVICE_URL, {
      auth: {
        token: tokens.idToken,
      },
      query: {
        meetingId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`.trim(),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();

    // Unirse a la sala después de conectar (según spec: primero newUser, luego joinRoom)
    this.socket.on('connect', () => {
      console.log('[ChatService] ✅ Conectado a Socket.IO');
      this.setConnectionState('connected');
      
      // Primero registrar usuario (spec: emit newUser)
      if (user.id) {
        console.log('[ChatService] Emitiendo newUser:', user.id);
        this.socket?.emit('newUser', user.id);
      }
      
      // Luego unirse a la sala
      this.joinRoom(meetingId);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[ChatService] ❌ Error de conexión Socket.IO:', error.message);
      this.setConnectionState('error');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[ChatService] Desconectado:', reason);
      this.setConnectionState('disconnected');
    });
  }

  /**
   * Disconnects from the chat service and leaves the current room.
   */
  disconnect(): void {
    if (this.socket) {
      if (this.currentMeetingId) {
        this.leaveRoom(this.currentMeetingId);
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentMeetingId = null;
    this.setConnectionState('disconnected');
  }

  /**
   * Sends a chat message to the current room via `chat:message` event.
   * @param message Plain text message content.
   */
  sendMessage(message: string): void {
    if (!this.socket?.connected || !this.currentMeetingId) {
      console.error('No hay conexión activa para enviar mensaje');
      return;
    }

    const payload: SendMessagePayload = {
      meetingId: this.currentMeetingId,
      userId: this.currentUserId ?? '',
      userName: this.currentUserName ?? undefined,
      messageId: crypto.randomUUID(),
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    console.log('[ChatService] Emitiendo chat:message:', payload);
    this.socket.emit('chat:message', payload);
  }

  /**
   * Subscribes to incoming chat messages.
   * @param callback Handler invoked for every new `chat:message`.
   * @returns Unsubscribe function.
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Subscribes to users-online updates for the current room.
   * @param callback Handler invoked when the server emits `usersOnline`.
   * @returns Unsubscribe function.
   */
  onUsersOnline(callback: UsersOnlineCallback): () => void {
    this.usersOnlineCallbacks.add(callback);
    return () => this.usersOnlineCallbacks.delete(callback);
  }

  /**
   * Subscribes to chat errors pushed by the server.
   * @param callback Handler invoked on error events.
   * @returns Unsubscribe function.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * Subscribes to connection state changes.
   * @param callback Handler invoked when connection state updates.
   * @returns Unsubscribe function.
   */
  onConnectionStateChange(callback: (state: ChatConnectionState) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  /**
   * Loads persisted chat history for a meeting.
   * @param meetingId Meeting identifier to load history from.
   * @param limit Maximum number of messages to retrieve (default 50).
   */
  async loadHistory(meetingId: string, limit = 50): Promise<ChatMessage[]> {
    return fetchMeetingMessages(meetingId, limit);
  }

  // --- Métodos privados ---

  private setConnectionState(state: ChatConnectionState): void {
    this.connectionState = state;
    this.stateChangeCallbacks.forEach((cb) => cb(state));
  }

  private joinRoom(meetingId: string): void {
    const { user } = useAuthStore.getState();
    if (!this.socket || !user) return;

    // Guardar info del usuario para mensajes
    this.currentUserId = user.id;
    this.currentUserName = `${user.firstName} ${user.lastName}`.trim();

    // Spec: emit joinRoom(meetingId) - solo el meetingId como string
    console.log('[ChatService] Emitiendo joinRoom:', meetingId);
    this.socket.emit('joinRoom', meetingId);
  }

  private leaveRoom(meetingId: string): void {
    if (!this.socket) return;
    this.socket.emit('leave-room', { meetingId });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Spec: escuchar chat:message para mensajes entrantes
    this.socket.on('chat:message', (message: ChatMessage) => {
      console.log('[ChatService] Mensaje recibido:', message);
      this.messageCallbacks.forEach((cb) => cb(message));
    });

    // Spec: escuchar usersOnline para lista de usuarios en sala
    this.socket.on('usersOnline', (payload: UsersOnlinePayload | Array<{ odId: string; odName?: string }>) => {
      console.log('[ChatService] usersOnline:', payload);
      // El servidor puede enviar array global o objeto por sala
      if (Array.isArray(payload)) {
        // Formato global - convertir a formato por sala
        const converted: UsersOnlinePayload = {
          meetingId: this.currentMeetingId ?? '',
          users: payload,
          count: payload.length,
        };
        this.usersOnlineCallbacks.forEach((cb) => cb(converted));
      } else {
        this.usersOnlineCallbacks.forEach((cb) => cb(payload));
      }
    });

    this.socket.on('error', (error: { code: string; message: string }) => {
      console.error('[ChatService] Error:', error);
      this.errorCallbacks.forEach((cb) => cb(error));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[ChatService] Desconectado:', reason);
      if (reason !== 'io client disconnect') {
        this.setConnectionState('error');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[ChatService] Error de conexión:', error);
      this.setConnectionState('error');
    });
  }
}

/** Singleton chat service instance. */
export const chatService = new ChatService();

// Re-exportar tipos de meetings.ts
export type { ChatMessage };
