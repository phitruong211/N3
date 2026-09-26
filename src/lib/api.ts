import type { AppSettings, Rating, SRSCard } from '@/types';

// In development Vite proxies this relative URL to Spring Boot. Deployments can
// override it with VITE_API_URL when the API is hosted on a different origin.
const API_URL = (import.meta.env?.VITE_API_URL || '/api/v1').replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'auth:access_token';
const REFRESH_TOKEN_KEY = 'auth:refresh_token';

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  locale: string;
  timezone: string;
  createdAt: string;
}

interface AuthResponse { accessToken: string; refreshToken: string; expiresIn: number; user: ApiUser }
interface ApiErrorBody { message?: string; fieldErrors?: Record<string, string> }

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message); this.status = status; this.fields = fields;
  }
}

const SESSION_KEY = 'auth:session_id';
let verifiedSession: string | null = null;

function migrateTokens() {
  const legacyRefresh = localStorage.getItem('n3_refresh_token');
  if (!localStorage.getItem(REFRESH_TOKEN_KEY) && legacyRefresh) {
    const legacyAccess = localStorage.getItem('n3_access_token');
    if (legacyAccess) localStorage.setItem(ACCESS_TOKEN_KEY, legacyAccess);
    localStorage.setItem(REFRESH_TOKEN_KEY, legacyRefresh);
  }
  // Never combine the old account's access token with a newer refresh token.
  localStorage.removeItem('n3_access_token');
  localStorage.removeItem('n3_refresh_token');
  if (localStorage.getItem(REFRESH_TOKEN_KEY) && !localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, crypto.randomUUID());
}
export function sessionIdentity(): string | null { migrateTokens(); return localStorage.getItem(SESSION_KEY); }
export function isSessionStorageKey(key: string | null): boolean { return key === null || key === SESSION_KEY; }
export function invalidateApiSession(): void { verifiedSession = null; }
function notifySessionExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-session-expired'));
}
function saveTokens(response: AuthResponse, newSession = false) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  if (newSession) localStorage.setItem(SESSION_KEY, crypto.randomUUID());
}
export function hasSession(): boolean { migrateTokens(); return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY)); }
export function clearSession(): void {
  verifiedSession = null;
  for (const key of [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_KEY, 'n3_access_token', 'n3_refresh_token']) localStorage.removeItem(key);
}
function assertSession(identity: string | null) {
  if (sessionIdentity() !== identity) throw new ApiError(401, 'Phiên đã thay đổi. Vui lòng thực hiện lại thao tác.');
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  return new ApiError(response.status, body.message || `Yêu cầu thất bại (${response.status})`, body.fieldErrors);
}

let refreshFlight: { identity: string | null; promise: Promise<boolean> } | null = null;
async function refreshAccessToken(identity: string | null): Promise<boolean> {
  assertSession(identity);
  if (refreshFlight?.identity === identity) return refreshFlight.promise;
  const promise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, deviceName: navigator.userAgent.slice(0, 200) }),
    });
    assertSession(identity);
    if (response.status === 401) { clearSession(); notifySessionExpired(); return false; }
    if (!response.ok) throw await parseError(response);
    const tokens = await response.json() as AuthResponse;
    assertSession(identity);
    saveTokens(tokens);
    return true;
  })();
  const flight = { identity, promise };
  refreshFlight = flight;
  try { return await promise; } finally { if (refreshFlight === flight) refreshFlight = null; }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const identity = sessionIdentity();
  const publicAuth = ['/auth/login', '/auth/register', '/auth/logout', '/auth/refresh'].includes(path);
  if (!publicAuth && path !== '/auth/me' && (!identity || verifiedSession !== identity)) {
    throw new ApiError(401, 'Đăng nhập để lưu và đồng bộ bộ thẻ của bạn');
  }
  if (path === '/auth/me' && !hasSession()) throw new ApiError(401, 'Chưa có phiên đăng nhập.');
  const headers = new Headers(init.headers);
  headers.delete('Authorization');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && !publicAuth) headers.set('Authorization', `Bearer ${token}`);
  const timeout = AbortSignal.timeout(90_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, signal });
  } catch {
    if (timeout.aborted) throw new ApiError(0, 'Máy chủ phản hồi quá lâu. Bản nháp vẫn được giữ; hãy thử lại.');
    throw new ApiError(0, 'Không thể kết nối máy chủ. Hãy kiểm tra backend đang chạy ở cổng 8080.');
  }
  init.signal?.throwIfAborted();
  assertSession(identity);
  if (response.status === 401 && retry && (path === '/auth/me' || !path.startsWith('/auth/'))) {
    if (await refreshAccessToken(identity)) return apiRequest<T>(path, init, false);
  }
  if (response.status === 401 && !publicAuth && !retry) { clearSession(); notifySessionExpired(); }
  if (!response.ok) { const error = await parseError(response); assertSession(identity); throw error; }
  if (response.status === 204) return undefined as T;
  const body = await response.json() as T;
  init.signal?.throwIfAborted();
  assertSession(identity);
  return body;
}

export async function login(email: string, password: string, signal?: AbortSignal): Promise<ApiUser> {
  const identity = sessionIdentity();
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST', signal, body: JSON.stringify({ email, password, deviceName: navigator.userAgent.slice(0, 200) }),
  });
  signal?.throwIfAborted();
  assertSession(identity);
  saveTokens(response, true); verifiedSession = sessionIdentity(); return response.user;
}

export async function register(email: string, password: string, displayName: string, signal?: AbortSignal): Promise<ApiUser> {
  const identity = sessionIdentity();
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST', signal, body: JSON.stringify({ email, password, displayName, deviceName: navigator.userAgent.slice(0, 200) }),
  });
  signal?.throwIfAborted();
  assertSession(identity);
  saveTokens(response, true); verifiedSession = sessionIdentity(); return response.user;
}

export async function currentUser(): Promise<ApiUser> { const identity = sessionIdentity(); const user = await apiRequest<ApiUser>('/auth/me'); assertSession(identity); verifiedSession = identity; return user; }
export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  // Clear synchronously; a late refresh cannot resurrect this session.
  clearSession();
  if (refreshToken) {
    const response = await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
    if (!response.ok) throw await parseError(response);
  }
}

export async function getRemoteSettings(): Promise<AppSettings> { return apiRequest('/users/me/settings'); }
export async function patchRemoteSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  return apiRequest('/users/me/settings', { method: 'PATCH', body: JSON.stringify(updates) });
}

export type ApiCardKind = 'VOCABULARY' | 'KANJI' | 'GRAMMAR' | 'GENERAL';
export interface ApiDeckSummary { id: string; name: string; description: string | null; sourceType: string; sourceName: string | null; importFormat: string | null; visibility: string; cardCount: number; position: number; templateConfig: Record<string, unknown>; createdAt: string; updatedAt: string }
export interface ApiCard { id: string; deckId: string; front: string; back: string; reading: string | null; notes: string | null; kind: ApiCardKind; position: number; externalId: string | null; extraData: Record<string, unknown>; createdAt: string; updatedAt: string }
export interface ApiDeck { deck: ApiDeckSummary; cards: ApiCard[] }
export interface ApiQueueCard { cardId: string; deckId: string; deckName: string; front: string; back: string; reading: string | null; notes: string | null; kind: ApiCardKind; progress: ApiProgress | null }
export interface ApiProgress { state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'; easeFactor: number; intervalMinutes?: number; intervalDays?: number; dueAt: string; repetitions: number; lapses: number; lastReviewedAt: string | null }

export const listDecks = () => apiRequest<ApiDeckSummary[]>('/decks');
export const getDeck = (id: string) => apiRequest<ApiDeck>(`/decks/${id}`);
export const createDeck = (body: unknown) => apiRequest<ApiDeck>('/decks', { method: 'POST', body: JSON.stringify(body) });
export const updateDeck = (id: string, body: unknown) => apiRequest<ApiDeckSummary>(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeDeck = (id: string) => apiRequest<void>(`/decks/${id}`, { method: 'DELETE' });
export const reorderDecks = (deckIds: string[]) => apiRequest<ApiDeckSummary[]>('/decks/reorder', { method: 'PUT', body: JSON.stringify({ deckIds }) });
export const addCard = (deckId: string, body: unknown) => apiRequest<ApiCard>(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify(body) });
export const updateCard = (id: string, body: unknown) => apiRequest<ApiCard>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeCard = (id: string) => apiRequest<void>(`/cards/${id}`, { method: 'DELETE' });
export const reorderCards = (deckId: string, cardIds: string[]) => apiRequest<ApiCard[]>(`/decks/${deckId}/cards/reorder`, { method: 'PUT', body: JSON.stringify({ cardIds }) });
export const moveCards = (cardIds: string[], targetDeckId: string, targetPosition?: number) => apiRequest<ApiCard[]>('/cards/move', { method: 'POST', body: JSON.stringify({ cardIds, targetDeckId, targetPosition }) });
export const getDeckProgress = (deckId: string) => apiRequest<ApiQueueCard[]>(`/anki/decks/${deckId}/cards`);
export async function reviewCard(cardId: string, rating: Rating, responseTimeMs?: number): Promise<SRSCard> {
  const result = await apiRequest<{ cardId: string; progress: ApiProgress }>(`/anki/cards/${cardId}/reviews`, {
    method: 'POST', body: JSON.stringify({ rating: rating.toUpperCase(), responseTimeMs }),
  });
  return progressToSrs(cardId, result.progress);
}

export function progressToSrs(cardId: string, progress: ApiProgress): SRSCard {
  return { cardId, deckType: 'vocabulary', state: progress.state.toLowerCase() as SRSCard['state'],
    easeFactor: Number(progress.easeFactor), intervalMinutes: progress.intervalMinutes,
    intervalDays: progress.intervalDays, dueDate: progress.dueAt, reps: progress.repetitions,
    lapses: progress.lapses, lastReviewedAt: progress.lastReviewedAt };
}
