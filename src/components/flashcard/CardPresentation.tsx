import { useState, useRef, useEffect, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Bold, Copy, Eye, EyeOff, GripVertical, Italic, Minus, Plus, X } from '@/components/ui/icons';
import { CARD_FONT_PRESETS, defaultDeckTemplate, importFaceBlocks, kindLabels, parseCardExamples, type ImportFaceBlock } from "@/lib/ankiImport";
import { parseStoredFurigana } from "@/lib/furigana";
import { mergeSideStyle } from "@/lib/deckFormat";
import { fontStack } from "@/lib/fontRegistry";
import { ensureFont } from "@/lib/fontLoader";
import { fieldDecoration, fontIdsOf, surfaceStyle } from "@/lib/cardSurface";
import { FontSelectOptions } from "./FontSelectOptions";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { MIN_CONTRAST, styleContrast } from "@/lib/styleContrast";
import { FuriganaText } from "./FuriganaText";
import { hasCardMarkup } from '@/lib/cardFormatting';
import { CardFields } from "./CardFields";
import { copySideStyle, createAppearanceDraft } from "@/lib/cardAppearance";
import type {
  CardField,
  DeckTemplateConfig,
  ImportedCard,
  ImportedDeck,
} from "@/lib/ankiImport";
import type { NoteType } from "@/lib/deckFormat";
const fieldLabels: Record<string, string> = {
  front: "Mặt trước",
  back: "Mặt sau",
  reading: "Cách đọc",
  hanViet: "Hán Việt",
  notes: "Ghi chú",
  kind: "Loại thẻ",
  deckName: "Tên bộ thẻ",
};
const clampFontSize = (value: number) => Math.max(12, Math.min(72, Math.round(value)));
function FontSizeInput({ value, label, onCommit }: { value: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const number = draft.trim() ? Number(draft) : NaN;
    const next = Number.isFinite(number) ? clampFontSize(number) : value;
    setDraft(String(next));
    onCommit(next);
  };
  return <input type="text" inputMode="numeric" role="spinbutton"
    aria-valuemin={12} aria-valuemax={72} aria-valuenow={value} aria-label={label}
    className="card-font-size-input min-w-0 w-full bg-transparent px-2 text-center tabular-nums outline-none"
    value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.blur();
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const number = draft.trim() ? Number(draft) : value;
        const next = clampFontSize((Number.isFinite(number) ? number : value) + (event.key === 'ArrowUp' ? 1 : -1));
        setDraft(String(next));
        onCommit(next);
      }
    }} />;
}
// Short text (a single word or kanji) is enlarged when autoFit is on; capped by viewport width so it never overflows.
export function autoFitScale(text: string): number {
  const length = Array.from(text.replace(/\s+/g, "")).length;
  return length <= 3 ? 2.4 : length <= 8 ? 1.6 : 1;
}

function cardTextStyle(style: DeckTemplateConfig['front']['style'], text = "", secondary = false): CSSProperties {
  const scale = style.autoFit && !secondary ? autoFitScale(text) : 1;
  const size = secondary ? Math.max(14, Math.round(style.fontSize * 0.55)) : style.fontSize * scale;
  return {
    fontSize: scale > 1 ? `min(${size}px, 18vw)` : `${size}px`,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    fontFamily: fontStack(style.fontFamily),
    fontSynthesis: "weight style",
  };
}
function fieldValue(
  field: CardField,
  card: ImportedCard,
  deckName: string,
  side: 'front' | 'back',
): string {
  if (field.startsWith("field:")) {
    const value = card.fields?.[field.slice(6)];
    return typeof value === "string" ? value : "";
  }
  if (field === "kind") return kindLabels[card.kind];
  if (field === "deckName") return deckName;
  if (field === "reading") return side === "back" ? card.backReading || card.reading : card.reading;
  return card[field];
}

function ExampleMeaning({ meaning, label }: { meaning: string; label: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="mt-2 text-sm font-normal sm:text-base">
    <button type="button" className="study-button !min-h-8 !px-2 !py-1 !text-xs"
      aria-label={`${visible ? "Ẩn" : "Hiện"} nghĩa ${label}`} aria-expanded={visible}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setVisible(value => !value); }}>
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      {visible ? "Ẩn nghĩa" : "Hiện nghĩa"}
    </button>
    {visible && <div className="mt-2 whitespace-pre-wrap break-words opacity-75"><FuriganaText text={meaning} show={false} /></div>}
  </div>;
}

function Examples({ value, showReading }: { value: unknown; showReading: boolean }) {
  let examples;
  try { examples = parseCardExamples(value); } catch { return null; }
  if (!examples.length) return null;
  return <div className="space-y-3 border-t border-current/10 pt-4 text-left">
    <p className="text-xs font-semibold opacity-60">Ví dụ · bấm mắt để xem nghĩa</p>
    {examples.map((example, index) => <div key={index} className="rounded-sm border-l-2 border-[color-mix(in_srgb,currentColor_24%,transparent)] bg-[color-mix(in_srgb,currentColor_4%,transparent)] px-4 py-3">
      <div lang="ja" className="font-jp whitespace-pre-wrap break-words text-base leading-relaxed sm:text-lg">{index + 1}. <FuriganaText text={example.japanese} show={showReading} /></div>
      {showReading && example.reading && <p lang="ja" className="card-reading font-jp mt-1 text-sm text-[var(--color-accent)]">{example.reading}</p>}
      <ExampleMeaning meaning={example.meaning} label={`ví dụ ${index + 1}`} />
    </div>)}
  </div>;
}

type KanjiVocabularyEntry = { word: string; reading: string; meaning: string };

function parseKanjiVocabulary(value: unknown): KanjiVocabularyEntry[] {
  if (!value) return [];
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length > 100) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.word !== "string" || typeof item.reading !== "string" || typeof item.meaning !== "string") return [];
      const word = item.word.trim();
      const reading = item.reading.trim();
      const meaning = item.meaning.trim();
      return word && meaning ? [{ word, reading, meaning }] : [];
    });
  } catch {
    return [];
  }
}

function KanjiVocabulary({ value, showReading }: { value: unknown; showReading: boolean }) {
  const entries = parseKanjiVocabulary(value);
  if (!entries.length) return null;
  return (
    <div className="mx-auto w-fit max-w-full space-y-2 text-left">
      {entries.map((entry, index) => (
        <div key={`${entry.word}-${entry.reading}-${index}`} className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-2">
          <span lang="ja" className="furigana-text font-jp whitespace-nowrap text-lg leading-loose">
            {showReading && entry.reading ? <ruby>{entry.word}<rt>{entry.reading}</rt></ruby> : entry.word}
          </span>
          <span aria-hidden="true">—</span>
          <span className="min-w-0 break-words">{entry.meaning}</span>
        </div>
      ))}
    </div>
  );
}

function GrammarBack({ value, reading, storedSegments, showReading, compact, style }: { value: string; reading: string; storedSegments?: unknown; showReading: boolean; compact: boolean; style: DeckTemplateConfig['back']['style'] }) {
  const textStyle = compact ? undefined : cardTextStyle(style);
  const hasExplicitFurigana = parseStoredFurigana(storedSegments).some((segment) => segment.reading);
  if (showReading && (reading || hasExplicitFurigana)) {
    return <div className={`text-left whitespace-pre-wrap break-words leading-relaxed ${compact ? "text-sm" : ""}`} style={textStyle}>
      <FuriganaText text={value} reading={reading} storedSegments={storedSegments} />
    </div>;
  }
  return (
    <div className={`space-y-5 text-left font-normal leading-relaxed ${compact ? "text-sm" : ""}`} style={textStyle}>
      {value.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map((block, index) => (
        <div key={index} className={index === 0 ? "" : "border-t border-current/10 pt-4"}>
          {block.split("\n").map((line, lineIndex) => line.trim().startsWith("→") ? (
            <ExampleMeaning key={lineIndex} meaning={line.trim().slice(1).trim()} label={`ví dụ ${index + 1}`} />
          ) : (
            <div
              key={lineIndex}
              className={/^【.*】$/.test(line.trim())
                ? "mb-2 text-xs font-semibold tracking-wide opacity-60"
                : line.trim().startsWith("→")
                  ? "mt-1 text-sm font-normal opacity-75 sm:text-base"
                  : "font-jp whitespace-pre-wrap break-words"}
              style={/^【.*】$/.test(line.trim()) ? undefined : textStyle}
            >
              {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ImportedFaceBlocks({ blocks, reading, showReading, compact, style }: { blocks: ImportFaceBlock[]; reading: string; showReading: boolean; compact: boolean; style: DeckTemplateConfig['front']['style'] }) {
  const multiple = blocks.length > 1;
  return <div className={`space-y-4 ${style.alignment === "left" ? "text-left" : "text-center"}`}>
    {blocks.map((block, index) => <section key={block.key} className={index ? "border-t border-current/10 pt-4" : ""}>
      {multiple && <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider opacity-55">{block.label}</p>}
      <div className={`font-jp whitespace-pre-wrap break-words leading-relaxed ${compact ? "text-base" : ""}`} style={compact ? undefined : cardTextStyle(style)}>
        <FuriganaText text={block.value} reading={index === 0 ? reading : ""} show={showReading} />
      </div>
    </section>)}
  </div>;
}

export function CardFace({
  card,
  deckName,
  fields,
  template,
  side,
  compact = false,
  showExampleReadings = true,
}: {
  card: ImportedCard;
  deckName: string;
  fields: CardField[];
  template: DeckTemplateConfig;
  side: 'front' | 'back';
  compact?: boolean;
  showExampleReadings?: boolean;
}) {
  const grammarAnswer = card.kind === "grammar" && fields.includes("back");
  const style = mergeSideStyle(template[side].style, card.style);
  const fontKey = fontIdsOf(style, template.fieldStyles, card.style).join(",");
  useEffect(() => { for (const id of fontKey.split(",")) ensureFont(id); }, [fontKey]);
  const firstTextIndex = fields.findIndex(field => field === "front" || field === "back");
  return (
    <div
      className={`w-full space-y-4 ${grammarAnswer ? "mx-auto max-w-3xl text-left" : style.alignment === "left" ? "text-left" : "text-center"} ${compact ? "!text-base" : ""}`}
      style={fieldDecoration({ colors: { fg: style.colors?.fg, accent: style.colors?.accent } })}
    >
      {fields.map((field, index) => {
        const value = fieldValue(field, card, deckName, side);
        if (!value) return null;
        const fieldKey = field === "reading" ? (side === "front" ? "frontReading" : "backReading") : field.startsWith("field:") ? field.slice(6) : field;
        const fieldSpec = template.fieldStyles?.[fieldKey];
        const fieldStyle = mergeSideStyle(style, fieldSpec);
        const importedBlocks = field === "front" || field === "back" ? importFaceBlocks(card, field) : [];
        const kanjiVocabulary = field === "notes" && card.kind === "kanji"
          ? parseKanjiVocabulary(card.extraData?.kanjiVocabulary)
          : [];
        if (field === "reading" && (
          (side === "front" && fields.includes("front")) ||
          (side === "back" && fields.includes("back") && card.backReading)
        )) return null;
        if (grammarAnswer && field === "back" && !importedBlocks.length && !hasCardMarkup(value)) {
          return <GrammarBack key={`${field}-${index}`} value={value} reading={card.backReading} storedSegments={card.extraData?.backFuriganaSegments} showReading={fields.includes("reading")} compact={compact} style={fieldStyle} />;
        }
        if (field.startsWith("field:")) {
          const label = template.fieldLabels?.[field.slice(6)] ?? field.slice(6);
          return <section key={`${field}-${index}`} data-field={field} className="border-t border-current/10 pt-4 text-left" style={fieldDecoration(fieldSpec)}>
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider opacity-55">{label}</p>
            <div className="font-jp whitespace-pre-wrap break-words leading-relaxed" style={compact ? undefined : cardTextStyle(fieldStyle, value, true)}>
              <FuriganaText text={value} show={fields.includes("reading")} />
            </div>
          </section>;
        }
        const isCardText = field === "front" || field === "back";
        const cardReading = field === "front" ? card.reading : field === "back" ? card.backReading : "";
        const storedSegments = field === "front" ? card.extraData?.frontFuriganaSegments : field === "back" ? card.extraData?.backFuriganaSegments : undefined;
        const showFurigana = fields.includes("reading");
        return (
          <div
            key={`${field}-${index}`}
            data-field={field}
            className={
              field === "notes"
                ? "whitespace-pre-wrap break-words rounded-sm border-l-2 border-[color-mix(in_srgb,currentColor_24%,transparent)] bg-[color-mix(in_srgb,currentColor_4%,transparent)] px-4 py-3 text-base"
                : field === "reading"
                  ? "card-reading font-jp text-lg text-[var(--color-accent)]"
                  : field === "hanViet"
                    ? "text-base font-medium text-[var(--color-kanji)]"
                  : field === "kind" || field === "deckName"
                    ? "text-xs font-bold uppercase tracking-wide opacity-70"
                : "font-jp whitespace-pre-wrap break-words"
            }
            style={isCardText ? { ...cardTextStyle(fieldStyle, value, index !== firstTextIndex), ...fieldDecoration(fieldSpec) } : { ...(fieldSpec?.font?.family ? { fontFamily: fontStack(fieldSpec.font.family) } : {}), ...fieldDecoration(fieldSpec) }}
          >
            <span className="sr-only">{fieldLabels[field]}: </span>
            {kanjiVocabulary.length ? <KanjiVocabulary value={kanjiVocabulary} showReading={showExampleReadings} /> : field === "hanViet" ? `Hán Việt: ${value}` : importedBlocks.length ? (
              <ImportedFaceBlocks blocks={importedBlocks} reading={cardReading} showReading={showFurigana} compact={compact} style={fieldStyle} />
            ) : isCardText ? (
              <FuriganaText text={value} reading={cardReading} storedSegments={storedSegments} show={showFurigana} />
            ) : hasCardMarkup(value) ? <FuriganaText text={value} show={false} /> : value}
          </div>
        );
      })}
      {fields.includes("back") && template.back.showExamples !== false && <Examples key={card.id} value={card.extraData?.examples} showReading={showExampleReadings} />}
    </div>
  );
}

export function DeckCustomizeDialog({
  deck,
  busy,
  error,
  editableCard,
  noteTypes,
  onCancel,
  onSave,
}: {
  deck: ImportedDeck;
  busy: boolean;
  error?: string;
  editableCard?: ImportedCard;
  noteTypes?: NoteType[];
  onCancel: () => void;
  onSave: (template: DeckTemplateConfig, card?: ImportedCard) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener?.focus();
    };
  }, []);
  const initialAppearance = createAppearanceDraft(deck.template);
  const [template, setTemplate] = useState<DeckTemplateConfig>(initialAppearance.template);
  const [separateSides, setSeparateSides] = useState(initialAppearance.separateSides);
  const [cardDraft, setCardDraft] = useState<ImportedCard | undefined>(editableCard);
  const [previewBack, setPreviewBack] = useState(false);
  const example = cardDraft || deck.cards[0] || {
    id: "preview",
    front: "日本語を勉強する",
    back: "Học tiếng Nhật",
    reading: "にほんごをべんきょうする",
    backReading: "",
    hanViet: "Nhật Bản Ngữ · Miễn Cường",
    notes: "Ghi chú sẽ xuất hiện ở đây.",
    kind: "vocabulary" as const,
  };
  const labelOf = (field: CardField) => field.startsWith("field:") ? template.fieldLabels?.[field.slice(6)] ?? field.slice(6) : fieldLabels[field];
  const candidates: CardField[] = [
    "front",
    "back",
    "reading",
    "hanViet",
    "notes",
    "kind",
    "deckName",
    ...Object.keys(template.fieldLabels ?? {}).map((key) => `field:${key}` as CardField),
  ];
  const updateFields = (side: "front" | "back", fields: CardField[]) =>
    setTemplate((previous) => ({
      ...previous,
      [side]: { ...previous[side], fields },
    }));
  const toggleField = (side: "front" | "back", field: CardField) => {
    const current = template[side].fields;
    updateFields(
      side,
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  };
  const shiftField = (side: "front" | "back", index: number, delta: number) => {
    const fields = [...template[side].fields];
    const target = Math.max(0, Math.min(fields.length - 1, index + delta));
    if (index === target) return;
    const [field] = fields.splice(index, 1);
    fields.splice(target, 0, field);
    updateFields(side, fields);
  };
  const activeSide = previewBack ? "back" : "front";
  const activeStyle = template[activeSide].style;
  const activePreset = (Object.entries(CARD_FONT_PRESETS) as Array<[DeckTemplateConfig[typeof activeSide]["style"]["fontScale"], number]>)
    .find(([, size]) => size === activeStyle.fontSize)?.[0] || "custom";
  const updateActiveStyle = (changes: Partial<DeckTemplateConfig[typeof activeSide]["style"]>) =>
    setTemplate((previous) => separateSides ? ({
      ...previous,
      [activeSide]: { ...previous[activeSide], style: { ...previous[activeSide].style, ...changes } },
    }) : ({
      ...previous,
      front: { ...previous.front, style: { ...previous.front.style, ...changes } },
      back: { ...previous.back, style: { ...previous.back.style, ...changes } },
    }));
  const customFonts = useCustomFonts();
  const dialogContrast = styleContrast({ theme: activeStyle.theme, colors: activeStyle.colors });
  useEffect(() => { ensureFont(activeStyle.fontFamily); }, [activeStyle.fontFamily]);
  const themeClass =
    activeStyle.theme === "dark"
      ? "bg-slate-900 text-white"
      : activeStyle.theme === "blue"
        ? "bg-blue-50 text-slate-900"
        : "bg-[var(--color-surface)] text-[var(--color-text)]";
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-0 h-dvh w-screen max-w-none max-h-none fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tùy chỉnh bộ thẻ"
    >
      <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-[var(--color-bg)] p-4 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="study-eyebrow">TÙY CHỈNH BỘ THẺ</p>
            <h2 className="text-xl font-bold">{deck.name}</h2>
          </div>
          <button
            className="study-button !p-2"
            onClick={onCancel}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-surface-alt)] p-1" role="tablist" aria-label="Chọn mặt thẻ để tùy chỉnh">
          <button
            type="button"
            role="tab"
            aria-selected={!previewBack}
            className={!previewBack ? "study-button study-button-primary" : "study-button border-transparent bg-transparent"}
            onClick={() => setPreviewBack(false)}
          >
            Mặt trước
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={previewBack}
            className={previewBack ? "study-button study-button-primary" : "study-button border-transparent bg-transparent"}
            onClick={() => setPreviewBack(true)}
          >
            Mặt sau
          </button>
        </div>
        <label className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span><strong className="block text-sm">Chỉnh riêng từng mặt</strong><span className="mt-1 block text-xs text-[var(--color-text-secondary)]">Tắt để font, cỡ chữ và kiểu chữ luôn giống nhau ở hai mặt.</span></span>
          <input type="checkbox" checked={separateSides} aria-label="Chỉnh riêng từng mặt" onChange={(event) => {
            const next = event.target.checked;
            if (!next) setTemplate((previous) => copySideStyle(previous, activeSide));
            setSeparateSides(next);
          }}/>
        </label>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            {cardDraft && (
              <fieldset className="rounded-xl border border-[var(--color-border)] p-4">
                <legend className="px-2 font-semibold">Nội dung thẻ hiện tại</legend>
                <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
                  Chỉnh trực tiếp thẻ import đang học. Nội dung sẽ được lưu cùng bộ thẻ.
                </p>
                <CardFields key={cardDraft.id} card={cardDraft} noteTypes={noteTypes} onChange={setCardDraft} compact showPreview={false} />
              </fieldset>
            )}
              <fieldset className="rounded-xl border border-[var(--color-border)] p-4">
                <legend className="px-2 font-semibold">Nội dung {previewBack ? "mặt sau" : "mặt trước"}</legend>
                <div className="space-y-2">
                  {activeSide === "back" && <label className="flex items-center gap-3">
                    <input type="checkbox" checked={template.back.showFront} onChange={event => setTemplate(previous => ({ ...previous, back: { ...previous.back, showFront: event.target.checked } }))} />
                    <span>Lặp lại câu hỏi trên mặt sau</span>
                  </label>}
                  {activeSide === "back" && <label className="flex items-center gap-3">
                    <input type="checkbox" checked={template.back.showExamples} onChange={event => setTemplate(previous => ({ ...previous, back: { ...previous.back, showExamples: event.target.checked } }))} />
                    <span>Hiện ví dụ</span>
                  </label>}
                  {candidates.map((field) => (
                    <label key={field} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={template[activeSide].fields.includes(field)}
                        onChange={() => toggleField(activeSide, field)}
                      />
                      <span>{labelOf(field)}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {activeSide === "back" ? 'Khi mặt sau chưa có cách đọc riêng, dùng cách đọc mặt trước. Bỏ chọn “Cách đọc” để ẩn trên mặt sau.' : 'Bỏ chọn “Cách đọc” để ẩn trên mặt trước.'}
                </p>
                {template[activeSide].fields.length > 1 && (
                  <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3">
                    {template[activeSide].fields.map((field, index) => (
                      <div
                        key={field}
                        className="flex items-center justify-between rounded-lg bg-[var(--color-surface-alt)] px-3 py-2"
                      >
                        <span>
                          <GripVertical className="mr-2 inline" size={15} />
                          {labelOf(field)}
                        </span>
                        <span className="flex gap-1">
                          <button
                            className="study-button !p-1.5"
                            disabled={index === 0}
                            onClick={() => shiftField(activeSide, index, -1)}
                            aria-label={`Đưa ${labelOf(field)} lên`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="study-button !p-1.5"
                            disabled={
                              index === template[activeSide].fields.length - 1
                            }
                            onClick={() => shiftField(activeSide, index, 1)}
                            aria-label={`Đưa ${labelOf(field)} xuống`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            <fieldset className="rounded-xl border border-[var(--color-border)] p-4">
              <legend className="px-2 font-semibold">Kiểu {previewBack ? "mặt sau" : "mặt trước"}</legend>
              <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">Chuyển mặt ở khung xem trước để chỉnh riêng từng mặt.</p>
              <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Chủ đề
                <select
                  className="study-input mt-1"
                  value={activeStyle.theme}
                  onChange={(event) => updateActiveStyle({ theme: event.target.value as DeckTemplateConfig[typeof activeSide]["style"]["theme"] })}
                >
                  <option value="paper">Giấy sáng</option>
                  <option value="blue">Xanh nhạt</option>
                  <option value="dark">Tối</option>
                  <option value="system">Theo hệ thống</option>
                </select>
              </label>
              <label>
                Font chữ
                <select
                  className="study-input mt-1"
                  value={activeStyle.fontFamily}
                  aria-label="Font chữ"
                  onChange={(event) => updateActiveStyle({ fontFamily: event.target.value as DeckTemplateConfig[typeof activeSide]["style"]["fontFamily"] })}
                >
                  <FontSelectOptions custom={customFonts.fonts} current={activeStyle.fontFamily} />
                </select>
              </label>
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                {([["bg", "Màu nền"], ["fg", "Màu chữ"], ["accent", "Màu nhấn"]] as const).map(([key, text]) => {
                  const own = activeStyle.colors?.[key];
                  return <div key={key} className="space-y-1">
                    <span className="block text-sm">{text} {previewBack ? "mặt sau" : "mặt trước"}</span>
                    <div className="flex items-center gap-2">
                      <input type="color" aria-label={`${text} ${previewBack ? "mặt sau" : "mặt trước"}`} className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-1"
                        value={own ?? (key === "bg" ? "#faf7f1" : key === "fg" ? "#1f2937" : "#b45309")}
                        onChange={(event) => updateActiveStyle({ colors: { ...activeStyle.colors, [key]: event.target.value } })} />
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">{own ?? "Theo chủ đề"}</span>
                      {own && <button type="button" className="study-button !min-h-9 !px-2 !py-1 !text-xs" aria-label={`Bỏ ${text.toLowerCase()} ${previewBack ? "mặt sau" : "mặt trước"}`}
                        onClick={() => { const { [key]: _drop, ...rest } = activeStyle.colors ?? {}; updateActiveStyle({ colors: Object.keys(rest).length ? rest : undefined }); }}>Bỏ</button>}
                    </div>
                  </div>;
                })}
              </div>
              {dialogContrast && !dialogContrast.ok && <p role="status" className="sm:col-span-2 rounded-lg bg-[var(--color-warning-subtle)] px-3 py-2 text-sm text-[var(--color-warning)]">Chữ và nền chỉ đạt tương phản {dialogContrast.ratio.toFixed(1)}:1; khuyến nghị từ {MIN_CONTRAST}:1.</p>}
              <label>
                Cỡ chữ nhanh
                <select
                  className="study-input mt-1"
                  value={activePreset}
                  aria-label={`Cỡ chữ nhanh ${previewBack ? "mặt sau" : "mặt trước"}`}
                  onChange={(event) => {
                    if (event.target.value === "custom") return;
                    const fontScale = event.target.value as DeckTemplateConfig[typeof activeSide]["style"]["fontScale"];
                    updateActiveStyle({ fontScale, fontSize: CARD_FONT_PRESETS[fontScale] });
                  }}
                >
                  <option value="small">Nhỏ</option>
                  <option value="medium">Vừa</option>
                  <option value="large">Lớn</option>
                  <option value="xlarge">Rất lớn</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
              </label>
              <label>
                Cỡ chữ chính xác (px)
                <span className="mt-1 grid grid-cols-[44px_minmax(64px,1fr)_44px] overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]">
                  <button
                    type="button"
                    className="grid min-h-11 w-11 shrink-0 place-items-center border-r border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                    aria-label="Giảm cỡ chữ"
                    onClick={() => updateActiveStyle({ fontSize: clampFontSize(activeStyle.fontSize - 1) })}
                  >
                    <Minus size={17} />
                  </button>
                  <FontSizeInput
                    key={activeSide}
                    value={activeStyle.fontSize}
                    label={`Cỡ chữ chính xác ${previewBack ? "mặt sau" : "mặt trước"}`}
                    onCommit={fontSize => updateActiveStyle({ fontSize })}
                  />
                  <button
                    type="button"
                    className="grid min-h-11 w-11 shrink-0 place-items-center border-l border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                    aria-label="Tăng cỡ chữ"
                    onClick={() => updateActiveStyle({ fontSize: clampFontSize(activeStyle.fontSize + 1) })}
                  >
                    <Plus size={17} />
                  </button>
                </span>
              </label>
              <label className="flex items-center justify-between gap-3 sm:col-span-2">
                <span>Tự phóng chữ ngắn<span className="block text-xs font-normal text-[var(--color-text-tertiary)]">Từ hoặc kanji ngắn được phóng to hơn cỡ đã chọn.</span></span>
                <input type="checkbox" checked={Boolean(activeStyle.autoFit)} aria-label={`Tự phóng chữ ngắn ${previewBack ? "mặt sau" : "mặt trước"}`} onChange={(event) => updateActiveStyle({ autoFit: event.target.checked })}/>
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block">Kiểu chữ</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={activeStyle.bold}
                    className={activeStyle.bold ? "study-button study-button-primary" : "study-button"}
                    onClick={() => updateActiveStyle({ bold: !activeStyle.bold })}
                  >
                    <Bold size={18} /> In đậm
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeStyle.italic}
                    className={activeStyle.italic ? "study-button study-button-primary" : "study-button"}
                    onClick={() => updateActiveStyle({ italic: !activeStyle.italic })}
                  >
                    <Italic size={18} /> In nghiêng
                  </button>
                </div>
              </div>
              <label>
                Căn chữ
                <select
                  className="study-input mt-1"
                  value={activeStyle.alignment}
                  onChange={(event) => updateActiveStyle({ alignment: event.target.value as "left" | "center" })}
                >
                  <option value="center">Giữa</option>
                  <option value="left">Trái</option>
                </select>
              </label>
              <button
                type="button"
                className="study-button self-end sm:col-span-2"
                onClick={() => { setTemplate(previous => copySideStyle(previous, activeSide)); setSeparateSides(false); }}
              >
                <Copy size={17} /> Áp dụng kiểu này cho cả hai mặt
              </button>
              </div>
            </fieldset>
          </div>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <div
              className={`flex min-h-80 items-center rounded-2xl border border-[var(--color-border)] p-6 shadow-sm ${themeClass}`}
              style={surfaceStyle(mergeSideStyle(activeStyle, cardDraft?.style ?? example.style))}
            >
              <CardFace
                card={example}
                deckName={deck.name}
                fields={
                  previewBack ? template.back.fields : template.front.fields
                }
                template={template}
                side={activeSide}
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4">
          <button
            className="study-button"
            disabled={busy}
            onClick={() => { setTemplate(defaultDeckTemplate()); setSeparateSides(false); }}
          >
            Khôi phục mặc định
          </button>
          {error && <p role="alert" className="w-full text-sm text-[var(--color-error)]">{error}</p>}
          <button className="study-button" disabled={busy} onClick={onCancel}>
            Hủy
          </button>
          <button
            className="study-button study-button-primary"
            disabled={
              busy ||
              !template.front.fields.length ||
              !template.back.fields.length ||
              !!cardDraft && (!cardDraft.front.trim() || !cardDraft.back.trim())
            }
            onClick={() => onSave(template, cardDraft)}
          >
            Lưu tùy chỉnh
          </button>
        </div>
      </div>
    </dialog>
  );
}
