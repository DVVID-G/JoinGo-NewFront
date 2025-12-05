# Especificación del Microservicio de Chat (`eisc-chat`)

Documento dirigido a desarrolladores frontend para integrar la capa de chat en tiempo real junto con el backend principal (`JoinGo-backend`).

## 1. Panorama General
- **Tecnología**: Node.js + Socket.IO + Firebase Admin opcional.
- **Propósito**: Gestionar conexiones WebSocket, rooms por reunión y retransmitir mensajes en tiempo real.
- **Persistencia**: No almacena mensajes. El backend principal se conecta como cliente privilegiado y persiste cada `chat:message` en Firestore (`meetings/{id}/messages`).

## 2. Variables de Entorno Clave
| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto TCP para el servidor Socket.IO (p.ej. `3001`). |
| `ORIGIN` | Lista separada por comas con los orígenes permitidos para CORS (ej. `https://app.joingo.com,https://admin.joingo.com`). Si se omite, acepta todos (útil en dev). |
| `CHAT_SERVICE_TOKEN` | Secreto compartido entre el backend y `eisc-chat`. Si se presenta en el handshake (`auth.token`) se otorga acceso privilegiado. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Credenciales para verificar ID tokens cuando clientes usan Firebase Auth directo. `FIREBASE_PRIVATE_KEY` debe mantener los `\n` escapados. |
| `CHAT_ALLOW_ANONYMOUS` | `true/false`. Si `true` (default) permite conexiones sin token (solo para dev/test). |

## 3. Autenticación del Socket
1. El cliente comparte un `token` en `socket.io-client` mediante `io(url, { auth: { token } })`.
2. El servidor acepta tres variantes:
   - **Service token**: coincide con `CHAT_SERVICE_TOKEN`. Se usa para `JoinGo-backend`, que persiste mensajes.
   - **Firebase ID Token**: verificado mediante Firebase Admin. Requiere credenciales válidas. Permite identificar al usuario (`socket.data.uid`).
   - **Anónimo**: permitido solo si `CHAT_ALLOW_ANONYMOUS=true`. Se marca como invitado (`socket.data.guest`).
3. Errores posibles: `unauthorized`, `auth-unavailable` (falta credenciales Admin) o desconexión inmediata.

## 4. Rooms y Flujo de Conexión
1. Tras conectar, el cliente debe emitir `newUser(userId)` para mapear `socket.id -> userId`.
2. Para recibir mensajes de una reunión, emitir `joinRoom(meetingId)`; el servidor mapea internamente a `room:<meetingId>` y envía el conteo actualizado vía `usersOnline`.
3. El historial no proviene del microservicio. El frontend lo recupera con `GET /api/meetings/:id/messages` del backend.

## 5. Eventos Socket
### 5.1 Eventos Cliente → Servidor
| Evento | Payload | Descripción |
| --- | --- | --- |
| `newUser` | `userId: string` | Registra el identificador del usuario autenticado. Necesario para que el servidor informe presencia y para propagar `userId` en mensajes.
| `joinRoom` | `meetingId: string` | Suscribe el socket a la sala `room:<meetingId>` y provoca un `usersOnline` para esa sala.
| `chat:message` | `{ meetingId?, userId?, messageId?, userName?, message, timestamp? }` | Mensaje a retransmitir. `meetingId` dirige el mensaje solo a la sala de esa reunión. `message` se sanitiza/trim. `timestamp` default `new Date().toISOString()`.

### 5.2 Eventos Servidor → Cliente
| Evento | Payload | Disparador |
| --- | --- | --- |
| `usersOnline` | Lista global `OnlineUser[]` **o** `{ meetingId, users, count }` por sala | Emisión global tras conectar/desconectar o dentro del room tras `joinRoom`.
| `chat:message` | `{ meetingId?, userId, messageId?, userName?, message, timestamp }` | Enviado a todos los sockets del room (o global si `meetingId` ausente). Los mensajes entrantes desde el backend también se reflejan aquí.
| `Server logs` | No es evento, pero se imprimen `room` stats en consola para depuración.

## 6. Coordinación con el Backend Principal
- `JoinGo-backend` establece una conexión dedicada usando `CHAT_SERVICE_TOKEN` (ver `src/realtime/chatClient.ts`).
- Al recibir `chat:message`, el backend guarda el payload con `saveMessage()` en Firestore. Esto garantiza historial incluso si los clientes se desconectan.
- Si el backend no puede conectarse (token inválido, `unauthorized`), los mensajes seguirán fluyendo entre clientes pero **no** se persistirán.

## 7. Implementación Frontend Recomendada
1. **Autenticación**
   ```ts
   const idToken = await firebaseAuth.currentUser?.getIdToken();
   const socket = io(import.meta.env.VITE_CHAT_SERVICE_URL, {
     transports: ['websocket'],
     auth: { token: idToken }
   });
   ```
2. **Registro de usuario y room**
   ```ts
   socket.emit('newUser', user.uid);
   socket.emit('joinRoom', meetingId);
   ```
3. **Envió de mensajes**
   ```ts
   socket.emit('chat:message', {
     meetingId,
     userId: user.uid,
     userName: user.displayName,
     messageId: crypto.randomUUID(),
     message: draftMessage.trim(),
     timestamp: new Date().toISOString()
   });
   ```
4. **Recepción**
   ```ts
   socket.on('chat:message', (payload) => {
     // Actualiza UI y opcionalmente confirma persistencia consultando REST
   });
   ```
5. **Historial**: antes de suscribirse, llamar `GET /api/meetings/:id/messages?limit=100` contra el backend y rellenar el estado inicial.

## 8. Errores Comunes y Solución
| Síntoma | Causa | Mitigación |
| --- | --- | --- |
| `connect_error unauthorized` | `CHAT_SERVICE_TOKEN` mismatched o ID token inválido | Revisar `.env` en ambos servicios; renovar ID Token. |
| `auth-unavailable` | Firebase Admin sin credenciales | Definir `FIREBASE_*` o `GOOGLE_APPLICATION_CREDENTIALS`. |
| Mensajes no se persisten | Backend no conectado o sin token | Ver logs en `JoinGo-backend` (`Chat client connect_error`). |
| `usersOnline` muestra `userId` vacío | Cliente omitió `newUser` después del connect | Emitir `newUser` tras handshake. |

## 9. Secuencia End-to-End
1. El frontend obtiene ID token y abre Socket.IO → microservicio valida token.
2. Frontend emite `newUser` + `joinRoom`.
3. Usuario envía `chat:message` → microservicio reemite a la sala y a la conexión del backend.
4. Backend recibe `chat:message`, invoca `POST meetings/{id}/messages` en Firestore.
5. Cualquier cliente puede pedir historial al backend; los mensajes nuevos llegan por WebSocket.

Con estas pautas el equipo frontend puede orquestar el microservicio de chat junto al backend y garantizar historial persistente, presencia y seguridad consistente.
