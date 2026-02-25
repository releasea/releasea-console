import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthUser } from '@/types/releasea';
import {
  authExchangeSSOTicket,
  authConfirmPasswordReset,
  authLogin,
  authLogout,
  authRequestPasswordReset,
  authSignUp,
  authValidatePasswordResetToken,
} from '@/lib/data';
import { apiClient } from '@/lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithSSOTicket: (ticket: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; token?: string }>;
  validatePasswordResetToken: (token: string) => Promise<{ valid: boolean; email?: string }>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (requiredRole: 'admin' | 'developer') => boolean;
}

const roleHierarchy: Record<string, number> = {
  admin: 2,
  developer: 1,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_AUTH_STORAGE_KEYS = [
  'releasea_auth_user',
  'releasea_auth_token',
  'releasea_refresh_token',
  'releasea_reset_token',
];

const clearLegacyAuthStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }
  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizeAuthUser = (value: unknown): AuthUser | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const email = readString(value.email);
  if (!id || !email) {
    return null;
  }

  const role = readString(value.role) === 'admin' ? 'admin' : 'developer';
  const name = readString(value.name) || email;

  return {
    id,
    name,
    email,
    role,
    teamId: readString(value.teamId),
    teamName: readString(value.teamName),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      clearLegacyAuthStorage();
      try {
        const restoredUser = await apiClient.restoreSession<unknown>();
        if (!active) {
          return;
        }
        setUser(normalizeAuthUser(restoredUser));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, []);

  const applyAuthSession = (sessionUser: AuthUser, token: string) => {
    setUser(sessionUser);
    apiClient.setToken(token);
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const result = await authLogin(email, password);
    if (!result.success || !result.user || !result.token) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'Login failed.' };
    }

    applyAuthSession(result.user, result.token);
    setIsLoading(false);

    return { success: true };
  };

  const signUp = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const result = await authSignUp(name, email, password);
    if (!result.success || !result.user || !result.token) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'Failed to create account. Please try again.' };
    }

    applyAuthSession(result.user, result.token);
    setIsLoading(false);
    return { success: true };
  };

  const loginWithSSOTicket = async (ticket: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const result = await authExchangeSSOTicket(ticket);
    if (!result.success || !result.user || !result.token) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'SSO login failed.' };
    }

    applyAuthSession(result.user, result.token);
    setIsLoading(false);
    return { success: true };
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string; token?: string }> => {
    setIsLoading(true);

    const result = await authRequestPasswordReset(email);
    if (!result.success) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'Please enter a valid email address.' };
    }

    setIsLoading(false);
    return { success: true, token: result.token };
  };

  const validatePasswordResetToken = async (token: string): Promise<{ valid: boolean; email?: string }> => {
    return authValidatePasswordResetToken(token);
  };

  const confirmPasswordReset = async (token: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const result = await authConfirmPasswordReset(token, newPassword);
    if (!result.success) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'Invalid or expired reset link. Please request a new one.' };
    }

    setIsLoading(false);
    return { success: true };
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await authLogout();

    setUser(null);
    clearLegacyAuthStorage();
    apiClient.setToken(null);
    setIsLoading(false);
  };

  const hasPermission = (requiredRole: 'admin' | 'developer'): boolean => {
    if (!user) return false;
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithSSOTicket,
        logout,
        signUp,
        requestPasswordReset,
        validatePasswordResetToken,
        confirmPasswordReset,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
