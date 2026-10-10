const GUEST_SESSION_KEY = 'guest:session';

export function readGuestSession(storage: Pick<Storage, 'getItem'> = sessionStorage): boolean {
  try { return storage.getItem(GUEST_SESSION_KEY) === '1'; }
  catch { return false; }
}

export function writeGuestSession(active: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> = sessionStorage): void {
  try {
    if (active) storage.setItem(GUEST_SESSION_KEY, '1');
    else storage.removeItem(GUEST_SESSION_KEY);
  } catch { /* Session storage can be unavailable in privacy mode. */ }
}
