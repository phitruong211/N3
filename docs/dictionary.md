# Dictionary MVP — 13 October 2026

Public entry: `/dictionary`. The dictionary route sits outside the learning AppProvider/AuthGate, so search does not require loading the study library or signing in. Navigation includes Từ điển in the sidebar/mobile More and a dictionary action in Ctrl+K. Dictionary Ctrl+K focuses its own input.

The shipped source is JMdict's Japanese/English component; English is labeled explicitly. No unlicensed Vietnamese dataset or machine translation is silently substituted. Users can edit the card's definition into Vietnamese when adding it. Source/license links appear on dictionary screens and on shared previews containing dictionary cards.

## Available

- Kanji/kana/romaji and English definition search, IME composition handling, debounce, canceled stale requests, literal query escaping and bounded pagination.
- One-layer deinflection for supported polite, negative, past/te forms and i-adjectives, with server dictionary POS validation.
- Word details retain individual meanings, alternative readings and spelling/reading restrictions.
- Search hits carry the matching sense/reading into the add dialog. Multi-token meaning search does not combine unrelated senses. Pagination reaches all 250 bounded candidates. Expired cursors restart visibly; expired card drafts can reload source meanings while preserving edits.
- Add directly from results: choose a searchable/paged personal deck (including grouped/imported decks), or create a private deck in the same dialog. Recently successful deck is remembered per account.
- Edit one selected meaning, spelling, reading, front/back/notes. Preview uses the destination deck's real renderer/template. Incompatible hidden-word/meaning templates require another deck or an explicit template change.
- Guest sign-in/sign-up preserves the pending word and search URL. No automatic write after login. Word and edited card drafts are tab-local with a 30-minute restoration window; an expired session can resume on the same account with the same retry key. An account switch discards the old account's pending operation.
- Stable retry key for an unchanged payload; the server also deduplicates source entry/spelling/reading/meaning in each deck. An existing edited card is not overwritten. Create-deck retries are idempotent too.
- Success offers Mở bộ thẻ / Tiếp tục tra từ. Opening a deck loads its latest metadata; existing open deck tabs react to account-scoped change signals.

## Setup and checks

Backend must apply V11 and import an official snapshot; follow `BE/japanese-server/docs/dictionary.md` and `scripts/import-dictionary.ps1`. No data files or database credentials are included in frontend assets. Before the first import the UI reports the dictionary is being prepared.

`npm run build`, `npm run lint`, `npm test` are standard checks. `PLAYWRIGHT_CHANNEL=msedge npm run test:dictionary` checks public lookup, login resume, grouped deck beyond page one, meaning edits, retry keys, create retry, recent deck, IME, Back, mobile and dark screenshots.

For a **disposable** real API/database, set `DICTIONARY_TEST_API_URL=http://127.0.0.1:18080` and `DICTIONARY_TEST_ALLOW_WRITES=1`, then run `npm run test:dictionary:integration`. It creates an account/deck and verifies real saved contents, deduplication and opening that deck. `npm run test:dictionary:benchmark` requires the API URL and a complete corpus; it reports 100 requests from 20 concurrent clients after warmup. In PowerShell set environment variables with `$env:NAME='value'` before running commands.

## Follow-up scope

Handwriting, KANJIDIC2/Unihan, stroke animation, verified Vietnamese corpus, favorites, synced history and Tatoeba are later phases in the implementation plan. Handwriting has no visible non-working button in this MVP. Recognition has its own evaluation gate; typed search and add-to-deck can ship independently. Offline full-dictionary search and external OCR are not enabled.
