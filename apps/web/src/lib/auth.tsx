import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** False when the API is not reachable (e.g. static preview). Tools still work. */
  online: boolean;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, loading, online, refresh, setUser, logout }), [user, loading, online, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
