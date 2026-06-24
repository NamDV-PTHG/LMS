'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

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

  // Auto-refresh access token 2 minutes before expiry (token is 15m)
  useEffect(() => {
    if (!accessToken) return;
    const timer = setTimeout(() => refreshToken(), 13 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [accessToken, refreshToken]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}
