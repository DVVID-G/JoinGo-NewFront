import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  MessageSquare,
  Users,
  Settings,
  Copy,
  X,
  Send,
  Monitor,
  MonitorOff,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/store/authStore';
import { useMeetingStore, Meeting } from '@/store/meetingStore';
import { getMeetingById, updateMeetingStatus } from '@/services/meetings';
import { useChat } from '@/hooks/use-chat';
import { startVoiceChat, stopVoiceChat, setMicrophoneEnabled } from '@/services/webrtc';
import { toast } from 'sonner';

/**
 * Hidden audio renderer for a remote peer stream.
 */
function RemoteAudio({ peerId, stream }: { peerId: string; stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  
  return <audio ref={ref} data-peer-id={peerId} autoPlay playsInline style={{ display: "none" }} />;
}

/**
 * Meeting room page handling media, voice chat, and text chat for a meeting code/ID.
 */
export default function MeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { getMeetingByIdOrCode, upsertMeeting } = useMeetingStore();
  
  // Estado de la reunión
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  
  // Estado de controles de media
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Estado de paneles laterales
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  
  // Estado para WebRTC
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // Referencias para media streams
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const hasSidePanelOpen = isChatOpen || isParticipantsOpen;
  const isHost = meeting?.hostUid === user?.id || meeting?.createdBy === user?.id;

  // Callbacks para WebRTC
  const handleRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    console.log('[MeetingRoom] Stream remoto recibido de:', peerId);
    setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
  }, []);

  const handlePeerLeft = useCallback((peerId: string) => {
    console.log('[MeetingRoom] Peer desconectado:', peerId);
    setRemoteStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  }, []);

  // Hook de chat
  const {
    messages,
    connectionState: chatConnectionState,
    isLoadingHistory,
    usersOnline,
    sendMessage: sendChatMessage,
    connect: connectChat,
    disconnect: disconnectChat,
  } = useChat({
    meetingId: meeting?.id ?? '',
    autoConnect: false,
    onNewMessage: (msg) => {
      // Solo mostrar toast si el mensaje es de otro usuario
      if (msg.userId !== user?.id) {
        toast.info(`${msg.userName ?? 'Usuario'}: ${msg.message.substring(0, 50)}...`);
      }
    },
  });

  const closeSidePanels = () => {
    setIsChatOpen(false);
    setIsParticipantsOpen(false);
  };

  // Obtener acceso a la cámara y micrófono
  /**
   * Requests local media (camera + mic) and binds streams to local elements.
   */
  const initializeMediaDevices = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accediendo a dispositivos de media:', error);
      toast.error('No se pudo acceder a la cámara o micrófono');
      setIsVideoOn(false);
      setIsAudioOn(false);
    }
  }, []);

  // Cargar reunión desde API o store local
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const loadMeeting = async () => {
      if (!code) {
        setMeetingError('Código de reunión no válido');
        setIsLoadingMeeting(false);
        return;
      }

      setIsLoadingMeeting(true);
      setMeetingError(null);

      // Buscar en el store local por ID o código
      const localMeeting = getMeetingByIdOrCode(code);
      
      // Determinar qué ID usar para la llamada al backend
      const meetingIdToFetch = localMeeting?.id ?? code;
      
      try {
        // Verificar con el backend que la reunión existe y está activa
        const apiMeeting = await getMeetingById(meetingIdToFetch);
        setMeeting(apiMeeting);
        upsertMeeting(apiMeeting);
      } catch (error) {
        // Si falla el API pero tenemos la reunión local, usarla
        if (localMeeting) {
          console.warn('No se pudo verificar reunión con backend, usando datos locales');
          setMeeting(localMeeting);
        } else {
          setMeetingError('La reunión no existe o ha finalizado');
        }
      } finally {
        setIsLoadingMeeting(false);
      }
    };

    loadMeeting();
  }, [code, isAuthenticated, navigate, getMeetingByIdOrCode, upsertMeeting]);

  // Inicializar media cuando la reunión esté lista
  useEffect(() => {
    if (!meeting?.id || !isAuthenticated) {
      return;
    }

    console.log('[MeetingRoom] Reunión cargada, iniciando servicios para:', meeting.id);
    
    // Inicializar dispositivos de media y conectar chat sin abrir panel
    initializeMediaDevices();
    connectChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, isAuthenticated]);

  // Iniciar WebRTC cuando tengamos meetingId
  useEffect(() => {
    if (!meeting?.id) return;
    
    setVoiceError(null);
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    startVoiceChat(meeting.id, {
      onRemoteStream: handleRemoteStream,
      onPeerLeft: handlePeerLeft,
    })
      .then(({ stop, localStream: stream }) => {
        if (cancelled) {
          stop();
          return;
        }
        cleanup = stop;
        setVoiceReady(true);
        setLocalStream(stream);
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = stream;
        }
        toast.success('Conectado al canal de voz');
      })
      .catch((err) => {
        console.error('[MeetingRoom] Error iniciando voice chat:', err);
        setVoiceError('No se pudo iniciar el canal de voz. Verifica los permisos del micrófono.');
      });

    return () => {
      cancelled = true;
      cleanup?.();
      stopVoiceChat();
      setVoiceReady(false);
      setRemoteStreams({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  // Actualizar estado de micrófono
  useEffect(() => {
    setMicrophoneEnabled(isAudioOn);
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isAudioOn;
      });
    }
  }, [isAudioOn, localStream]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      console.log('[MeetingRoom] Cleanup final: deteniendo streams y desconectando servicios');
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      stopVoiceChat();
      disconnectChat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remotePeerCount = Object.keys(remoteStreams).length;

  /**
   * Ends the call, optionally closes the meeting when host, and navigates out.
   */
  const handleEndCall = async () => {
    // Detener streams de media
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    
    // Si es host, preguntar si quiere cerrar la reunión para todos
    if (isHost && meeting?.id) {
      try {
        await updateMeetingStatus(meeting.id, 'closed');
        toast.success('Reunión finalizada');
      } catch (error) {
        console.error('Error cerrando reunión:', error);
      }
    } else {
      toast.info('Has salido de la reunión');
    }
    
    navigate('/dashboard');
  };

  /**
   * Copies the meeting code to clipboard with textarea fallback.
   */
  const handleCopyCode = async () => {
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        toast.success('Código copiado al portapapeles');
      } catch (e) {
        // Fallback
        const el = document.createElement('textarea');
        el.value = code;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success('Código copiado');
      }
    }
  };

  /**
   * Sends a chat message via useChat hook and clears the input.
   */
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user) return;

    sendChatMessage(chatMessage.trim());
    setChatMessage('');
  };

  /**
   * Toggles local video track, requesting permissions again when needed.
   */
  const toggleVideo = async () => {
    const stream = localStream;
    const videoTrack = stream?.getVideoTracks()[0];

    // Si no hay track y queremos encender, pedimos permisos de nuevo
    if (!videoTrack && !isVideoOn) {
      await initializeMediaDevices();
      const refreshedTrack = localStream?.getVideoTracks()[0];
      if (refreshedTrack) {
        refreshedTrack.enabled = true;
        setIsVideoOn(true);
        toast.info('Cámara activada');
      }
      return;
    }

    if (videoTrack) {
      const nextState = !videoTrack.enabled;
      videoTrack.enabled = nextState;
      setIsVideoOn(nextState);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = nextState ? stream ?? null : null;
      }
      toast.info(nextState ? 'Cámara activada' : 'Cámara desactivada');
      return;
    }

    // Sin stream, simplemente invierte estado para la UI
    setIsVideoOn((prev) => !prev);
  };

  /**
   * Toggles microphone tracks on/off.
   */
  const toggleAudio = () => {
    setIsAudioOn(!isAudioOn);
  };

  /**
   * Switches between screen sharing and camera stream.
   */
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Detener compartir pantalla y volver a cámara
      await initializeMediaDevices();
      setIsScreenSharing(false);
      toast.info('Compartir pantalla desactivado');
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        // Detectar cuando el usuario deja de compartir
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          initializeMediaDevices();
        };
        setIsScreenSharing(true);
        toast.info('Compartiendo pantalla');
      } catch (error) {
        console.error('Error compartiendo pantalla:', error);
        toast.error('No se pudo compartir la pantalla');
      }
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  // Pantalla de carga mientras se obtiene la reunión
  if (isLoadingMeeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Cargando reunión...</p>
        </div>
      </div>
    );
  }

  // Pantalla de error si la reunión no existe
  if (meetingError || !meeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            No se pudo unir a la reunión
          </h2>
          <p className="mt-2 text-muted-foreground">
            {meetingError || 'La reunión no existe o ha finalizado'}
          </p>
          <Button className="mt-6" onClick={() => navigate('/dashboard')}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">
              {meeting?.name || 'Reunión'}
            </h1>
            <button
              type="button"
              onClick={handleCopyCode}
              className="mt-1 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <span className="font-mono">{code}</span>
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
            {voiceReady ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {remotePeerCount + 1} en llamada
                </span>
              </>
            ) : voiceError ? (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">{voiceError}</span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                <span className="text-xs text-muted-foreground">Conectando...</span>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <main className="flex flex-1 flex-col min-h-0">
          {/* Video grid */}
          <div className="flex-1 p-4 min-h-0">
            <div className="grid h-full min-h-0 gap-4 grid-cols-1 place-items-center">
              {/* Main video (self) */}
              <div className="relative flex h-full max-h-[calc(100vh-260px)] min-h-[260px] w-full max-w-5xl items-center justify-center rounded-xl bg-black overflow-hidden">
                {isVideoOn ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user.avatar} alt={user.firstName} />
                    <AvatarFallback className="bg-primary text-3xl text-primary-foreground">
                      {user.firstName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-background/80 px-3 py-1.5 backdrop-blur-sm">
                  <span className="text-sm font-medium text-foreground">
                    {user.firstName} {user.lastName} (Tú)
                  </span>
                  {!isAudioOn && <MicOff className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border bg-card p-4">
            <Button
              variant={isAudioOn ? 'secondary' : 'destructive'}
              size="lg"
              className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
              onClick={toggleAudio}
            >
              {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            <Button
              variant={isVideoOn ? 'secondary' : 'destructive'}
              size="lg"
              className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            <Button
              variant={isScreenSharing ? 'default' : 'secondary'}
              size="lg"
              className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
              onClick={toggleScreenShare}
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </Button>

            <Button
              variant={isChatOpen ? 'default' : 'secondary'}
              size="lg"
              className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
              onClick={() => {
                setIsChatOpen(!isChatOpen);
                setIsParticipantsOpen(false);
              }}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>

            <Button
              variant={isParticipantsOpen ? 'default' : 'secondary'}
              size="lg"
              className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
              onClick={() => {
                setIsParticipantsOpen(!isParticipantsOpen);
                setIsChatOpen(false);
              }}
            >
              <Users className="h-5 w-5" />
            </Button>

            <Button
              variant="destructive"
              size="lg"
              className="h-12 w-12 rounded-full sm:h-14 sm:w-14 sm:ml-4"
              onClick={handleEndCall}
            >
              <Phone className="h-5 w-5 rotate-[135deg]" />
            </Button>
          </div>
        </main>

        {/* Sidebar - Chat */}
        {isChatOpen && (
          <aside className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-lg lg:static lg:h-auto lg:w-80">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">Chat</h2>
                {chatConnectionState === 'connected' ? (
                  <span className="flex h-2 w-2 rounded-full bg-green-500" />
                ) : chatConnectionState === 'connecting' ? (
                  <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                ) : (
                  <span className="flex h-2 w-2 rounded-full bg-red-500" />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No hay mensajes aún
                </p>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.messageId}
                      className={`flex flex-col ${
                        msg.userId === user.id ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="text-xs text-muted-foreground">
                        {msg.userName ?? 'Usuario'}
                      </span>
                      <div
                        className={`mt-1 rounded-lg px-3 py-2 ${
                          msg.userId === user.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="border-t border-border p-4">
              <div className="flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!chatMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </aside>
        )}

        {/* Sidebar - Participants */}
        {isParticipantsOpen && (
          <aside className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-lg lg:static lg:h-auto lg:w-80">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-semibold text-foreground">
                Participantes ({usersOnline?.count ?? 1})
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsParticipantsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {/* Usuario local */}
                <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar} alt={user.firstName} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user.firstName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isHost ? 'Anfitrión' : 'Tú'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isAudioOn && <MicOff className="h-4 w-4 text-muted-foreground" />}
                    {!isVideoOn && <VideoOff className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Otros participantes */}
                {usersOnline?.users
                  .filter((u) => u.odId !== user?.id)
                  .map((participant) => (
                    <div
                      key={participant.odId}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {(participant.odName ?? participant.odId).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {participant.odName ?? `Usuario ${participant.odId.slice(0, 6)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {remoteStreams[participant.odId] ? 'En llamada' : 'En sala'}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>

      {/* Audio elements */}
      <audio ref={localAudioRef} autoPlay muted playsInline style={{ display: "none" }} />
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <RemoteAudio key={peerId} peerId={peerId} stream={stream} />
      ))}
    </div>
  );
}
