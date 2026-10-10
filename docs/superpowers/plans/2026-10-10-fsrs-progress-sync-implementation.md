# FSRS Progress and Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace both fixed-step schedulers with compatible FSRS-6 adapters, persist and synchronize every rating, requeue same-day learning cards in real time, and expose spaced-repetition status only on the dedicated review page.

**Architecture:** Built-in content keeps its local-first learning snapshot while personal decks keep normalized backend progress. Both paths expose one application-level `FsrsProgress` contract and consume the same account-global scheduling settings. A pure live-queue module owns scheduled ordering and wake-up behavior; free study remains an ordinary card list with no SRS writes.

**Tech Stack:** React 19, TypeScript 6, `ts-fsrs@5.4.2`, Spring Boot 4.1, Java 21, `io.github.open-spaced-repetition:fsrs:1.0.0`, MySQL/Flyway, Node test runner, JUnit 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-fsrs-progress-sync-design.md`

## Global Constraints

- Run frontend commands from `/Users/vophitruong/.codex/worktrees/separate-study-modes/N3` and backend commands from `/Users/vophitruong/.codex/worktrees/separate-study-modes/japanese-server`.
- `/decks` is free study only and never mutates SRS progress.
- `/review` is spaced repetition only and contains no mode, card-count, order, or time-limit picker.
- Use account-global settings: `srsAgainMinutes=1`, `srsGoodMinutes=10`, and `srsDesiredRetention=0.90` by default.
- Accept only retention values `0.90`, `0.93`, and `0.95`; require `1 <= srsAgainMinutes <= 30`, `2 <= srsGoodMinutes <= 720`, and `srsGoodMinutes > srsAgainMinutes`.
- Introduce at most 20 new cards per deck per local calendar day.
- “Chưa nhớ” means latest rating `Again` or `Hard`; a later `Good` or `Easy` resolves it.
- “Hôm nay” counts unique cards rated in the user's local day.
- Persist due instants in UTC and compute day windows in the user's account timezone.
- Do not bulk-reschedule existing cards when enabling FSRS or changing settings.
- Preserve legacy due dates, review counts, lapse counts, and last-review timestamps.
- Enable long-interval fuzzing in production; disable it in deterministic contract tests.
- Pin frontend FSRS to `5.4.2` and backend FSRS to `1.0.0`.
- Do not repair unrelated audit findings inside this migration.

---

### Task 1: Checkpoint the already-verified separate-mode foundation

**Files:**
- Modify/commit in frontend: current changes under `src/App.tsx`, `src/components/dashboard`, `src/components/flashcard`, `src/components/layout`, `src/components/settings`, `src/lib`, and `tests`
- Modify/commit in backend: current changes in `DeckDtos.java`, `DeckService.java`, `CardRepository.java`, and `DeckServiceIntegrationTest.java`

**Interfaces:**
- Produces: stable `/decks` and `/review` routes, `DeckScheduleSummary`, personal-deck learned/today/new-started counts
- Consumes: the already-approved separate study mode design

- [ ] **Step 1: Run the frontend regression suite on the current uncommitted foundation**

Run:

```bash
npm test
npm run build
```

Expected: all Node tests pass and Vite production build succeeds.

- [ ] **Step 2: Commit only the frontend foundation changes**

```bash
git add src tests
git commit -m "feat: separate free and spaced study modes"
```

- [ ] **Step 3: Run the affected backend integration test and package build**

Run in the backend worktree:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
  PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=DeckServiceIntegrationTest test
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
  PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -DskipTests package
```

Expected: both commands exit `0`.

- [ ] **Step 4: Commit only the backend foundation changes**

```bash
git add src/main/java/com/japaneselearning/japanese_learning_api/deck \
  src/main/java/com/japaneselearning/japanese_learning_api/repository/CardRepository.java \
  src/test/java/com/japaneselearning/japanese_learning_api/deck/DeckServiceIntegrationTest.java
git commit -m "feat: expose deck learning metrics"
```

---

### Task 2: Define the canonical frontend FSRS progress and legacy migration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/index.ts`
- Create: `src/lib/fsrsProgress.ts`
- Modify: `src/lib/srs.ts`
- Create: `tests/fsrsProgress.test.mjs`
- Modify: `tests/srs.test.mjs`

**Interfaces:**
- Produces: `FsrsProgress`, `SrsSchedulingSettings`, `legacyToFsrsProgress`, `reviewBuiltInCard`, `previewBuiltInIntervals`
- Consumes: `ts-fsrs@5.4.2`, existing `SRSCard`, and `Rating`

- [ ] **Step 1: Install the pinned frontend scheduler**

```bash
npm install --save-exact ts-fsrs@5.4.2
```

Expected: `package.json` contains `"ts-fsrs": "5.4.2"` and the lockfile records the same version.

- [ ] **Step 2: Write failing migration and review tests**

Create `tests/fsrsProgress.test.mjs` with fixed instants:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyToFsrsProgress,
  reviewBuiltInCard,
} from '../src/lib/fsrsProgress.ts';

const settings = {
  srsAgainMinutes: 1,
  srsGoodMinutes: 10,
  srsDesiredRetention: 0.90,
};

test('legacy migration preserves due date and counters', () => {
  const legacy = {
    cardId: 'v-1', deckType: 'vocabulary', state: 'review',
    easeFactor: 2.5, intervalDays: 12,
    dueDate: '2026-10-15T00:00:00.000Z', reps: 7, lapses: 2,
    lastReviewedAt: '2026-10-03T00:00:00.000Z',
  };
  const migrated = legacyToFsrsProgress(legacy);
  assert.equal(migrated.dueAt, legacy.dueDate);
  assert.equal(migrated.repetitions, 7);
  assert.equal(migrated.lapses, 2);
  assert.equal(migrated.stability, 12);
  assert.equal(migrated.difficulty, 5);
});

test('again schedules the configured same-session retry', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const next = reviewBuiltInCard(null, 'again', now, settings, false);
  assert.equal(next.state, 'learning');
  assert.equal(next.dueAt, '2026-10-10T00:01:00.000Z');
  assert.equal(next.lastRating, 'again');
});
```

- [ ] **Step 3: Run the new test and confirm missing exports**

```bash
node --experimental-strip-types --test tests/fsrsProgress.test.mjs
```

Expected: FAIL because `src/lib/fsrsProgress.ts` does not exist.

- [ ] **Step 4: Add canonical types and settings**

Add to `src/types/index.ts`:

```ts
export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface FsrsProgress {
  algorithm: 'fsrs-6';
  state: CardState;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  repetitions: number;
  lapses: number;
  firstReviewedAt: string | null;
  lastReviewedAt: string | null;
  lastRating: SrsRating | null;
}

export interface SrsSchedulingSettings {
  srsAgainMinutes: number;
  srsGoodMinutes: number;
  srsDesiredRetention: 0.90 | 0.93 | 0.95;
}
```

Extend `SRSCard` with optional canonical FSRS fields while retaining the legacy fields for one release.

- [ ] **Step 5: Implement the isolated FSRS adapter**

`src/lib/fsrsProgress.ts` must:

```ts
export const DEFAULT_SRS_SETTINGS: SrsSchedulingSettings = {
  srsAgainMinutes: 1,
  srsGoodMinutes: 10,
  srsDesiredRetention: 0.90,
};

export function legacyToFsrsProgress(card: SRSCard): FsrsProgress;
export function reviewBuiltInCard(
  current: SRSCard | FsrsProgress | null,
  rating: Rating,
  now: Date,
  settings: SrsSchedulingSettings,
  enableFuzz: boolean,
): FsrsProgress;
export function previewBuiltInIntervals(
  current: SRSCard | FsrsProgress | null,
  now: Date,
  settings: SrsSchedulingSettings,
): Record<Rating, string>;
```

Use `createEmptyCard`, `fsrs`, and `Rating` from `ts-fsrs`. The adapter maps library numeric states to application string states and copies `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `due`, and `last_review`. It owns every library-specific name so components remain library-independent.

- [ ] **Step 6: Replace `src/lib/srs.ts` scheduling math with compatibility exports**

Keep query/format helpers used elsewhere, but make `processReview` and `getNextIntervals` call the new adapter. Delete `DEFAULT_EASE`, `MIN_EASE`, `processLearningState`, and `processReviewState` after existing tests pass through the adapter.

- [ ] **Step 7: Run focused and full frontend tests**

```bash
node --experimental-strip-types --test tests/fsrsProgress.test.mjs tests/srs.test.mjs
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 8: Commit the frontend scheduler adapter**

```bash
git add package.json package-lock.json src/types/index.ts src/lib/fsrsProgress.ts src/lib/srs.ts tests/fsrsProgress.test.mjs tests/srs.test.mjs
git commit -m "feat: add canonical FSRS progress adapter"
```

---

### Task 3: Add backend FSRS persistence and account settings

**Files:**
- Modify: `pom.xml`
- Create: `src/main/resources/db/migration/V7__fsrs_progress_and_settings.sql`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/model/AnkiCardProgress.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/model/AnkiReviewLog.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/model/UserSettings.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/user/UserSettingsDtos.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/user/UserSettingsController.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/auth/AuthService.java`
- Create: `src/test/java/com/japaneselearning/japanese_learning_api/user/UserSettingsIntegrationTest.java`

**Interfaces:**
- Produces: persistent FSRS fields, `client_review_id` uniqueness, and three validated account scheduling settings
- Consumes: Java-FSRS `1.0.0`

- [ ] **Step 1: Write failing settings validation tests**

Create `UserSettingsIntegrationTest` with MockMvc cases that patch valid values and reject invalid combinations:

```java
mockMvc.perform(patch("/api/v1/users/me/settings")
        .header("Authorization", "Bearer " + accessToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {"srsAgainMinutes":2,"srsGoodMinutes":15,"srsDesiredRetention":0.93}
          """))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.srsAgainMinutes").value(2))
    .andExpect(jsonPath("$.srsGoodMinutes").value(15))
    .andExpect(jsonPath("$.srsDesiredRetention").value(0.93));
```

Add rejected cases for retention `0.99`, Again `0`, Good `721`, and Good less than or equal to Again.

- [ ] **Step 2: Run the test and confirm the missing fields**

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=UserSettingsIntegrationTest test
```

Expected: FAIL because the DTO and entity do not expose the fields.

- [ ] **Step 3: Add the pinned Java dependency and additive Flyway migration**

Add to `pom.xml`:

```xml
<dependency>
  <groupId>io.github.open-spaced-repetition</groupId>
  <artifactId>fsrs</artifactId>
  <version>1.0.0</version>
</dependency>
```

`V7__fsrs_progress_and_settings.sql` adds:

```sql
ALTER TABLE user_settings
  ADD COLUMN srs_again_minutes INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN srs_good_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN srs_desired_retention NUMERIC(4,3) NOT NULL DEFAULT 0.900;

ALTER TABLE anki_card_progress
  ADD COLUMN fsrs_stability DOUBLE,
  ADD COLUMN fsrs_difficulty DOUBLE,
  ADD COLUMN fsrs_elapsed_days INTEGER,
  ADD COLUMN fsrs_scheduled_days INTEGER,
  ADD COLUMN fsrs_step INTEGER,
  ADD COLUMN fsrs_algorithm VARCHAR(20),
  ADD COLUMN first_reviewed_at DATETIME(6),
  ADD COLUMN last_rating VARCHAR(20);

ALTER TABLE anki_review_logs
  ADD COLUMN client_review_id BINARY(16),
  ADD COLUMN result_progress LONGTEXT;

CREATE UNIQUE INDEX ux_anki_review_user_client
  ON anki_review_logs(user_id, client_review_id);

ALTER TABLE user_settings
  ADD CONSTRAINT chk_srs_again_minutes CHECK (srs_again_minutes BETWEEN 1 AND 30),
  ADD CONSTRAINT chk_srs_good_minutes CHECK (srs_good_minutes BETWEEN 2 AND 720),
  ADD CONSTRAINT chk_srs_good_after_again CHECK (srs_good_minutes > srs_again_minutes),
  ADD CONSTRAINT chk_srs_retention CHECK (srs_desired_retention IN (0.900, 0.930, 0.950));
```

- [ ] **Step 4: Map the new entity fields and validate cross-field settings**

Map every new migration column, including `fsrsElapsedDays` and `fsrsScheduledDays`, and add entity defaults matching the migration. In `UserSettingsController.update`, calculate candidate Again/Good values first and reject `good <= again` with `new ApiException(HttpStatus.BAD_REQUEST, "Thời gian nhớ phải lớn hơn thời gian quên")` before mutating the entity.

- [ ] **Step 5: Run settings and registration tests**

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=UserSettingsIntegrationTest,AuthServiceIntegrationTest test
```

Expected: PASS, including defaults for newly registered accounts.

- [ ] **Step 6: Commit persistence and settings**

```bash
git add pom.xml src/main/resources/db/migration/V7__fsrs_progress_and_settings.sql \
  src/main/java/com/japaneselearning/japanese_learning_api/model \
  src/main/java/com/japaneselearning/japanese_learning_api/user \
  src/main/java/com/japaneselearning/japanese_learning_api/auth/AuthService.java \
  src/test/java/com/japaneselearning/japanese_learning_api/user/UserSettingsIntegrationTest.java
git commit -m "feat: persist FSRS progress settings"
```

---

### Task 4: Replace the backend scheduler and make review writes idempotent

**Files:**
- Rewrite: `src/main/java/com/japaneselearning/japanese_learning_api/anki/AnkiScheduler.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/anki/AnkiService.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/anki/AnkiDtos.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/repository/AnkiReviewLogRepository.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/repository/UserSettingsRepository.java`
- Rewrite: `src/test/java/com/japaneselearning/japanese_learning_api/anki/AnkiSchedulerTest.java`
- Create: `src/test/java/com/japaneselearning/japanese_learning_api/anki/AnkiServiceIntegrationTest.java`

**Interfaces:**
- Produces: `AnkiScheduler.apply(progress, rating, now, responseTimeMs, settings, fuzz)`, idempotent `ReviewRequest(clientReviewId, rating, responseTimeMs)`, canonical `ProgressResponse`
- Consumes: entity fields and settings from Task 3

- [ ] **Step 1: Replace fixed-step tests with FSRS behavior tests**

Use a fixed `Instant` and fuzzing disabled:

```java
@Test void againUsesConfiguredRetryAndMarksUnresolved() {
    AnkiCardProgress progress = fresh();
    scheduler.apply(progress, AGAIN, now, 1200, settings(2, 15, "0.93"), false);
    assertThat(progress.getState()).isEqualTo(LEARNING);
    assertThat(progress.getDueAt()).isEqualTo(now.plusSeconds(120));
    assertThat(progress.getLastRating()).isEqualTo(AGAIN);
    assertThat(progress.getFsrsStability()).isPositive();
    assertThat(progress.getFsrsDifficulty()).isBetween(1.0, 10.0);
}
```

Add tests for legacy conversion preserving due/counters, a review lapse becoming relearning, and `Good` resolving a prior `Again`.

- [ ] **Step 2: Add a failing duplicate-review integration test**

Call `AnkiService.review` twice with the same `clientReviewId`. Assert one log row, one repetition increment, and identical returned progress. Then use a different ID and assert a second review occurs.

- [ ] **Step 3: Run the focused tests and confirm fixed-step behavior fails**

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=AnkiSchedulerTest,AnkiServiceIntegrationTest test
```

Expected: FAIL until the scheduler and idempotency contract are implemented.

- [ ] **Step 4: Implement the Java-FSRS adapter**

The scheduler builds an official `Scheduler` for each request:

```java
Scheduler fsrs = Scheduler.builder()
    .desiredRetention(settings.getSrsDesiredRetention().doubleValue())
    .learningSteps(new Duration[] {
        Duration.ofMinutes(settings.getSrsAgainMinutes()),
        Duration.ofMinutes(settings.getSrsGoodMinutes())
    })
    .relearningSteps(new Duration[] {
        Duration.ofMinutes(settings.getSrsAgainMinutes())
    })
    .maximumInterval(36500)
    .enableFuzzing(enableFuzzing)
    .build();
```

Map `AnkiCardProgress` into an official `Card`, call `reviewCard`, then copy state, step, stability, difficulty, due, and last review back. Maintain repetitions, lapses, first/last review, and last rating in the entity because Java-FSRS `Card` does not own those counters.
Derive and persist `fsrsElapsedDays` from the elapsed whole days before applying the rating and `fsrsScheduledDays` from the resulting due/last-review interval. The response exposes canonical names and retains `intervalMinutes`, `intervalDays`, `easeFactor`, and `reps` as deprecated compatibility aliases for old clients during this release.

- [ ] **Step 5: Implement idempotent review handling**

Before scheduling, query `findByUserIdAndClientReviewId`. If present, deserialize `resultProgress` and return it. Otherwise schedule, save progress, save the review log with canonical response JSON, and return it in the same transaction.

The request accepts a nullable client ID for old clients and generates a UUID server-side; the new frontend always sends one.

- [ ] **Step 6: Run focused backend tests**

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=AnkiSchedulerTest,AnkiServiceIntegrationTest test
```

Expected: PASS.

- [ ] **Step 7: Commit the backend scheduler**

```bash
git add src/main/java/com/japaneselearning/japanese_learning_api/anki \
  src/main/java/com/japaneselearning/japanese_learning_api/repository/AnkiReviewLogRepository.java \
  src/main/java/com/japaneselearning/japanese_learning_api/repository/UserSettingsRepository.java \
  src/test/java/com/japaneselearning/japanese_learning_api/anki
git commit -m "feat: schedule personal cards with FSRS"
```

---

### Task 5: Extend built-in learning snapshots and immediate retryable sync

**Files:**
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/learning/LearningDtos.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/learning/LearningService.java`
- Modify: `src/test/java/com/japaneselearning/japanese_learning_api/learning/LearningServiceIntegrationTest.java`
- Modify: `src/lib/learningSync.ts`
- Modify: `src/hooks/useLearningSync.ts`
- Modify: `src/hooks/useApp.tsx`
- Create: `tests/learningFsrsSync.test.mjs`

**Interfaces:**
- Produces: backward-compatible snapshot DTO, `learningSync.saveReview(card)`, online retry, identical-remote conflict acknowledgement
- Consumes: canonical progress from Task 2

- [ ] **Step 1: Add failing backend snapshot compatibility tests**

Create one legacy `SrsCard` payload and one FSRS payload. Assert both validate and round-trip, while invalid difficulty, stability, rating, or timestamps return `400`. Keep the existing revision-conflict tests.

- [ ] **Step 2: Extend the learning DTO with nullable FSRS fields**

The record retains legacy fields and adds `algorithm`, `dueAt`, `stability`, `difficulty`, `elapsedDays`, `scheduledDays`, `learningSteps`, `repetitions`, `firstReviewedAt`, and `lastRating`. `LearningService.validate` validates canonical fields only when `algorithm="fsrs-6"` and continues accepting existing payloads.

- [ ] **Step 3: Add failing frontend retry tests**

In `tests/learningFsrsSync.test.mjs`, use a fake storage adapter to assert:

```js
assert.equal(storage.getJSON('learning_dirty', false), true);
await sync.saveReview(card).catch(() => {});
assert.equal(storage.getJSON('learning_dirty', false), true);
online.resolve();
await sync.retryPending();
assert.equal(storage.getJSON('learning_dirty', true), false);
```

Also assert that a remote snapshot containing the exact submitted card clears a lost-response conflict, while a different card state preserves `learning_local_backup`.

- [ ] **Step 4: Extract synchronization decisions into pure helpers**

Add helpers in `src/lib/learningSync.ts` for `sameLearningData`, `containsSubmittedCard`, and retry classification. `useLearningSync.saveReview` writes local storage first, marks dirty, and calls `flush()` immediately. Add an `online` event listener that invokes `flush` while dirty.

- [ ] **Step 5: Run frontend and backend sync tests**

```bash
node --experimental-strip-types --test tests/learningFsrsSync.test.mjs
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=LearningServiceIntegrationTest test
```

Expected: PASS.

- [ ] **Step 6: Commit backend and frontend snapshot changes separately**

Backend:

```bash
git add src/main/java/com/japaneselearning/japanese_learning_api/learning \
  src/test/java/com/japaneselearning/japanese_learning_api/learning/LearningServiceIntegrationTest.java
git commit -m "feat: accept FSRS learning snapshots"
```

Frontend:

```bash
git add src/lib/learningSync.ts src/hooks/useLearningSync.ts src/hooks/useApp.tsx tests/learningFsrsSync.test.mjs
git commit -m "feat: sync built-in reviews immediately"
```

---

### Task 6: Add consistent deck metrics to backend and frontend

**Files:**
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/repository/CardRepository.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/deck/DeckDtos.java`
- Modify: `src/main/java/com/japaneselearning/japanese_learning_api/deck/DeckService.java`
- Modify: `src/test/java/com/japaneselearning/japanese_learning_api/deck/DeckServiceIntegrationTest.java`
- Rewrite: `src/lib/deckSchedule.ts`
- Rewrite: `tests/deckSchedule.test.mjs`
- Modify: `src/lib/deckApi.ts`

**Interfaces:**
- Produces: `DeckReviewMetrics { dueCount, unresolvedCount, studiedTodayCount, remainingTodayCount, learnedCount, newStartedTodayCount }`
- Consumes: `lastRating`, due timestamps, repetitions, and local day windows

- [ ] **Step 1: Write backend metric assertions**

Create progress rows representing:

- one due `Again` card,
- one future `Hard` card,
- one today `Good` card,
- one untouched card.

Assert `dueCount=1`, `unresolvedCount=2`, `studiedTodayCount=3`, `newStartedTodayCount=3`, `remainingTodayCount=18`, and `learnedCount=3`. The remaining calculation is the union of due IDs and the unused new-card allowance, so a due unresolved card is counted once.

- [ ] **Step 2: Write pure frontend metric tests with the same fixture**

Export:

```ts
export function buildDeckReviewMetrics<T>(
  cards: readonly T[],
  progressFor: (card: T) => DeckScheduleProgress | null | undefined,
  options: { now: Date; dayStart: Date; nextDayStart: Date; dailyNewLimit?: number },
): DeckReviewMetrics;
```

Use the same expected counts as the backend test.

- [ ] **Step 3: Run both tests and confirm missing unresolved/remaining logic**

```bash
node --experimental-strip-types --test tests/deckSchedule.test.mjs
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=DeckServiceIntegrationTest test
```

Expected: FAIL before query and helper changes.

- [ ] **Step 4: Implement a single aggregate backend query**

Extend `CardRepository.DeckCounts` and its aggregate query with `unresolvedCount`. Compute `remainingTodayCount` in `DeckService` as the count of distinct due cards plus `max(0, 20 - newStartedTodayCount)`. Keep the deck listing within the existing three-statement performance bound.

- [ ] **Step 5: Implement the matching pure frontend metrics**

Replace browser-local date equality with explicit `[dayStart, nextDayStart)` bounds. Return both the launchable ready queue and the metric object. Use `lastRating` to compute unresolved cards.

- [ ] **Step 6: Run focused tests**

Run the commands from Step 3. Expected: PASS.

- [ ] **Step 7: Commit metrics changes**

Backend:

```bash
git add src/main/java/com/japaneselearning/japanese_learning_api/repository/CardRepository.java \
  src/main/java/com/japaneselearning/japanese_learning_api/deck \
  src/test/java/com/japaneselearning/japanese_learning_api/deck/DeckServiceIntegrationTest.java
git commit -m "feat: expose spaced review deck metrics"
```

Frontend:

```bash
git add src/lib/deckSchedule.ts src/lib/deckApi.ts tests/deckSchedule.test.mjs
git commit -m "feat: calculate spaced review deck metrics"
```

---

### Task 7: Build the real-time scheduled queue

**Files:**
- Create: `src/lib/liveReviewQueue.ts`
- Create: `tests/liveReviewQueue.test.mjs`
- Modify: `src/lib/deckSchedule.ts`

**Interfaces:**
- Produces: `createReviewQueue`, `nextReadyCard`, `applyReviewedProgress`, `promoteDueCards`, `reviewQueueSnapshot`
- Consumes: `FsrsProgress`, card source keys, fixed daily-new allowance

- [ ] **Step 1: Write fake-clock queue tests**

Test this sequence:

```js
const queue = createReviewQueue({ cards: [card], progressByKey: new Map(), now, dailyNewLimit: 20 });
const first = nextReadyCard(queue, now);
const afterAgain = applyReviewedProgress(queue, first.key, {
  ...againProgress, dueAt: '2026-10-10T00:01:00.000Z'
}, now);
assert.equal(nextReadyCard(afterAgain, new Date('2026-10-10T00:00:59.999Z')), null);
const promoted = promoteDueCards(afterAgain, new Date('2026-10-10T00:01:00.000Z'));
assert.equal(nextReadyCard(promoted, new Date('2026-10-10T00:01:00.000Z')).key, first.key);
```

Add priority tests for relearning before review before new, de-duplication after retries, long-term due dates not blocking completion, and 20 new cards per deck per day.

- [ ] **Step 2: Run and confirm the module is missing**

```bash
node --experimental-strip-types --test tests/liveReviewQueue.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement immutable queue transitions**

The module stores card keys rather than React components:

```ts
export type ReviewQueue<T> = {
  cardsByKey: Map<string, T>;
  progressByKey: Map<string, FsrsProgress | null>;
  ready: string[];
  futureLearning: string[];
  introducedToday: Set<string>;
  answeredToday: Set<string>;
};
```

Every exported transition returns a new queue. Sort `ready` by state priority, `dueAt`, then source position. `futureLearning` contains only learning/relearning cards due before `nextDayStart`.

- [ ] **Step 4: Run queue and deck schedule tests**

```bash
node --experimental-strip-types --test tests/liveReviewQueue.test.mjs tests/deckSchedule.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the queue engine**

```bash
git add src/lib/liveReviewQueue.ts src/lib/deckSchedule.ts tests/liveReviewQueue.test.mjs tests/deckSchedule.test.mjs
git commit -m "feat: add live spaced review queue"
```

---

### Task 8: Wire the live queue and authoritative progress into StudySession

**Files:**
- Modify: `src/components/flashcard/StudySession.tsx`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/deckApi.ts`
- Create: `tests/studySessionState.test.mjs`
- Modify: `tests/srsIntegration.browser.mjs`

**Interfaces:**
- Consumes: queue transitions from Task 7, `reviewBuiltInCard`, `learningSync.saveReview`, backend canonical progress
- Produces: waiting/countdown/completion session states and idempotent personal ratings

- [ ] **Step 1: Extract and test the scheduled session reducer**

Create reducer cases in `tests/studySessionState.test.mjs` for `RATE_STARTED`, `RATE_SAVED`, `RATE_FAILED`, `CLOCK_TICK`, and `EXIT`. Assert a failed personal rating keeps the same revealed card, while a successful `Again` moves it into `futureLearning` and later returns it.

- [ ] **Step 2: Update the review API contract**

Change `reviewCard` to accept and send a stable client ID:

```ts
export async function reviewCard(
  cardId: string,
  rating: Rating,
  clientReviewId: string,
  responseTimeMs?: number,
): Promise<FsrsProgress>;
```

Create the UUID once when rating starts and reuse it when the learner presses Retry.

- [ ] **Step 3: Replace the fixed scheduled array/index path**

Keep the existing index flow only for `mode="flashcards"`. For `mode="anki"`, derive `current` from `nextReadyCard(queue, now)`. Store the progress returned by either local FSRS or the backend in `progressByKey` before selecting the next card.

- [ ] **Step 4: Implement waiting and completion states**

If no ready card exists but `futureLearning` does, render:

```tsx
<ReviewWaitingState
  dueAt={nearestDueAt}
  onExit={finish}
  syncStatus={learningSync.status}
/>
```

Tick once per second and compare `Date.now()` to persisted `dueAt`; do not decrement a stored counter. If no same-day future card exists, render the completion summary with unique cards, total answers, resolved cards, accuracy, and synchronization status.

- [ ] **Step 5: Remove scheduled session timer and jump/shuffle paths**

The scheduled branch must not call `useAnkiSessionTimer`, expose jump controls, or use `sessionCards.length` as completion. Free study retains its navigation and shuffle behavior.

- [ ] **Step 6: Extend the browser integration scenario**

Use Playwright's clock to rate a one-card deck `Again`, assert the waiting state, advance 60 seconds, and assert the same card returns. Abort one personal review request, assert the card stays visible, then retry and verify one backend review log through the API.

- [ ] **Step 7: Run reducer, browser, and build checks**

```bash
node --experimental-strip-types --test tests/studySessionState.test.mjs
npm run build
npm run test:integration
```

Expected: all commands pass with local Vite, backend, and disposable MySQL running for the integration script.

- [ ] **Step 8: Commit session integration**

```bash
git add src/components/flashcard/StudySession.tsx src/lib/api.ts src/lib/deckApi.ts \
  tests/studySessionState.test.mjs tests/srsIntegration.browser.mjs
git commit -m "feat: repeat due cards inside review sessions"
```

---

### Task 9: Finish review-only metrics, free-study simplicity, and SRS settings UI

**Files:**
- Modify: `src/components/flashcard/UnifiedDeckPage.tsx`
- Modify: `src/components/flashcard/ImportedDecks.tsx`
- Modify: `src/components/flashcard/DeckCard.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/lib/storage.ts`
- Modify: `src/hooks/useSettingsSync.ts`
- Modify: `src/types/index.ts`
- Modify: `tests/navigation.test.mjs`
- Create: `tests/srsSettings.test.mjs`
- Modify: `tests/guestFlow.browser.mjs`

**Interfaces:**
- Produces: dedicated review cards with four metrics, lesson-only free setup, validated account-global SRS settings
- Consumes: metrics and settings contracts from prior tasks

- [ ] **Step 1: Add settings normalization tests**

Assert missing legacy fields receive `1`, `10`, and `0.90`; invalid stored values are clamped/reset; and a proposed Good value less than or equal to Again returns a field error without saving.

- [ ] **Step 2: Add browser assertions for page separation**

On `/decks`, assert no text `Cần ôn`, `Chưa nhớ`, `Hôm nay`, or `Còn lại` appears inside deck cards. Starting a lesson deck exposes only lesson selection. On `/review`, assert all four metrics appear and no count/time/order controls exist.

- [ ] **Step 3: Extend local and remote settings models**

Add the three SRS fields to `AppSettings`, defaults, storage normalization, pending settings synchronization, and API serialization. Remove the obsolete `ankiSessionMinutes` UI dependency; retain its backend field only for old-client compatibility during this release.

- [ ] **Step 4: Add the compact settings section**

Render two numeric inputs and one three-choice retention control. Validate on blur and before `updateSettings`. Use these exact visible labels:

- `Học lại khi quên`
- `Kiểm tra lại khi vừa nhớ`
- `Cân bằng · 90%`, `Ghi nhớ cao · 93%`, `Ôn kỹ · 95%`
- `Khôi phục mặc định`

Include one sentence: “Nếu không nhớ đáp án, hãy chọn Quên; Khó chỉ dùng khi bạn vẫn nhớ nhưng phải suy nghĩ nhiều.”

- [ ] **Step 5: Render metrics only in scheduled mode**

Change the review metric order to `Cần ôn`, `Chưa nhớ`, `Hôm nay`, `Còn lại`. Personal cards consume backend counts; built-in cards consume `buildDeckReviewMetrics`. `Ôn ngay` launches directly.

- [ ] **Step 6: Run UI-focused tests and build**

```bash
node --experimental-strip-types --test tests/srsSettings.test.mjs tests/navigation.test.mjs tests/deckSchedule.test.mjs
npm test
npm run build
npm run test:guest
```

Expected: PASS.

- [ ] **Step 7: Commit the UI and settings**

```bash
git add src/components/flashcard src/components/settings/SettingsPage.tsx src/lib/storage.ts \
  src/hooks/useSettingsSync.ts src/types/index.ts tests
git commit -m "feat: present dedicated spaced review controls"
```

---

### Task 10: Add cross-runtime fixtures and complete regression verification

**Files:**
- Create: `test-fixtures/fsrs-contract.json`
- Create: `tests/fsrsContract.test.mjs`
- Create in backend: `src/test/resources/fsrs-contract.json`
- Create in backend: `src/test/java/com/japaneselearning/japanese_learning_api/anki/FsrsContractTest.java`
- Modify: `docs/srs-verification.md`

**Interfaces:**
- Produces: one deterministic behavior contract shared by TypeScript and Java
- Consumes: both FSRS adapters with fuzzing disabled

- [ ] **Step 1: Create fixed contract scenarios**

The JSON fixture contains:

```json
{
  "settings": {"againMinutes": 1, "goodMinutes": 10, "desiredRetention": 0.9},
  "cases": [
    {"name": "new-again", "now": "2026-10-10T00:00:00Z", "progress": null, "rating": "again"},
    {"name": "new-good", "now": "2026-10-10T00:00:00Z", "progress": null, "rating": "good"},
    {"name": "review-lapse", "now": "2026-10-20T00:00:00Z", "progress": {"state":"review","dueAt":"2026-10-20T00:00:00Z","stability":10,"difficulty":5,"learningSteps":0,"repetitions":3,"lapses":0,"lastReviewedAt":"2026-10-10T00:00:00Z"}, "rating": "again"}
  ]
}
```

Each test asserts state, due interval seconds, repetitions, and lapses exactly. Assert stability and difficulty are finite, within the FSRS ranges, and deterministic inside each runtime. Copy the exact input fixture into backend test resources and add a test that fails if the files diverge byte-for-byte. Do not require TypeScript and Java floating-point model outputs to be byte-identical because the official libraries can publish different FSRS parameter revisions; the shared application contract is the state transition, configured short step, counters, and due interval.

- [ ] **Step 2: Run contract tests**

```bash
node --experimental-strip-types --test tests/fsrsContract.test.mjs
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=FsrsContractTest test
```

Expected: PASS.

- [ ] **Step 3: Run all practical frontend checks**

```bash
npm test
npm run lint
npm run build
npm run test:guest
```

Expected: tests/build/guest flow pass. Existing lint warnings may remain, but no new warning may originate from files changed by this plan.

- [ ] **Step 4: Run all backend unit/in-memory integration checks**

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -Dtest=AnkiSchedulerTest,AnkiServiceIntegrationTest,DeckServiceIntegrationTest,LearningServiceIntegrationTest,UserSettingsIntegrationTest,AuthServiceIntegrationTest,FsrsContractTest test
env JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH \
  sh mvnw -q -DskipTests package
```

Expected: PASS.

- [ ] **Step 5: Run the MySQL/browser integration flow**

Start the backend against a disposable MySQL schema and Vite against that backend, then run:

```bash
npm run test:integration
```

Expected: PASS with Again requeue, reload persistence, personal idempotency, settings sync, and mobile layout assertions.

- [ ] **Step 6: Document exact verification evidence**

Update `docs/srs-verification.md` with dependency versions, commands, results, the test timestamp, and any environment-only limitation. Do not describe a skipped MySQL test as passing.

- [ ] **Step 7: Commit contract and verification artifacts**

Frontend:

```bash
git add test-fixtures/fsrs-contract.json tests/fsrsContract.test.mjs docs/srs-verification.md
git commit -m "test: verify FSRS scheduling across runtimes"
```

Backend:

```bash
git add src/test/resources/fsrs-contract.json \
  src/test/java/com/japaneselearning/japanese_learning_api/anki/FsrsContractTest.java
git commit -m "test: verify backend FSRS contract"
```

---

### Task 11: Audit the remaining project after the SRS migration

**Files:**
- Create: `docs/project-audit-2026-10-10.md`
- Read only: all frontend/backend source, tests, migrations, build configuration, and existing SRS/import/guest documentation

**Interfaces:**
- Produces: prioritized audit findings with evidence, impact, affected files, and recommended next action
- Consumes: the verified post-FSRS codebase

- [ ] **Step 1: Inventory routes, API endpoints, persistence models, and test coverage**

Run:

```bash
rg -n "path=|PAGE_PATHS|@RequestMapping|@(Get|Post|Put|Patch|Delete)Mapping" src
rg -n "localStorage|sessionStorage|apiRequest|fetch\(" src
rg -n "TODO|FIXME|HACK|console\.(log|error)|catch \{" src tests
```

Run equivalent controller, persistence, and marker searches in the backend repository.

- [ ] **Step 2: Re-run broad automated checks and record only reproducible failures**

Run frontend tests/lint/build and backend tests/package. Classify failures as product defects, missing environment dependencies, flaky tests, or documentation drift.

- [ ] **Step 3: Review critical user journeys**

Inspect login/register return-to-home, Guest learning, import across all file types, card editing/customization, furigana on both faces, free study, spaced review, quiz, progress, listening, settings sync, mobile navigation, and account conflict recovery.

- [ ] **Step 4: Write a ranked audit without implementing unrelated fixes**

Use this table shape:

```markdown
| Priority | Finding | Evidence | User impact | Recommended change |
| --- | --- | --- | --- | --- |
| P0/P1/P2/P3 | Concrete behavior | File/test/command | Concrete consequence | Bounded next action |
```

Every finding must include a reproducible path or exact code reference. Record verified-complete areas separately so they are not reopened without evidence.

- [ ] **Step 5: Commit the audit report**

```bash
git add docs/project-audit-2026-10-10.md
git commit -m "docs: audit remaining learning flows"
```

The audit ends this plan. Any P0/P1 fix that changes behavior starts its own bounded or architectural design cycle.

