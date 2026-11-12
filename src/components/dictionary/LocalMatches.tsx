import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadGrammar, loadKanji, loadVocabulary } from '@/lib/data';
import { localEntries, searchLocal, type LocalEntry, type LocalKind } from '@/lib/localDictionary';

const KIND: Record<LocalKind, { label: string; path: string }> = {
  vocabulary: { label: 'Từ vựng', path: '/library/vocabulary' },
  kanji: { label: 'Kanji', path: '/library/kanji' },
  grammar: { label: 'Ngữ pháp', path: '/library/grammar' },
};

/**
 * The app's own entries for a dictionary query, with Vietnamese meanings, above the Japanese–English results. The
 * library loads once (shared with the library pages) and only after a first query, so an empty dictionary stays light.
 */
export function LocalMatches({ query }: { query: string }) {
  const [entries, setEntries] = useState<LocalEntry[] | null>(null);
  const wanted = Boolean(query.trim());
  useEffect(() => {
    if (!wanted || entries) return;
    let alive = true;
    Promise.all([loadVocabulary(), loadKanji(), loadGrammar()])
      .then(([vocabulary, kanji, grammar]) => { if (alive) setEntries(localEntries({ vocabulary, kanji, grammar })); })
      .catch(() => { if (alive) setEntries([]); }); // the English results still work without the library
    return () => { alive = false; };
  }, [wanted, entries]);
  const hits = useMemo(() => entries ? searchLocal(entries, query) : [], [entries, query]);
  if (!hits.length) return null;
  return <section className="dictionary-local" aria-label="Trong SỔ NHẬT">
    <p className="dictionary-result-label"><span>Trong SỔ NHẬT · nghĩa tiếng Việt</span></p>
    <ul>
      {hits.map(hit => <li key={hit.kind + hit.id}>
        <Link to={`${KIND[hit.kind].path}?q=${encodeURIComponent(hit.word)}`} className="dictionary-local-row">
          <span className="min-w-0">
            <span className="font-jp-serif text-xl text-[var(--color-text)]">{hit.word}</span>
            {hit.reading && hit.reading !== hit.word && <span className="font-jp ml-2 text-sm text-[var(--color-text-secondary)]">{hit.reading}</span>}
            <span className="mt-0.5 block text-sm text-[var(--color-text-secondary)]">{[hit.hanViet && `Hán Việt: ${hit.hanViet}`, hit.meaning].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">{KIND[hit.kind].label} {hit.level}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
