# Review Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Space reveals then rates Good; undo reverses the last review without corrupting scheduling or counts.
**Architecture:** Server snapshots and tombstones protect review identity. A durable outbox undo intent serializes cancellation/server reversal with review sending. Session receipts restore the prior question; an idempotent activity delta preserves real study time.
**Tech Stack:** React/TypeScript, localStorage/Web Locks, Java 21/Spring/JPA/Flyway, Node tests/Playwright.
**Spec:** docs/superpowers/specs/2026-10-15-review-undo-design.md

## Global Constraints
- Keep FSRS scheduling; no fixed replacement interval.
- Undo only the latest review in this session; keyboard ignores inputs/dialogs/repeats.
- Both card sources and guests; waiting/completion screens offer undo.
- Preserve time; subtract the contribution, never overwrite unrelated activity.
- Do not push until requested. Backend deployment precedes frontend deployment.

### Task 1: Backend snapshots and undo transactions
Files: backend LearningService, BuiltInReviewLog, LearningController; AnkiService, AnkiReviewLog, AnkiController; V16 migration; integration tests.
Interfaces: POST /users/me/learning/reviews/{id}/undo -> {state,card}; POST /anki/cards/{cardId}/reviews/{id}/undo -> {cardId,progress}.
- [ ] Add integration cases: review -> undo equals pre-review FSRS; retry undo returns current effective state; later review rejects stale undo; other owner denied; legacy snapshot absent rejected.
- [ ] Store before-state and undone marker in existing log rows. Before undo lock same row as review, compare current state with target result and detect later active review identity. Restore before-state transactionally and retain receipt.
- [ ] Refuse replay of undone review UUID. Return current state on undo retry so a newer review cannot be overwritten.
- [ ] Run Java 21 Maven integration/scheduler tests and review diff.

### Task 2: Durable outbox undo and statistics
Files: src/lib/reviewOutbox.ts, src/hooks/useReviewOutbox.ts, src/hooks/useLearningSync.ts, src/lib/reviewSnapshot.ts, src/lib/storage.ts, src/lib/learningSync.ts; tests/reviewOutbox.test.mjs and storage/merge tests.
Interfaces: QueuedReview.activity?: {date,isNew,correct}; undo(item): Promise<SRSCard>; undoPending:boolean; storage.undoReviewActivity(id,activity).
- [ ] Add unit test for never-sent cancellation without HTTP, in-flight completion then undo, lost undo response + reload, duplicate request, storage failure, stats idempotence and newer server state.
- [ ] Persist undo intent under data lock. Mark review attempted under same lock before sender I/O; only never-attempted entries may be removed. Keep uncertain sends and original UUID. Reject enqueue during undo.
- [ ] Drain serially, persist undo result before local effects, then apply idempotent stats delta and exact restored projection; clear intent only after effects. Sender errors retain intent and release lock.
- [ ] Add force-restored merge path; block ordinary snapshot flush/load while undo pending. Undo activity marker and delta share one durable study-day write.
- [ ] Run Node unit tests and tsc/build.

### Task 3: Session controls and guest reversal
Files: StudySession.tsx, studySession.css, tests/studySessionUI.browser.mjs.
- [ ] Space twice calls rate('good'); keep Enter reveal-only for SRS and native button semantics.
- [ ] Store immutable receipt with original queue/stats/operation ID and activity date. ↶ / Backspace calls undo and restores answer face, resets completion, subtracts count/correct, keeps minutes.
- [ ] Guest uses original card and removes matching guest log UUID, then idempotent activity delta. Auth uses outbox; pending/error blocks ratings and permits retry. Show undo on waiting and done screens.
- [ ] Browser tests cover repeats, previous answer, changed rating, last-card undo, dialog guards and mobile targets.

### Task 4: Integrated review
- [ ] Inspect backend/FE contract; run both suites and authenticated slow/lost-response browser integration.
- [ ] Independent review of undo ordering, authority, retry and cross-tab conflicts; fix concrete findings.
- [ ] Update docs with verification and rollout order; report remaining limitations truthfully.

## Execution rulings
- Continue in existing checkout on codex/review-undo to preserve the user's live local preview and existing uncommitted Space patch.
- User's “ok làm đi” authorizes execution in this chat; no further design approval loop.
- Backend and session UI delegated under subagent-driven-development; root owns shared outbox/storage/sync integration.
