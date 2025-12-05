# JoinGo Backend API Specification

Esta especificación resume todo lo que necesita un desarrollador frontend senior para consumir las APIs expuestas por el backend de JoinGo y coordinarse con los microservicios de chat/voz existentes.

## 1. Arquitectura y Convenciones
- **Stack**: Node.js + Express + Firebase Admin + Firestore. Todas las rutas viven bajo la misma app Express.
- **Autenticación**: Se usa Firebase ID Token en el header `Authorization: Bearer <ID_TOKEN>`.
- **Respuesta base**: Formato `{ data: ... }` para respuestas exitosas y `{ error: { code, message } }` para errores. La única excepción actual es `GET /api/meetings/:id/messages`, que devuelve directamente un array.
- **Errores estándar**: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `SERVER_ERROR` (500).
- **Modelos clave**:
  - `User`: `uid`, `displayName`, `firstName`, `lastName`, `email`, `avatarUrl`, `phoneNumber`, `role ('host'|'participant')`, `status ('active'|'deleted')`, `provider` metadata, `createdAt`, `updatedAt`, `deletedAt?`.
  - `Meeting`: `id`, `hostUid`, `createdAt`, `status ('active'|'inactive'|'closed')`, `maxParticipants`, `metadata`, `voiceEnabled`, `voiceRoomId`, `expiresAt?`.
  - `ChatMessage`: `messageId`, `meetingId`, `userId`, `userName?`, `message`, `timestamp`.
  - `VoiceConfig`: `voiceServerUrl`, `signalUrl`, `iceServers[{ urls, username?, credential? }]`, `requiresToken`.
  - `VoiceSession`: `meetingId`, `voiceRoomId`, `userId`, `voiceServerUrl`, `signalUrl`, `iceServers`, `token?`, `expiresAt`.

## 2. Autenticación y Headers
1. El cliente debe autenticar al usuario con Firebase JS SDK (email/password o proveedor) y obtener un ID token con `user.getIdToken()`.
2. Ese token se envía en `Authorization: Bearer <token>` para todas las rutas protegidas.
3. No se mantiene sesión estatal en el backend; los tokens vencidos retornan `401 UNAUTHORIZED`.
4. `POST /api/auth/login` usa la API REST de Firebase y devuelve `idToken` + `refreshToken`. El frontend debe persistirlos localmente (p.ej. secure storage) para reusar el ID token o renovar sesión mediante Firebase SDK.

## 3. Mapeo de Rutas
### 3.1 Health
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | No | Retorna `{ status: 'ok' }`. Útil para monitoreo.

### 3.2 Autenticación
**Públicas**
1. `POST /api/auth/register`
   - Body: `{ firstName?, lastName?, age?, email, password }`
   - Crea usuario en Firebase Auth y perfil en Firestore. Respuesta `201` `{ data: { uid, email, displayName } }`.
2. `POST /api/auth/login`
   - Body: `{ email, password }`
   - Retorna `{ data: { idToken, refreshToken, expiresIn, uid, email, displayName } }`.
3. `POST /api/auth/forgot-password`
   - Body: `{ email }`
   - Genera link de restablecimiento: `{ data: { link } }`.
4. `POST /api/auth/oauth`
   - Body: `{ provider: 'google'|'facebook', code, redirectUri? }`
   - Flujo opcional de intercambio server-side. Respuesta `{ data: { customToken, user } }`.

**Protegidas (requieren `Authorization`):**
1. `POST /api/auth/logout`
   - Revoca los refresh tokens del usuario. Respuesta `{ data: { success: true } }`.
2. `POST /api/auth/change-email`
   - Body: `{ email }`. Actualiza email en Firebase Auth. Respuesta `{ data: { success: true } }`.
3. `POST /api/auth/change-password`
   - Body: `{ password }`. Actualiza password en Firebase Auth. Respuesta `{ data: { success: true } }`.
4. `POST /api/auth/provider-sync`
   - Body opcional: `{ provider?, displayName?, avatarUrl?, locale?, phoneNumber?, firstName?, lastName?, email? }`.
   - Sincroniza datos del proveedor (Firebase `userRecord`) con Firestore. Respuesta `{ data: User }`.

### 3.3 Usuarios (todas protegidas)
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/users/sync` | `displayName?`, `avatarUrl?`, `role?`, `firstName?`, `lastName?`, `age?`, `phoneNumber?` (E.164 o dígitos 7-15) | `{ data: User }` (upsert, normaliza `phoneNumber`). |
| GET | `/api/users/me` | — | `{ data: User }`.
| PUT | `/api/users/me` | Mismos campos que sync (todos opcionales). | `{ data: User }` (overwrites fields provistos).
| DELETE | `/api/users/me?full=true|false` | — | `{ data: User }`. Con `full=true` también borra al usuario en Firebase Auth.

### 3.4 Reuniones
| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/api/meetings` | Sí | `{ maxParticipants?: number (2-10), ttlMinutes?: number, metadata?: Record<string, any> }` | `201 { data: Meeting }`. `voiceEnabled` y `voiceRoomId` se autogeneran. |
| GET | `/api/meetings` | Sí | — | `{ data: Meeting[] }` de reuniones activas del host autenticado.
| GET | `/api/meetings/:id` | No | — | `{ data: Meeting }` o 404 si no existe. Útil para check pública antes de join.
| GET | `/api/meetings/:id/messages?limit=50` | Sí | — | `[ ChatMessage ]` (array directo sin wrapper). Orden cronológico ascendente.
| PATCH | `/api/meetings/:id/status` | Sí (host) | `{ status: 'active' | 'inactive' | 'closed' }` | `{ data: Meeting }`. `inactive` aplica soft delete (`deletedAt`).

Notas:
- `GET /api/meetings` usa Firestore y puede requerir índice compuesto (ver logs). En fallback, filtra en memoria.
- `createMeeting` asigna `voiceRoomId = meeting.id` y `maxParticipants` default 10.

### 3.5 Voz (todas protegidas)
1. `GET /api/voice/config`
   - Sin body. Respuesta `{ data: VoiceConfig }` con URLs y `ICE` listos para PeerJS/WebRTC.
2. `POST /api/voice/session`
   - Body: `{ meetingId: string }`.
   - Valida que la reunión exista, esté activa y tenga voz habilitada. Respuesta `{ data: VoiceSession }` con token HMAC (`token`) válido por 5 minutos (`expiresAt`).
   - El frontend debe enviar este token al microservicio de voz (headers o handshake, según implementación) y usar `voiceRoomId` para unirse a la sala correcta.

### 3.6 Otros servicios relevantes
- **Chat Microservice (`eisc-chat`)**: No expone rutas HTTP desde este repo; el backend actúa como cliente Socket.IO y persiste mensajes bajo `meetings/{id}/messages`. El frontend solo lee historial vía `GET /api/meetings/:id/messages` y usa el servicio de chat externo para enviar/recibir en tiempo real.

## 4. Flujos Recomendados para el Frontend
1. **Registro/Login (Email/Password)**
   - Llamar a `/api/auth/register` si se desea crear usuario desde el backend (opcional).
   - Para login, invocar `/api/auth/login` para obtener `idToken`. Persistir `idToken` y `refreshToken` (o delegar en Firebase SDK). Todas las llamadas protegidas requieren ese `idToken` en `Authorization`.

2. **Login con Proveedores (Google/Facebook)**
   - Usar Firebase JS SDK (`signInWithPopup`). Obtener `idToken` y llamar `POST /api/auth/provider-sync` para crear/actualizar perfil (& campos personalizados).
   - Alternativa: usar `POST /api/auth/oauth` si el flujo requiere intercambio server-side y luego iniciar sesión en el cliente con `signInWithCustomToken(customToken)`.

3. **Gestión de Perfil**
   - Tras login, llamar `GET /api/users/me` para poblar stores locales.
   - Usar `PUT /api/users/me` para ediciones. `phoneNumber` debe cumplir la regex (se normaliza internamente: conserva `+` si existe y elimina caracteres no numéricos).
   - `DELETE /api/users/me?full=true` permite borrar cuenta completa (Auth + Firestore); sin `full`, solo marca `status: 'deleted'`.

4. **Reuniones**
   - Crear reunión: `POST /api/meetings` (host logueado). Guardar `id`, `voiceRoomId` y `maxParticipants`.
   - Compartir `id` a invitados; estos pueden verificar con `GET /api/meetings/:id` (no requiere token, pero se recomienda agregarle un fetch protegido si luego se exponen datos sensibles).
   - Obtener historial de chat: `GET /api/meetings/:id/messages?limit=100` (devuelve array simple). Cada objeto: `{ messageId, meetingId, userId, userName, message, timestamp }`.
   - Cambiar estado (host): `PATCH /api/meetings/:id/status` (p.ej. `'closed'` al finalizar).

5. **Voz/WebRTC**
   - Antes de conectar a la malla de audio, llamar `GET /api/voice/config` para poblar PeerJS/STUN config.
   - Solicitar token corto con `POST /api/voice/session` incluyendo `meetingId`. Conectar al microservicio de voz usando `voiceServerUrl`/`signalUrl` y presentar el `token` si el servidor lo exige.

## 5. Reglas de Seguridad y Validaciones
- **Auth Middleware** valida el header y descarta tokens con comillas envolventes.
- **Validaciones Zod**: Todos los controllers ejecutan `validate(schema, req.body)`; los errores devuelven `400 BAD_REQUEST` con mensaje agregado.
- **Límites**: `maxParticipants` 2-10; `phoneNumber` 7-15 dígitos; `password` mínimo 6 caracteres.
- **Voice Sessions**: vencen en 5 minutos (TTL fijo). El cliente debe manejar renovación solicitando un nuevo token si expira.
- **Meeting Messages**: `limit` query se parsea a entero positivo; valores inválidos se ignoran y se usa `50`.

## 6. Ejemplos de Consumo
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "ana@example.com", "password": "Passw0rd!" }
```
Respuesta:
```json
{
  "data": {
    "idToken": "eyJhbGciOi...",
    "refreshToken": "AEu4...",
    "expiresIn": "3600",
    "uid": "v1AbcDeFgH",
    "email": "ana@example.com",
    "displayName": "Ana" 
  }
}
```

```http
GET /api/meetings/room123/messages?limit=100
Authorization: Bearer <ID_TOKEN>
```
Respuesta:
```json
[
  {
    "messageId": "msg_001",
    "meetingId": "room123",
    "userId": "uid_a",
    "userName": "Ana",
    "message": "Hola a todos",
    "timestamp": "2025-12-04T15:00:00.000Z"
  }
]
```

```http
POST /api/voice/session
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json

{ "meetingId": "room123" }
```
Respuesta:
```json
{
  "data": {
    "meetingId": "room123",
    "voiceRoomId": "room123",
    "userId": "uid_a",
    "voiceServerUrl": "https://voice.example.com",
    "signalUrl": "https://voice.example.com/ws",
    "iceServers": [
      { "urls": "turn:relay.example.com:3478?transport=udp", "username": "demo", "credential": "secret" }
    ],
    "token": "eyJtZWV0aW5nSWQiOiJyb29tMTIzIi4uLg==",
    "expiresAt": "2025-12-04T15:05:00.000Z"
  }
}
```

## 7. Checklist para Integración Frontend
1. Configurar Firebase JS SDK con los mismos credenciales que usa el backend.
2. Persistir `idToken` tras login y refrescarlo antes de expiración (Firebase `user.getIdToken(true)`).
3. Añadir `Authorization` a todas las rutas protegidas (auth/user/meetings/voice).
4. Manejar el formato de error `{ error: { code, message } }` y la excepción mencionada (`GET /api/meetings/:id/messages`).
5. Para voz:
   - Llamar primero `GET /api/voice/config` al inicializar la app.
   - Solicitar `POST /api/voice/session` justo antes de unirse al canal y renovar cada 5 minutos.
6. Para chat:
   - Recuperar historial con la ruta REST y suscribirse al microservicio `eisc-chat` vía WebSocket/Socket.IO según configuración del frontend existente.
7. Cuando un usuario borre su cuenta (con `full=true`), invalidar sesión local y limpiar cachés.

Con este documento, cualquier desarrollador frontend puede consumir todas las capacidades actuales del backend y preparar la UI/UX para el nuevo diseño.
