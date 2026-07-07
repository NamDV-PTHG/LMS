'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

/** Decode JWT payload (client-side, no signature verification) to read exp */
function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

// ── Types ─────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  companyId: string;
  roles: { role: string; organizationId: string; organizationName: string }[];
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.data as AuthUser;
    } catch {
      return null;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await axios.post('/api/auth/refresh');
      const { accessToken: newToken } = res.data.data;
      setAccessToken(newToken);
      return newToken;
    } catch {
      setUser(null);
      setAccessToken(null);
      return null;
    }
  }, []);

  // On mount: try to restore session via refresh token cookie
  useEffect(() => {
    (async () => {
      const token = await refreshToken();
      if (token) {
        const profile = await fetchMe(token);
        setUser(profile);
      }
      setIsLoading(false);
    })();
  }, [refreshToken, fetchMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await axios.post('/api/auth/login', { email, password });
      const { accessToken: token, user: profile, mustChangePassword } = res.data.data;
      setAccessToken(token);
      setUser(profile);
      if (mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    },
    [router],
  );

  const logout = useCallback(async (): Promise<void> => {
    if (accessToken) {
      await axios
        .post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${accessToken}` } })
        .catch(() => {});
    }
    setUser(null);
    setAccessToken(null);
    router.push('/login');
  }, [accessToken, router]);

  // Auto-refresh: schedule refresh 60s before the token's actual expiry
  useEffect(() => {
    if (!accessToken) return;
    const exp = getTokenExpiry(accessToken);
    if (!exp) return;
    const msUntilRefresh = (exp * 1000) - Date.now() - 60_000; // 60s before expiry
    if (msUntilRefresh <= 0) {
      // Token already expired or about to — refresh immediately
      refreshToken();
      return;
    }
    const timer = setTimeout(() => refreshToken(), msUntilRefresh);
    return () => clearTimeout(timer);
  }, [accessToken, refreshToken]);

  // Refresh on page focus after device sleep / tab switch
  // Stores the last-known token in a ref so the handler always sees the latest value
  const accessTokenRef = useRef(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const token = accessTokenRef.current;
      if (!token) return;
      const exp = getTokenExpiry(token);
      const now = Math.floor(Date.now() / 1000);
      // Refresh if less than 60 seconds left (covers device sleep where timers don't fire)
      if (exp - now < 60) {
        const newToken = await refreshToken();
        if (newToken) {
          const profile = await fetchMe(newToken);
          if (profile) setUser(profile);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshToken, fetchMe]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}
