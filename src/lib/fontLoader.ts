// Loads a font on first use. Bundled fonts: each stylesheet is its own chunk, so a deck only downloads the fonts it
// picks (and only the unicode-range slices its text needs); nothing leaves the app origin. Uploaded fonts: the bytes
// come from the owner's account and are registered with the FontFace API, so they never have a public URL.
import { customFamilyName, isCustomFontId } from './fontRegistry';
import { fontBytes } from './fontApi';

const loaders: Record<string, () => Promise<unknown>> = {
  zenMaruGothic: () => import('@fontsource/zen-maru-gothic/400.css'),
  mPlusRounded: () => import('@fontsource/m-plus-rounded-1c/400.css'),
  zenKakuGothic: () => import('@fontsource/zen-kaku-gothic-new/400.css'),
  bizUdpGothic: () => import('@fontsource/biz-udpgothic/400.css'),
  shipporiMincho: () => import('@fontsource/shippori-mincho/400.css'),
  kleeOne: () => import('@fontsource/klee-one/400.css'),
  lexend: () => import('@fontsource/lexend/400.css'),
  playfairDisplay: () => import('@fontsource/playfair-display/400.css'),
};
const started = new Map<string, Promise<unknown>>();
const registered = new Map<string, FontFace>();
const listeners = new Set<() => void>();
/** Fonts we could not load (not the owner's, deleted, signed out): remembered so a deck full of them asks once. */
const unavailable = new Set<string>();

async function loadCustom(id: string) {
  try {
    const face = new FontFace(customFamilyName(id), await fontBytes(id.slice('custom:'.length)));
    await face.load();
    document.fonts.add(face);
    registered.set(id, face);
  } catch {
    unavailable.add(id);
  }
  listeners.forEach(listener => listener());
}

/** Fonts without a loader (default, Noto, Dela, Be Vietnam Pro, Newsreader, system) are always available. */
export function ensureFont(id: string | undefined): void {
  if (!id || started.has(id) || unavailable.has(id)) return;
  if (isCustomFontId(id)) { started.set(id, loadCustom(id)); return; }
  if (!loaders[id]) return;
  started.set(id, loaders[id]().catch(() => { started.delete(id); }));
}

/** Fonts that failed while signed out or under another account get another chance once the account's own list is known. */
export function retryUnavailableFonts(): void {
  for (const id of unavailable) started.delete(id);
  unavailable.clear();
}

/** Call after deleting an uploaded font so a later upload of the same id would load again. */
export function forgetCustomFont(id: string): void {
  const face = registered.get(id);
  if (face) document.fonts.delete(face);
  registered.delete(id); started.delete(id); unavailable.delete(id);
}
export const onFontsChanged = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const lazyFontIds = Object.keys(loaders);
