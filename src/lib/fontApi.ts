import { ApiError, apiBytes, apiRequest } from './api';

export interface UploadedFont { id: string; name: string; format: 'woff2' | 'ttf'; sizeBytes: number; createdAt: string }
export interface FontLimits { maxFonts: number; maxFileBytes: number; maxTotalBytes: number; usedBytes: number }
export interface FontList { fonts: UploadedFont[]; limits: FontLimits }

export const listFonts = () => apiRequest<FontList>('/fonts');
export const deleteFont = (id: string) => apiRequest<void>(`/fonts/${id}`, { method: 'DELETE' });
export const fontBytes = (id: string) => apiBytes(`/fonts/${id}/file`);

export function uploadFont(file: File, name: string) {
  const body = new FormData();
  body.append('file', file);
  if (name.trim()) body.append('name', name.trim());
  return apiRequest<UploadedFont>('/fonts', { method: 'POST', body });
}

/** Quick checks before sending; the server decides for real. */
export function checkFontFile(file: File, limits: Pick<FontLimits, 'maxFileBytes'> = { maxFileBytes: 5 * 1024 * 1024 }): string | null {
  if (!/\.(woff2|ttf)$/i.test(file.name)) return 'Chỉ nhận font .woff2 hoặc .ttf.';
  if (file.size > limits.maxFileBytes) return `Font tối đa ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.`;
  return null;
}
export { ApiError };
