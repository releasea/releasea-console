import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { clientLogger } from '@/platform/logging/client-logger';

export interface PlatformPreferences {
  // Display preferences
  compactView: boolean;
  sidebarCollapsed: boolean;
  defaultLandingPage: '/' | '/projects' | '/services' | '/workers';
  
  // Metrics preferences
  autoRefreshMetrics: boolean;
  metricsRefreshInterval: number; // seconds
  
  // Localization
  timezone: string;
  dateFormat: 'ISO' | 'US' | 'EU' | 'relative';
  language: 'en' | 'pt-BR' | 'es';
  
  // Session
  sessionTimeoutMinutes: number;
  showSessionWarning: boolean;
  
  // Tables
  defaultPageSize: 10 | 25 | 50 | 100;
  showTableDensity: 'comfortable' | 'compact';
}

const defaultPreferences: PlatformPreferences = {
  compactView: false,
  sidebarCollapsed: false,
  defaultLandingPage: '/',
  autoRefreshMetrics: true,
  metricsRefreshInterval: 30,
  timezone: 'UTC',
  dateFormat: 'ISO',
  language: 'en',
  sessionTimeoutMinutes: 60,
  showSessionWarning: true,
  defaultPageSize: 10,
  showTableDensity: 'comfortable',
};

const STORAGE_KEY = 'releasea.preferences';

interface PlatformPreferencesContextValue {
  preferences: PlatformPreferences;
  updatePreference: <K extends keyof PlatformPreferences>(
    key: K,
    value: PlatformPreferences[K]
  ) => void;
  updatePreferences: (updates: Partial<PlatformPreferences>) => void;
  resetPreferences: () => void;
}

const PlatformPreferencesContext = createContext<PlatformPreferencesContextValue | null>(null);

const loadPreferences = (): PlatformPreferences => {
  if (typeof window === 'undefined') {
    return defaultPreferences;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPreferences, ...parsed };
    }
  } catch (error) {
    clientLogger.warn('preferences.load', 'Failed to load preferences', { error });
  }

  return defaultPreferences;
};

const savePreferences = (preferences: PlatformPreferences): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    clientLogger.warn('preferences.save', 'Failed to save preferences', { error });
  }
};

interface PlatformPreferencesProviderProps {
  children: ReactNode;
}

export function PlatformPreferencesProvider({ children }: PlatformPreferencesProviderProps) {
  const [preferences, setPreferences] = useState<PlatformPreferences>(loadPreferences);

  // Apply compact view class to body
  useEffect(() => {
    if (preferences.compactView) {
      document.body.classList.add('compact-view');
    } else {
      document.body.classList.remove('compact-view');
    }
  }, [preferences.compactView]);

  // Save preferences when they change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof PlatformPreferences>(key: K, value: PlatformPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updatePreferences = useCallback((updates: Partial<PlatformPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <PlatformPreferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        updatePreferences,
        resetPreferences,
      }}
    >
      {children}
    </PlatformPreferencesContext.Provider>
  );
}

export function usePlatformPreferences() {
  const context = useContext(PlatformPreferencesContext);
  if (!context) {
    throw new Error('usePlatformPreferences must be used within a PlatformPreferencesProvider');
  }
  return context;
}
