import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, currentUser, hasSession, invalidateApiSession, isSessionStorageKey, login, logout, register, sessionIdentity, type ApiUser } from '@/lib/api';
import { createLearningStorage, type LearningStorage } from '@/lib/storage';
import type { ImportedCard, ImportPreview } from '@/lib/ankiImport';
import type { PageId } from '@/types';

export type ImportDraft = { preview: ImportPreview | null; name: string; creatingDeck: boolean; mode: 'flashcards' | 'anki'; manualCards?: ImportedCard[]; allowEmpty?: boolean; importSeed?: string };
type AuthPrompt = 'choice' | 'login' | 'register' | null;
interface AuthState {
  user: ApiUser | null;
  mode: 'unauthenticated' | 'guest' | 'authenticated';
  loading: boolean;
  restoreError: string | null;
  retryRestore: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterGuest: () => void;
  storage: LearningStorage;
  prompt: AuthPrompt;
  requestAuth: () => void;
  setPrompt: (prompt: AuthPrompt) => void;
  draft: ImportDraft | null;
  setDraft: (draft: ImportDraft | null) => void;
  resumePage: PageId | null;
  rememberPage: (page: PageId) => void;
  guestNotice: boolean;
  dismissGuestNotice: () => void;
  sessionKey: string;
}
const AuthContext = createContext<AuthState | null>(null);
const GUEST_KEY = 'guest:session';
function isGuestSession() { try { return sessionStorage.getItem(GUEST_KEY) === 'true'; } catch { return false; } }
function rememberGuest() { try { sessionStorage.setItem(GUEST_KEY, 'true'); } catch { /* Guest remains usable in memory. */ } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [guest, setGuest] = useState(isGuestSession);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [prompt, setPrompt] = useState<AuthPrompt>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [resumePage, setResumePage] = useState<PageId | null>(null);
  const [guestNotice, setGuestNotice] = useState(false);
  const pageRef = useRef<PageId>('dashboard');
  const generation = useRef(0);
  const authRequest = useRef<AbortController | null>(null);
  const [sessionKey, setSessionKey] = useState('initial');
  const rememberPage = useCallback((page: PageId) => { pageRef.current = page; }, []);
  const scope = user ? `user:${user.id}` as const : 'guest';
  const storage = useMemo(() => createLearningStorage(scope), [scope]);

  useEffect(() => {
    const changed = () => {
      generation.current++;
      authRequest.current?.abort();
      invalidateApiSession();
      setUser(null); setDraft(null); setPrompt(null); setResumePage(null); setGuestNotice(false);
      setLoading(true); setRestoreAttempt(value => value + 1);
    };
    const handleStorage = (event: StorageEvent) => { if (isSessionStorageKey(event.key)) changed(); };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth-session-expired', changed);
    return () => { window.removeEventListener('storage', handleStorage); window.removeEventListener('auth-session-expired', changed); };
  }, []);

  useEffect(() => {
    let active = true;
    const attempt = generation.current;
    setRestoreError(null);
    if (!hasSession()) { setLoading(false); setSessionKey(`guest:${attempt}`); return; }
    setLoading(true);
    currentUser().then(restored => {
      if (active && attempt === generation.current) { setUser(restored); setSessionKey(sessionIdentity()!); }
    }).catch(error => {
      if (!active || attempt !== generation.current) return;
      if (!(error instanceof ApiError && error.status === 401)) setRestoreError('Chưa thể kết nối để khôi phục phiên. Phiên đăng nhập của bạn vẫn được giữ lại.');
    }).finally(() => { if (active && attempt === generation.current) setLoading(false); });
    return () => { active = false; };
  }, [restoreAttempt]);

  useEffect(() => {
    if (!restoreError || !hasSession()) return;
    const retryOnline = () => setRestoreAttempt(value => value + 1);
    window.addEventListener('online', retryOnline);
    return () => window.removeEventListener('online', retryOnline);
  }, [restoreError]);

  function changePrompt(next: AuthPrompt) {
    if (next === null && authRequest.current) {
      generation.current++;
      authRequest.current.abort();
      authRequest.current = null;
    }
    setPrompt(next);
  }
  async function authenticate(action: (signal: AbortSignal) => Promise<ApiUser>) {
    authRequest.current?.abort();
    const controller = new AbortController();
    authRequest.current = controller;
    const attempt = generation.current;
    let account: ApiUser;
    try { account = await action(controller.signal); }
    finally { if (authRequest.current === controller) authRequest.current = null; }
    controller.signal.throwIfAborted();
    if (attempt !== generation.current) throw new Error('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
    setResumePage(guest ? pageRef.current : null);
    // P3 / FR-GUEST-07,08: connect consent + idempotent server migration here only after the sync API exists.
    const guestStorage = createLearningStorage('guest');
    setGuestNotice(guestStorage.getBookmarks().length > 0 || guestStorage.getStudyDays().length > 0 || (['vocabulary', 'kanji', 'grammar'] as const).some(type => guestStorage.getSRSCards(type).length > 0) || ['nhat-listening-v1', 'nhat-jlpt-listening-scores-v1'].some(key => Object.keys(guestStorage.getJSON(key, {})).length > 0));
    setUser(account); setSessionKey(sessionIdentity()!); setPrompt(null); setRestoreError(null);
  }
  function enterGuest() {
    // Never discard a recoverable authenticated session just to enter Guest.
    if (hasSession()) return;
    invalidateApiSession(); rememberGuest(); setGuest(true); setResumePage('dashboard'); setPrompt(null);
    createLearningStorage('guest').setLastPage('dashboard');
  }
  async function signOut() {
    const attempt = ++generation.current;
    authRequest.current?.abort();
    const pending = logout();
    setUser(null); setDraft(null); setPrompt(null); setGuestNotice(false); setRestoreError(null);
    rememberGuest(); setGuest(true); setResumePage('dashboard'); setSessionKey(`guest:${generation.current}`);
    createLearningStorage('guest').setLastPage('dashboard');
    try { await pending; } catch { if (attempt !== generation.current || hasSession()) return; setRestoreError('Đã đăng xuất trên thiết bị. Chưa thể thu hồi phiên trên máy chủ do lỗi kết nối.'); }
  }
  return <AuthContext.Provider value={{ user, mode: user ? 'authenticated' : guest ? 'guest' : 'unauthenticated', loading, restoreError,
    retryRestore: () => setRestoreAttempt(value => value + 1),
    signIn: (email, password) => authenticate(signal => login(email, password, signal)),
    signUp: (email, password, displayName) => authenticate(signal => register(email, password, displayName, signal)),
    signOut, enterGuest, storage, prompt, setPrompt: changePrompt, requestAuth: () => setPrompt('choice'),
    draft, setDraft, resumePage, rememberPage, guestNotice, dismissGuestNotice: () => setGuestNotice(false), sessionKey,
  }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
