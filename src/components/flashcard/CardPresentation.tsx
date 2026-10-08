import { useState, useRef, useEffect } from "react";
import { ArrowDown, ArrowUp, GripVertical, X, Eye, EyeOff } from "lucide-react";
import { defaultDeckTemplate, kindLabels, parseCardExamples } from "@/lib/ankiImport";
import type {
  CardField,
  DeckTemplateConfig,
  ImportedCard,
  ImportedDeck,
} from "@/lib/ankiImport";
const fieldLabels: Record<CardField, string> = {
  front: "Mặt trước",
  back: "Mặt sau",
  reading: "Cách đọc",
  hanViet: "Hán Việt",
  notes: "Ghi chú",
  kind: "Loại thẻ",
  deckName: "Tên bộ thẻ",
};
const cardTextSizes: Record<DeckTemplateConfig['front']['style']['fontScale'], string> = {
  small: "text-xl",
  medium: "text-2xl",
  large: "text-3xl",
  xlarge: "text-4xl",
};
function fieldValue(
  field: CardField,
  card: ImportedCard,
  deckName: string,
): string {
  if (field === "kind") return kindLabels[card.kind];
  if (field === "deckName") return deckName;
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
    {visible && <p className="mt-2 whitespace-pre-wrap break-words opacity-75">{meaning}</p>}
  </div>;
}

function Examples({ value, showReading }: { value: unknown; showReading: boolean }) {
  let examples;
  try { examples = parseCardExamples(value); } catch { return null; }
  if (!examples.length) return null;
  return <div className="space-y-3 border-t border-current/10 pt-4 text-left">
    <p className="text-xs font-semibold opacity-60">Ví dụ · bấm mắt để xem nghĩa</p>
    {examples.map((example, index) => <div key={index} className="rounded-xl bg-black/5 p-4">
      <p lang="ja" className="font-jp whitespace-pre-wrap break-words text-base leading-relaxed sm:text-lg">{index + 1}. {example.japanese}</p>
      {showReading && example.reading && <p lang="ja" className="font-jp mt-1 text-sm text-[var(--color-accent)]">{example.reading}</p>}
      <ExampleMeaning meaning={example.meaning} label={`ví dụ ${index + 1}`} />
    </div>)}
  </div>;
}

function GrammarBack({ value, compact, fontScale }: { value: string; compact: boolean; fontScale: DeckTemplateConfig['back']['style']['fontScale'] }) {
  return (
    <div className={`space-y-5 text-left font-normal leading-relaxed ${compact ? "text-sm" : cardTextSizes[fontScale]}`}>
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
            >
              {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
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
  const style = template[side].style;
  return (
    <div
      className={`w-full space-y-4 ${grammarAnswer ? "mx-auto max-w-3xl text-left" : style.alignment === "left" ? "text-left" : "text-center"} ${compact ? "!text-base" : ""}`}
    >
      {fields.map((field, index) => {
        const value = fieldValue(field, card, deckName);
        if (!value) return null;
        if (grammarAnswer && field === "back") {
          return <GrammarBack key={`${field}-${index}`} value={value} compact={compact} fontScale={style.fontScale} />;
        }
        return (
          <div
            key={`${field}-${index}`}
            className={
              field === "notes"
                ? "whitespace-pre-wrap break-words rounded-xl bg-black/5 p-4 text-base"
                : field === "reading"
                  ? "font-jp text-lg text-[var(--color-accent)]"
                  : field === "hanViet"
                    ? "text-base font-medium text-[var(--color-kanji)]"
                  : field === "kind" || field === "deckName"
                    ? "text-xs font-bold uppercase tracking-wide opacity-70"
                : `${cardTextSizes[style.fontScale]} font-jp whitespace-pre-wrap break-words`
            }
          >
            <span className="sr-only">{fieldLabels[field]}: </span>
            {field === "hanViet" ? `Hán Việt: ${value}` : value}
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
  onCancel,
  onSave,
}: {
  deck: ImportedDeck;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (template: DeckTemplateConfig) => void;
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
  const [template, setTemplate] = useState<DeckTemplateConfig>(deck.template);
  const [previewBack, setPreviewBack] = useState(false);
  const example = deck.cards[0] || {
    id: "preview",
    front: "日本語を勉強する",
    back: "Học tiếng Nhật",
    reading: "にほんごをべんきょうする",
    hanViet: "Nhật Bản Ngữ · Miễn Cường",
    notes: "Ghi chú sẽ xuất hiện ở đây.",
    kind: "vocabulary" as const,
  };
  const candidates: CardField[] = [
    "front",
    "back",
    "reading",
    "hanViet",
    "notes",
    "kind",
    "deckName",
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
        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
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
                      <span>{fieldLabels[field]}</span>
                    </label>
                  ))}
                </div>
                {template[activeSide].fields.length > 1 && (
                  <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3">
                    {template[activeSide].fields.map((field, index) => (
                      <div
                        key={field}
                        className="flex items-center justify-between rounded-lg bg-[var(--color-surface-alt)] px-3 py-2"
                      >
                        <span>
                          <GripVertical className="mr-2 inline" size={15} />
                          {fieldLabels[field]}
                        </span>
                        <span className="flex gap-1">
                          <button
                            className="study-button !p-1.5"
                            disabled={index === 0}
                            onClick={() => shiftField(activeSide, index, -1)}
                            aria-label={`Đưa ${fieldLabels[field]} lên`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="study-button !p-1.5"
                            disabled={
                              index === template[activeSide].fields.length - 1
                            }
                            onClick={() => shiftField(activeSide, index, 1)}
                            aria-label={`Đưa ${fieldLabels[field]} xuống`}
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
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      [activeSide]: {
                        ...previous[activeSide],
                        style: {
                          ...previous[activeSide].style,
                          theme: event.target.value as DeckTemplateConfig[typeof activeSide]["style"]["theme"],
                        },
                      },
                    }))
                  }
                >
                  <option value="paper">Giấy sáng</option>
                  <option value="blue">Xanh nhạt</option>
                  <option value="dark">Tối</option>
                  <option value="system">Theo hệ thống</option>
                </select>
              </label>
              <label>
                Cỡ chữ
                <select
                  className="study-input mt-1"
                  value={activeStyle.fontScale}
                  aria-label={`Cỡ chữ ${previewBack ? "mặt sau" : "mặt trước"}`}
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      [activeSide]: {
                        ...previous[activeSide],
                        style: {
                          ...previous[activeSide].style,
                          fontScale: event.target.value as DeckTemplateConfig[typeof activeSide]["style"]["fontScale"],
                        },
                      },
                    }))
                  }
                >
                  <option value="small">Nhỏ</option>
                  <option value="medium">Vừa</option>
                  <option value="large">Lớn</option>
                  <option value="xlarge">Rất lớn</option>
                </select>
              </label>
              <label>
                Căn chữ
                <select
                  className="study-input mt-1"
                  value={activeStyle.alignment}
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      [activeSide]: {
                        ...previous[activeSide],
                        style: {
                          ...previous[activeSide].style,
                          alignment: event.target.value as "left" | "center",
                        },
                      },
                    }))
                  }
                >
                  <option value="center">Giữa</option>
                  <option value="left">Trái</option>
                </select>
              </label>
              </div>
            </fieldset>
          </div>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <div
              className={`flex min-h-80 items-center rounded-2xl border border-[var(--color-border)] p-6 shadow-sm ${themeClass}`}
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
            onClick={() => setTemplate(defaultDeckTemplate())}
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
              !template.back.fields.length
            }
            onClick={() => onSave(template)}
          >
            Lưu tùy chỉnh
          </button>
        </div>
      </div>
    </dialog>
  );
}
