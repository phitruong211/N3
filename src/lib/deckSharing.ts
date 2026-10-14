import { apiRequest, ApiError } from './api';

export interface ShareLink { token: string | null; includePersonalNotes?: boolean }
export interface SharedDeckPreview {
  name: string; description: string | null; author: string; cardCount: number;
  previewCount: number; page: number; size: number; totalPages: number;
  cards: Array<{ front: string; back: string; reading: string | null; kind: string; dictionarySource?: boolean }>;
}
export const shareStatus = (id: string) => apiRequest<ShareLink>(`/decks/${id}/share`);
export const enableShare = (id: string, includePersonalNotes = false) => apiRequest<ShareLink>(`/decks/${id}/share`, { method: 'PUT', body: JSON.stringify({ includePersonalNotes }) });
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
export const enableGroupShare = (id: string, includePersonalNotes = false) => apiRequest<GroupShareLink>(`/deck-groups/${id}/share`, { method: 'PUT', body: JSON.stringify({ includePersonalNotes }) });
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
