import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
  hasRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pim_access_token', accessToken);
      localStorage.setItem('pim_refresh_token', refreshToken);
      localStorage.setItem('pim_user', JSON.stringify(user));
    }
    set({ user, accessToken, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pim_access_token');
      localStorage.removeItem('pim_refresh_token');
      localStorage.removeItem('pim_user');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  hasRole: (...roles: string[]) => {
    const user = get().user;
    return user ? roles.includes(user.role) : false;
  },

  loadFromStorage: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('pim_access_token');
      const userStr = localStorage.getItem('pim_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, accessToken: token, isAuthenticated: true });
        } catch {
          // Invalid stored data
        }
      }
    }
  },
}));
