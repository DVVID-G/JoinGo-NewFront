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

/**
 * Shape used to upsert user data in the backend.
 * All fields are optional to support partial updates.
 */
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

/**
 * Fetches the authenticated user profile from the backend.
 * @returns The normalized user object as stored in `authStore`.
 */
export async function fetchCurrentUser(): Promise<User> {
  const data = await apiFetch<BackendUser>('/api/users/me');
  return normalizeUser(data);
}

/**
 * Syncs (creates or updates) the user profile with backend data coming from Firebase.
 * @param payload Profile attributes to upsert.
 * @returns The normalized user stored in the auth store shape.
 */
export async function syncUserProfile(payload: UpsertUserPayload): Promise<User> {
  const data = await apiFetch<BackendUser>('/api/users/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeUser(data);
}

/**
 * Updates the current user profile with editable fields.
 * @param payload Partial profile fields to persist.
 * @returns The normalized user after the update.
 */
export async function updateUserProfile(payload: UpsertUserPayload): Promise<User> {
  const data = await apiFetch<BackendUser>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return normalizeUser(data);
}

/**
 * Soft-deletes the user account (or fully deletes when `full` is true).
 * @param options.full When true, performs a full removal instead of soft delete.
 */
export async function deleteUserAccount(options: { full?: boolean } = {}): Promise<void> {
  const search = new URLSearchParams();
  if (options.full !== undefined) {
    search.set('full', String(options.full));
  }

  await apiFetch(`/api/users/me${search.toString() ? `?${search.toString()}` : ''}`, {
    method: 'DELETE',
  });
}
