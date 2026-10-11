# Flexible Anki Import Field Layout Design

**Date:** 2026-10-12  
**Status:** Ready for user review  
**Scope:** Personal deck import in the React application. No built-in deck or spaced-repetition scheduling changes.

## Problem

The current importer accepts JSON, CSV, TSV, TXT, XLSX, and XLS, but it normalizes every file into a fixed schema (`front`, `back`, `reading`, and other known fields). Files with user-defined Anki note fields therefore require manual mapping through a technical form, can use only one source column for each face, and can silently leave useful fields out of the card presentation.

Users should be able to import an Anki-style file without first renaming its fields to match a sample. After reading the file, the app should show the fields found in that file and let the user decide which fields appear on the front, which appear on the back, and which fields provide furigana readings.

## Goals

1. Accept arbitrary source field names from every currently supported file format.
2. Default the first source field to the front, and only that field to the front.
3. Preserve the remaining useful fields by placing them on the back by default.
4. Let users move fields between faces, hide fields, and reorder fields without editing the source file.
5. Keep front and back reading fields separate and render furigana only when alignment is reliable.
6. Update a live sample preview immediately after every layout change.
7. Preserve compatibility with existing imports, existing personal decks, the current backend API, and explicit `Kanji[hiragana]` markup.

## Non-goals

- Importing `.apkg` databases or Anki media packages.
- Executing Anki HTML, CSS, JavaScript, or card templates.
- Automatically generating Japanese readings with an external service.
- Changing built-in decks, the review algorithm, or the backend database schema.
- Replacing the existing per-card editor after import.

## User flow

1. The user chooses any supported file.
2. The parser discovers sheets, rows, headers, and source fields. A headerless file receives labels such as `Cột 1`, `Cột 2`.
3. The importer opens a field-layout step before final import.
4. Each source field appears once in a compact list with:
   - its original label;
   - one sample value;
   - a destination control;
   - ordering controls when assigned to a card face.
5. Destinations are:
   - `Mặt trước`;
   - `Mặt sau`;
   - `Cách đọc mặt trước`;
   - `Cách đọc mặt sau`;
   - `Ghi chú`;
   - `Nhãn`;
   - `Không dùng`.
6. The default layout uses exactly the first source field on the front. Remaining nonempty fields go to the back, except confidently detected reading, tag, and note columns, which receive their semantic destinations.
7. The user can move a field between destinations and use up/down buttons to reorder front or back fields. Buttons are used instead of drag-only interaction so the flow remains usable on touch screens and with a keyboard.
8. A two-sided card preview displays one representative row. The user can switch between up to three sample rows to check the layout.
9. The app summarizes valid cards, skipped rows, duplicates, and furigana warnings before enabling the final import action.

## Interaction rules

### Face assignment

- A source field can have only one destination.
- The front and back each accept multiple ordered fields.
- At least one nonempty field must remain on each face before import.
- Moving the last field away from a face shows an inline error and disables import.
- The first source field starts as the only front field, even when its header is unknown.
- Existing well-known schemas remain convenient: semantic columns are detected, but detection never overrides the one-field front default.

### Preview presentation

- A face containing one field displays only the value; its source label is omitted to keep vocabulary cards clean.
- A face containing multiple fields displays each block in order. The primary block is visually strongest; later blocks use the original source label and a quieter style.
- Empty values are omitted per card without changing the global field order.
- Newlines inside source values remain intact.
- Preview and study mode use the same block-rendering helper, preventing discrepancies between import and learning.

### Source data preservation

- Canonical `front` and `back` strings remain populated for search, deduplication, compatibility, and API validation.
- Structured face blocks are stored in `extraData.importFieldLayout` as versioned JSON. Each block contains a stable source key, original label, destination, and order.
- Per-card values are stored in `extraData.importFieldValues` as JSON keyed by the stable source key.
- Existing semantic data continues to use current fields (`reading`, `backReading`, `notes`, `tags`, `hanViet`, and `examples`) where applicable.
- Unknown fields are not discarded unless the user explicitly selects `Không dùng`.
- The serialized extra data remains subject to the current 20,000-character safety limit. Rows exceeding it are reported clearly rather than truncated silently.

## Data model

`ImportTable` gains a versioned layout rather than relying solely on one-column-per-canonical-field mapping:

```ts
type ImportDestination =
  | "front"
  | "back"
  | "frontReading"
  | "backReading"
  | "notes"
  | "tags"
  | "ignore";

interface ImportSourceField {
  key: string;
  label: string;
  column: number;
  destination: ImportDestination;
  order: number;
}

interface ImportTable {
  // existing sheet and row properties
  layoutVersion: 1;
  sourceFields: ImportSourceField[];
}
```

The current `mapping` property remains readable during migration. When `sourceFields` is absent, a migration helper derives it from the old mapping. This protects saved Guest drafts and any tests or code that still construct legacy previews.

For each parsed row:

- `front` is a plain-text aggregate of ordered front blocks;
- `back` is a plain-text aggregate of ordered back blocks;
- reading destinations populate `reading` and `backReading`;
- the structured layout and row values are stored in `extraData`;
- deduplication uses the aggregate front/back pair as it does today.

## Field detection

Detection is advisory and deterministic:

1. Preserve original field order and labels.
2. Assign column 0 to the front.
3. Detect well-known reading aliases (`reading`, `kana`, `hiragana`, `yomikata`, `cách đọc`, and existing aliases). Assign one front reading and, when explicitly named for the back, one back reading.
4. Detect note and tag aliases for their semantic destinations.
5. Assign all remaining columns to the back in source order.
6. If multiple columns compete for one reading destination, choose the first and leave the others on the back. Show a small “Đã đề xuất” marker so the user knows the choice was automatic.

JSON objects use their first-seen key order. CSV, TSV, TXT, and Excel use column order. Headerless files use generated column labels and do not apply semantic detection.

## Furigana and reading behavior

Furigana follows these precedence rules independently for each face:

1. Explicit markup such as `学校[がっこう]` is authoritative and is parsed into ruby segments.
2. Otherwise, the selected reading field is passed to the current alignment algorithm.
3. If alignment is unambiguous, ruby segments are stored and rendered.
4. If alignment is ambiguous or invalid, the original face text and reading remain visible, no incorrect ruby is generated, and the preview shows an actionable warning.
5. A reading field is metadata by default and is not repeated as a normal face block. The user can keep a second source column on a face when they intentionally want visible kana.
6. Front and back readings never fall back to each other. This prevents a front reading from appearing above Kanji on the answer side.

No automatic dictionary lookup is introduced. Users remain in control of readings.

## Component design

### Parser and normalization

`src/lib/ankiImport.ts` will:

- expose source field descriptors for arbitrary headers;
- create the default layout;
- migrate legacy table mappings;
- compose canonical values and structured blocks;
- preserve current limits, duplicates, examples, type inference, and format support;
- keep existing exported parsing functions compatible.

### Field layout editor

`ImportPreviewEditor.tsx` will replace the destination-centric grid of nine selects with a source-centric field list. The advanced sheet/header controls remain available but collapsed. Layout changes continue to call `remapImportPreview`, so validation and preview share one data path.

A focused helper component may be extracted if needed:

- `ImportFieldLayoutEditor`: assignment and ordering;
- `ImportCardPreview`: front/back sample preview using the shared face-block renderer.

### Study rendering

`CardPresentation.tsx` will render structured import blocks when present. Existing cards without structured blocks use the current `front` and `back` rendering unchanged. Built-in decks therefore remain unaffected.

### Import guide

The guide will lead with a short instruction:

> Chọn file bất kỳ. SỔ NHẬT sẽ đọc các trường trong file; bạn chọn trường nào nằm ở mặt trước, mặt sau và trường nào dùng làm cách đọc.

The sample format becomes optional reference material rather than a requirement.

## Error handling

- No source fields: reject the file as empty.
- Missing front or back assignment: keep the preview visible, show an inline error, disable final import.
- Row missing all assigned front or back values: skip that row and state which face is empty.
- Invalid explicit furigana: keep the card and show a warning.
- Ambiguous inferred furigana: keep text and reading separately, show a warning.
- Oversized structured data: skip the row with the existing safety-limit explanation.
- Malformed JSON/CSV/Excel: retain current explicit parse errors.
- Aborted parsing: retain current cancel behavior.

## Accessibility and responsive behavior

- Every source field row has a visible label and a native select.
- Ordering buttons have descriptive names such as `Đưa Ví dụ lên trên`.
- Assignment changes and validation summaries use polite status regions.
- Front/back previews have headings and remain understandable without color.
- Mobile uses one field row per block; desktop may align label, sample, destination, and order controls in columns.
- No essential action depends on hover or drag-and-drop.

## Compatibility and migration

- Existing personal decks render exactly as before because structured blocks are optional.
- Existing Guest import drafts using `mapping` migrate in memory when opened.
- Existing known-schema imports continue producing canonical fields and semantic metadata.
- The backend receives the same card request shape and stores the new versioned JSON inside the already supported `extraData`; no backend schema migration is required.
- If a future client does not understand `importFieldLayout`, it still displays the canonical aggregate `front` and `back` strings.

## Testing strategy

### Unit tests

- Arbitrary JSON keys become source fields in stable order.
- Headerless data receives generated labels.
- Only the first source field defaults to the front.
- Remaining fields default to the back except detected reading/note/tag fields.
- Multiple ordered fields compose front/back consistently.
- Moving and reordering fields remaps every row.
- Legacy mappings migrate without changing their current output.
- Explicit front and back furigana remain independent.
- Ambiguous reading alignment produces a warning without dropping the card.
- Structured data round-trips through API serialization.
- Unknown fields survive import unless explicitly ignored.

### Browser tests

- Import a file with arbitrary Anki field names.
- Move fields between faces and verify the live preview.
- Reorder two back fields and verify study-mode order after import.
- Select independent front/back reading fields and verify ruby output.
- Confirm keyboard-accessible ordering and mobile layout.
- Confirm the final import button remains disabled when a face has no assigned field.

### Regression checks

- Current JSON, CSV, TSV, TXT, XLSX, and XLS fixtures still pass.
- Built-in decks and existing imported decks render unchanged.
- Build, lint, unit tests, Guest browser flow, and import customization browser test pass.

## Acceptance criteria

1. A user can import a file whose fields do not match the sample schema.
2. The first source field alone appears on the front by default.
3. Other useful fields are preserved on the back by default.
4. The user can assign and reorder fields for each face before import.
5. The preview matches the final study card.
6. Front and back furigana use their own selected readings and never cross over.
7. Ambiguous furigana is reported, not guessed incorrectly.
8. Existing imports and decks remain compatible.
9. No backend schema change is required.
