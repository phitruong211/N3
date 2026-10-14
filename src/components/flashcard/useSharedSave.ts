import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { saveSharedDeck, saveSharedGroup } from '@/lib/deckSharing';

export function useSharedSave(token: string, kind: 'deck' | 'group') {
  const { user, prompt, loading: authLoading, requestAuth, restoreError, retryRestore } = useAuth();
  const identity = `${kind}:${token}:${user?.id ?? 'guest'}`;
  const scope = `${kind}:${token}`;
  const current = useRef(identity); current.current = identity;
  const mounted = useRef(true);
  const lock = useRef(false);
  const pending = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [result, setResult] = useState<{ identity: string; id: string; alreadySaved: boolean } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current = null; }; }, []);
  useEffect(() => { setError(''); setUnavailable(false); }, [identity]);
  const save = useCallback(async () => {
    if (!user) { pending.current = scope; requestAuth(); return; }
    if (lock.current) return;
    const account = identity;
    lock.current = true; setBusy(true); setError('');
    try {
      const received = kind === 'group' ? await saveSharedGroup(token) : await saveSharedDeck(token);
      if (mounted.current && current.current === account) setResult({ identity: account, id: 'groupId' in received ? received.groupId : received.deckId, alreadySaved: received.alreadySaved });
    } catch (e) {
      if (mounted.current && current.current === account) {
        setError(e instanceof Error ? e.message : 'Chưa thể lưu. Hãy thử lại.');
        if (e instanceof ApiError && e.status === 404) setUnavailable(true);
      }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [identity, kind, requestAuth, scope, token, user]);
  useEffect(() => {
    if (pending.current !== scope) { pending.current = null; return; }
    if (user) { pending.current = null; void save(); }
    else if (prompt === null) pending.current = null;
  }, [prompt, save, scope, user]);
  return { save, busy, error, unavailable, saved: result?.identity === identity ? result : null, guest: !user, authLoading, restoreError, retryRestore };
}
