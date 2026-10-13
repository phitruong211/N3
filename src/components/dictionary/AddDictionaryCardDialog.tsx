import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, ApiError } from "@/lib/api";
import { AppDialog } from "@/components/ui/AppDialog";
import { CardFace } from "@/components/flashcard/CardPresentation";
import { normalizeDeckTemplate, type ImportedCard } from "@/lib/ankiImport";
import {
  addDictionaryCard,
  createDictionaryDeck,
  deckOptions,
  defaultSelection,
  validSenses,
  validWrittenForms,
  senseText,
  getDictionaryWord,
  type DictionaryWord,
  type DeckOption,
  type AddDictionaryResult,
} from "@/lib/dictionary/api";
import {
  readCardDraft,
  writeCardDraft,
  clearCardDraft,
} from "@/lib/dictionary/draft";

export function AddDictionaryCardDialog({
  word,
  onClose,
  onUpdateWord,
}: {
  word: DictionaryWord;
  onClose: () => void;
  onUpdateWord: (word: DictionaryWord) => void;
}) {
  const { user } = useAuth();
  const ownerId = user!.id;
  const initial = defaultSelection(word);
  const restored = useRef(readCardDraft(word, user!.id)).current;
  const [written, setWritten] = useState(restored?.written ?? initial.written);
  const [reading, setReading] = useState(restored?.reading ?? initial.reading);
  const [senseId, setSenseId] = useState(restored?.senseId ?? initial.sense.id);
  const [front, setFront] = useState(restored?.front ?? initial.written);
  const [back, setBack] = useState(restored?.back ?? senseText(initial.sense));
  const [notes, setNotes] = useState(restored?.notes ?? "");
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [selected, setSelected] = useState<DeckOption | null>(null);
  const [selectionRestored, setSelectionRestored] = useState(
    !restored?.selected,
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deckError, setDeckError] = useState("");
  const [newName, setNewName] = useState(restored?.newName ?? "");
  const [creating, setCreating] = useState(restored?.creating ?? false);
  const [result, setResult] = useState<AddDictionaryResult | null>(null);
  const [expired, setExpired] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState("");
  const [needsMeaningConfirmation, setNeedsMeaningConfirmation] = useState(
    restored?.needsMeaningConfirmation ?? false,
  );
  const operation = useRef(restored?.operation ?? { payload: "", key: "" });
  const creation = useRef(restored?.creation ?? { name: "", key: "" });
  const mounted = useRef(true);
  const lock = useRef(false);
  const recentKey = `dictionary:recent-deck:${user!.id}`;
  const persist = useCallback(() => {
    if (result) {
      clearCardDraft();
      return;
    }
    writeCardDraft({
      ownerId,
      wordKey: word.key,
      version: word.version,
      updatedAt: Date.now(),
      written,
      reading,
      senseId,
      front,
      back,
      notes,
      selected: selectionRestored ? selected : (restored?.selected ?? null),
      needsMeaningConfirmation,
      newName,
      creating,
      operation: operation.current,
      creation: creation.current,
    });
  }, [
    result,
    ownerId,
    word.key,
    word.version,
    written,
    reading,
    senseId,
    front,
    back,
    notes,
    selectionRestored,
    selected,
    restored?.selected,
    needsMeaningConfirmation,
    newName,
    creating,
  ]);
  useEffect(() => {
    persist();
  }, [persist]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setDeckError("");
    const timer = setTimeout(() => {
      deckOptions(query, page, c.signal)
        .then((data) => {
          if (c.signal.aborted) return;
          setDecks(data.items);
          setHasMore(data.hasMore);
          setSelected(
            (previous) =>
              previous ||
              (selectionRestored &&
              data.items.length === 1 &&
              !data.hasMore &&
              !query &&
              page === 0
                ? data.items[0]
                : null),
          );
        })
        .catch((e) => {
          if (!c.signal.aborted) setDeckError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, page, attempt, selectionRestored]);
  useEffect(() => {
    const c = new AbortController();
    let id: string | null = null;
    try {
      id = restored?.selected?.id || localStorage.getItem(recentKey);
    } catch {
      /* optional preference */
    }
    if (id)
      apiRequest<DeckOption>(`/decks/${id}/metadata`, { signal: c.signal })
        .then((deck) => {
          if (!c.signal.aborted && deck.sourceType !== "SYSTEM")
            setSelected((previous) => previous || deck);
        })
        .catch(() => {
          /* deleted recent deck does not block picker */
        })
        .finally(() => {
          if (!c.signal.aborted) setSelectionRestored(true);
        });
    else setSelectionRestored(true);
    return () => c.abort();
  }, [recentKey, restored?.selected?.id]);
  const senses = validSenses(word, written, reading);
  const template = normalizeDeckTemplate(selected?.templateConfig);
  const visibleFields = [...template.front.fields, ...template.back.fields];
  const canDisplayWordAndMeaning =
    visibleFields.includes("front") && visibleFields.includes("back");
  const preview: ImportedCard = {
    id: "dictionary-preview",
    front,
    back,
    reading,
    backReading: "",
    hanViet: "",
    notes,
    kind: "vocabulary",
    extraData: {},
  };
  function chooseForm(nextWritten: string, nextReading: string) {
    setWritten(nextWritten);
    setReading(nextReading);
    setFront(nextWritten);
    const sense = validSenses(word, nextWritten, nextReading)[0];
    if (sense) {
      setSenseId(sense.id);
      setBack(senseText(sense));
    }
  }
  async function create() {
    if (lock.current || !newName.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const name = newName.trim();
    if (creation.current.name !== name)
      creation.current = { name, key: crypto.randomUUID() };
    persist();
    try {
      const deck = await createDictionaryDeck(name, creation.current.key);
      if (!mounted.current) return;
      const option: DeckOption = {
        id: deck.deckId,
        name: deck.name,
        groupId: null,
        sourceType: "MANUAL",
        templateConfig: {},
      };
      setSelected(option);
      setCreating(false);
      setNewName("");
      setAttempt((a) => a + 1);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function save() {
    if (lock.current || !selected) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const body = {
      targetDeckId: selected.id,
      datasetVersion: word.version,
      writtenForm: written,
      reading,
      senseIds: [senseId],
      front: front.trim(),
      back: back.trim(),
      notes: notes.trim(),
    };
    const payload = JSON.stringify(body);
    if (operation.current.payload !== payload)
      operation.current = { payload, key: crypto.randomUUID() };
    persist();
    try {
      const added = await addDictionaryCard(word, body, operation.current.key);
      if (!mounted.current) return;
      setResult(added);
      try {
        localStorage.setItem(recentKey, selected.id);
        localStorage.setItem(
          `dictionary:deck-changed:${user!.id}`,
          crypto.randomUUID(),
        );
      } catch {
        /* optional cross-tab signal */
      }
      window.dispatchEvent(new Event("dictionary-deck-changed"));
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        if (e instanceof ApiError && e.status === 404) setSelected(null);
        if (e instanceof ApiError && e.code === "DICTIONARY_VERSION_EXPIRED")
          setExpired(true);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function refreshWord() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const fresh = await getDictionaryWord(
        word.key,
        new AbortController().signal,
      );
      if (!mounted.current) return;
      const next = defaultSelection({
        ...fresh,
        preferredSelection: { written, reading, senseId },
      });
      const oldSense = word.senses.find((s) => s.id === senseId);
      if (front === written) setFront(next.written);
      if (oldSense && back === senseText(oldSense))
        setBack(senseText(next.sense));
      setWritten(next.written);
      setReading(next.reading);
      setSenseId(next.sense.id);
      setNeedsMeaningConfirmation(next.sense.id !== senseId);
      operation.current = { payload: "", key: "" };
      onUpdateWord(fresh);
      setExpired(false);
      setRefreshNotice(
        next.sense.id === senseId
          ? "Đã tải phiên bản mới. Nội dung bạn sửa được giữ lại."
          : "Nghĩa nguồn đã thay đổi. Nội dung bạn sửa được giữ lại; hãy kiểm tra nghĩa mới trước khi thêm.",
      );
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <AppDialog
      open
      title="Thêm vào bộ thẻ"
      onClose={() => {
        if (!busy) onClose();
      }}
      className="dictionary-dialog"
      footer={
        !result ? (
          <div className="space-y-3">
            {error && (
              <p role="alert" className="text-[var(--color-error)] text-sm">
                {error}
              </p>
            )}
            {expired && (
              <button
                className="study-button"
                disabled={busy}
                onClick={() => void refreshWord()}
              >
                Tải lại nghĩa, giữ nội dung đã sửa
              </button>
            )}
            {refreshNotice && (
              <p role="status" className="study-copy text-sm">
                {refreshNotice}
              </p>
            )}
            {(needsMeaningConfirmation ||
              refreshNotice.startsWith("Nghĩa nguồn")) && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!needsMeaningConfirmation}
                  onChange={(e) => {
                    setNeedsMeaningConfirmation(!e.target.checked);
                  }}
                />
                Tôi đã kiểm tra nghĩa mới và mặt sau của thẻ
              </label>
            )}
            <button
              className="study-button study-button-primary w-full !whitespace-normal [overflow-wrap:anywhere]"
              disabled={
                busy ||
                expired ||
                needsMeaningConfirmation ||
                !selectionRestored ||
                !selected ||
                !front.trim() ||
                !back.trim() ||
                !canDisplayWordAndMeaning ||
                !senses.some((s) => s.id === senseId)
              }
              onClick={() => void save()}
            >
              <span className="line-clamp-2">
                {busy
                  ? "Đang lưu…"
                  : selected
                    ? `Thêm vào ${selected.name}`
                    : "Chọn bộ thẻ để thêm"}
              </span>
            </button>
          </div>
        ) : undefined
      }
    >
      {result ? (
        <div className="space-y-4" role="status">
          <Check className="text-[var(--color-accent)]" />
          <p className="font-semibold">
            {!result.available
              ? "Thao tác trước đã hoàn tất; thẻ hiện đã được chuyển hoặc xóa."
              : result.outcome === "alreadyExists"
                ? `Từ này đã có trong ${selected?.name}.`
                : `Đã thêm ${front} vào ${selected?.name}.`}
          </p>
          <p className="study-copy">{result.cardCount} thẻ trong bộ.</p>
          <div className="flex gap-2">
            {result.available && (
              <Link
                className="study-button study-button-primary"
                to={`/decks?deck=${result.deckId}`}
              >
                Mở bộ thẻ
              </Link>
            )}
            <button className="study-button" onClick={onClose}>
              Tiếp tục tra từ
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-4">
            <div>
              <label
                className="dictionary-label"
                htmlFor="dictionary-deck-query"
              >
                Chọn bộ thẻ
              </label>
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-3.5 text-[var(--color-text-tertiary)]"
                />
                <input
                  id="dictionary-deck-query"
                  className="study-input !pl-10"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Tìm tên bộ thẻ…"
                />
              </div>
            </div>
            {selected && (
              <p className="dictionary-selected">
                <Check size={16} />
                Đã chọn: <strong>{selected.name}</strong>
              </p>
            )}
            {loading ? (
              <p role="status" className="study-copy">
                Đang tìm bộ thẻ…
              </p>
            ) : deckError ? (
              <div role="alert">
                <p>{deckError}</p>
                <button
                  className="study-button mt-2"
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  Thử tải bộ thẻ lại
                </button>
              </div>
            ) : (
              <>
                <div className="dictionary-deck-list" aria-label="Các bộ thẻ">
                  {decks.map((deck) => (
                    <button
                      key={deck.id}
                      title={deck.name}
                      aria-pressed={selected?.id === deck.id}
                      className="dictionary-deck-option"
                      onClick={() => setSelected(deck)}
                    >
                      <span className="min-w-0">
                        <strong className="block truncate">{deck.name}</strong>
                        <small className="study-copy">
                          {deck.groupName ||
                            (deck.groupId ? "Trong nhóm" : "Bộ cá nhân")}{" "}
                          ·{" "}
                          {deck.sourceType === "IMPORT"
                            ? "Đã nhập"
                            : "Thủ công"}
                        </small>
                      </span>
                      {selected?.id === deck.id && <Check size={18} />}
                    </button>
                  ))}
                  {!decks.length && (
                    <p className="study-copy py-3">
                      {query
                        ? "Không tìm thấy bộ phù hợp."
                        : "Bạn chưa có bộ thẻ. Tạo bộ đầu tiên bên dưới."}
                    </p>
                  )}
                </div>
                {(page > 0 || hasMore) && (
                  <div className="flex items-center gap-3">
                    <button
                      className="study-button"
                      disabled={!page}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Trước
                    </button>
                    <span className="text-sm">Trang {page + 1}</span>
                    <button
                      className="study-button"
                      disabled={!hasMore}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Tiếp
                    </button>
                  </div>
                )}
              </>
            )}
            {creating ? (
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Tên bộ mới"
                  className="study-input flex-1 !w-auto min-w-0"
                  value={newName}
                  maxLength={200}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void create();
                    }
                  }}
                  placeholder="Tên bộ mới"
                />
                <button
                  className="study-button"
                  disabled={!newName.trim()}
                  onClick={() => void create()}
                >
                  Tạo bộ
                </button>
                <button
                  className="study-button"
                  onClick={() => setCreating(false)}
                >
                  Hủy tạo
                </button>
              </div>
            ) : (
              <button
                className="study-button"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                Tạo bộ mới
              </button>
            )}
            <label className="dictionary-label">
              Nghĩa dùng cho thẻ
              <select
                className="study-input mt-1"
                value={senseId}
                onChange={(e) => {
                  setSenseId(e.target.value);
                  setBack(
                    senseText(senses.find((s) => s.id === e.target.value)!),
                  );
                }}
              >
                {senses.map((s, i) => (
                  <option key={`${s.id}-${i}`} value={s.id}>
                    {i + 1}. {senseText(s)}
                  </option>
                ))}
              </select>
            </label>
            <details className="dictionary-edit">
              <summary>Chỉnh từ và nghĩa</summary>
              <div className="space-y-3 pt-3">
                <label className="dictionary-label">
                  Cách đọc
                  <select
                    className="study-input mt-1"
                    value={reading}
                    onChange={(e) => {
                      const r = word.readings.find(
                        (r) => r.text === e.target.value,
                      )!;
                      const w = validWrittenForms(word, r)[0];
                      chooseForm(w, r.text);
                    }}
                  >
                    {word.readings
                      .filter((r) => validWrittenForms(word, r).length > 0)
                      .map((r) => (
                        <option key={r.text} value={r.text}>
                          {r.text}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="dictionary-label">
                  Cách viết
                  <select
                    className="study-input mt-1"
                    value={written}
                    onChange={(e) => chooseForm(e.target.value, reading)}
                  >
                    {(() => {
                      const r = word.readings.find((r) => r.text === reading)!;
                      return validWrittenForms(word, r).map((w) => (
                        <option key={w}>{w}</option>
                      ));
                    })()}
                  </select>
                </label>
                <label className="dictionary-label">
                  Mặt trước
                  <input
                    className="study-input mt-1"
                    value={front}
                    maxLength={20000}
                    onChange={(e) => setFront(e.target.value)}
                  />
                </label>
                <label className="dictionary-label" htmlFor="dictionary-back">
                  Mặt sau
                </label>
                <textarea
                  id="dictionary-back"
                  className="study-input mt-1"
                  rows={3}
                  value={back}
                  maxLength={20000}
                  onChange={(e) => setBack(e.target.value)}
                />
                <label className="dictionary-label" htmlFor="dictionary-notes">
                  Ghi chú
                </label>
                <textarea
                  id="dictionary-notes"
                  className="study-input mt-1"
                  rows={2}
                  value={notes}
                  maxLength={20000}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </details>
          </fieldset>
          <div className="dictionary-preview">
            <p className="dictionary-caption">XEM TRƯỚC THẺ</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <small>Mặt trước</small>
                <CardFace
                  card={preview}
                  template={template}
                  side="front"
                  fields={template.front.fields}
                  deckName={selected?.name || ""}
                  compact
                />
              </div>
              <div>
                <small>Mặt sau</small>
                <CardFace
                  card={preview}
                  template={template}
                  side="back"
                  fields={template.back.fields}
                  deckName={selected?.name || ""}
                  compact
                />
              </div>
            </div>
          </div>
          <p className="study-copy text-xs">
            Nghĩa gốc tiếng Anh từ JMdict · CC BY-SA 4.0. Bạn có thể tự sửa
            nghĩa trước khi lưu. Thẻ mới bắt đầu lịch ôn riêng.
          </p>
          {selected && !canDisplayWordAndMeaning && (
            <p role="alert" className="study-copy text-sm">
              Mẫu của bộ này đang ẩn từ hoặc nghĩa. Hãy chọn bộ khác, hoặc sửa
              mẫu hiển thị trong bộ thẻ rồi thử lại.
            </p>
          )}
        </div>
      )}
    </AppDialog>
  );
}
