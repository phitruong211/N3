import { useState, useRef, useEffect } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { defaultDeckTemplate, kindLabels } from "@/lib/ankiImport";
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
  notes: "Ghi chú",
  kind: "Loại thẻ",
  deckName: "Tên bộ thẻ",
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

export function CardFace({
  card,
  deckName,
  fields,
  template,
  compact = false,
}: {
  card: ImportedCard;
  deckName: string;
  fields: CardField[];
  template: DeckTemplateConfig;
  compact?: boolean;
}) {
  const sizes = {
    small: "text-lg",
    medium: "text-2xl",
    large: "text-3xl sm:text-5xl",
    xlarge: "text-4xl sm:text-6xl",
  };
  return (
    <div
      className={`w-full space-y-4 ${template.style.alignment === "left" ? "text-left" : "text-center"} ${compact ? "!text-base" : ""}`}
    >
      {fields.map((field, index) => {
        const value = fieldValue(field, card, deckName);
        if (!value) return null;
        return (
          <div
            key={`${field}-${index}`}
            className={
              field === "notes"
                ? "rounded-xl bg-black/5 p-4 text-base"
                : field === "reading"
                  ? "font-jp text-lg text-[var(--color-accent)]"
                  : field === "kind" || field === "deckName"
                    ? "text-xs font-bold uppercase tracking-wide opacity-70"
                    : `${sizes[template.style.fontScale]} font-semibold whitespace-pre-wrap break-words`
            }
          >
            <span className="sr-only">{fieldLabels[field]}: </span>
            {value}
          </div>
        );
      })}
    </div>
  );
}

export function DeckCustomizeDialog({
  deck,
  busy,
  onCancel,
  onSave,
}: {
  deck: ImportedDeck;
  busy: boolean;
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
    notes: "Ghi chú sẽ xuất hiện ở đây.",
    kind: "vocabulary" as const,
  };
  const candidates: CardField[] = [
    "front",
    "back",
    "reading",
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
  const themeClass =
    template.style.theme === "dark"
      ? "bg-slate-900 text-white"
      : template.style.theme === "blue"
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
        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            {(["front", "back"] as const).map((side) => (
              <fieldset
                key={side}
                className="rounded-xl border border-[var(--color-border)] p-4"
              >
                <legend className="px-2 font-semibold">
                  {side === "front" ? "Mặt trước" : "Mặt sau"}
                </legend>
                <div className="space-y-2">
                  {candidates.map((field) => (
                    <label key={field} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={template[side].fields.includes(field)}
                        onChange={() => toggleField(side, field)}
                      />
                      <span>{fieldLabels[field]}</span>
                    </label>
                  ))}
                </div>
                {template[side].fields.length > 1 && (
                  <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3">
                    {template[side].fields.map((field, index) => (
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
                            onClick={() => shiftField(side, index, -1)}
                            aria-label={`Đưa ${fieldLabels[field]} lên`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="study-button !p-1.5"
                            disabled={
                              index === template[side].fields.length - 1
                            }
                            onClick={() => shiftField(side, index, 1)}
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
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Chủ đề
                <select
                  className="study-input mt-1"
                  value={template.style.theme}
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      style: {
                        ...previous.style,
                        theme: event.target
                          .value as DeckTemplateConfig["style"]["theme"],
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
                  value={template.style.fontScale}
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      style: {
                        ...previous.style,
                        fontScale: event.target
                          .value as DeckTemplateConfig["style"]["fontScale"],
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
                  value={template.style.alignment}
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      style: {
                        ...previous.style,
                        alignment: event.target.value as "left" | "center",
                      },
                    }))
                  }
                >
                  <option value="center">Giữa</option>
                  <option value="left">Trái</option>
                </select>
              </label>
              <label>
                Hướng học
                <select
                  className="study-input mt-1"
                  value={template.study.orientation}
                  onChange={(event) =>
                    setTemplate((previous) => ({
                      ...previous,
                      study: {
                        orientation: event.target
                          .value as DeckTemplateConfig["study"]["orientation"],
                      },
                    }))
                  }
                >
                  <option value="front-first">Mặt trước → mặt sau</option>
                  <option value="back-first">Mặt sau → mặt trước</option>
                  <option value="mixed">Trộn hai chiều</option>
                </select>
              </label>
            </div>
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
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className={
                  !previewBack
                    ? "study-button study-button-primary"
                    : "study-button"
                }
                onClick={() => setPreviewBack(false)}
              >
                Mặt trước
              </button>
              <button
                className={
                  previewBack
                    ? "study-button study-button-primary"
                    : "study-button"
                }
                onClick={() => setPreviewBack(true)}
              >
                Mặt sau
              </button>
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
