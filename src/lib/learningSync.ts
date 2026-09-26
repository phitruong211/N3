import { apiRequest } from './api';
import type { Bookmark, SRSCard, StudyDay } from '@/types';

export interface LearningData { bookmarks: Bookmark[]; srsCards: SRSCard[]; studyDays: StudyDay[] }
export interface LearningSnapshot extends LearningData { revision: number }
export interface MigrationReport { state: LearningSnapshot; bookmarksCreated: number; srsCreated: number; srsSkipped: number; activitiesMerged: number }
export const getLearningState = (signal?: AbortSignal) => apiRequest<LearningSnapshot>('/users/me/learning', { signal });
export const putLearningState = (state: LearningSnapshot, signal?: AbortSignal) => apiRequest<LearningSnapshot>('/users/me/learning', { method: 'PUT', body: JSON.stringify(state), signal });
export const migrateGuestLearning = (data: LearningData, idempotencyKey: string, signal?: AbortSignal) => apiRequest<MigrationReport>('/users/me/learning/guest', { method: 'POST', body: JSON.stringify({ ...data, idempotencyKey }), signal });

/** A stable operation identity survives reload and uncertain network outcomes.
 * Payload changes create a distinct operation; completed source removal is the caller's responsibility. */
export async function migrationKey(accountId: string, sourceId: string, data: LearningData): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ accountId, data }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${sourceId.slice(0, 20)}:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
}
