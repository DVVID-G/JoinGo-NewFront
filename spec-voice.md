# Especificación del Microservicio de Voz (`eisc-video`)

Guía para implementar la capa de audio/WebRTC en el frontend coordinada con el backend (`JoinGo-backend`) y el microservicio `Voice-video-server`.

## 1. Panorama General
- **Tecnología**: Socket.IO para señalización + Simple-Peer (en el cliente) para WebRTC mesh.
- **Rol**: Gestionar rooms de audio basados en `meetingId`, intercambiar señales (`signal` events) y avisar cuando usuarios se conectan/desconectan.
- **Persistencia**: No almacena datos; solo mantiene el estado temporal de peers en memoria.

## 2. Variables de Entorno Clave
| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto TCP del servidor Socket.IO (p.ej. `3100`). |
| `ORIGIN` | Lista separada por comas con orígenes permitidos para CORS. Debe incluir la URL del frontend. |
| *(Opcional)* `VOICE_SERVICE_TOKEN` | Aunque el microservicio actualmente no valida tokens, `JoinGo-backend` puede enviar `auth.token` al conectarse para diagnósticos y futura hardening. |

## 3. Diagrama de Orquestación
1. El frontend llama `GET /api/voice/config` en el backend → obtiene `signalUrl`, `voiceServerUrl`, `iceServers` y flag `requiresToken`.
2. Antes de unirse, llama `POST /api/voice/session` con `{ meetingId }` → obtiene `voiceRoomId`, `token` (HMAC) y `expiresAt` (TTL 5 min).
3. El frontend abre Socket.IO hacia `voiceServerUrl` o `signalUrl` indicando `meetingId` en `query`:
   ```ts
   const socket = io(voiceUrl, {
     transports: ['websocket'],
     query: { meetingId },
     auth: { token: voiceSession.token }
   });
   ```
4. El microservicio valida únicamente que `meetingId` esté presente; cualquier socket sin ese query es rechazado.
5. Una vez conectado se usa Simple-Peer (u otra librería) para realizar el intercambio `signal` entre peers.

## 4. Ciclo de Vida del Socket
| Etapa | Descripción |
| --- | --- |
| `connection` | El servidor lee `meetingId` desde `socket.handshake.query`. Si falta, emite `error` y cierra. |
| Registro en room | El socket se une a `room = meetingId` y se guarda en memoria (`rooms[meetingId]`). |
| `introduction` (server → client) | Enviado solo al socket recién conectado. Contiene un array de `peerId` (otros sockets en el room) para crear conexiones WebRTC salientes. |
| `newUserConnected` (server → room) | Notifica a los demás usuarios que existe un nuevo peer (`socket.id`). Los clientes deben crear una conexión entrante hacia ese peer. |
| `signal` (bidireccional) | Payload `(to: string, from: string, data: any)`. Permite reenviar señales WebRTC entre peers. El cliente debe emitir `signal` cuando Simple-Peer genera datos para otro peer. |
| `userDisconnected` (server → room) | Informado cuando un peer sale del room. Los clientes deben cerrar la conexión asociada. |
| `disconnect` | El servidor limpia el `room`. Si queda vacío, elimina la entrada en memoria. |

## 5. Integración con el Backend
- `JoinGo-backend` regula el acceso mediante `POST /api/voice/session`: verifica que la reunión exista, esté `active` y tenga `voiceEnabled`. También genera el token HMAC (`token`) y la expiración.
- Aunque el microservicio hoy no valida el token, el frontend **debe** enviarlo porque:
  - El backend puede usarlo para habilitar métricas/auditoría via `voiceClient`.
  - Permite endurecer seguridad en despliegues futuros sin cambios del lado del cliente.
- `voiceRoomId` normalmente coincide con `meetingId`, pero el backend puede redefinirlo en el futuro (p.ej. sub-salas). El frontend debe siempre usar `voiceRoomId` para crear nombres de salas locales y `meetingId` para query param.

## 6. Implementación Frontend Recomendada
```ts
import Peer from 'simple-peer';
import { io, Socket } from 'socket.io-client';

async function connectVoice(meetingId: string) {
  const { data: voiceConfig } = await api.get('/api/voice/config');
  const { data: session } = await api.post('/api/voice/session', { meetingId });

  const socket: Socket = io(voiceConfig.signalUrl ?? voiceConfig.voiceServerUrl!, {
    transports: ['websocket'],
    query: { meetingId },
    auth: { token: session.token }
  });

  const peers = new Map<string, Peer.Instance>();

  socket.on('introduction', (peerIds: string[]) => {
    peerIds.forEach((peerId) => createPeer(peerId, true));
  });

  socket.on('newUserConnected', (peerId: string) => createPeer(peerId, false));
  socket.on('signal', (to: string, from: string, data: any) => {
    peers.get(from)?.signal(data);
  });
  socket.on('userDisconnected', (peerId: string) => {
    peers.get(peerId)?.destroy();
    peers.delete(peerId);
  });

  function createPeer(peerId: string, initiator: boolean) {
    const peer = new Peer({ initiator, trickle: false, stream: localMediaStream, config: { iceServers: voiceConfig.iceServers } });
    peers.set(peerId, peer);

    peer.on('signal', (data) => socket.emit('signal', peerId, socket.id, data));
    peer.on('stream', (remoteStream) => attachRemoteAudio(peerId, remoteStream));
  }
}
```

## 7. Buenas Prácticas
- **Renovar token**: el token de sesión expira en 5 minutos; si se pierde conexión prolongada, solicitar `POST /api/voice/session` de nuevo antes de reintentar.
- **Control de capacidad**: el microservicio no impone límites. El frontend debe respetar `meeting.maxParticipants` para evitar mallas demasiado grandes (>10 peers).
- **Fallback**: si `signalUrl` está vacío, usar `voiceServerUrl`. Para navegadores que requieren HTTPS + WSS, asegurar que el microservicio esté detrás de TLS.
- **Errores**: escuchar `socket.on('error', ...)` para detectar cuando falta `meetingId` o se recibe otra validación futura (p.ej. token inválido).
- **Limpieza**: destruir todos los peers locales y hacer `socket.disconnect()` al abandonar la reunión o cerrar pestaña.

## 8. End-to-End Summary
1. Usuario se autentica y entra a una reunión (`meetingId`).
2. Frontend llama `GET /api/voice/config` una vez al iniciar la app para cachear STUN/TURN.
3. Al abrir la vista de voz: `POST /api/voice/session` con `meetingId`, guarda `voiceRoomId` + `token`.
4. Conecta a `voiceServerUrl` con `query.meetingId` y `auth.token`.
5. Usa los eventos `introduction`, `newUserConnected`, `signal`, `userDisconnected` para mantener Simple-Peer en sync.
6. Refresca token si la llamada dura más de 5 minutos o si el servidor lo exige en el futuro.

Con este spec, el equipo frontend puede integrar audio P2P de forma consistente, respetando las validaciones del backend y manteniendo la arquitectura preparada para futuras mejoras (validación de tokens, sub-rooms, reconexiones seguras).
