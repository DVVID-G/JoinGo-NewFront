# JoinGo Frontend - Copilot Instructions

## Arquitectura General

JoinGo es una aplicación de videollamadas construida con **React 18 + TypeScript + Vite**. Usa **Firebase Auth** para autenticación y un backend REST propio para datos de reuniones y usuarios.

### Capas del Sistema
```
src/
├── pages/          → Páginas/rutas (Login, Register, Dashboard, MeetingRoom)
├── components/     → UI reutilizable (shadcn/ui en components/ui/)
├── services/       → Lógica de comunicación con APIs (auth.ts, meetings.ts, user.ts)
├── store/          → Estado global con Zustand (authStore.ts, meetingStore.ts)
├── hooks/          → Hooks personalizados (use-auth-session, use-meetings)
├── lib/            → Utilidades (api-client.ts, firebase.ts, utils.ts)
```

## Patrones Críticos

### Autenticación Dual (Firebase + Backend)
- **Firebase Auth**: Maneja OAuth (Google/GitHub) y emite tokens JWT
- **Backend API**: Sincroniza perfiles y gestiona datos de reuniones
- El flujo OAuth usa `signInWithPopup` con fallback a `signInWithRedirect` si hay errores COOP
- Los tokens se refrescan automáticamente en `use-auth-session.ts` (1 min antes de expirar)

```typescript
// Patrón de autenticación con proveedor (src/services/auth.ts)
const payload = await loginWithProvider('google');
login(payload); // Actualiza authStore
await syncProviderProfile(payload, providerId); // Sincroniza con backend
```

### API Client con Refresco Automático
`src/lib/api-client.ts` maneja todas las llamadas al backend:
- Inyecta automáticamente el header `Authorization: Bearer {idToken}`
- Si recibe 401, refresca el token y reintenta la petición
- Extrae datos del wrapper `{ data: T }` automáticamente

```typescript
// Uso correcto de apiFetch
const meetings = await apiFetch<Meeting[]>('/api/meetings');
await apiFetch('/api/auth/logout', { method: 'POST' });
```

### Estado Global (Zustand + Persist)
- `authStore`: Usuario, tokens, isAuthenticated. Persiste en localStorage como `joingo-auth`
- `meetingStore`: Lista de reuniones. Persiste como `joingo-meetings`

```typescript
// Acceder al estado
const { user, tokens, login, logout } = useAuthStore();
const { meetings, addMeeting, getMeetingByCode } = useMeetingStore();
```

### Normalización de Datos Backend
Los servicios normalizan respuestas del backend que vienen con estructuras inconsistentes:
- `normalizeMeeting()` en `meetings.ts` - maneja metadata anidada
- `normalizeUser()` en `user.ts` - unifica displayName/firstName/lastName

## Comandos de Desarrollo

```bash
npm run dev      # Servidor dev en puerto 8080 (o siguiente disponible)
npm run build    # Build de producción
npm run lint     # ESLint
npm run preview  # Preview del build
```

## Variables de Entorno Requeridas

```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Convenciones de Código

### Componentes UI
- Usar componentes de `@/components/ui/` (shadcn/ui)
- Combinar clases con `cn()` de `@/lib/utils`
- Notificaciones con `toast` de sonner: `toast.success()`, `toast.error()`

### Manejo de Errores
- Errores de Firebase: Traducir códigos con funciones `translateFirebaseError()`
- Errores de API: Usar tipo `ApiError` con `status`, `code`, `message`
- Mostrar errores al usuario con `toast.error(mensaje)`

### Idioma
- La UI y mensajes de error están en **español**
- Código y comentarios técnicos en inglés

## Archivos Clave para Entender el Sistema

| Archivo | Propósito |
|---------|-----------|
| `src/services/auth.ts` | Toda la lógica de autenticación (email, OAuth, logout) |
| `src/lib/api-client.ts` | Cliente HTTP con auth automática y retry |
| `src/store/authStore.ts` | Estado de autenticación persistente |
| `src/hooks/use-auth-session.ts` | Refresco automático de tokens |
| `vite.config.ts` | Headers COOP para Firebase popup auth |
