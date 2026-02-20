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
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  validatePasswordResetToken: (token: string) => Promise<{ valid: boolean; email?: string }>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (requiredRole: 'admin' | 'developer') => boolean;
}

const roleHierarchy: Record<string, number> = {
  admin: 2,
  developer: 1,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('releasea_auth_user');
    const storedToken = localStorage.getItem('releasea_auth_token');
    if (storedToken) {
      apiClient.setToken(storedToken);
    }
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('releasea_auth_user');
      }
    } else if (storedUser && !storedToken) {
      localStorage.removeItem('releasea_auth_user');
    }
    setIsLoading(false);
  }, []);

  const applyAuthSession = (sessionUser: AuthUser, token: string, refreshToken?: string) => {
    setUser(sessionUser);
    localStorage.setItem('releasea_auth_user', JSON.stringify(sessionUser));
    localStorage.setItem('releasea_auth_token', token);
    if (refreshToken) {
      localStorage.setItem('releasea_refresh_token', refreshToken);
    }
    apiClient.setToken(token);
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const result = await authLogin(email, password);
    if (!result.success || !result.user || !result.token) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'Login failed.' };
    }

    applyAuthSession(result.user, result.token, result.refreshToken);
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

    applyAuthSession(result.user, result.token, result.refreshToken);
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

    applyAuthSession(result.user, result.token, result.refreshToken);
    setIsLoading(false);
    return { success: true };
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const result = await authRequestPasswordReset(email);
    if (!result.success) {
      setIsLoading(false);
      return { success: false, error: result.error ?? 'Please enter a valid email address.' };
    }

    if (result.token) {
      localStorage.setItem('releasea_reset_token', result.token);
    }

    setIsLoading(false);
    return { success: true };
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

    localStorage.removeItem('releasea_reset_token');
    setIsLoading(false);
    return { success: true };
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await authLogout();

    setUser(null);
    localStorage.removeItem('releasea_auth_user');
    localStorage.removeItem('releasea_auth_token');
    localStorage.removeItem('releasea_refresh_token');
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
