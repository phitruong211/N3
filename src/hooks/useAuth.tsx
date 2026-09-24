import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, clearSession, currentUser, hasSession, login, logout, register, type ApiUser } from '@/lib/api';

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  restoreError: string | null;
  retryRestore: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRestoreError(null);
    if (!hasSession()) { setLoading(false); return; }
    setLoading(true);
    currentUser().then(restored => { if (active) setUser(restored); }).catch(error => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) clearSession();
      else setRestoreError('Chưa thể kết nối để khôi phục phiên. Phiên đăng nhập của bạn vẫn được giữ lại.');
    }).finally(() => { if (active) setLoading(false); });
    const retryOnline = () => setRestoreAttempt(value => value + 1);
    window.addEventListener('online', retryOnline);
    return () => { active = false; window.removeEventListener('online', retryOnline); };
  }, [restoreAttempt]);
  return <AuthContext.Provider value={{ user, loading, restoreError,
    retryRestore: () => setRestoreAttempt(value => value + 1),
    signIn: async (email, password) => setUser(await login(email, password)),
    signUp: async (email, password, displayName) => setUser(await register(email, password, displayName)),
    signOut: async () => { try { await logout(); } finally { setUser(null); } },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
