import { useMemo, useState } from "react";
import { kindLabels, type ImportedCard } from "@/lib/ankiImport";
import {
  parseStoredFurigana,
  resolveFurigana,
  serializeFurigana,
  type FuriganaResult,
} from "@/lib/furigana";
import { FuriganaText } from "./FuriganaText";

type Side = "front" | "back";

function editableText(card: ImportedCard, side: Side) {
  const key = side === "front" ? "frontFuriganaSegments" : "backFuriganaSegments";
  const segments = parseStoredFurigana(card.extraData?.[key]);
  return segments.length ? serializeFurigana(segments) : card[side];
}

function withFurigana(card: ImportedCard, side: Side, result: FuriganaResult): ImportedCard {
  const key = side === "front" ? "frontFuriganaSegments" : "backFuriganaSegments";
  const extraData = { ...card.extraData };
  if (!result.warning && result.segments.some((segment) => segment.reading)) {
    extraData[key] = JSON.stringify(result.segments);
  } else {
    delete extraData[key];
  }
  return { ...card, [side]: result.text, extraData };
}

export function CardFields({
  card,
  onChange,
  compact = false,
  showPreview = true,
}: {
  card: ImportedCard;
  onChange: (card: ImportedCard) => void;
  compact?: boolean;
  showPreview?: boolean;
}) {
  const [frontInput, setFrontInput] = useState(() => editableText(card, "front"));
  const [backInput, setBackInput] = useState(() => editableText(card, "back"));
  const frontResult = useMemo(
    () => resolveFurigana(frontInput, card.reading),
    [frontInput, card.reading],
  );
  const backResult = useMemo(
    () => resolveFurigana(backInput, card.backReading),
    [backInput, card.backReading],
  );
  const updateText = (side: Side, value: string) => {
    if (side === "front") setFrontInput(value);
    else setBackInput(value);
    const reading = side === "front" ? card.reading : card.backReading;
    onChange(withFurigana(card, side, resolveFurigana(value, reading)));
  };
  const updateReading = (side: Side, value: string) => {
    const readingKey = side === "front" ? "reading" : "backReading";
    const inputValue = side === "front" ? frontInput : backInput;
    const next = { ...card, [readingKey]: value };
    onChange(withFurigana(next, side, resolveFurigana(inputValue, value)));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]">
        Đặt hiragana trên Kanji bằng <code className="font-semibold text-[var(--color-text)]">学校[がっこう]</code>.
        Trường “Cách đọc” vẫn dùng được khi hệ thống ghép chắc chắn; cú pháp trong ngoặc vuông cho kết quả chính xác nhất.
      </div>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        <label>
          Mặt trước <span aria-hidden="true">*</span>
          <textarea
            className="study-input mt-1 min-h-24"
            required
            maxLength={20000}
            value={frontInput}
            onChange={(event) => updateText("front", event.target.value)}
          />
          {frontResult.warning && <span className="mt-1 block text-xs text-[var(--color-warning)]">{frontResult.warning}</span>}
        </label>
        <label>
          Mặt sau <span aria-hidden="true">*</span>
          <textarea
            className="study-input mt-1 min-h-24"
            required
            maxLength={20000}
            value={backInput}
            onChange={(event) => updateText("back", event.target.value)}
          />
          {backResult.warning && <span className="mt-1 block text-xs text-[var(--color-warning)]">{backResult.warning}</span>}
        </label>
        <label>
          Cách đọc mặt trước
          <textarea className="study-input mt-1" maxLength={10000} value={card.reading} onChange={(event) => updateReading("front", event.target.value)} />
        </label>
        <label>
          Cách đọc mặt sau
          <textarea className="study-input mt-1" maxLength={10000} value={card.backReading} onChange={(event) => updateReading("back", event.target.value)} />
        </label>
        <label>
          Hán Việt
          <textarea className="study-input mt-1" maxLength={10000} value={card.hanViet} onChange={(event) => onChange({ ...card, hanViet: event.target.value })} />
        </label>
        <label>
          Ghi chú
          <textarea className="study-input mt-1" maxLength={20000} value={card.notes} onChange={(event) => onChange({ ...card, notes: event.target.value })} />
        </label>
        <label>
          Loại thẻ
          <select className="study-input mt-1" value={card.kind} onChange={(event) => onChange({ ...card, kind: event.target.value as ImportedCard["kind"] })}>
            {Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          Tags (cách nhau bằng dấu phẩy)
          <input
            className="study-input mt-1"
            value={card.tags?.join(", ") || ""}
            onChange={(event) => onChange({ ...card, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
          />
        </label>
      </div>
      {showPreview && (
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          {(["front", "back"] as const).map((side) => (
            <div key={side} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="study-eyebrow mb-3">XEM TRƯỚC {side === "front" ? "MẶT TRƯỚC" : "MẶT SAU"}</p>
              <p lang="ja" className="font-jp whitespace-pre-wrap break-words text-xl leading-loose">
                <FuriganaText
                  text={side === "front" ? frontResult.text : backResult.text}
                  reading={side === "front" ? card.reading : card.backReading}
                  storedSegments={side === "front" ? card.extraData?.frontFuriganaSegments : card.extraData?.backFuriganaSegments}
                />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
