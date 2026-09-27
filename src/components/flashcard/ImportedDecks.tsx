import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  defaultDeckTemplate,
  kindLabels,
  normalizeDeckTemplate,
  parseImportFile,
  type ImportedCard,
  type ImportPreview,
  type DeckTemplateConfig,
} from "@/lib/ankiImport";
import ImportPreviewEditor from "./ImportPreviewEditor";
import {
  addCard,
  updateCard,
  updateDeck,
  removeCard,
  removeDeck,
  reorderCards,
  reorderDecks,
  moveCards,
  type ApiProgress,
} from "@/lib/api";
import {
  asImported,
  cardPage,
  cardRequest,
  creationBody,
  deckCardIds,
  deckMetadata,
  dueQueue,
  importDeck,
  listDeckPage,
  type Page,
  type PersonalCard,
  type PersonalDeck,
} from "@/lib/deckApi";
import { importedCardView, type CardView } from "@/lib/cards";
import { StudySession } from "./StudySession";
import { DeckCustomizeDialog } from "./CardPresentation";
import { ContentBadge } from "@/components/ui/StudyUI";
import {
  GripVertical,
  HelpCircle,
  MoreVertical,
  PenLine,
  Plus,
  Upload,
  X,
} from "lucide-react";
const blankCard = (): ImportedCard => ({
  id: crypto.randomUUID(),
  front: "",
  back: "",
  reading: "",
  notes: "",
  kind: "general",
  tags: [],
});
const emptyPage = <T,>(): Page<T> => ({
  content: [],
  number: 0,
  size: 20,
  totalPages: 0,
  totalElements: 0,
});
export function ImportedDecks({
  leadingDeck,
  mode = "anki",
}: {
  leadingDeck?: ReactNode;
  mode?: "flashcards" | "anki";
}) {
  const { user, requestAuth, draft, setDraft } = useAuth();
  const initial = useRef(draft?.mode === mode ? draft : null).current;
  const [decks, setDecks] = useState<Page<PersonalDeck>>(emptyPage);
  const [deckPage, setDeckPage] = useState(0);
  const sort = "position,asc";
  const [active, setActive] = useState<PersonalDeck | null>(null);
  const [cards, setCards] = useState<Page<PersonalCard>>(emptyPage);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(
    initial?.preview ?? null,
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [creating, setCreating] = useState(initial?.creatingDeck ?? false);
  const [manualCards, setManualCards] = useState<ImportedCard[]>(
    initial?.manualCards ?? [blankCard()],
  );
  const [allowEmpty, setAllowEmpty] = useState(initial?.allowEmpty ?? false);
  const seed = useRef(initial?.importSeed ?? crypto.randomUUID());
  const [rules, setRules] = useState(false);
  const [creatorError, setCreatorError] = useState("");
  const [draggingDeckId, setDraggingDeckId] = useState<string | null>(null);
  const [dropDeckId, setDropDeckId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const editExisting = useRef(false);
  const [editing, setEditing] = useState<ImportedCard | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<PersonalDeck[]>([]);
  const [target, setTarget] = useState("");
  const [customizing, setCustomizing] = useState<PersonalDeck | null>(null);
  const [launch, setLaunch] = useState<PersonalDeck | null>(null);
  const [range, setRange] = useState(50);
  const [shuffle, setShuffle] = useState(false);
  const [orientation, setOrientation] =
    useState<DeckTemplateConfig["study"]["orientation"]>("front-first");
  const [session, setSession] = useState<{
    cards: CardView[];
    deck: PersonalDeck;
    template: DeckTemplateConfig;
    progress: Record<string, ApiProgress | null>;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const parser = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      parser.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setDecks(emptyPage());
      return;
    }
    let valid = true;
    setLoading(true);
    setError("");
    listDeckPage(deckPage, sort)
      .then((p) => {
        if (valid) {
          setDecks(p);
          if (deckPage > Math.max(0, p.totalPages - 1))
            setDeckPage(Math.max(0, p.totalPages - 1));
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [user, deckPage, sort, reload]);
  useEffect(() => {
    if (!active || !user) return;
    let valid = true;
    setLoading(true);
    setError("");
    cardPage(active.id, page, query, type, state)
      .then((p) => {
        if (valid) {
          setCards(p);
          if (page > Math.max(0, p.totalPages - 1))
            setPage(Math.max(0, p.totalPages - 1));
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [user, active, page, query, type, state, reload]);
  useEffect(() => {
    if (!user)
      setDraft(
        preview || creating
          ? {
              preview,
              name,
              creatingDeck: creating,
              mode,
              manualCards,
              allowEmpty,
              importSeed: seed.current,
            }
          : null,
      );
  }, [user, preview, creating, name, mode, manualCards, allowEmpty, setDraft]);
  async function operation(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Không lưu được thay đổi.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function requireAccount() {
    if (user) return true;
    setDraft({
      preview,
      name,
      creatingDeck: creating,
      mode,
      manualCards,
      allowEmpty,
      importSeed: seed.current,
    });
    requestAuth();
    return false;
  }
  function closeDraft() {
    setPreview(null);
    setCreating(false);
    setDraft(null);
    setCreatorError("");
    setRules(false);
    seed.current = crypto.randomUUID();
  }
  async function refreshActive() {
    if (active) setActive(await deckMetadata(active.id));
    setReload((v) => v + 1);
  }
  function open(deck: PersonalDeck) {
    closeDraft();
    setActive(deck);
    setName(deck.name);
    setPage(0);
    setQuery("");
    setType("");
    setState("");
    setSelected([]);
    setEditing(null);
    setCards(emptyPage());
  }
  async function allDecks() {
    const first = await listDeckPage(0, "position,asc");
    const all = [...first.content];
    for (let p = 1; p < first.totalPages; p++)
      all.push(...(await listDeckPage(p, "position,asc")).content);
    return all;
  }
  async function create(manual = false, createEmpty = false) {
    if (!name.trim()) {
      setCreatorError("Nhập tên bộ thẻ trước khi tạo.");
      return;
    }
    if (!requireAccount()) return;
    const list = manual
      ? createEmpty || allowEmpty
        ? []
        : manualCards
      : preview!.cards;
    if (
      !allowEmpty &&
      manual &&
      (!list.length || list.some((c) => !c.front.trim() || !c.back.trim()))
    ) {
      setError(
        "Nhập đủ mặt trước và mặt sau cho mỗi thẻ, hoặc chủ động chọn Tạo bộ trống.",
      );
      return;
    }
    await operation(async () => {
      const body = creationBody(
        name,
        list,
        manual ? "Tạo thủ công" : preview!.source,
        manual ? "Thủ công" : preview!.format,
        defaultDeckTemplate(),
        manual,
      );
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(body)),
      );
      const key =
        seed.current.slice(0, 8) +
        ":" +
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      const response = await importDeck(body, key);
      const metadata = await deckMetadata(response.deck.id);
      const skipped = preview?.skipped || 0;
      const counts: Record<string, number> = {};
      for (const issue of preview?.issues || [])
        counts[issue.reason] = (counts[issue.reason] || 0) + 1;
      const issues = Object.entries(counts).map(
        ([reason, count]) => `${count} dòng: ${reason}`,
      );
      closeDraft();
      setActive(null);
      setDeckPage(Math.floor(Math.max(0, decks.totalElements) / 20));
      setDecks((current) => ({
        ...current,
        content: [...current.content, metadata],
        totalElements: current.totalElements + 1,
      }));
      setReload((v) => v + 1);
      setMessage(
        manual
          ? `Đã tạo “${metadata.name}”. Mở menu ba chấm để thêm thẻ.`
          : `Đã tạo “${metadata.name}” với ${metadata.cardCount} thẻ${skipped ? `; bỏ qua ${skipped} dòng (${issues.join(", ")})` : ""}.`,
      );
    });
  }

  function openCreator() {
    closeDraft();
    setCreating(true);
    setActive(null);
    setName("");
    setManualCards([blankCard()]);
    setAllowEmpty(true);
  }

  function chooseImport() {
    if (!name.trim()) {
      setCreatorError("Nhập tên bộ thẻ trước khi chọn file import.");
      return;
    }
    setCreatorError("");
    input.current?.click();
  }

  async function dropDeck(sourceId: string, targetId: string) {
    if (sourceId === targetId || busy) return;
    const previous = decks;
    const visible = [...decks.content];
    const from = visible.findIndex((deck) => deck.id === sourceId);
    const to = visible.findIndex((deck) => deck.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = visible.splice(from, 1);
    visible.splice(to, 0, moved);
    setDecks((current) => ({ ...current, content: visible }));
    setDraggingDeckId(null);
    setDropDeckId(null);
    await operation(async () => {
      try {
        const all = await allDecks();
        const sourceIndex = all.findIndex((deck) => deck.id === sourceId);
        const targetIndex = all.findIndex((deck) => deck.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0)
          throw new Error("Không tìm thấy bộ thẻ để sắp xếp.");
        const [item] = all.splice(sourceIndex, 1);
        all.splice(targetIndex, 0, item);
        await reorderDecks(all.map((deck) => deck.id));
        setMessage("Đã lưu thứ tự bộ thẻ.");
      } catch (reason) {
        setDecks(previous);
        throw reason;
      }
    });
  }
  function chooseStudy(deck: PersonalDeck) {
    setLaunch(deck);
    setRange(Math.min(deck.cardCount, 50));
    setOrientation(
      normalizeDeckTemplate(deck.templateConfig).study.orientation,
    );
  }
  async function startStudy() {
    if (!launch) return;
    const deck = launch;
    await operation(async () => {
      let views: CardView[] = [];
      const progress: Record<string, ApiProgress | null> = {};
      if (mode === "anki") {
        const queue = await dueQueue(
          deck.id,
          Math.min(200, Math.max(1, range)),
        );
        views = queue.map((c, i) => {
          progress[c.cardId] = c.progress;
          return {
            id: c.cardId,
            deckId: deck.id,
            front: c.front,
            back: c.back,
            reading: c.reading || "",
            note: c.notes || "",
            type: c.kind,
            tags: [],
            source: deck.sourceType === "MANUAL" ? "MANUAL" : "IMPORT",
            position: i,
          };
        });
      } else {
        const count = Math.min(deck.cardCount, Math.max(1, range));
        for (let p = 0; views.length < count; p++) {
          const batch = await cardPage(deck.id, p, "", "", "", 200);
          views.push(
            ...batch.content.map((c, i) =>
              importedCardView(
                asImported(c),
                deck.id,
                deck.sourceType === "MANUAL" ? "MANUAL" : "IMPORT",
                p * 200 + i,
              ),
            ),
          );
          if (p + 1 >= batch.totalPages) break;
        }
        views = views.slice(0, count);
        if (shuffle)
          for (let i = views.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [views[i], views[j]] = [views[j], views[i]];
          }
      }
      if (!views.length) {
        setMessage("Chưa có thẻ đến hạn hoặc thẻ mới trong bộ này.");
        setLaunch(null);
        return;
      }
      const template = normalizeDeckTemplate(deck.templateConfig);
      template.study.orientation = orientation;
      setSession({ cards: views, deck, template, progress });
      setLaunch(null);
    });
  }
  async function shiftCard(id: string, delta: number) {
    if (!active) return;
    await operation(async () => {
      const ids = await deckCardIds(active.id);
      const index = ids.indexOf(id);
      const next = index + delta;
      if (next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      await reorderCards(active.id, ids);
      setReload((v) => v + 1);
    });
  }
  function download(format: "csv" | "json") {
    const text =
      format === "csv"
        ? "front,back,reading,note,type,tags\n勉強,Việc học,べんきょう,Ôn bài 6,VOCABULARY,học tập\n"
        : JSON.stringify(
            [
              {
                front: "勉強",
                back: "Việc học",
                reading: "べんきょう",
                note: "Ôn bài 6",
                type: "VOCABULARY",
                tags: ["học tập"],
              },
            ],
            null,
            2,
          );
    const url = URL.createObjectURL(
      new Blob([text], {
        type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `mau-bo-the.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (session)
    return (
      <StudySession
        cards={session.cards}
        deckName={session.deck.name}
        mode={mode}
        template={session.template}
        initialProgress={session.progress}
        onExit={() => {
          setSession(null);
          void refreshActive();
        }}
      />
    );
  return (
    <section className="space-y-5" aria-label="Bộ thẻ của bạn">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="study-eyebrow">CỦA BẠN</p>
          <h2 className="mt-1 text-xl font-semibold">Bộ thẻ của bạn</h2>
        </div>
        {user && decks.totalElements > 1 && (
          <p className="hidden text-xs text-[var(--color-text-tertiary)] sm:block">
            Kéo tay cầm ⋮⋮ để đổi thứ tự
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label="Chọn file nhập bộ thẻ"
        accept=".txt,.csv,.tsv,.json,.xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setActive(null);
          setCreating(true);
          setCreatorError("");
          parser.current = new AbortController();
          void operation(async () => {
            try {
              const p = await parseImportFile(file, parser.current!.signal);
              setPreview(p);
              setName((current) => current.trim() || p.name);
            } finally {
              parser.current = null;
            }
          });
        }}
      />
      {busy && (
        <p role="status">
          Đang xử lý…{" "}
          {parser.current && !preview && (
            <button
              className="study-button"
              onClick={() => parser.current?.abort()}
            >
              Hủy đọc tệp
            </button>
          )}
        </p>
      )}
      {error && (
        <div role="alert" className="text-[var(--color-error)]">
          {error}{" "}
          <button
            className="study-button"
            disabled={busy}
            onClick={() => setReload((v) => v + 1)}
          >
            Thử tải lại
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {launch && (
        <div
          className="rounded-xl border border-[var(--color-border)] p-4 space-y-3"
          aria-label="Thiết lập phiên học"
        >
          <h3>Học {launch.name}</h3>
          <label>
            Số thẻ (tối đa{" "}
            {mode === "anki"
              ? Math.min(200, launch.cardCount)
              : launch.cardCount}
            )
            <input
              className="study-input"
              type="number"
              min={1}
              max={
                mode === "anki"
                  ? Math.min(200, launch.cardCount)
                  : launch.cardCount
              }
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            />
          </label>
          {mode === "flashcards" && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              Xáo trộn
            </label>
          )}
          <label>
            Hướng học
            <select
              className="study-input"
              value={orientation}
              onChange={(e) =>
                setOrientation(e.target.value as typeof orientation)
              }
            >
              <option value="front-first">Mặt trước → mặt sau</option>
              <option value="back-first">Mặt sau → mặt trước</option>
              <option value="mixed">Trộn hai chiều</option>
            </select>
          </label>
          <button
            className="study-button study-button-primary"
            disabled={busy || range < 1}
            onClick={() => void startStudy()}
          >
            Bắt đầu phiên
          </button>{" "}
          <button className="study-button" onClick={() => setLaunch(null)}>
            Hủy
          </button>
        </div>
      )}
      {active && !creating && !preview && (
        <div className="space-y-4">
          <button
            className="study-button"
            onClick={() => {
              setActive(null);
              setEditing(null);
              setSelected([]);
            }}
          >
            ← Các bộ thẻ
          </button>
          <h3 className="text-lg font-semibold">
            {active.name} · {active.cardCount} thẻ
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Đổi tên bộ thẻ"
              className="study-input !w-auto grow"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="study-button"
              disabled={busy || !name.trim()}
              onClick={() =>
                void operation(async () => {
                  await updateDeck(active.id, { name: name.trim() });
                  await refreshActive();
                })
              }
            >
              Đổi tên
            </button>
            <button
              className="study-button"
              onClick={() => setCustomizing(active)}
            >
              Tùy chỉnh
            </button>
            <button
              className="study-button"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Xóa bộ “${active.name}” và lịch ôn của ${active.cardCount} thẻ?`,
                  )
                )
                  void operation(async () => {
                    await removeDeck(active.id);
                    setActive(null);
                    setReload((v) => v + 1);
                  });
              }}
            >
              Xóa bộ
            </button>
          </div>
          <p className="study-copy">
            {active.newCount} mới · {active.dueCount} đến hạn
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="study-button study-button-primary"
              onClick={() => {
                editExisting.current = false;
                setEditing(blankCard());
              }}
            >
              Thêm thẻ
            </button>
            {active.cardCount > 0 && (
              <button
                className="study-button"
                onClick={() => chooseStudy(active)}
              >
                Bắt đầu học
              </button>
            )}
          </div>
          {editing && (
            <form
              className="rounded-xl border border-[var(--color-border)] p-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void operation(async () => {
                  if (editExisting.current)
                    await updateCard(editing.id, cardRequest(editing));
                  else await addCard(active.id, cardRequest(editing));
                  setEditing(null);
                  await refreshActive();
                });
              }}
            >
              <CardFields card={editing} onChange={setEditing} />
              <button
                className="study-button study-button-primary"
                disabled={busy || !editing.front.trim() || !editing.back.trim()}
              >
                Lưu thẻ
              </button>{" "}
              <button
                type="button"
                className="study-button"
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
            </form>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="study-input"
              aria-label="Tìm trong bộ thẻ"
              placeholder="Tìm mặt trước / mặt sau"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
            <select
              className="study-input"
              aria-label="Loại thẻ"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Mọi loại</option>
              {Object.entries(kindLabels).map(([k, v]) => (
                <option key={k} value={k.toUpperCase()}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="study-input"
              aria-label="Trạng thái ôn"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Mọi trạng thái</option>
              <option value="NEW">Mới</option>
              <option value="DUE">Đến hạn</option>
              <option value="LEARNING">Đang học</option>
              <option value="REVIEW">Ôn tập</option>
              <option value="RELEARNING">Học lại</option>
            </select>
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                className="study-button"
                onClick={() =>
                  void operation(async () =>
                    setTargets(
                      (await allDecks()).filter((d) => d.id !== active.id),
                    ),
                  )
                }
              >
                Chọn bộ đích ({selected.length} thẻ)
              </button>
              <select
                aria-label="Bộ đích"
                className="study-input !w-auto"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Chọn bộ đích</option>
                {targets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                className="study-button"
                disabled={!target || busy}
                onClick={() => {
                  if (
                    confirm(
                      `Chuyển ${selected.length} thẻ sang bộ khác? Lịch ôn sẽ được giữ lại.`,
                    )
                  )
                    void operation(async () => {
                      await moveCards(selected, target);
                      setSelected([]);
                      await refreshActive();
                    });
                }}
              >
                Chuyển thẻ
              </button>
            </div>
          )}
          {loading ? (
            <p role="status">Đang tải thẻ…</p>
          ) : cards.content.length ? (
            cards.content.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-[var(--color-border)] p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${c.front}`}
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked
                          ? [...v, c.id]
                          : v.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-jp break-words">{c.front}</p>
                    <p className="whitespace-pre-wrap break-words">{c.back}</p>
                    {c.reading && <p className="study-copy">{c.reading}</p>}
                    {c.notes && (
                      <p className="study-copy whitespace-pre-wrap">
                        {c.notes}
                      </p>
                    )}
                    {c.tags?.length > 0 && (
                      <p className="study-copy">{c.tags.join(" · ")}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="study-button"
                    disabled={busy}
                    onClick={() => {
                      editExisting.current = true;
                      setEditing(asImported(c));
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    className="study-button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Xóa thẻ này cùng lịch ôn?"))
                        void operation(async () => {
                          await removeCard(c.id);
                          setSelected((v) => v.filter((id) => id !== c.id));
                          await refreshActive();
                        });
                    }}
                  >
                    Xóa
                  </button>
                  <button
                    className="study-button"
                    aria-label={`Đưa ${c.front} lên`}
                    disabled={busy || c.position === 0}
                    onClick={() => void shiftCard(c.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="study-button"
                    aria-label={`Đưa ${c.front} xuống`}
                    disabled={busy || c.position >= active.cardCount - 1}
                    onClick={() => void shiftCard(c.id, 1)}
                  >
                    ↓
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="study-copy">
              {active.cardCount
                ? "Không có thẻ phù hợp bộ lọc."
                : "Chưa có thẻ. Chọn Thêm thẻ để bắt đầu."}
            </p>
          )}
          <Pagination
            value={page}
            pages={cards.totalPages}
            total={cards.totalElements}
            onChange={setPage}
          />
        </div>
      )}
      {!active && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {creating || preview ? (
              <section className="study-panel relative space-y-4 border-dashed sm:col-span-2 xl:col-span-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="study-eyebrow">BỘ THẺ MỚI</p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {preview
                        ? "Kiểm tra dữ liệu import"
                        : "Bạn muốn tạo bộ thế nào?"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
                    aria-label="Đóng form tạo bộ thẻ"
                    onClick={closeDraft}
                  >
                    <X size={18} />
                  </button>
                </div>
                <label className="block max-w-xl">
                  Tên bộ thẻ <span aria-hidden="true">*</span>
                  <input
                    className="study-input mt-1"
                    autoFocus
                    maxLength={200}
                    value={name}
                    aria-invalid={!!creatorError}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (event.target.value.trim()) setCreatorError("");
                    }}
                    placeholder="Ví dụ: Từ vựng N3 bài 1"
                  />
                </label>
                {creatorError && (
                  <p role="alert" className="text-sm text-[var(--color-error)]">
                    {creatorError}
                  </p>
                )}
                {preview ? (
                  <>
                    <ImportPreviewEditor
                      preview={preview}
                      onChange={setPreview}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="study-button study-button-primary"
                        disabled={busy || !preview.cards.length}
                        onClick={() => void create(false)}
                      >
                        Tạo bộ thẻ
                      </button>
                      <button
                        type="button"
                        className="study-button"
                        disabled={busy}
                        onClick={chooseImport}
                      >
                        Chọn file khác
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="group flex min-h-28 items-center gap-4 rounded-xl border border-[var(--color-border)] p-4 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-alt)]"
                      disabled={busy}
                      onClick={() => void create(true, true)}
                    >
                      <span className="rounded-full bg-[var(--color-surface-alt)] p-3 text-[var(--color-accent)]">
                        <PenLine size={21} />
                      </span>
                      <span>
                        <strong className="block">Tạo thủ công</strong>
                        <span className="study-copy">
                          Tạo bộ trống rồi thêm từng thẻ
                        </span>
                      </span>
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        className="flex min-h-28 w-full items-center gap-4 rounded-xl border border-[var(--color-border)] p-4 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-alt)]"
                        disabled={busy}
                        onClick={chooseImport}
                      >
                        <span className="rounded-full bg-[var(--color-surface-alt)] p-3 text-[var(--color-accent)]">
                          <Upload size={21} />
                        </span>
                        <span>
                          <strong className="block">Import file</strong>
                          <span className="study-copy">
                            TXT, CSV, TSV, JSON hoặc Excel
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded-full p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                        aria-label="Hướng dẫn import"
                        aria-expanded={rules}
                        onClick={() => setRules((value) => !value)}
                      >
                        <HelpCircle size={17} />
                      </button>
                      {rules && (
                        <div className="absolute right-0 top-11 z-20 w-[min(22rem,calc(100vw-3rem))] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-xl">
                          <p>
                            Tệp tối đa 20 MB và 20.000 thẻ. Cần mặt trước, mặt
                            sau; có thể thêm cách đọc, ghi chú, loại và tag.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              className="study-button"
                              onClick={() => download("csv")}
                            >
                              Mẫu CSV
                            </button>
                            <button
                              className="study-button"
                              onClick={() => download("json")}
                            >
                              Mẫu JSON
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <button
                type="button"
                className="group flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-transparent p-5 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-alt)]"
                onClick={openCreator}
              >
                <span className="grid size-11 place-items-center rounded-full bg-[var(--color-surface-alt)] text-[var(--color-accent)] transition-transform group-hover:scale-105">
                  <Plus size={24} />
                </span>
                <span className="font-semibold">Tạo bộ mới</span>
              </button>
            )}

            {leadingDeck}

            {user &&
              decks.content.map((deck) => {
                const badge = personalDeckBadge(deck);
                const isDragging = draggingDeckId === deck.id;
                const isDropTarget = dropDeckId === deck.id;
                return (
                  <article
                    key={deck.id}
                    className={`study-panel relative flex min-h-52 flex-col transition-[transform,border-color,opacity,box-shadow] duration-200 ${isDragging ? "opacity-45" : ""} ${isDropTarget ? "-translate-y-0.5 border-[var(--color-accent)] shadow-lg" : ""}`}
                    onDragOver={(event) => {
                      if (!draggingDeckId || draggingDeckId === deck.id) return;
                      event.preventDefault();
                      setDropDeckId(deck.id);
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node,
                        )
                      )
                        setDropDeckId(null);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingDeckId)
                        void dropDeck(draggingDeckId, deck.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ContentBadge tone={badge.tone}>
                        {badge.label}
                      </ContentBadge>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          draggable={!busy}
                          className="cursor-grab rounded-full p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)] active:cursor-grabbing"
                          aria-label={`Kéo để sắp xếp bộ ${deck.name}`}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", deck.id);
                            setDraggingDeckId(deck.id);
                          }}
                          onDragEnd={() => {
                            setDraggingDeckId(null);
                            setDropDeckId(null);
                          }}
                        >
                          <GripVertical size={18} />
                        </button>
                        <details className="relative">
                          <summary
                            className="list-none cursor-pointer rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)] [&::-webkit-details-marker]:hidden"
                            aria-label={`Thao tác với bộ ${deck.name}`}
                          >
                            <MoreVertical size={18} />
                          </summary>
                          <div className="absolute right-0 top-10 z-20 min-w-36 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl">
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-alt)]"
                              onClick={() => open(deck)}
                            >
                              Quản lý
                            </button>
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-alt)]"
                              onClick={() => setCustomizing(deck)}
                            >
                              Tùy chỉnh
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                    <h3 className="mt-5 break-words text-base font-semibold">
                      {deck.name}
                    </h3>
                    <p className="mt-3 flex items-baseline gap-1.5">
                      <strong className="text-4xl font-semibold tracking-tight">
                        {deck.cardCount}
                      </strong>
                      <span className="study-copy">thẻ</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {deck.newCount} mới · {deck.dueCount} đến hạn
                    </p>
                    <button
                      type="button"
                      className={`mt-auto pt-5 text-left text-sm font-semibold ${deck.cardCount ? "text-[var(--color-accent)] hover:underline" : "cursor-default text-[var(--color-text-tertiary)]"}`}
                      disabled={!deck.cardCount}
                      onClick={() => chooseStudy(deck)}
                    >
                      {deck.cardCount ? "Bắt đầu học →" : "Chưa có thẻ"}
                    </button>
                  </article>
                );
              })}
          </div>

          {!user && (
            <p className="study-copy">
              Bạn có thể bắt đầu tạo bộ; hệ thống sẽ yêu cầu đăng nhập khi lưu.
            </p>
          )}
          {user && loading && <p role="status">Đang tải bộ thẻ…</p>}
          {user && !loading && !decks.content.length && (
            <p className="study-copy">
              Chưa có bộ cá nhân. Chọn “Tạo bộ mới” để bắt đầu.
            </p>
          )}
          {user && (
            <Pagination
              value={deckPage}
              pages={decks.totalPages}
              total={decks.totalElements}
              onChange={setDeckPage}
            />
          )}
        </div>
      )}
      {customizing && (
        <DeckCustomizeDialog
          deck={{
            id: customizing.id,
            name: customizing.name,
            source: customizing.sourceName || "",
            format: customizing.importFormat || "",
            position: customizing.position,
            createdAt: customizing.createdAt,
            template: normalizeDeckTemplate(customizing.templateConfig),
            cards:
              active?.id === customizing.id
                ? cards.content.map(asImported)
                : [],
          }}
          busy={busy}
          onCancel={() => setCustomizing(null)}
          onSave={(template) =>
            void operation(async () => {
              await updateDeck(customizing.id, { templateConfig: template });
              if (active?.id === customizing.id) await refreshActive();
              else setReload((value) => value + 1);
              setCustomizing(null);
            })
          }
        />
      )}
    </section>
  );
}

function personalDeckBadge(deck: PersonalDeck): {
  label: string;
  tone: "neutral" | "vocabulary" | "grammar" | "kanji";
} {
  const text = `${deck.name} ${deck.sourceName || ""}`.toLocaleLowerCase("vi");
  if (/từ vựng|tu vung|vocab|vocabulary/.test(text))
    return { label: "Từ vựng", tone: "vocabulary" };
  if (/ngữ pháp|ngu phap|grammar/.test(text))
    return { label: "Ngữ pháp", tone: "grammar" };
  if (/kanji|hán tự|han tu/.test(text))
    return { label: "Kanji", tone: "kanji" };
  return { label: "Của bạn", tone: "neutral" };
}

function Pagination({
  value,
  pages,
  total,
  onChange,
}: {
  value: number;
  pages: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        className="study-button"
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        Trang trước
      </button>
      <span className="study-copy">
        {total} mục · {pages ? value + 1 : 0}/{pages}
      </span>
      <button
        className="study-button"
        disabled={value + 1 >= pages}
        onClick={() => onChange(value + 1)}
      >
        Trang sau
      </button>
    </div>
  );
}
function CardFields({
  card,
  onChange,
}: {
  card: ImportedCard;
  onChange: (c: ImportedCard) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["front", "back", "reading", "notes"] as const).map((key, i) => (
        <label key={key}>
          {["Mặt trước", "Mặt sau", "Cách đọc", "Ghi chú"][i]}
          <textarea
            className="study-input mt-1"
            required={i < 2}
            maxLength={key === "reading" ? 10000 : 20000}
            value={card[key]}
            onChange={(e) => onChange({ ...card, [key]: e.target.value })}
          />
        </label>
      ))}
      <label>
        Loại
        <select
          className="study-input"
          value={card.kind}
          onChange={(e) =>
            onChange({ ...card, kind: e.target.value as ImportedCard["kind"] })
          }
        >
          {Object.entries(kindLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags (cách bằng dấu phẩy)
        <input
          className="study-input"
          value={card.tags?.join(", ") || ""}
          onChange={(e) =>
            onChange({
              ...card,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
    </div>
  );
}
