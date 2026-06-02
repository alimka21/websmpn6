// src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../lib/api';

export type Role = 'SUPER_ADMIN' | 'GURU' | 'SISWA';

interface UserProfile {
  nama: string;
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  profile: UserProfile;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  isAuthenticated: () => boolean;
  hasRole: (roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true, // Init dengan true supaya bisa fetchMe
      
      login: async (identifier, password, role) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/api/auth/login', { identifier, password, role });
          set({ user: res.user, token: res.token, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/api/auth/logout');
        } catch (error) {
          // Ignore error on logout if already disconnected
        } finally {
          set({ user: null, token: null });
          localStorage.removeItem('auth-storage');
        }
      },

      fetchMe: async () => {
        const { token } = get();
        if (!token) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const res = await api.get('/api/auth/me');
          set({ user: res, isLoading: false });
        } catch (error) {
          set({ user: null, token: null, isLoading: false });
          localStorage.removeItem('auth-storage');
        }
      },

      isAuthenticated: () => {
        return !!get().token && !!get().user;
      },

      hasRole: (roles: Role[]) => {
        const user = get().user;
        if (!user) return false;
        return roles.includes(user.role);
      }
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ token: state.token }), // Kita hanya persist token-nya saja
    }
  )
);
