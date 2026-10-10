# FSRS Progress, Sync, and Separate Study Modes Design

## Purpose

Replace the duplicated fixed-step SM-2-style scheduling with an effective, predictable spaced-repetition flow that persists every rating, synchronizes account progress, repeats forgotten cards inside the active session, and keeps free study completely separate from scheduled review.

This design implements the user's prioritized SRS work first. A broader product audit follows as a separate read-only report and, where needed, separate design cycles. That audit is not allowed to expand this implementation while the scheduler is being migrated.

## Success Criteria

- `/decks` is exclusively free study. It never displays SRS status or changes SRS progress.
- `/review` is exclusively spaced repetition. It shows deck-level review status and launches the scheduler without a setup dialog.
- Rating a card persists progress immediately. Account data is synchronized to the backend without waiting for the end of the session.
- A card rated `Again` returns after the configured delay, one minute by default, in the same session.
- When no card is ready but a same-day learning or relearning card is pending, the session shows a countdown and wakes when that card becomes due.
- The scheduler uses FSRS-6 defaults with a global account retention target of 90%, 93%, or 95%.
- Existing due dates and review counters survive migration. No bulk reschedule occurs.
- “Chưa nhớ” means the card's latest rating is `Again` or `Hard` and no later `Good` or `Easy` rating has resolved it.
- “Hôm nay” means the number of unique cards rated at least once in the user's local calendar day.
- Frontend, backend, migration, queue, and browser-flow tests pass before release.

## Existing System and Confirmed Defects

The frontend currently schedules built-in vocabulary, kanji, and grammar in `src/lib/srs.ts`. It stores `SRSCard` objects in local storage and synchronizes the complete learning snapshot through `/users/me/learning`. Personal/imported decks use `AnkiScheduler.java`, normalized progress rows, and review logs in the backend. Both schedulers duplicate the same fixed `[1, 10, 60]` minute algorithm.

`StudySession.tsx` creates a fixed card array when a session begins. After a rating it advances the array index and marks the session complete at the final array item. Although `Again` writes a due time one minute in the future, the session never re-enqueues or waits for that card. For personal decks, the backend's updated review response is not installed in session state, so later interval previews can also use stale progress.

The two persistence models remain for this migration because replacing built-in content with normalized backend card rows would require a separate content-ID migration. Their scheduler semantics and account settings will be unified now.

## Chosen Architecture

### Scheduler libraries

- Frontend built-in scheduling uses `ts-fsrs` pinned to `5.4.2`.
- Backend personal-deck scheduling uses `io.github.open-spaced-repetition:fsrs` pinned to `1.0.0`.
- Both use the official 21 default FSRS-6 parameters, the same retention target, the same short learning steps, a maximum interval of 36,500 days, and UTC instants.
- Production interval fuzzing is enabled for long intervals to avoid concentrating reviews on one date. Contract fixtures disable fuzzing and use a fixed clock so TypeScript and Java behavior can be compared deterministically.
- FSRS parameters are not exposed in the UI and are not manually edited. Per-user parameter optimization is outside this migration.

FSRS models difficulty, stability, and retrievability instead of multiplying a single ease factor. The retention target defaults to 90%, which Anki documents as a balance between retention and workload. Retention above 97% is intentionally unavailable because workload increases sharply. Learning and relearning steps remain shorter than one day, following Anki's FSRS guidance.

References:

- <https://docs.ankiweb.net/manual/deck-options>
- <https://github.com/open-spaced-repetition/ts-fsrs>
- <https://github.com/open-spaced-repetition/java-fsrs>

### User-facing scheduling settings

Settings contains one “Ôn ngắt quãng” group with these account-global values:

| Setting | Default | Allowed values | Meaning |
| --- | ---: | --- | --- |
| `srsAgainMinutes` | 1 | integer 1–30 | First retry after `Again` for new, learning, and lapsed cards |
| `srsGoodMinutes` | 10 | integer 2–720 and greater than `srsAgainMinutes` | Same-day confirmation step after the learner first remembers a card |
| `srsDesiredRetention` | 0.90 | exactly 0.90, 0.93, or 0.95 | Long-term target used by FSRS |

The labels shown to users are “Học lại khi quên”, “Kiểm tra lại khi vừa nhớ”, and “Mức ghi nhớ mục tiêu”. A “Khôi phục mặc định” action restores `1`, `10`, and `0.90`.

`Hard` and long-term `Good`/`Easy` intervals remain algorithm-controlled. Letting users directly override those intervals would undermine the memory model. The rating copy explains that `Hard` means the answer was recalled with difficulty; a forgotten answer must use `Again`.

Guests retain the same settings locally. Authenticated users load and patch these values through `/users/me/settings`. Existing accounts receive database defaults.

## Progress Model and Migration

### Canonical FSRS progress

The application-level progress shape contains:

```ts
type FsrsState = "new" | "learning" | "review" | "relearning";
type SrsRating = "again" | "hard" | "good" | "easy";

interface FsrsProgress {
  algorithm: "fsrs-6";
  state: FsrsState;
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
```

Frontend adapters translate this shape to and from `ts-fsrs`. Backend adapters translate it to and from Java-FSRS `Card`. UI and queue code consume `FsrsProgress` and never depend directly on a library's enum numbering or serialized JSON.

### Built-in decks

Built-in progress remains in the account learning snapshot so existing stable content IDs continue to work. `SRSCard` gains the FSRS fields above. The backend learning DTO accepts both legacy and FSRS shapes during migration.

On the first rating of a legacy built-in card:

- Preserve `dueDate`, `reps`, `lapses`, and `lastReviewedAt`.
- Map the old state to the equivalent FSRS state.
- Initialize stability from the positive legacy interval: `intervalDays`, otherwise `intervalMinutes / 1440`, otherwise `0.1` day.
- Initialize difficulty to the neutral FSRS value `5.0`; do not invent precision from the legacy ease factor.
- Infer the current learning step from the legacy minute interval.
- Apply FSRS at the next rating time. The old due date remains authoritative until that rating.

The snapshot remains backward-readable for one release by retaining optional legacy ease and interval fields. New writes include the canonical FSRS fields.

### Personal/imported decks

A Flyway migration adds nullable FSRS state data and summary fields to `anki_card_progress`, plus `last_rating` and `first_reviewed_at`. Legacy columns remain for backward compatibility during this release.

Personal rows are migrated lazily on the first subsequent rating with the same stability and difficulty rules used by the frontend. `AnkiScheduler.java` becomes a thin adapter around Java-FSRS rather than a second scheduling implementation.

`anki_review_logs` continues to record every rating and receives a unique `client_review_id`. A duplicate client review ID returns the already-created result and never schedules the card twice. This protects against a response being lost after the backend committed the review.

Changing retention or learning-step settings affects future ratings only. It does not rewrite existing due dates or create a sudden review backlog.

## Persistence and Synchronization

### Built-in progress

Each rating follows this order:

1. Compute the next progress with the frontend FSRS adapter.
2. Write the progress to local storage synchronously.
3. Update the active queue and visible metrics immediately.
4. If authenticated, request an immediate learning-snapshot flush rather than waiting for the five-second debounce.
5. If the request fails, retain `learning_dirty=true`, display “Chờ đồng bộ”, and retry on the browser `online` event, on a later scheduled flush, and during the next application start.

The user may continue studying while built-in progress is pending because the local write is durable. Closing a session requests a final flush but never deletes the local pending state.

If a snapshot `PUT` response is lost and a subsequent request encounters a revision conflict, the client reloads the remote snapshot. An identical remote card state is treated as success. A genuine competing-device difference keeps the local backup and uses the existing conflict UI.

### Personal progress

The backend remains authoritative. A rating request carries `clientReviewId`, `rating`, and `responseTimeMs`. The session advances only after the backend transaction succeeds and the returned `FsrsProgress` has replaced the in-memory progress. A failed request keeps the current card visible with a clear retry action; it is never silently counted as studied.

## Live Review Queue

`StudySession` delegates scheduled-mode ordering to a pure queue module. Free-study navigation remains a simple ordered list.

The scheduled queue maintains:

- `ready`: cards whose `dueAt <= now`.
- `futureLearning`: learning or relearning cards due later in the current local day.
- `seenToday`: unique cards rated in the current day.
- `newStartedToday`: unique cards first introduced in the current day.
- `progressByCard`: the latest authoritative state returned by local FSRS or the backend.

Ready-card priority is:

1. Due learning and relearning cards, earliest deadline first.
2. Due review cards, earliest deadline first.
3. New cards in source order, limited to 20 per deck per local day after subtracting `newStartedToday`.

After every rating, the current card is removed and its returned progress is classified again. An immediately due card enters `ready`; a same-day learning/relearning card enters `futureLearning`; a long-term card leaves the session.

When `ready` is empty and `futureLearning` is not, the UI shows a countdown to the nearest due card and a “Kết thúc phiên” action. A one-second clock promotes cards only when their exact due time arrives. Long-term cards due on a later day never hold the session open. When both queues are empty and the daily new-card allowance is exhausted, the session completes.

The queue de-duplicates by content source plus card ID, preventing a card from appearing twice after a retry or state refresh.

## Separate User Flows

### Free study at `/decks`

- Deck cards show content type, title, total cards, and `Học tự do`.
- They do not show due, forgotten, today, or remaining SRS counts.
- A deck with lesson metadata opens a compact lesson selector. That is the only pre-study choice.
- A deck without lessons begins immediately.
- Free study supports in-session source order and shuffle controls but never calls a review endpoint or changes FSRS progress.

### Spaced repetition at `/review`

- The sidebar has a distinct `Ôn ngắt quãng` destination.
- Each review deck card shows `Cần ôn`, `Chưa nhớ`, `Hôm nay`, and `Còn lại` in a compact status row at the bottom.
- `Cần ôn` counts learning, relearning, or review cards whose due instant has passed.
- `Chưa nhớ` counts cards whose latest rating is `Again` or `Hard`.
- `Hôm nay` counts unique cards reviewed in the user's local day.
- `Còn lại` is the current due count plus the unused portion of the deck's 20-new-card daily allowance. A card is counted once even if it is both due and unresolved.
- `Ôn ngay` starts the automatic queue directly. There is no count picker, time limit, order picker, or mode switch.
- Counts update after every successful rating and after a countdown promotes a card.

Personal-deck summaries are calculated in backend repository queries. Built-in summaries are calculated from synchronized `SRSCard` data with the same pure rules. Day boundaries use the authenticated user's timezone for counts; due instants remain UTC.

## Session Feedback and Completion

The study header displays deck name and completed unique cards, not the current fixed array index. Rating buttons show the interval preview generated by the active FSRS adapter. The waiting state announces the countdown accessibly and does not leave a blank card.

The completion view reports:

- Unique cards studied.
- Total answers, including repeated attempts.
- Cards resolved from `Again`/`Hard` to `Good`/`Easy`.
- Accuracy based on all answers.
- Pending synchronization status when applicable.

## Errors and Concurrency

- Invalid scheduling settings return field-specific validation errors and are not persisted.
- A personal review version conflict reloads the latest progress and asks the learner to rate the still-visible card again.
- Duplicate `clientReviewId` requests are idempotent.
- A built-in snapshot conflict never discards the local snapshot; it keeps a recoverable backup and uses the existing conflict panel.
- Corrupt legacy progress falls back to a new neutral FSRS state for that card only and records a recoverable diagnostic. Other cards continue loading.
- Browser visibility changes and sleep do not advance timers artificially; all readiness checks compare the current instant with persisted `dueAt`.

## Testing Strategy

### Frontend unit tests

- Legacy-to-FSRS conversion preserves due dates and counters.
- Each rating maps to the correct library rating and produces a valid progress shape.
- Queue priority, 20-new-card cap, de-duplication, and exact-time promotion use a fake clock.
- `Again` returns after the configured minute delay.
- `Hard` stays unresolved; a later `Good` or `Easy` resolves it.
- Day-boundary metrics use the supplied timezone/day window.
- Settings validation enforces ranges, allowed retention presets, and `Good > Again`.

### Backend integration tests

- Flyway upgrades an existing legacy progress row without losing counters or due time.
- Java-FSRS persists and returns every progress field.
- The same `clientReviewId` schedules exactly once.
- Deck summary queries return due, unresolved, today, remaining, and learned counts for a fixed user timezone.
- User settings persist and reject invalid combinations.

### Cross-runtime contract tests

A shared JSON fixture contains fixed clocks, settings, initial cards, ratings, and expected normalized progress. TypeScript and Java tests run the same fixture with fuzzing disabled. They must agree on state transitions, due intervals, stability, difficulty, repetitions, and lapses within documented floating-point tolerances.

### Browser flows

- `/decks` starts free study with only a lesson choice and never changes SRS state.
- `/review` contains no manual session-size or time controls.
- Rating `Again` shows the waiting state and automatically returns the card when the fake clock reaches the configured due time.
- Reloading restores the queue and counts.
- A simulated built-in sync failure shows pending status and later succeeds.
- A simulated personal review failure keeps the card visible and retrying does not double-count it.
- Desktop and mobile layouts keep the primary rating and exit actions visible.

## Rollout and Compatibility

The database migration is additive. Legacy fields and readers remain for one release. New settings have server defaults, so old clients continue receiving a valid response shape. The API only adds response properties and adds `clientReviewId` to the review request; during the transition it accepts a missing ID by generating one server-side, while the new frontend always supplies one.

No automatic reschedule runs at deployment. Metrics may become more precise after a card receives its first FSRS rating because legacy data has no reliable latest-rating field.

## Explicit Non-Goals

- Per-deck FSRS presets.
- Per-user optimization of the 21 FSRS parameters.
- Moving built-in content into normalized backend card tables.
- A study-time limit or manual “new cards this session” control.
- Changes to quiz, listening, import parsing, or card presentation unrelated to SRS.
- Fixing unrelated findings from the later whole-project audit in this same migration.

