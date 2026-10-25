// The signed-in user's uploaded fonts, shared by every place that offers a font choice.
import { ApiError } from './api';
import { deleteFont, listFonts, uploadFont, type FontLimits, type UploadedFont } from './fontApi';
import { ensureFont, forgetCustomFont, retryUnavailableFonts } from './fontLoader';

export interface CustomFontsState { status: 'idle' | 'loading' | 'ready' | 'error'; fonts: UploadedFont[]; limits: FontLimits | null; error: string }
const empty: CustomFontsState = { status: 'idle', fonts: [], limits: null, error: '' };
let state = empty;
const listeners = new Set<() => void>();
const set = (next: CustomFontsState) => { state = next; listeners.forEach(listener => listener()); };

export const getCustomFonts = () => state;
export const subscribeCustomFonts = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const customFontId = (font: Pick<UploadedFont, 'id'>) => `custom:${font.id}`;

export async function refreshCustomFonts(): Promise<void> {
  set({ ...state, status: 'loading', error: '' });
  try {
    const { fonts, limits } = await listFonts();
    set({ status: 'ready', fonts, limits, error: '' });
    retryUnavailableFonts();
    fonts.forEach(font => ensureFont(customFontId(font)));
  } catch (error) {
    set({ ...empty, status: 'error', error: error instanceof ApiError ? error.message : 'Không tải được danh sách font.' });
  }
}

export async function addCustomFont(file: File, name: string): Promise<UploadedFont> {
  const font = await uploadFont(file, name);
  await refreshCustomFonts();
  return font;
}

export async function removeCustomFont(id: string): Promise<void> {
  await deleteFont(id);
  forgetCustomFont(`custom:${id}`);
  await refreshCustomFonts();
}

/** On sign-out the next account must not see this one's fonts. */
export function resetCustomFonts() { set(empty); }
