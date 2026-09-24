import type { AppSettings, Rating, SRSCard } from '@/types';

// In development Vite proxies this relative URL to Spring Boot. Deployments can
// override it with VITE_API_URL when the API is hosted on a different origin.
const API_URL = (import.meta.env?.VITE_API_URL || '/api/v1').replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'n3_access_token';
const REFRESH_TOKEN_KEY = 'n3_refresh_token';

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

function saveTokens(response: AuthResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
}

export function hasSession(): boolean { return Boolean(localStorage.getItem(REFRESH_TOKEN_KEY)); }
export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  return new ApiError(response.status, body.message || `Yêu cầu thất bại (${response.status})`, body.fieldErrors);
}

let refreshPromise: Promise<boolean> | null = null;
async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, deviceName: navigator.userAgent.slice(0, 200) }),
    });
    if (response.status === 401) { clearSession(); return false; }
    if (!response.ok) throw await parseError(response);
    saveTokens(await response.json() as AuthResponse);
    return true;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Không thể kết nối máy chủ. Hãy kiểm tra backend đang chạy ở cổng 8080.');
  }
  if (response.status === 401 && retry && (path === '/auth/me' || !path.startsWith('/auth/'))) {
    if (await refreshAccessToken()) return apiRequest<T>(path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<ApiUser> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password, deviceName: navigator.userAgent.slice(0, 200) }),
  });
  saveTokens(response); return response.user;
}

export async function register(email: string, password: string, displayName: string): Promise<ApiUser> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password, displayName, deviceName: navigator.userAgent.slice(0, 200) }),
  });
  saveTokens(response); return response.user;
}

export async function currentUser(): Promise<ApiUser> { return apiRequest('/auth/me'); }
export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  try { if (refreshToken) await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }); }
  finally { clearSession(); }
}

export async function getRemoteSettings(): Promise<AppSettings> { return apiRequest('/users/me/settings'); }
export async function patchRemoteSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  return apiRequest('/users/me/settings', { method: 'PATCH', body: JSON.stringify(updates) });
}

export type ApiCardKind = 'VOCABULARY' | 'KANJI' | 'GRAMMAR' | 'GENERAL';
export interface ApiDeckSummary { id: string; name: string; description: string | null; sourceType: string; sourceName: string | null; importFormat: string | null; visibility: string; cardCount: number; createdAt: string; updatedAt: string }
export interface ApiCard { id: string; deckId: string; front: string; back: string; reading: string | null; notes: string | null; kind: ApiCardKind; position: number; externalId: string | null; extraData: Record<string, unknown>; createdAt: string; updatedAt: string }
export interface ApiDeck { deck: ApiDeckSummary; cards: ApiCard[] }
export interface ApiQueueCard { cardId: string; deckId: string; deckName: string; front: string; back: string; reading: string | null; notes: string | null; kind: ApiCardKind; progress: ApiProgress | null }
export interface ApiProgress { state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'; easeFactor: number; intervalMinutes?: number; intervalDays?: number; dueAt: string; repetitions: number; lapses: number; lastReviewedAt: string | null }

export const listDecks = () => apiRequest<ApiDeckSummary[]>('/decks');
export const getDeck = (id: string) => apiRequest<ApiDeck>(`/decks/${id}`);
export const createDeck = (body: unknown) => apiRequest<ApiDeck>('/decks', { method: 'POST', body: JSON.stringify(body) });
export const updateDeck = (id: string, body: unknown) => apiRequest<ApiDeckSummary>(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeDeck = (id: string) => apiRequest<void>(`/decks/${id}`, { method: 'DELETE' });
export const addCard = (deckId: string, body: unknown) => apiRequest<ApiCard>(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify(body) });
export const updateCard = (id: string, body: unknown) => apiRequest<ApiCard>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeCard = (id: string) => apiRequest<void>(`/cards/${id}`, { method: 'DELETE' });
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
