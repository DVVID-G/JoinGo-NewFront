# JoinGo Frontend

Aplicación de videollamadas y chat construida con **React 18 + TypeScript + Vite**, usando **Firebase Auth** para autenticación y un backend propio para reuniones, chat y canal de voz (WebRTC + simple-peer).

## Stack principal
- React 18, TypeScript, Vite
- Zustand (estado global) con persistencia
- shadcn/ui + Tailwind CSS
- Firebase Auth (email/password y OAuth)
- Socket.io + simple-peer para voz y chat en tiempo real

## Requisitos
- Node.js 18+ (recomendado con nvm)
- npm (o pnpm/yarn si prefieres)

## Configuración rápida
```sh
git clone <url-del-repo>
cd nuevo\ front
npm install
```

### Variables de entorno (`.env`)
```
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Voz / WebRTC
VITE_WEBRTC_URL=https://voice-server-joingo.onrender.com
# Opcional: STUN/TURN
VITE_ICE_SERVER_URL=stun:stun.l.google.com:19302
VITE_ICE_SERVER_USERNAME=  # si aplica
VITE_ICE_SERVER_CREDENTIAL= # si aplica
```

## Scripts
- `npm run dev` — servidor de desarrollo (Vite)
- `npm run build` — build de producción
- `npm run lint` — lint con ESLint

## Estructura destacada
- `src/pages/` — vistas principales (landing, auth, dashboard, meeting room)
- `src/components/` — UI reutilizable (shadcn/ui en `components/ui`)
- `src/store/` — Zustand stores (`authStore`, `meetingStore`)
- `src/services/` — llamadas a API y WebRTC (`auth`, `meetings`, `webrtc`)
- `src/hooks/` — hooks de sesión y chat
- `src/lib/` — utilidades (`api-client`, `firebase`, helpers)

## Notas de desarrollo
- La landing oculta CTA de registro/login si el usuario ya está autenticado y dirige al dashboard.
- En sala de reunión, el panel de chat no se abre por defecto; el usuario decide abrirlo.
- El contenedor de video limita altura/ancho y usa `object-contain` para evitar sobredimensionar la cámara.
- Botón de cámara: reaccede a la cámara si no hay track y alterna visible/oculto limpiando/restaurando `srcObject`.

## Problemas comunes
- `process` o `events` no definidos en el navegador: revisar polyfills en `src/polyfills` y alias en `vite.config.ts`.
- Errores de ICE server: asegúrate de que `VITE_ICE_SERVER_URL` tenga esquema (`stun:`/`turn:`).

## Licencia
Pendiente de definir.
