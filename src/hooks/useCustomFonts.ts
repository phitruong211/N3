import { useEffect, useSyncExternalStore } from 'react';
import { useOptionalAuth } from './useAuth';
import { getCustomFonts, refreshCustomFonts, resetCustomFonts, subscribeCustomFonts } from '@/lib/customFonts';

/** Uploaded fonts of the signed-in account, loaded on first use. Empty for guests. */
export function useCustomFonts() {
  const user = useOptionalAuth()?.user ?? null;
  const state = useSyncExternalStore(subscribeCustomFonts, getCustomFonts);
  useEffect(() => {
    if (!user) { if (getCustomFonts().status !== 'idle') resetCustomFonts(); return; }
    if (getCustomFonts().status === 'idle') void refreshCustomFonts();
  }, [user]);
  return { ...state, signedIn: Boolean(user) };
}
