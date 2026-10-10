# Import, Card Customization, and Settings Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce import to three clear steps, split content editing from card appearance, preserve legacy two-sided styles, and reorganize Settings and shared visual primitives for a clean, accessible finish.

**Architecture:** Import parsing remains in the existing pure parser and worker; new view-model helpers group issues and bound previews. Card editing and appearance become separate components backed by the same `DeckTemplateConfig`. Settings keeps the existing persistence/sync layer and changes only information hierarchy, wording, and disclosure.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, existing import worker and deck APIs, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-progressive-disclosure-ux-redesign-design.md` and `docs/superpowers/specs/2026-10-10-import-furigana-card-editor-design.md`

## Global Constraints

- TXT, CSV, TSV, JSON, XLSX, and XLS continue through one normalized schema with a 20 MB/20,000-card limit.
- Import with zero valid cards is an error and cannot create a deck; retry remains idempotent.
- Keep row/sheet context, Unicode deduplication, two-sided furigana, three Japanese fonts, and 12–72 px card size.
- Editing imported card content must not reset its SRS progress. Built-in content remains read-only.
- New templates synchronize both faces by default. Existing templates with different faces open in separate-face mode and are never overwritten automatically.
- Global furigana off hides ruby without deleting data; when on, each face template decides whether ruby is rendered.
- Settings keeps four themes, three UI sizes, reduced motion, local-first persistence, and account sync behavior.
- All dialogs use the shared accessible dialog and sticky action footer.

---

### Task 1: Group import issues into a bounded summary

**Files:**
- Create: `src/lib/importSummary.ts`
- Create: `tests/importSummary.test.mjs`
- Modify: `src/components/flashcard/ImportPreviewEditor.tsx`

**Interfaces:**
- Produces: `ImportIssueGroup = { reason; count; samples }`
- Produces: `summarizeImport(preview, sampleLimit?): { status; valid; skipped; duplicates; samples; groups }`

- [ ] **Step 1: Write failing issue-group tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeImport } from '../src/lib/importSummary.ts';

test('zero valid cards is an error and repeated issues are grouped', () => {
  const issues = Array.from({ length: 648 }, (_, index) => ({ row: index + 2, reason: 'Loại thẻ không hợp lệ', sheet: 'Cards' }));
  const summary = summarizeImport({ cards: [], skipped: 648, duplicates: 0, issues, tables: [] });
  assert.equal(summary.status, 'error');
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].count, 648);
  assert.equal(summary.groups[0].samples.length, 3);
});

test('preview returns at most three sample cards', () => {
  const cards = Array.from({ length: 10 }, (_, index) => ({ id: String(index), front: `F${index}`, back: `B${index}` }));
  assert.equal(summarizeImport({ cards, skipped: 0, duplicates: 0, issues: [], tables: [] }).samples.length, 3);
});
```

- [ ] **Step 2: Run and confirm the missing module failure**

Run: `node --experimental-strip-types --test tests/importSummary.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic grouping**

```ts
export function summarizeImport(preview: ImportPreview, sampleLimit = 3) {
  const grouped = new Map<string, ImportIssue[]>();
  for (const issue of preview.issues) {
    const list = grouped.get(issue.reason) ?? [];
    list.push(issue);
    grouped.set(issue.reason, list);
  }
  return {
    status: preview.cards.length ? (preview.skipped ? 'warning' : 'success') : 'error',
    valid: preview.cards.length,
    skipped: preview.skipped,
    duplicates: preview.duplicates,
    samples: preview.cards.slice(0, sampleLimit),
    groups: [...grouped.entries()].map(([reason, issues]) => ({ reason, count: issues.length, samples: issues.slice(0, 3) })),
  } as const;
}
```

- [ ] **Step 4: Render the summary instead of every issue**

`ImportPreviewEditor` uses error styling when `valid === 0`, warning when skipped rows exist, and success only when at least one card is valid. Each issue group shows reason, count, and up to three row/sheet samples, with an optional disclosure for further distinct groups.

- [ ] **Step 5: Run parser and summary tests**

Run: `node --experimental-strip-types --test tests/importSummary.test.mjs tests/ankiImport.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit import summaries**

```bash
git add src/lib/importSummary.ts src/components/flashcard/ImportPreviewEditor.tsx tests/importSummary.test.mjs
git commit -m "feat: group and bound import feedback"
```

---

### Task 2: Turn deck creation into one three-step flow

**Files:**
- Create: `src/components/flashcard/DeckCreator.tsx`
- Create: `src/components/flashcard/ManualFirstCard.tsx`
- Modify: `src/components/flashcard/ImportedDecks.tsx`
- Modify: `src/components/flashcard/ImportGuide.tsx`
- Modify: `src/components/flashcard/CardFields.tsx`

**Interfaces:**
- Produces: `DeckCreatorStep = 'choose' | 'manual' | 'file' | 'review'`
- Produces: `DeckCreatorDraft = { name; step; preview; manualCard; dirty }`
- Consumes: existing `ImportDraft`, `parseImportFile`, `creationBody`, `importDeck`

- [ ] **Step 1: Extract creator state without changing persistence**

```ts
export type DeckCreatorDraft = {
  name: string;
  step: 'choose' | 'manual' | 'file' | 'review';
  preview: ImportPreview | null;
  manualCard: ImportedCard;
  dirty: boolean;
};
```

`DeckCreator` receives the draft and callbacks; it does not fetch decks or own account state. `ImportedDecks` remains responsible for save/auth/API orchestration.

- [ ] **Step 2: Make manual creation include the first card**

The manual path shows required deck name, required Mặt trước/Mặt sau, and optional type. CTA is “Tạo bộ với 1 thẻ”. “Tạo bộ trống” is a secondary text action and still requires a name. Remove the current immediate `create(true, true)` behavior from the large choice button.

- [ ] **Step 3: Make file import visibly three steps**

1. Choose/drop file and show supported formats.
2. Review valid/skipped/duplicate counts, mapping disclosure, and three samples.
3. Confirm “Tạo bộ thẻ”.

Keep `preview`, mapping edits, and filename in the auth draft. Disable confirmation when `preview.cards.length === 0`. Put confirmation in a sticky creator footer.

- [ ] **Step 4: Simplify the guide copy and vocabulary**

Main UI shows `JSON, Excel, CSV, TXT · Xem hướng dẫn và file mẫu`. The guide dialog has tabs `File mẫu`, `Cách ghi furigana`, and `Tạo bằng AI`. Replace labels: Import file → Nhập từ tệp, Tags → Nhãn, Sheet → Trang tính, Không ánh xạ → Không dùng cột này, Prompt → Câu lệnh mẫu cho AI.

- [ ] **Step 5: Preserve account gating and idempotency**

Guest may parse and review locally. Only the final save calls `requestAuth()`. After auth, Hôm nay exposes “Tiếp tục tạo bộ”; returning to `/decks` restores the exact draft and still requires an explicit final click. Do not auto-submit after login.

- [ ] **Step 6: Run import and Guest verification**

Run: `npm test`

Run with Vite active: `npm run test:guest`

Expected: all import formats still parse; Guest preview makes no protected request; zero valid cards cannot save.

- [ ] **Step 7: Commit the creation flow**

```bash
git add src/components/flashcard/DeckCreator.tsx src/components/flashcard/ManualFirstCard.tsx src/components/flashcard/ImportedDecks.tsx src/components/flashcard/ImportGuide.tsx src/components/flashcard/CardFields.tsx tests/guestFlow.browser.mjs
git commit -m "feat: streamline deck creation and import"
```

---

### Task 3: Detect synchronized versus separate card styles safely

**Files:**
- Create: `src/lib/cardAppearance.ts`
- Create: `tests/cardAppearance.test.mjs`
- Modify: `src/lib/ankiImport.ts`

**Interfaces:**
- Produces: `hasSeparateSideStyles(template): boolean`
- Produces: `copySideStyle(template, sourceSide): DeckTemplateConfig`
- Produces: `createAppearanceDraft(template): { template; separateSides }`

- [ ] **Step 1: Write legacy-preservation tests**

```js
test('legacy different faces open in separate mode without mutation', () => {
  const template = defaultDeckTemplate();
  template.front.style.fontSize = 70;
  template.back.style.fontSize = 24;
  const draft = createAppearanceDraft(template);
  assert.equal(draft.separateSides, true);
  assert.equal(draft.template.front.style.fontSize, 70);
  assert.equal(draft.template.back.style.fontSize, 24);
});

test('copying one side is explicit and copies style only', () => {
  const copied = copySideStyle(template, 'front');
  assert.deepEqual(copied.back.style, template.front.style);
  assert.deepEqual(copied.back.fields, template.back.fields);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --experimental-strip-types --test tests/cardAppearance.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement normalized comparison and explicit copying**

Compare only normalized `style` objects for sync mode. Do not use field lists or `showFront` to infer typography synchronization. Deep-clone the copied style and preserve fields, `showFront`, `showDeckName`, and other content settings.

- [ ] **Step 4: Extend template normalization without rewriting old differences**

`normalizeDeckTemplate` fills missing style properties but never makes back equal front. New `defaultDeckTemplate()` may create identical sides. Existing tests for independent front/back styles must continue to pass.

- [ ] **Step 5: Run appearance and import tests**

Run: `node --experimental-strip-types --test tests/cardAppearance.test.mjs tests/ankiImport.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit appearance helpers**

```bash
git add src/lib/cardAppearance.ts src/lib/ankiImport.ts tests/cardAppearance.test.mjs tests/ankiImport.test.mjs
git commit -m "fix: preserve legacy two-sided card styles"
```

---

### Task 4: Split card content editing from deck appearance

**Files:**
- Create: `src/components/flashcard/CardEditor.tsx`
- Create: `src/components/flashcard/DeckAppearanceDialog.tsx`
- Create: `src/components/flashcard/CardPreview.tsx`
- Modify: `src/components/flashcard/CardPresentation.tsx`
- Modify: `src/components/flashcard/StudySession.tsx`
- Modify: `src/components/flashcard/ImportedDecks.tsx`

**Interfaces:**
- Produces: `CardEditor({ card, busy, onChange })`
- Produces: `DeckAppearanceDialog({ template, editableCard?, onSave, onCancel })`
- Consumes: `createAppearanceDraft`, `copySideStyle`, existing `FuriganaText`

- [ ] **Step 1: Extract a controlled CardEditor**

`CardEditor` exposes Mặt trước, Mặt sau, Loại thẻ by default. “Thêm thông tin” reveals reading, back reading, Hán Việt, ghi chú, and nhãn. It parses `Kanji[hiragana]` on both faces and emits a normalized `ImportedCard`; it never calls the API itself.

- [ ] **Step 2: Build a single Front/Back preview component**

`CardPreview` accepts `{ card, template, side, settings }` and renders exactly the same `CardFace` used in study. Mobile toggles Trước/Sau; desktop keeps preview sticky beside controls. Do not render two full previews simultaneously on mobile.

- [ ] **Step 3: Build basic and advanced appearance sections**

Basic contains preset size, font, alignment, synchronized-sides switch, bold, and italic. Exact 12–72 px, field ordering, individual themes, `showFront`, and per-face settings are under `<details>` “Nâng cao”. If `separateSides` is false, every style change applies to both sides in the draft. Toggling separate on does not mutate either side.

- [ ] **Step 4: Preserve authorization and separate saves**

`StudySession` provides `editableCard` only for `source === 'IMPORT'`. Saving compares content and template separately: call `updateCard` only for changed content, `updateDeck` only for changed template. If one request fails, keep the dialog open, identify the failed section, and retain the server-confirmed part.

- [ ] **Step 5: Add sticky footer and accessible dialog behavior**

Use `AppDialog` with title “Giao diện thẻ”. Footer contains Hủy and one primary “Lưu thay đổi”. The footer stays visible while controls scroll. All icon-only controls have labels; disclosure uses `aria-expanded`.

- [ ] **Step 6: Update browser customization coverage**

In `tests/importCardCustomization.browser.mjs`, assert:

```js
await dialog.getByRole('button', { name: 'Thêm thông tin' }).click();
await dialog.getByLabel('Chỉnh riêng từng mặt').check();
await dialog.getByLabel('Cỡ chữ thẻ mặt trước').fill('42');
await dialog.getByLabel('Cỡ chữ thẻ mặt sau').fill('42');
```

Then verify both study sides render the saved 42 px style, two-sided ruby remains correct, and progress fields are unchanged.

- [ ] **Step 7: Run customization tests**

Run: `node --experimental-strip-types --test tests/ankiImport.test.mjs tests/cardAppearance.test.mjs tests/furigana.test.mjs`

Run: `node tests/importCardCustomization.browser.mjs`

Run: `npm run build`

Expected: all PASS.

- [ ] **Step 8: Commit the split dialog**

```bash
git add src/components/flashcard/CardEditor.tsx src/components/flashcard/DeckAppearanceDialog.tsx src/components/flashcard/CardPreview.tsx src/components/flashcard/CardPresentation.tsx src/components/flashcard/StudySession.tsx src/components/flashcard/ImportedDecks.tsx tests/importCardCustomization.browser.mjs
git commit -m "feat: separate card content and appearance editing"
```

---

### Task 5: Reorganize Settings with clear ownership and disclosure

**Files:**
- Create: `src/components/settings/SettingsSection.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/lib/storage.ts`
- Modify: `tests/guestStorage.test.mjs`

**Interfaces:**
- Preserves: existing `AppSettings` API fields and sync behavior
- Produces: four UI groups: Tài khoản, Giao diện, Khi học, Ôn tập

- [ ] **Step 1: Group existing controls without changing stored keys**

Tài khoản contains identity, sync/error status, legacy data link, and login/logout. Giao diện contains four themes, “Cỡ chữ giao diện”, and reduced motion. Khi học contains front/back furigana, autoplay, and daily goal. Ôn tập contains “Giới hạn thời gian ôn”.

- [ ] **Step 2: Clarify furigana precedence in copy and behavior**

Keep `showFuriganaFront` and `showFuriganaBack` storage for backward compatibility. UI labels are “Hiện furigana mặt trước” and “Hiện furigana mặt sau”. Turning a side off hides `ruby` but never changes imported segments or template fields. Add a storage test proving off/on round-trips without modifying card data.

- [ ] **Step 3: Collapse advanced preview and danger actions**

On desktop, preview sits inside Giao diện. On mobile it is a `<details>` named “Xem trước cỡ chữ”. Put reset under `<details>` “Vùng nguy hiểm”; the destructive button still requires its second confirmation state.

- [ ] **Step 4: Make every preset expose selection semantics**

Theme, UI size, and time presets use `aria-pressed`. Time presets replace “10m” with “10 phút”. Input labels include units and limits. Sync success remains in Tài khoản; only errors may appear as alerts elsewhere.

- [ ] **Step 5: Run settings persistence checks**

Run: `node --experimental-strip-types --test tests/guestStorage.test.mjs`

Run: `npm run build`

Expected: settings persist with the same storage/API keys and no user/account namespace leakage.

- [ ] **Step 6: Commit Settings hierarchy**

```bash
git add src/components/settings/SettingsSection.tsx src/components/settings/SettingsPage.tsx src/lib/storage.ts tests/guestStorage.test.mjs
git commit -m "feat: simplify settings hierarchy"
```

---

### Task 6: Tighten visual tokens, typography, and common controls

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ui/StudyUI.tsx`
- Modify: `src/components/ui/AppDialog.tsx`
- Modify: `src/components/ui/OverflowMenu.tsx`
- Modify: `src/components/flashcard/FuriganaText.tsx`

**Interfaces:**
- Produces: one shared visual language for panels, CTA, pills, segmented controls, dialog footer, and focus states

- [ ] **Step 1: Correct low-contrast tokens**

Darken light-theme `--color-text-tertiary` and `--color-grammar` until each reaches at least 4.5:1 on its actual background. Verify reading and high-contrast themes separately. Keep semantic hue differences and text labels.

- [ ] **Step 2: Raise minimum small-text and ruby sizes**

Set `.study-eyebrow` to at least `0.75rem`; avoid letter spacing that makes Vietnamese hard to scan. Replace `.furigana-text rt { font-size: .42em }` with:

```css
.furigana-text rt {
  color: var(--color-accent);
  font-size: max(.48em, 9px);
  font-style: normal;
  font-weight: 500;
  line-height: 1;
}
```

- [ ] **Step 3: Add shared segmented and sticky-action styles**

Define `.study-segmented`, `.study-dialog-body`, and `.study-dialog-actions` in `index.css`. Controls remain at least 44 px high, wrap or horizontally scroll without clipping at 320 px, and respect safe-area insets.

- [ ] **Step 4: Remove decorative noise from migrated screens**

Use one border per panel, no stacked panel inside panel unless it denotes a new task, no repeated status pills, and at most one filled button per section. Keep content-type color in `ContentBadge`; do not communicate type by color alone.

- [ ] **Step 5: Verify accessibility and motion**

Keyboard-test every dialog/menu, run browser with `prefers-reduced-motion: reduce`, and confirm focus rings remain visible in all four themes. Verify 320×812, 375×812, 768×1024, 1024×768, and 1440×900 without horizontal overflow.

- [ ] **Step 6: Commit visual primitives**

```bash
git add src/index.css src/components/ui/StudyUI.tsx src/components/ui/AppDialog.tsx src/components/ui/OverflowMenu.tsx src/components/flashcard/FuriganaText.tsx
git commit -m "style: refine shared learning interface"
```

---

### Task 7: Complete regression, visual QA, and dead-code cleanup

**Files:**
- Modify: `tests/guestFlow.browser.mjs`
- Modify: `tests/srsIntegration.browser.mjs`
- Modify: `tests/importCardCustomization.browser.mjs`
- Modify: `docs/anki-import.md`
- Delete only after `rg` verification: obsolete creator/customizer/session fragments from migrated files

**Interfaces:**
- Produces: documented and tested final UX; no parallel legacy implementations

- [ ] **Step 1: Update browser tests to the final labels and paths**

Cover Học thử persistence, five mobile tabs, More sheet, Bộ thẻ setup, free completion, scheduled rating, import error grouping, draft continuation after auth, Settings disclosures, and successful reload of card style/furigana.

- [ ] **Step 2: Run all frontend checks**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run with Vite active: `npm run test:guest`

Run with disposable API/MySQL active: `npm run test:integration`

Expected: all PASS.

- [ ] **Step 3: Run API scale verification if an existing endpoint changed**

Run: `npm run test:scale`

Expected: PASS. Skip only when `git diff` proves no API contract or server pagination/reorder path changed.

- [ ] **Step 4: Perform visual QA and save evidence**

Capture Hôm nay, Thư viện, Bộ thẻ, Study setup, front/back session, import review, customization, and Settings at mobile and desktop sizes in light/dark themes. Check text wrapping using long Vietnamese questions and Japanese ruby.

- [ ] **Step 5: Remove code proven unreachable**

Use `rg` for every candidate export before deletion. Remove obsolete `lessonPicker`, old creator blocks, old `DeckCustomizeDialog`, duplicate RatingButton, and old page-switch navigation only after their replacements pass build and browser tests.

- [ ] **Step 6: Refresh import documentation**

Update `docs/anki-import.md` to match the three-step import flow, supported schema, two-sided `Kanji[hiragana]`, and account gating. State storage/API behavior accurately.

- [ ] **Step 7: Final clean-tree verification and commit**

```bash
git diff --check
git status --short
git add tests docs/anki-import.md src
git commit -m "chore: finish simplified learning experience"
```

