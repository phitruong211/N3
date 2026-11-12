import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';
const subscribe = (change: () => void) => { const mq = matchMedia(QUERY); mq.addEventListener('change', change); return () => mq.removeEventListener('change', change); };

/** True on screens wide enough to show a list and its detail side by side (the `lg` breakpoint). */
export const useWide = () => useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => true);
