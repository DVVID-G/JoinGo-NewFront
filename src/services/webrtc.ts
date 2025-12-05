import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import EventEmitter from "events";
import process from "process";
import { format } from "util";

const serverWebRTCUrl = import.meta.env.VITE_WEBRTC_URL;
const iceServerUrl = import.meta.env.VITE_ICE_SERVER_URL;
const iceServerUsername = import.meta.env.VITE_ICE_SERVER_USERNAME;
const iceServerCredential = import.meta.env.VITE_ICE_SERVER_CREDENTIAL;

const peers = new Map<string, Peer.Instance>();
let socket: Socket | null = null;
let localStream: MediaStream | null = null;
let currentMeetingId: string | null = null;

const voiceEvents = new EventEmitter();

const iceServers = (() => {
  if (!iceServerUrl) {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }

  // Normaliza la URL: si no trae prefijo stun/turn, lo agregamos
  const normalizeIceUrls = (url: string): string[] => {
    const hasScheme = /^(stun|turn)s?:/i.test(url);
    const sanitized = url.replace(/^(stun|turn)s?:/i, "");

    // Si se proveen credenciales, usamos TURN y agregamos STUN como respaldo
    if (iceServerUsername || iceServerCredential) {
      const turnUrl = hasScheme ? url : `turn:${sanitized}`;
      const stunUrl = hasScheme ? url : `stun:${sanitized}`;
      return [stunUrl, turnUrl];
    }

    // Sin credenciales: solo STUN
    return [hasScheme ? url : `stun:${sanitized}`];
  };

  const urls = normalizeIceUrls(iceServerUrl);
  const entry: RTCIceServer = { urls };
  if (iceServerUsername) entry.username = iceServerUsername;
  if (iceServerCredential) entry.credential = iceServerCredential;
  return [entry];
})();

export interface VoiceChatCallbacks {
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onPeerLeft?: (peerId: string) => void;
}

/**
 * Starts a voice chat session using Socket.IO + Peer.js.
 * @param meetingId - Meeting identifier used as the room key on the signaling server.
 * @param callbacks - Callbacks for remote stream and peer left events
 * @returns helper utilities for cleanup and local audio.
 */
export async function startVoiceChat(
  meetingId: string,
  callbacks: VoiceChatCallbacks = {}
): Promise<{ stop: () => void; localStream: MediaStream }> {
  if (!meetingId) throw new Error("meetingId is required to start voice chat");
  if (!serverWebRTCUrl) throw new Error("VITE_VOICE_SERVER_URL is not configured");

  currentMeetingId = meetingId;
  voiceEvents.emit(
    "voice:init",
    format("Bootstrapping voice chat in %s mode", process.env?.NODE_ENV || "development")
  );
  console.log("[WebRTC] Iniciando voice chat para meetingId:", meetingId);

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const socketInstance = await createSocket(meetingId);

  const handleRemoteStream = (peerId: string, stream: MediaStream) => {
    callbacks.onRemoteStream?.(peerId, stream);
    voiceEvents.emit("peer-stream", { peerId, stream });
  };

  const handlePeerLeft = (peerId: string) => {
    callbacks.onPeerLeft?.(peerId);
    voiceEvents.emit("peer-left", peerId);
  };

  socketInstance.on("introduction", (remotePeers: string[] = []) => {
    console.log("[WebRTC] Introduction - peers existentes:", remotePeers);
    remotePeers.forEach((peerId) => {
      ensurePeer(peerId, true, handleRemoteStream, handlePeerLeft);
    });
  });

  socketInstance.on("newUserConnected", (peerId: string) => {
    console.log("[WebRTC] Nuevo usuario conectado:", peerId);
    voiceEvents.emit("peer-joined", peerId);
    // The newcomer will initiate the connection; ensure a peer exists ready to handle incoming signal.
    ensurePeer(peerId, false, handleRemoteStream, handlePeerLeft);
  });

  socketInstance.on("signal", (to: string, from: string, data: Peer.SignalData) => {
    if (to !== socketInstance.id) return;
    console.log("[WebRTC] Señal recibida de:", from);
    const peer = ensurePeer(from, false, handleRemoteStream, handlePeerLeft);
    peer?.signal(data);
  });

  socketInstance.on("userDisconnected", (peerId: string) => {
    console.log("[WebRTC] Usuario desconectado:", peerId);
    teardownPeer(peerId, handlePeerLeft);
  });

  socketInstance.on("disconnect", () => {
    console.log("[WebRTC] Socket desconectado");
    voiceEvents.emit("socket-disconnect", meetingId);
  });

  return {
    stop: () => stopVoiceChat(),
    localStream,
  };
}

async function createSocket(meetingId: string): Promise<Socket> {
  if (socket) return socket;
  
  console.log("[WebRTC] Conectando al servidor:", serverWebRTCUrl);
  
  socket = io(serverWebRTCUrl, {
    transports: ["websocket"],
    query: { meetingId },
  });
  
  return await new Promise((resolve, reject) => {
    socket!.on("connect", () => {
      console.log("[WebRTC] Socket conectado, ID:", socket!.id);
      resolve(socket!);
    });
    socket!.on("connect_error", (err) => {
      console.error("[WebRTC] Error de conexión:", err);
      reject(err);
    });
  });
}

function ensurePeer(
  peerId: string,
  initiator: boolean,
  onRemoteStream: (peerId: string, stream: MediaStream) => void,
  onPeerLeft: (peerId: string) => void
): Peer.Instance | null {
  if (!socket || peerId === socket.id) return null;
  if (peers.has(peerId)) {
    console.log("[WebRTC] Peer ya existe:", peerId);
    return peers.get(peerId)!;
  }

  console.log("[WebRTC] Creando nuevo peer:", peerId, "initiator:", initiator);
  
  const peer = new Peer({
    initiator,
    trickle: false,
    stream: localStream ?? undefined,
    config: { iceServers },
  });

  peer.on("signal", (data: Peer.SignalData) => {
    console.log("[WebRTC] Enviando señal a:", peerId);
    socket?.emit("signal", peerId, socket.id, data);
  });

  peer.on("stream", (stream: MediaStream) => {
    console.log("[WebRTC] Stream remoto recibido de:", peerId);
    onRemoteStream?.(peerId, stream);
  });

  peer.on("close", () => {
    console.log("[WebRTC] Peer cerrado:", peerId);
    teardownPeer(peerId, onPeerLeft);
  });

  peer.on("error", (err) => {
    console.error("[WebRTC] Error en peer", peerId, err);
    teardownPeer(peerId, onPeerLeft);
  });

  peers.set(peerId, peer);
  return peer;
}

function teardownPeer(peerId: string, onPeerLeft: (peerId: string) => void) {
  const peer = peers.get(peerId);
  if (peer) {
    peer.removeAllListeners();
    peer.destroy();
    peers.delete(peerId);
    onPeerLeft?.(peerId);
  }
}

/**
 * Stops all peers and closes the signaling socket.
 */
export function stopVoiceChat() {
  console.log("[WebRTC] Deteniendo voice chat");
  
  peers.forEach((peer) => peer.destroy());
  peers.clear();
  
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  
  currentMeetingId = null;
  voiceEvents.removeAllListeners();
}

/**
 * Toggles the local microphone tracks.
 * @param enabled - true to allow audio, false to mute microphone.
 */
export function setMicrophoneEnabled(enabled: boolean) {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
}

export { voiceEvents, currentMeetingId };
