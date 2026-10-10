# Decks and Study Session Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present personal and built-in decks through one clean catalog, add a predictable setup step, and use one accessible study-session language for free study and scheduled review.

**Architecture:** Pure catalog and setup helpers build bounded study queues before UI opens. Deck cards share one presentational component with capability-based actions. A canonical `/study/:source/:id` route loads the chosen deck and renders `StudyShell`; scheduling remains in the existing local SRS or personal-deck API layer.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Framer Motion, existing deck/SRS APIs, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-progressive-disclosure-ux-redesign-design.md`

## Global Constraints

- Personal decks appear before built-in decks; built-in order is N4 → N3 → N2.
- Built-in decks are read-only, personal decks use owner-scoped API actions, and Saved is virtual.
- Empty decks show “Thêm thẻ”, never “Học”. Saved never shows management or deletion.
- Free study can select 10/20/50/all up to 200; larger decks run in batches of 200.
- Scheduled review never exposes shuffle, card jump, or source-order controls that break the scheduler queue.
- Free study never mutates SRS state or reports accuracy. Scheduled review preserves due-first/new-second order and four ratings on keys 1–4.
- Mobile always shows the primary reveal/next/rating action. A card is not a fake button around nested buttons.
- Preserve imported deck order through the existing full-ID `PUT /decks/reorder` contract.

---

### Task 1: Define bounded study setup and queue behavior

**Files:**
- Create: `src/lib/studySetup.ts`
- Create: `tests/studySetup.test.mjs`

**Interfaces:**
- Produces: `FreeStudySetup`
- Produces: `ScheduledStudySetup`
- Produces: `StudySetup = FreeStudySetup | ScheduledStudySetup`
- Produces: `buildFreeStudyQueue(cards, setup, random?): CardView[]`
- Produces: `serializeStudySetup(setup): URLSearchParams`
- Produces: `parseStudySetup(search): StudySetup`

- [ ] **Step 1: Write failing queue and serialization tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFreeStudyQueue, parseStudySetup, serializeStudySetup } from '../src/lib/studySetup.ts';

const cards = Array.from({ length: 250 }, (_, position) => ({ id: String(position), position, tags: position < 30 ? ['Bài 1'] : ['Bài 2'] }));

test('free study filters lessons, orders, and caps large all sessions', () => {
  const queue = buildFreeStudyQueue(cards, { mode: 'free', limit: 'all', order: 'source', lessonKey: 'lesson-2' });
  assert.equal(queue.length, 200);
  assert.equal(queue[0].id, '30');
});

test('scheduled setup does not accept shuffle or card limits', () => {
  const parsed = parseStudySetup('?mode=scheduled&order=shuffle&limit=50&minutes=20');
  assert.deepEqual(parsed, { mode: 'scheduled', sessionMinutes: 20 });
});

test('free setup round-trips through the URL', () => {
  const setup = { mode: 'free', limit: 20, order: 'shuffle', lessonKey: 'lesson-6' };
  assert.deepEqual(parseStudySetup(`?${serializeStudySetup(setup)}`), setup);
});
```

- [ ] **Step 2: Run the tests and confirm the missing module failure**

Run: `node --experimental-strip-types --test tests/studySetup.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement discriminated setup types and bounded queues**

```ts
export type FreeStudyLimit = 10 | 20 | 50 | 200 | 'all';
export type FreeStudySetup = { mode: 'free'; limit: FreeStudyLimit; order: 'source' | 'shuffle'; lessonKey: string | null };
export type ScheduledStudySetup = { mode: 'scheduled'; sessionMinutes: number };
export type StudySetup = FreeStudySetup | ScheduledStudySetup;

export function buildFreeStudyQueue(cards: CardView[], setup: FreeStudySetup, random = Math.random): CardView[] {
  const filtered = setup.lessonKey ? cards.filter(card => belongsToLesson(card.tags, setup.lessonKey!)) : cards;
  const ordered = setup.order === 'shuffle' ? fisherYates(filtered, random) : [...filtered].sort((a, b) => a.position - b.position);
  const requested = setup.limit === 'all' ? 200 : setup.limit;
  return ordered.slice(0, Math.min(requested, 200));
}
```

Move `lessonKey`, `lessonOptions`, and `belongsToLesson` from `ImportedDecks.tsx` into this module. Clamp scheduled minutes to 0–180 and ignore free-only query parameters in scheduled mode.

- [ ] **Step 4: Run the focused tests**

Run: `node --experimental-strip-types --test tests/studySetup.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit setup behavior**

```bash
git add src/lib/studySetup.ts tests/studySetup.test.mjs src/components/flashcard/ImportedDecks.tsx
git commit -m "feat: define bounded study setup queues"
```

---

### Task 2: Extract the built-in deck catalog and common summaries

**Files:**
- Create: `src/lib/deckCatalog.ts`
- Create: `tests/deckCatalog.test.mjs`
- Modify: `src/components/flashcard/UnifiedDeckPage.tsx`
- Modify: `src/lib/cards.ts`

**Interfaces:**
- Produces: `BuiltInDeckDefinition`
- Produces: `buildBuiltInDecks(vocabulary, kanji, grammar): BuiltInDeckDefinition[]`
- Produces: `buildSavedDeck(decks, bookmarks): BuiltInDeckDefinition`
- Produces: `deckSummary(deck, progress, mode): DeckSummary`

- [ ] **Step 1: Write catalog ordering and permission tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortDeckDefinitions, deckCapabilities } from '../src/lib/deckCatalog.ts';

test('built-in decks follow N4 N3 N2 and content order', () => {
  const input = [
    { id: 'grammarN2', level: 'N2', kind: 'grammar' },
    { id: 'vocabN3', level: 'N3', kind: 'vocabulary' },
    { id: 'kanjiN4', level: 'N4', kind: 'kanji' },
  ];
  assert.deepEqual(sortDeckDefinitions(input).map(deck => deck.id), ['kanjiN4', 'vocabN3', 'grammarN2']);
});

test('capabilities distinguish built-in personal saved and empty', () => {
  assert.deepEqual(deckCapabilities('BUILT_IN', 10), { canStudy: true, canManage: false, canReorder: false });
  assert.deepEqual(deckCapabilities('SAVED', 0), { canStudy: false, canManage: false, canReorder: false });
  assert.deepEqual(deckCapabilities('IMPORT', 0), { canStudy: false, canManage: true, canReorder: true });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --experimental-strip-types --test tests/deckCatalog.test.mjs`

Expected: FAIL because `deckCatalog.ts` does not exist.

- [ ] **Step 3: Move built-in transformation out of the page**

`BuiltInDeckDefinition` is:

```ts
export interface BuiltInDeckDefinition {
  id: string;
  name: string;
  level: 'N4' | 'N3' | 'N2';
  kind: 'vocabulary' | 'kanji' | 'grammar';
  cards: CardView[];
}
```

Use order maps `{ N4: 0, N3: 1, N2: 2 }` and `{ vocabulary: 0, kanji: 1, grammar: 2 }`. Keep Kanji N4 in the source; do not mutate IDs or source arrays.

- [ ] **Step 4: Make `DeckSummary` the only card-count view model**

Add an adapter for `PersonalDeck` and built-in definitions. Personal totals use `cardCount/newCount/dueCount` returned by the API. Built-in totals use the full in-memory definition. Never use a paginated `cards.content.length` as the total.

- [ ] **Step 5: Run catalog and card tests**

Run: `node --experimental-strip-types --test tests/deckCatalog.test.mjs tests/cardPresentationData.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the catalog extraction**

```bash
git add src/lib/deckCatalog.ts src/lib/cards.ts src/components/flashcard/UnifiedDeckPage.tsx tests/deckCatalog.test.mjs
git commit -m "refactor: extract built-in deck catalog"
```

---

### Task 3: Introduce shared DeckCard, DeckGrid, and overflow actions

**Files:**
- Create: `src/components/flashcard/DeckCard.tsx`
- Create: `src/components/flashcard/DeckGrid.tsx`
- Create: `src/components/ui/OverflowMenu.tsx`
- Modify: `src/components/flashcard/UnifiedDeckPage.tsx`
- Modify: `src/components/flashcard/ImportedDecks.tsx`

**Interfaces:**
- Produces: `DeckCardProps`
- Produces: `DeckAction = { id; label; destructive?; disabled?; onSelect }`
- Consumes: `DeckSummary` and capability flags from Task 2

- [ ] **Step 1: Define the presentational contract**

```ts
export type DeckCardProps = {
  summary: DeckSummary;
  badge: { label: string; tone: 'neutral' | 'vocabulary' | 'grammar' | 'kanji' };
  description?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  actions?: DeckAction[];
  draggable?: boolean;
  onDragStart?: React.DragEventHandler;
  onDrop?: React.DragEventHandler;
};
```

The card renders one badge, title, count, context-specific metadata, one primary action, and an optional `OverflowMenu`. Built-in cards never receive actions. Saved never receives actions. Empty personal cards receive `primaryLabel="Thêm thẻ"`.

- [ ] **Step 2: Implement an accessible single-open overflow menu**

Use a controlled popover button with `aria-haspopup="menu"`, `aria-expanded`, click-outside, Escape, and focus return. Do not use `<details>`. Menu items use `role="menuitem"` and close after selection.

- [ ] **Step 3: Put personal decks before built-in decks**

`UnifiedDeckPage` renders:

```tsx
<PersonalDeckSection />
<BuiltInDeckSection levelOrder={['N4', 'N3', 'N2']} />
```

The personal section contains the inline “Tạo bộ mới” tile, Saved virtual card, then personal API decks. The built-in heading contains one “Bộ có sẵn · chỉ đọc” note; remove repeated `Chỉ đọc` pills.

- [ ] **Step 4: Preserve deck reorder on desktop and keyboard/mobile**

Keep drag-and-drop as a desktop shortcut. Add `Di chuyển lên` and `Di chuyển xuống` actions that produce the complete reordered ID array and call `reorderDecks({ deckIds })`. Disable at boundaries. Hide the permanent “Kéo tay cầm” instruction.

- [ ] **Step 5: Verify deck permissions and empty states**

Run: `npm run build`

Manual/browser assertions:

- Personal decks appear above built-in decks.
- An empty personal deck says “Thêm thẻ”.
- Saved has no menu.
- Built-in cards have no drag handle or overflow menu.
- Pagination is absent when `totalPages <= 1`.

- [ ] **Step 6: Commit common deck cards**

```bash
git add src/components/flashcard/DeckCard.tsx src/components/flashcard/DeckGrid.tsx src/components/ui/OverflowMenu.tsx src/components/flashcard/UnifiedDeckPage.tsx src/components/flashcard/ImportedDecks.tsx
git commit -m "feat: unify deck cards and permissions"
```

---

### Task 4: Add one StudySetupSheet for all deck launches

**Files:**
- Create: `src/components/flashcard/StudySetupSheet.tsx`
- Modify: `src/components/flashcard/UnifiedDeckPage.tsx`
- Modify: `src/components/flashcard/ImportedDecks.tsx`
- Modify: `src/components/ui/AppDialog.tsx`

**Interfaces:**
- Consumes: `StudySetup`, `lessonOptions`, `serializeStudySetup`
- Produces: `onStart(setup: StudySetup): void`

- [ ] **Step 1: Implement the setup sheet contract**

```ts
type StudySetupSheetProps = {
  open: boolean;
  deckName: string;
  totalCards: number;
  canSchedule: boolean;
  lessons: LessonOption[];
  defaultMode: 'free' | 'scheduled';
  defaultMinutes: number;
  onClose: () => void;
  onStart: (setup: StudySetup) => void;
};
```

Use segmented controls for mode, count, and order. Show lesson only in free mode when lessons exist. Show only the time limit in scheduled mode. The only filled CTA is “Bắt đầu học”.

- [ ] **Step 2: Replace immediate launch and separate lesson picker**

Built-in and personal DeckCard primary actions open `StudySetupSheet`. Delete `lessonPicker`, `chooseLesson`, and the separate “Chọn bài” link after parity. Do not mutate the scheduler queue for scheduled mode.

- [ ] **Step 3: Navigate to the canonical study URL**

On start:

```tsx
const query = serializeStudySetup(setup);
navigate(`/study/${source}/${encodeURIComponent(deckId)}?${query}`);
```

Use source values `built-in`, `personal`, or `saved`. Do not pass the full card array through router state.

- [ ] **Step 4: Verify mobile layout and keyboard behavior**

At 320×812, the sheet must fit without horizontal scroll, keep the CTA visible, close with Escape, and return focus to the deck’s Học button.

- [ ] **Step 5: Commit setup flow**

```bash
git add src/components/flashcard/StudySetupSheet.tsx src/components/flashcard/UnifiedDeckPage.tsx src/components/flashcard/ImportedDecks.tsx src/components/ui/AppDialog.tsx
git commit -m "feat: add shared study setup flow"
```

---

### Task 5: Load study sessions from a canonical route

**Files:**
- Create: `src/components/study/StudySessionPage.tsx`
- Create: `src/lib/studySource.ts`
- Create: `tests/studySource.test.mjs`
- Modify: `src/App.tsx`
- Modify: `src/components/flashcard/UnifiedDeckPage.tsx`
- Modify: `src/components/flashcard/ImportedDecks.tsx`

**Interfaces:**
- Produces: `loadStudySource({ source, deckId, setup, appData, storage }): Promise<LoadedStudySource>`
- Produces: `LoadedStudySource = { deckName; cards; template; progress; initialIndex }`

- [ ] **Step 1: Write source validation tests**

```js
test('unknown study sources fail without protected requests', async () => {
  let requested = false;
  await assert.rejects(loadStudySource({ source: 'bad', deckId: 'x', setup: free, requestPersonal: async () => { requested = true; } }), /Không tìm thấy nguồn/);
  assert.equal(requested, false);
});

test('free sources are bounded before rendering', async () => {
  const loaded = await loadStudySource({ source: 'built-in', deckId: 'vocabN3', setup: { mode: 'free', limit: 20, order: 'source', lessonKey: null }, builtInDecks });
  assert.equal(loaded.cards.length, 20);
});
```

- [ ] **Step 2: Implement source-specific loading**

Built-in and Saved use in-memory catalog cards. Personal free study uses `loadStudyPages(cardPage)` then `buildFreeStudyQueue`; personal scheduled study uses `dueQueue(deckId, 200)` and keeps API order. Guest attempting `personal` gets the existing auth prompt without starting a request.

- [ ] **Step 3: Add the full-screen route outside `MainLayout`**

Declare `/study/:source/:deckId` next to, not inside, the layout route. `StudySessionPage` parses params/query, loads the source, shows loading/error/retry, and renders `StudySession`. Exit uses `navigate(-1)` with `/decks` fallback.

- [ ] **Step 4: Verify reload and error states**

Reload a built-in session URL and a personal session URL. Built-in restores without API authentication; personal restores only with a valid account. Invalid deck IDs show an actionable error and “Về Bộ thẻ”.

- [ ] **Step 5: Commit the study route**

```bash
git add src/components/study/StudySessionPage.tsx src/lib/studySource.ts tests/studySource.test.mjs src/App.tsx src/components/flashcard/UnifiedDeckPage.tsx src/components/flashcard/ImportedDecks.tsx
git commit -m "feat: load study sessions from routes"
```

---

### Task 6: Build one accessible StudyShell and RatingControls

**Files:**
- Create: `src/components/study/StudyShell.tsx`
- Create: `src/components/study/RatingControls.tsx`
- Create: `src/components/study/StudyOverflowMenu.tsx`
- Modify: `src/components/flashcard/StudySession.tsx`
- Modify: `src/components/srs/SRSPage.tsx`

**Interfaces:**
- Produces: `StudyShell` with header, scrollable card viewport, alert slot, and sticky action bar
- Produces: `RatingControls({ intervals, busy, onRate })`

- [ ] **Step 1: Define shared rating labels and keys**

```ts
export const RATINGS = [
  { id: 'again', label: 'Quên', key: '1', tone: 'error' },
  { id: 'hard', label: 'Khó', key: '2', tone: 'warning' },
  { id: 'good', label: 'Nhớ', key: '3', tone: 'success' },
  { id: 'easy', label: 'Dễ', key: '4', tone: 'accent' },
] as const;
```

Both imported Anki and built-in SRS use this component and these exact labels.

- [ ] **Step 2: Implement the routed full-screen shell**

`StudyShell` renders a semantic `<main>` with a focusable `<h1 tabIndex={-1}>`, exit button with `aria-label="Thoát phiên học"`, progress, overflow menu, card viewport, `role="alert"` slot, and safe-area action footer. It does not use `fixed` over `MainLayout` because the route already excludes navigation.

- [ ] **Step 3: Move secondary controls into the overflow menu**

Free mode menu: Tùy chỉnh, Xáo trộn, Toàn màn hình, Đến thẻ. Scheduled mode menu: Tùy chỉnh and Toàn màn hình only. Keep ArrowLeft/ArrowRight and jump behavior in free mode; never expose them in scheduled mode.

- [ ] **Step 4: Remove nested interactive semantics**

Change the card container from `role="button" tabIndex={0}` to `<article>`. Card click may reveal as a pointer shortcut, but the sticky real button “Hiện đáp án” is always present. Any “Hiện nghĩa” button inside `CardFace` remains independently focusable.

- [ ] **Step 5: Use shared RatingControls in both sessions**

Delete local `RatingButton` from `SRSPage.tsx` and the mapped buttons in `StudySession.tsx`. Rating buttons are disabled before reveal and while saving; keyboard 1–4 only works after reveal.

- [ ] **Step 6: Run build and keyboard QA**

Run: `npm run build`

Verify Escape exits, Space reveals, 1–4 rates only after reveal, tab order stays within visible route content, and the exit button has an accessible name at 320 px.

- [ ] **Step 7: Commit the session shell**

```bash
git add src/components/study src/components/flashcard/StudySession.tsx src/components/srs/SRSPage.tsx
git commit -m "feat: unify accessible study controls"
```

---

### Task 7: Correct free-study metrics and simplify Review

**Files:**
- Create: `src/lib/studyMetrics.ts`
- Create: `tests/studyMetrics.test.mjs`
- Modify: `src/components/flashcard/StudySession.tsx`
- Modify: `src/lib/storage.ts`
- Modify: `src/components/srs/SRSPage.tsx`

**Interfaces:**
- Produces: `FreeStudySummary = { viewed: number; total: number; minutes: number }`
- Produces: `recordFreeStudyActivity(viewed, minutes)` without SRS mutation or accuracy

- [ ] **Step 1: Write failing metric tests**

```js
test('free study never creates accuracy or learned-card counts', () => {
  const summary = summarizeFreeStudy(new Set(['a', 'b']), 20, 3.2);
  assert.deepEqual(summary, { viewed: 2, total: 20, minutes: 3.2 });
  assert.equal('accuracy' in summary, false);
  assert.equal('newCardsLearned' in summary, false);
});
```

- [ ] **Step 2: Implement neutral free-study activity**

Add `recordFreeStudyActivity(viewed, timeSpent)` to scoped storage. It updates `flashcardViewed` and `timeSpent`; it does not update `cardsReviewed`, `newCardsLearned`, SRS arrays, or accuracy. Migrate old `StudyDay` records by treating missing `flashcardViewed` as zero.

- [ ] **Step 3: Remove fake correct counts from StudySession**

Replace `{ count, correct, minutes }` with `{ viewed, minutes }` in free mode. Completion copy becomes `Đã xem X/Y thẻ · Z phút`. Scheduled mode keeps reviewed count and rating-derived accuracy.

- [ ] **Step 4: Remove personal deck management from Review**

Delete `<ImportedDecks />` from `SRSPage`. Review shows aggregate due/new counts and one `Bắt đầu ôn` CTA, then compact source summaries only when selection is needed. Personal deck management remains under `/decks`.

- [ ] **Step 5: Run SRS and metrics tests**

Run: `node --experimental-strip-types --test tests/studyMetrics.test.mjs tests/srs.test.mjs tests/guestStorage.test.mjs`

Run: `npm run build`

Expected: PASS; no free-study path calls `processReview`, `reviewCard`, or `updateSRSCard`.

- [ ] **Step 6: Commit metric correction**

```bash
git add src/lib/studyMetrics.ts src/lib/storage.ts src/components/flashcard/StudySession.tsx src/components/srs/SRSPage.tsx tests/studyMetrics.test.mjs tests/guestStorage.test.mjs
git commit -m "fix: separate free study from scheduled progress"
```

---

### Task 8: Update integration coverage and remove verified session legacy

**Files:**
- Modify: `tests/guestFlow.browser.mjs`
- Modify: `tests/srsIntegration.browser.mjs`
- Modify: `tests/importCardCustomization.browser.mjs`
- Modify: `src/components/flashcard/FlashcardPage.tsx`
- Create: `src/hooks/useCardSpeech.ts`

**Interfaces:**
- Produces: one production session implementation: `StudySession`
- Produces: `useCardSpeech`/`speakJapanese` outside the legacy file

- [ ] **Step 1: Update browser selectors to the new language**

Navigation uses “Bộ thẻ” and “Ôn tập”; ratings use “Quên/Khó/Nhớ/Dễ”; study launch passes through the setup sheet. Add assertions that free completion contains “Đã xem” and does not contain `% chính xác`.

- [ ] **Step 2: Add mobile session assertions**

In a 375×812 Playwright context, assert “Hiện đáp án” is visible, bottom actions are not covered, and navigation landmarks are absent while `/study/...` is active.

- [ ] **Step 3: Extract the only legacy helper still imported**

Move speech behavior from `FlashcardPage.tsx` to `src/hooks/useCardSpeech.ts`. Use `rg "from './FlashcardPage'|from \"./FlashcardPage\"" src` to verify no legacy session symbol is imported.

- [ ] **Step 4: Delete unreachable session implementations**

Keep only the thin exports that route to `UnifiedDeckPage` while needed:

```tsx
export function FlashcardPage() { return <UnifiedDeckPage mode="flashcards" />; }
export function AnkiPage() { return <Navigate to="/decks?mode=scheduled" replace />; }
```

Remove the obsolete card/session code after build and browser tests prove parity.

- [ ] **Step 5: Run the complete verification set**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run with fixtures/services active: `npm run test:guest` and `npm run test:integration`

Expected: all PASS.

- [ ] **Step 6: Commit study-flow completion**

```bash
git add src/components/flashcard/FlashcardPage.tsx src/hooks/useCardSpeech.ts tests/guestFlow.browser.mjs tests/srsIntegration.browser.mjs tests/importCardCustomization.browser.mjs
git commit -m "test: cover simplified deck study flows"
```

