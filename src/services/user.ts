import { apiFetch } from '@/lib/api-client';
import { User } from '@/store/authStore';

interface BackendUser {
  uid: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
  age?: number;
  role?: 'host' | 'participant';
  status?: 'active' | 'deleted';
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface UpsertUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  age?: number;
  role?: 'host' | 'participant';
}

function normalizeUser(data: BackendUser): User {
  const displayName = data.displayName?.trim() ?? '';
  const [displayFirst = '', ...displayRest] = displayName.split(' ');
  const fallbackName = data.email.split('@')[0] ?? 'Usuario';

  return {
    id: data.uid,
    firstName: data.firstName ?? (displayFirst || fallbackName),
    lastName: data.lastName ?? displayRest.join(' ').trim(),
    email: data.email,
    avatar: data.avatarUrl,
    phone: data.phoneNumber,
    age: data.age,
    role: data.role,
    status: data.status,
    provider: data.provider,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    deletedAt: data.deletedAt ?? undefined,
  };
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await apiFetch<BackendUser>('/api/users/me');
  return normalizeUser(data);
}

export async function syncUserProfile(payload: UpsertUserPayload): Promise<User> {
  const data = await apiFetch<BackendUser>('/api/users/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeUser(data);
}

export async function updateUserProfile(payload: UpsertUserPayload): Promise<User> {
  const data = await apiFetch<BackendUser>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return normalizeUser(data);
}

export async function deleteUserAccount(options: { full?: boolean } = {}): Promise<void> {
  const search = new URLSearchParams();
  if (options.full !== undefined) {
    search.set('full', String(options.full));
  }

  await apiFetch(`/api/users/me${search.toString() ? `?${search.toString()}` : ''}`, {
    method: 'DELETE',
  });
}
