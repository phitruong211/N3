import { apiRequest, ApiError } from './api';

export interface ShareLink { token: string | null }
export interface SharedDeckPreview {
  name: string; description: string | null; author: string; cardCount: number;
  previewCount: number; page: number; size: number; totalPages: number;
  cards: Array<{ front: string; back: string; reading: string | null; kind: string }>;
}
export const shareStatus = (id: string) => apiRequest<ShareLink>(`/decks/${id}/share`);
export const enableShare = (id: string) => apiRequest<ShareLink>(`/decks/${id}/share`, { method: 'PUT' });
export const revokeShare = (id: string) => apiRequest<void>(`/decks/${id}/share`, { method: 'DELETE' });
export const saveSharedDeck = (token: string) => apiRequest<{ deckId: string; alreadySaved: boolean }>(`/shared-decks/${encodeURIComponent(token)}/copy`, { method: 'POST' });
export const shareUrl = (token: string) => `${window.location.origin}/shared/${encodeURIComponent(token)}`;

// Public preview deliberately sends no account token and does not require an authenticated session.
export async function sharedDeckPreview(token: string, signal: AbortSignal, page = 0): Promise<SharedDeckPreview> {
  const base = (import.meta.env?.VITE_API_URL || '/api/v1').replace(/\/$/, '');
  const response = await fetch(`${base}/shared-decks/${encodeURIComponent(token)}?page=${page}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]), cache: 'no-store', credentials: 'omit',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message || 'Không thể mở bộ thẻ. Hãy thử lại.');
  }
  return response.json();
}
