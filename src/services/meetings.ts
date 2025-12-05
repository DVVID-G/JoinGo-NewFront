import { apiFetch } from '@/lib/api-client';
import { Meeting, MeetingSettings, MeetingStatus } from '@/store/meetingStore';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Mensaje de chat persistido en el backend
 */
export interface ChatMessage {
  messageId: string;
  meetingId: string;
  userId: string;
  userName?: string;
  message: string;
  timestamp: string;
}

interface BackendMeeting {
  id: string;
  meetingName?: string;
  hostUid?: string;
  createdAt?: string;
  updatedAt?: string;
  voiceRoomId?: string;
  status?: 'active' | 'inactive' | 'closed';
  maxParticipants?: number;
  metadata?: BackendMeetingMetadata | null;
  date?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  duration?: string;
  participants?: string[];
  settings?: MeetingSettings;
}

interface BackendMeetingMetadata {
  meetingName?: string;
  name?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  duration?: string;
  participants?: string[];
  settings?: MeetingSettings;
  code?: string;
  joinCode?: string;
  maxParticipants?: number;
  voiceRoomId?: string;
  [key: string]: unknown;
}

export interface CreateMeetingInput {
  meetingName: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  duration?: string;
  maxParticipants?: number;
  participants?: string[];
  settings?: MeetingSettings;
}

const DEFAULT_SETTINGS: MeetingSettings = {
  chat: true,
  waitingRoom: true,
  privateRoom: false,
  screenSharing: true,
  requirePassword: false,
};

function normalizeMeeting(data: BackendMeeting): Meeting {
  const metadata = data.metadata ?? {};
  const meetingName =
    data.meetingName ?? metadata.meetingName ?? metadata.name ?? 'Reunión sin título';
  const date = data.date ?? metadata.date ?? '';
  const startTime = data.startTime ?? metadata.startTime ?? '';
  const endTime = data.endTime ?? metadata.endTime ?? '';
  const description = data.description ?? metadata.description ?? '';
  const duration = data.duration ?? metadata.duration ?? '';
  const participants = data.participants ?? metadata.participants ?? [];
  const settings = data.settings ?? metadata.settings ?? DEFAULT_SETTINGS;
  const code = metadata.code ?? metadata.joinCode ?? data.id;

  return {
    id: data.id,
    code,
    meetingName,
    name: meetingName,
    date,
    startTime,
    endTime,
    createdBy: data.hostUid,
    hostUid: data.hostUid,
    createdAt: data.createdAt,
    status: data.status ?? 'active',
    maxParticipants: data.maxParticipants ?? metadata.maxParticipants ?? 10,
    participants,
    description,
    duration,
    settings,
    metadata: metadata as Record<string, unknown>,
    voiceRoomId: data.voiceRoomId ?? metadata.voiceRoomId,
  };
}

export async function fetchMeetings(): Promise<Meeting[]> {
  const data = await apiFetch<BackendMeeting[]>('/api/meetings');
  return data.map(normalizeMeeting);
}

export async function createMeeting(payload: CreateMeetingInput): Promise<Meeting> {
  const body = {
    meetingName: payload.meetingName,
    maxParticipants: payload.maxParticipants ?? 10,
    metadata: {
      meetingName: payload.meetingName,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      description: payload.description ?? '',
      duration: payload.duration ?? '',
      participants: payload.participants ?? [],
      settings: payload.settings ?? DEFAULT_SETTINGS,
    },
  };

  const data = await apiFetch<BackendMeeting>('/api/meetings', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // Debug: mostrar respuesta del backend
  console.log('Backend createMeeting response:', JSON.stringify(data, null, 2));

  return normalizeMeeting(data);
}

/**
 * Obtiene una reunión por su ID (ruta pública, no requiere auth)
 * Útil para verificar si una reunión existe antes de unirse
 */
export async function getMeetingById(meetingId: string): Promise<Meeting> {
  console.log('[getMeetingById] Buscando reunión con ID:', meetingId);
  console.log('[getMeetingById] URL completa:', `${API_BASE_URL}/api/meetings/${meetingId}`);
  
  try {
    // Hacer fetch SIN autenticación ya que es un endpoint público
    const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[getMeetingById] Response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[getMeetingById] Error response:', errorBody);
      throw {
        status: response.status,
        code: 'NOT_FOUND',
        message: `Reunión no encontrada: ${response.status}`,
      };
    }

    const payload = await response.json();
    console.log('[getMeetingById] Response payload:', JSON.stringify(payload, null, 2));
    
    // El backend devuelve { data: Meeting }
    const data = payload.data ?? payload;
    return normalizeMeeting(data);
  } catch (error) {
    console.error('[getMeetingById] Error:', error);
    throw error;
  }
}

/**
 * Obtiene el historial de mensajes de una reunión
 * ⚠️ Este endpoint devuelve un array directo (sin wrapper { data: ... })
 */
export async function fetchMeetingMessages(
  meetingId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const { tokens } = useAuthStore.getState();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (tokens?.idToken) {
    headers['Authorization'] = `Bearer ${tokens.idToken}`;
  }

  const response = await fetch(
    `${API_BASE_URL}/api/meetings/${meetingId}/messages?limit=${limit}`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      code: error?.error?.code ?? 'UNKNOWN_ERROR',
      message: error?.error?.message ?? response.statusText,
    };
  }

  // El endpoint devuelve array directo, no { data: [...] }
  return response.json();
}

/**
 * Actualiza el estado de una reunión (solo el host puede ejecutar)
 * - 'active': reunión activa
 * - 'inactive': soft delete (marca deletedAt)
 * - 'closed': reunión finalizada
 */
export async function updateMeetingStatus(
  meetingId: string,
  status: MeetingStatus
): Promise<Meeting> {
  const data = await apiFetch<BackendMeeting>(`/api/meetings/${meetingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  return normalizeMeeting(data);
}
