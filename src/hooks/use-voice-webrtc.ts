import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { VoiceConfig, VoiceSession, IceServer } from '@/services/voice';

/**
 * Estado de un peer remoto
 */
export interface RemotePeer {
  peerId: string;
  stream: MediaStream | null;
  connected: boolean;
}

/**
 * Estado de conexión WebRTC
 */
export type WebRTCConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

interface UseVoiceWebRTCOptions {
  /** Configuración de voz (ICE servers, URLs) */
  config: VoiceConfig | null;
  /** Sesión activa con token */
  session: VoiceSession | null;
  /** Stream local de audio/video */
  localStream: MediaStream | null;
  /** Si debe conectar automáticamente cuando tenga config y session */
  autoConnect?: boolean;
  /** Callback cuando un peer remoto conecta con stream */
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  /** Callback cuando un peer se desconecta */
  onPeerDisconnect?: (peerId: string) => void;
  /** Callback cuando hay un error */
  onError?: (error: Error) => void;
}

interface UseVoiceWebRTCReturn {
  /** Estado de la conexión */
  connectionState: WebRTCConnectionState;
  /** Lista de peers remotos con sus streams */
  remotePeers: Map<string, RemotePeer>;
  /** Número de peers conectados */
  peerCount: number;
  /** Error si ocurrió alguno */
  error: Error | null;
  /** Conectar al servidor de señalización */
  connect: () => void;
  /** Desconectar y limpiar peers */
  disconnect: () => void;
}

/**
 * Convierte IceServer[] a RTCIceServer[] para WebRTC
 */
function toRTCIceServers(iceServers: IceServer[]): RTCIceServer[] {
  return iceServers.map((server) => ({
    urls: server.urls,
    username: server.username,
    credential: server.credential,
  }));
}

/**
 * Hook para gestionar conexiones WebRTC P2P usando Simple-Peer
 * 
 * Flujo según spec eisc-video:
 * 1. Conecta a Socket.IO con meetingId en query
 * 2. Recibe `introduction` con lista de peers existentes
 * 3. Recibe `newUserConnected` cuando alguien nuevo entra
 * 4. Intercambia señales WebRTC via evento `signal`
 * 5. Recibe `userDisconnected` cuando alguien sale
 * 
 * @example
 * ```tsx
 * const { remotePeers, connect, disconnect, connectionState } = useVoiceWebRTC({
 *   config: voiceConfig,
 *   session: voiceSession,
 *   localStream: myMediaStream,
 *   autoConnect: true,
 * });
 * ```
 */
export function useVoiceWebRTC({
  config,
  session,
  localStream,
  autoConnect = false,
  onRemoteStream,
  onPeerDisconnect,
  onError,
}: UseVoiceWebRTCOptions): UseVoiceWebRTCReturn {
  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>('disconnected');
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
  const isMountedRef = useRef(true);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Mantener localStream actualizado
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  /**
   * Crear un peer Simple-Peer
   */
  const createPeer = useCallback((
    peerId: string,
    initiator: boolean,
    iceServers: IceServer[]
  ): Peer.Instance | null => {
    if (!localStreamRef.current) {
      console.warn('[WebRTC] No hay stream local para crear peer');
      return null;
    }

    console.log(`[WebRTC] Creando peer para ${peerId}, initiator: ${initiator}`);

    const peer = new Peer({
      initiator,
      trickle: true, // Usar trickle ICE para conexión más rápida
      stream: localStreamRef.current,
      config: {
        iceServers: toRTCIceServers(iceServers),
      },
    });

    peer.on('signal', (signalData) => {
      console.log(`[WebRTC] Enviando signal a ${peerId}`);
      socketRef.current?.emit('signal', peerId, socketRef.current.id, signalData);
    });

    peer.on('stream', (remoteStream) => {
      console.log(`[WebRTC] ✅ Stream recibido de ${peerId}`);
      
      if (isMountedRef.current) {
        setRemotePeers((prev) => {
          const updated = new Map(prev);
          updated.set(peerId, {
            peerId,
            stream: remoteStream,
            connected: true,
          });
          return updated;
        });
        
        onRemoteStream?.(peerId, remoteStream);
      }
    });

    peer.on('connect', () => {
      console.log(`[WebRTC] ✅ Peer ${peerId} conectado`);
      
      if (isMountedRef.current) {
        setRemotePeers((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(peerId);
          if (existing) {
            updated.set(peerId, { ...existing, connected: true });
          } else {
            updated.set(peerId, { peerId, stream: null, connected: true });
          }
          return updated;
        });
      }
    });

    peer.on('close', () => {
      console.log(`[WebRTC] Peer ${peerId} cerrado`);
      destroyPeer(peerId);
    });

    peer.on('error', (err) => {
      console.error(`[WebRTC] Error en peer ${peerId}:`, err);
      destroyPeer(peerId);
    });

    peersRef.current.set(peerId, peer);
    return peer;
  }, [onRemoteStream]);

  /**
   * Destruir un peer
   */
  const destroyPeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      console.log(`[WebRTC] Destruyendo peer ${peerId}`);
      peer.destroy();
      peersRef.current.delete(peerId);
    }

    if (isMountedRef.current) {
      setRemotePeers((prev) => {
        const updated = new Map(prev);
        updated.delete(peerId);
        return updated;
      });
      
      onPeerDisconnect?.(peerId);
    }
  }, [onPeerDisconnect]);

  /**
   * Conectar al servidor de señalización
   */
  const connect = useCallback(() => {
    console.log('[WebRTC] connect() llamado con:', {
      hasConfig: !!config,
      hasSession: !!session,
      hasLocalStream: !!localStreamRef.current,
      configDetails: config ? {
        signalUrl: config.signalUrl,
        voiceServerUrl: config.voiceServerUrl,
        iceServersCount: config.iceServers?.length,
      } : null,
      sessionDetails: session ? {
        meetingId: session.meetingId,
        voiceRoomId: session.voiceRoomId,
        hasToken: !!session.token,
      } : null,
    });

    if (!config || !session) {
      console.warn('[WebRTC] No hay config o session para conectar');
      return;
    }

    if (!localStreamRef.current) {
      console.warn('[WebRTC] No hay stream local para conectar');
      return;
    }

    // Usar signalUrl o voiceServerUrl
    const serverUrl = config.signalUrl || config.voiceServerUrl;
    if (!serverUrl) {
      const err = new Error('No hay URL de servidor de señalización');
      setError(err);
      onError?.(err);
      return;
    }

    console.log('[WebRTC] Conectando a:', serverUrl);
    console.log('[WebRTC] meetingId:', session.meetingId);
    console.log('[WebRTC] ICE Servers:', config.iceServers);
    
    setConnectionState('connecting');
    setError(null);

    const socket = io(serverUrl, {
      transports: ['websocket'],
      query: {
        meetingId: session.meetingId,
      },
      auth: {
        token: session.token,
      },
    });

    socketRef.current = socket;

    // Evento: conexión establecida
    socket.on('connect', () => {
      console.log('[WebRTC] ✅ Conectado a servidor de señalización');
      if (isMountedRef.current) {
        setConnectionState('connected');
      }
    });

    // Evento: introducción con peers existentes (spec: introduction)
    socket.on('introduction', (peerIds: string[]) => {
      console.log('[WebRTC] Introduction - peers existentes:', peerIds);
      
      peerIds.forEach((peerId) => {
        // Crear conexión saliente (initiator: true)
        createPeer(peerId, true, session.iceServers);
      });
    });

    // Evento: nuevo usuario conectado (spec: newUserConnected)
    socket.on('newUserConnected', (peerId: string) => {
      console.log('[WebRTC] Nuevo usuario conectado:', peerId);
      
      // Crear conexión entrante (initiator: false)
      createPeer(peerId, false, session.iceServers);
    });

    // Evento: señal WebRTC (spec: signal)
    socket.on('signal', (to: string, from: string, signalData: Peer.SignalData) => {
      console.log(`[WebRTC] Signal recibida de ${from}`);
      
      let peer = peersRef.current.get(from);
      
      // Si no existe el peer, crearlo (puede pasar si recibimos signal antes de newUserConnected)
      if (!peer) {
        console.log(`[WebRTC] Creando peer para signal de ${from}`);
        peer = createPeer(from, false, session.iceServers);
      }
      
      if (peer) {
        peer.signal(signalData);
      }
    });

    // Evento: usuario desconectado (spec: userDisconnected)
    socket.on('userDisconnected', (peerId: string) => {
      console.log('[WebRTC] Usuario desconectado:', peerId);
      destroyPeer(peerId);
    });

    // Evento: error del servidor
    socket.on('error', (errorMsg: string) => {
      console.error('[WebRTC] Error del servidor:', errorMsg);
      const err = new Error(errorMsg);
      if (isMountedRef.current) {
        setError(err);
        setConnectionState('error');
      }
      onError?.(err);
    });

    // Evento: error de conexión
    socket.on('connect_error', (err) => {
      console.error('[WebRTC] Error de conexión:', err);
      if (isMountedRef.current) {
        setError(err);
        setConnectionState('error');
      }
      onError?.(err);
    });

    // Evento: desconexión
    socket.on('disconnect', (reason) => {
      console.log('[WebRTC] Desconectado:', reason);
      if (isMountedRef.current && reason !== 'io client disconnect') {
        setConnectionState('disconnected');
      }
    });
  }, [config, session, createPeer, destroyPeer, onError]);

  /**
   * Desconectar y limpiar
   */
  const disconnect = useCallback(() => {
    console.log('[WebRTC] Desconectando...');
    
    // Destruir todos los peers
    peersRef.current.forEach((peer, peerId) => {
      peer.destroy();
      onPeerDisconnect?.(peerId);
    });
    peersRef.current.clear();
    
    // Desconectar socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (isMountedRef.current) {
      setRemotePeers(new Map());
      setConnectionState('disconnected');
      setError(null);
    }
  }, [onPeerDisconnect]);

  // Auto-conectar cuando tenga todo lo necesario
  useEffect(() => {
    if (autoConnect && config && session && localStream && connectionState === 'disconnected') {
      connect();
    }
    // Nota: connect no está en dependencias para evitar loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, config, session, localStream, connectionState]);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Cleanup directo sin usar disconnect para evitar dependencias
      peersRef.current.forEach((peer) => {
        peer.destroy();
      });
      peersRef.current.clear();
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Sin dependencias - solo se ejecuta al desmontar

  return {
    connectionState,
    remotePeers,
    peerCount: remotePeers.size,
    error,
    connect,
    disconnect,
  };
}
