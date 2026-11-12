import { useEffect, useMemo, useRef, useState } from "react";
import type { ImportedCard } from "@/lib/ankiImport";
import { mergeSideStyle, noteTypeIdForKind, noteTypeOf, resolveTemplate, type CardField, type DeckConfig } from "@/lib/deckFormat";
import { CARD_PRESETS, activePreset, applyPreset } from "@/lib/cardPresets";
import { surfaceStyle } from "@/lib/cardSurface";
import { fontStack } from "@/lib/fontRegistry";
import { X } from "@/components/ui/icons";
import { CardFace } from "./CardPresentation";
import { CardFields } from "./CardFields";
import { NoteTypeEditor } from "./NoteTypeEditor";
import { StyleEditor } from "./StyleEditor";
import "./studySession.css";

type Tab = "look" | "layout" | "deck" | "card";
const TABS: Array<[Tab, string]> = [["look", "Mẫu"], ["layout", "Bố cục & trường"], ["deck", "Kiểu cả bộ"], ["card", "Thẻ này"]];

const SAMPLE: ImportedCard = {
  id: "preview", front: "日本語を勉強する", back: "Học tiếng Nhật", reading: "にほんごをべんきょうする", backReading: "",
  hanViet: "Nhật Bản Ngữ · Miễn Cường", notes: "Ghi chú sẽ xuất hiện ở đây.", kind: "vocabulary",
};

/**
 * The deck's card designer: the real cards on the left, exactly as a study session draws them, and every tier of the
 * look on the right — one-tap presets, the note type's layout and per-field styles, the whole deck, and this one card.
 * Nothing is saved until "Lưu thiết kế"; the preview follows every change.
 */
export function CardDesigner({ deckName, config, cards, startCardId, canEditCard, busy, error, onCancel, onSave }: {
  deckName: string;
  config: DeckConfig;
  cards: ImportedCard[];
  startCardId?: string;
  /** Whether a card's content and own look can be saved (personal decks). */
  canEditCard: boolean;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  /** The edited deck config, and the cards whose content or own look changed. */
  onSave: (config: DeckConfig, changedCards: ImportedCard[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); opener?.focus(); };
  }, []);

  const pool = useMemo(() => cards.length ? cards : [SAMPLE], [cards]);
  const [draft, setDraft] = useState(config);
  const [edits, setEdits] = useState<Record<string, ImportedCard>>({});
  const [index, setIndex] = useState(() => Math.max(0, pool.findIndex(card => card.id === startCardId)));
  const [side, setSide] = useState<"front" | "back">("front");
  const [tab, setTab] = useState<Tab>("look");

  const card = edits[pool[index].id] ?? pool[index];
  const type = noteTypeOf(draft, card.noteType ?? noteTypeIdForKind(card.kind));
  const template = resolveTemplate(draft, type.id);
  const sideFields = template[side].fields;
  const fields: CardField[] = side === "back" && template.back.showFront && !sideFields.includes("front") ? ["front", ...sideFields] : sideFields;
  const style = mergeSideStyle(template[side].style, card.style);
  const usage = useMemo(() => pool.filter(item => noteTypeOf(draft, item.noteType ?? noteTypeIdForKind(item.kind)).id === type.id).length, [pool, draft, type.id]);
  const changed = Object.values(edits).filter(edit => JSON.stringify(edit) !== JSON.stringify(pool.find(item => item.id === edit.id)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(config) || changed.length > 0;
  const current = activePreset(draft);
  const step = (delta: number) => setIndex(i => (i + delta + pool.length) % pool.length);

  return <dialog ref={dialog} className="card-designer" aria-labelledby="card-designer-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <header className="card-designer-head">
      <div className="min-w-0">
        <p className="study-eyebrow">Thiết kế thẻ</p>
        <h2 id="card-designer-title" className="truncate text-xl font-semibold">{deckName}</h2>
      </div>
      <button className="study-button !p-2" onClick={onCancel} disabled={busy} aria-label="Đóng"><X size={20}/></button>
    </header>

    <div className="card-designer-body">
      <section className="card-designer-stage" aria-label="Xem trước">
        <div className="card-designer-sides" role="tablist" aria-label="Mặt thẻ">
          {(["front", "back"] as const).map(value => <button key={value} role="tab" aria-selected={side === value} onClick={() => setSide(value)}>
            {value === "front" ? "Mặt trước" : "Mặt sau"}
          </button>)}
        </div>
        {/* A click flips it like in a session; the side tabs above are the keyboard way to do the same. */}
        <div className="study-session-card card-designer-card" data-card-theme={style.theme} style={surfaceStyle(style)}
          onClick={() => setSide(side === "front" ? "back" : "front")}>
          <p className="study-session-face-label" aria-hidden="true">{type.name} · {side === "front" ? "Câu hỏi" : "Đáp án"}</p>
          <div className="study-session-face"><CardFace card={card} deckName={deckName} fields={fields} template={template} side={side}/></div>
        </div>
        {pool.length > 1 && <div className="card-designer-pager">
          <button className="study-button !min-h-9 !px-3" onClick={() => step(-1)}>‹ Thẻ trước</button>
          <span className="tabular-nums">{index + 1} / {pool.length}</span>
          <button className="study-button !min-h-9 !px-3" onClick={() => step(1)}>Thẻ sau ›</button>
        </div>}
      </section>

      <section className="card-designer-panel" aria-label="Tùy chỉnh">
        <div className="card-designer-tabs" role="tablist" aria-label="Phần tùy chỉnh">
          {TABS.filter(([id]) => id !== "card" || canEditCard).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </div>

        <div className="card-designer-pane">
          {tab === "look" && <>
            <p className="study-copy">Chọn một kiểu cho cả bộ. Cỡ chữ và màu riêng của từng trường vẫn được giữ.</p>
            <div className="card-designer-presets">
              {CARD_PRESETS.map(preset => {
                const s = preset.style;
                const dark = s.theme === "dark";
                return <button key={preset.id} className="card-designer-preset" aria-pressed={current === preset.id} onClick={() => setDraft(applyPreset(draft, preset))}>
                  <span className="card-designer-swatch" aria-hidden="true" data-theme={s.theme}
                    style={{ background: s.colors?.bg ?? (dark ? "#0F1630" : s.theme === "system" ? "var(--color-surface)" : "#FAF7F1"), color: s.colors?.fg ?? (dark ? "#ECE6D8" : "var(--color-text)"), fontFamily: fontStack(s.font?.family), textAlign: s.align }}>
                    <span style={{ color: s.colors?.accent ?? (dark ? "#E4CE9E" : "var(--color-accent-text)") }}>にほん</span>
                    <b>日本</b>
                  </span>
                  <span className="text-sm font-semibold">{preset.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{preset.note}</span>
                </button>;
              })}
            </div>
            {!current && <p className="text-xs text-[var(--color-text-tertiary)]">Bộ này đang dùng kiểu tự chỉnh. Chọn một mẫu sẽ thay kiểu chung của bộ và của loại thẻ.</p>}
          </>}

          {tab === "layout" && <>
            <p className="study-copy">Loại thẻ <b>{type.name}</b> · dùng cho {usage} thẻ trong bộ. Chọn trường hiện ở mỗi mặt, thứ tự, và giao diện riêng của từng trường.</p>
            <NoteTypeEditor type={type} deckStyle={draft.style} onChange={next => setDraft({ ...draft, noteTypes: draft.noteTypes.map(item => item.id === next.id ? next : item) })}/>
          </>}

          {tab === "deck" && <>
            <p className="study-copy">Kiểu chung cho mọi thẻ trong bộ. Loại thẻ, từng mặt và từng trường có thể ghi đè.</p>
            <StyleEditor label="Kiểu cả bộ" value={draft.style} onChange={next => setDraft(({ style: _drop, ...rest }) => next ? { ...rest, style: next } : rest as DeckConfig)}/>
          </>}

          {tab === "card" && canEditCard && <>
            <p className="study-copy">Nội dung và giao diện riêng của thẻ <b>{card.front}</b>, ví dụ đổi màu để đánh dấu một thẻ khó.</p>
            <CardFields key={card.id} card={card} noteTypes={draft.noteTypes} compact showPreview={false} onChange={next => setEdits(all => ({ ...all, [card.id]: next }))}/>
          </>}
        </div>

        <footer className="card-designer-foot">
          {error && <p role="alert" className="mr-auto text-sm text-[var(--color-error)]">{error}</p>}
          <button className="study-button" onClick={onCancel} disabled={busy}>Hủy</button>
          <button className="study-button study-button-primary" disabled={busy || !dirty} onClick={() => onSave(draft, changed)}>
            {busy ? "Đang lưu…" : "Lưu thiết kế"}
          </button>
        </footer>
      </section>
    </div>
  </dialog>;
}
