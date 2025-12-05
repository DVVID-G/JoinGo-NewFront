import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  age?: number;
  avatar?: string;
  role?: 'host' | 'participant';
  status?: 'active' | 'deleted';
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface AuthTokens {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  login: (payload: { user: User; tokens: AuthTokens }) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setTokens: (tokens: AuthTokens | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      login: ({ user, tokens }) => set({ user, tokens, isAuthenticated: true }),
      logout: () => set({ user: null, tokens: null, isAuthenticated: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setTokens: (tokens) => set((state) => ({
        tokens,
        isAuthenticated: state.isAuthenticated && Boolean(tokens),
      })),
    }),
    {
      name: 'joingo-auth',
    }
  )
);
