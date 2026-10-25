import { apiRequest, ApiError } from './api';

export interface LibraryState { published: boolean; level: string | null; moderation: 'ACTIVE' | 'UNDER_REVIEW' | 'REMOVED'; removedReason: string | null; downloads: number }
/** `code` is the short code ("K7QM-3XPD"); `expiresAt` is null for links that never expire. */
export interface ShareLink { token: string | null; includePersonalNotes?: boolean; code?: string | null; expiresAt?: string | null; library?: LibraryState | null }
export interface SharedDeckPreview {
  name: string; description: string | null; author: string; cardCount: number;
  previewCount: number; page: number; size: number; totalPages: number;
  cards: Array<{ front: string; back: string; reading: string | null; kind: string; dictionarySource?: boolean }>;
}
export const shareStatus = (id: string) => apiRequest<ShareLink>(`/decks/${id}/share`);
/** `expiresInDays`: 1, 7, 30, null (never) or 'keep' to leave the current expiry alone. */
export type ShareExpiry = number | null | 'keep';
const expiryBody = (expiry: ShareExpiry) => expiry === 'keep' ? { keepExpiry: true } : { expiresInDays: expiry };
export const enableShare = (id: string, includePersonalNotes = false, expiry: ShareExpiry = null) => apiRequest<ShareLink>(`/decks/${id}/share`, { method: 'PUT', body: JSON.stringify({ includePersonalNotes, ...expiryBody(expiry) }) });
/** Keeps the saved options; creates the short code if the link predates codes and renews an expired link. */
export const touchShare = (id: string) => apiRequest<ShareLink>(`/decks/${id}/share`, { method: 'PUT' });
export const publishDeck = (id: string, body: { published: boolean; level?: string | null; description?: string | null }) => apiRequest<ShareLink>(`/decks/${id}/library`, { method: 'PUT', body: JSON.stringify(body) });
export const revokeShare = (id: string) => apiRequest<void>(`/decks/${id}/share`, { method: 'DELETE' });
export const saveSharedDeck = (token: string) => apiRequest<{ deckId: string; alreadySaved: boolean }>(`/shared-decks/${encodeURIComponent(token)}/copy`, { method: 'POST' });
export const shareUrl = (token: string) => `${window.location.origin}/shared/${encodeURIComponent(token)}`;

// Public preview deliberately sends no account token and does not require an authenticated session.
export const sharedDeckPreview = (token: string, signal: AbortSignal, page = 0) => publicRequest<SharedDeckPreview>(`/shared-decks/${encodeURIComponent(token)}?page=${page}`, signal);

export interface GroupShareLink extends ShareLink { deckCount: number; excludedDeckCount: number; cardCount: number }
export interface SharedGroupPreview {
  name: string; author: string; deckCount: number; excludedDeckCount: number; cardCount: number;
  page: number; size: number; totalPages: number;
  decks: Array<{ id: string; name: string; description: string | null; cardCount: number }>;
}
export const groupShareStatus = (id: string) => apiRequest<GroupShareLink>(`/deck-groups/${id}/share`);
export const enableGroupShare = (id: string, includePersonalNotes = false, expiry: ShareExpiry = null) => apiRequest<GroupShareLink>(`/deck-groups/${id}/share`, { method: 'PUT', body: JSON.stringify({ includePersonalNotes, ...expiryBody(expiry) }) });
export const touchGroupShare = (id: string) => apiRequest<GroupShareLink>(`/deck-groups/${id}/share`, { method: 'PUT' });
export const revokeGroupShare = (id: string) => apiRequest<void>(`/deck-groups/${id}/share`, { method: 'DELETE' });
export const saveSharedGroup = (token: string) => apiRequest<{ groupId: string; deckIds: string[]; alreadySaved: boolean }>(`/shared-deck-groups/${encodeURIComponent(token)}/copy`, { method: 'POST' });
export const groupShareUrl = (token: string) => `${window.location.origin}/shared/groups/${encodeURIComponent(token)}`;
async function publicRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const base = (import.meta.env?.VITE_API_URL || '/api/v1').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]), cache: 'no-store', credentials: 'omit' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message || 'Không thể mở nội dung chia sẻ. Hãy thử lại.');
  }
  return response.json();
}
export const sharedGroupPreview = (token: string, signal: AbortSignal, page = 0) => publicRequest<SharedGroupPreview>(`/shared-deck-groups/${encodeURIComponent(token)}?page=${page}`, signal);
export const sharedGroupDeckPreview = (token: string, id: string, signal: AbortSignal, page = 0) => publicRequest<SharedDeckPreview>(`/shared-deck-groups/${encodeURIComponent(token)}/decks/${encodeURIComponent(id)}?page=${page}`, signal);

// ---------- short codes, library, reports ----------
export const codeDigits = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();
/** The short link people scan or type: /s/K7QM3XPD resolves the code and opens the shared page. */
export const shortUrl = (code: string) => `${window.location.origin}/s/${encodeURIComponent(codeDigits(code))}`;
export const sharedPath = (resolved: { kind: 'deck' | 'group'; token: string }) => resolved.kind === 'group' ? `/shared/groups/${encodeURIComponent(resolved.token)}` : `/shared/${encodeURIComponent(resolved.token)}`;
export const resolveShareCode = (code: string, signal?: AbortSignal) => publicRequest<{ kind: 'deck' | 'group'; token: string }>(`/share-codes/${encodeURIComponent(codeDigits(code))}`, signal ?? new AbortController().signal);

export interface LibraryItem { token: string; name: string; description: string | null; author: string; level: string | null; cardCount: number; downloads: number; publishedAt: string; tags: string[] }
export interface LibraryPage { items: LibraryItem[]; page: number; totalPages: number; total: number }
export function browseLibrary(params: { query?: string; level?: string; sort?: 'recent' | 'popular'; page?: number }, signal: AbortSignal) {
  const search = new URLSearchParams();
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.level) search.set('level', params.level);
  search.set('sort', params.sort ?? 'recent');
  search.set('page', String(params.page ?? 0));
  return publicRequest<LibraryPage>(`/library?${search}`, signal);
}

export type ReportReason = 'COPYRIGHT' | 'INAPPROPRIATE' | 'SPAM' | 'OTHER';
export const REPORT_REASONS: Array<[ReportReason, string]> = [['COPYRIGHT', 'Vi phạm bản quyền'], ['INAPPROPRIATE', 'Nội dung không phù hợp'], ['SPAM', 'Spam hoặc quảng cáo'], ['OTHER', 'Lý do khác']];
export const reportDeck = (token: string, reason: ReportReason, details: string) => apiRequest<void>(`/shared-decks/${encodeURIComponent(token)}/report`, { method: 'POST', body: JSON.stringify({ reason, details: details.trim() || null }) });

export interface ModerationReport { id: string; deckId: string; deckToken: string | null; deckName: string; owner: string; reason: ReportReason; details: string | null; reporter: string; createdAt: string; status: string; openReportsForDeck: number; moderation: string | null }
export interface ModerationPage { reports: ModerationReport[]; page: number; totalPages: number; total: number }
export const listReports = (status = 'OPEN', page = 0) => apiRequest<ModerationPage>(`/admin/reports?status=${status}&page=${page}`);
export const dismissReport = (id: string) => apiRequest<void>(`/admin/reports/${id}/dismiss`, { method: 'POST' });
export const removeDeckFromSharing = (deckId: string, reason: string) => apiRequest<void>(`/admin/decks/${deckId}/remove`, { method: 'POST', body: JSON.stringify({ reason }) });
export const restoreDeckSharing = (deckId: string) => apiRequest<void>(`/admin/decks/${deckId}/restore`, { method: 'POST' });
