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
  const [sort, setSort] = useState("updatedAt,desc");
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
  const [customizing, setCustomizing] = useState(false);
  const [result, setResult] = useState<{
    deck: PersonalDeck;
    skipped: number;
    issues: string[];
  } | null>(null);
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
    setResult(null);
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
  async function create(manual = false) {
    if (!requireAccount()) return;
    const list = manual ? (allowEmpty ? [] : manualCards) : preview!.cards;
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
      setResult({ deck: metadata, skipped, issues });
      setActive(null);
      setReload((v) => v + 1);
      setMessage(`Đã tạo bộ thẻ với ${metadata.cardCount} thẻ.`);
      if (manual) {
        open(metadata);
        setMessage(
          metadata.cardCount
            ? "Đã tạo bộ thẻ."
            : "Bộ trống đã tạo. Chọn Thêm thẻ để bắt đầu.",
        );
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
  async function shiftDeck(id: string, delta: number) {
    await operation(async () => {
      const all = await allDecks();
      const index = all.findIndex((d) => d.id === id);
      const next = index + delta;
      if (next < 0 || next >= all.length) return;
      [all[index], all[next]] = [all[next], all[index]];
      await reorderDecks(all.map((d) => d.id));
      setSort("position,asc");
      setReload((v) => v + 1);
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
    <section className="study-panel space-y-5" aria-label="Bộ thẻ của bạn">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Bộ thẻ của bạn</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="study-button"
            disabled={busy}
            onClick={() => {
              closeDraft();
              setCreating(true);
              setActive(null);
              setName("Bộ thẻ mới");
              setManualCards([blankCard()]);
              setAllowEmpty(false);
            }}
          >
            Tạo bộ thủ công
          </button>
          <button
            className="study-button study-button-primary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            Import
          </button>
          <button
            className="study-button !px-4"
            aria-label="Quy tắc nhập tệp"
            aria-expanded={rules}
            aria-controls="import-rules"
            onClick={() => setRules((v) => !v)}
          >
            !
          </button>
        </div>
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
          closeDraft();
          setActive(null);
          parser.current = new AbortController();
          void operation(async () => {
            try {
              const p = await parseImportFile(file, parser.current!.signal);
              setPreview(p);
              setName(p.name);
            } finally {
              parser.current = null;
            }
          });
        }}
      />
      {rules && (
        <div
          id="import-rules"
          className="rounded-xl bg-[var(--color-surface-alt)] p-4 space-y-3"
        >
          <p>
            TXT/CSV/TSV/JSON/XLSX/XLS · tối đa 20 MB và 20.000 thẻ. Bắt buộc mặt
            trước/mặt sau; tùy chọn reading, note, type, tags. Nhận tiêu đề
            Anh/Việt; có thể đổi ánh xạ cột và chọn sheet Excel trước khi tạo.
          </p>
          <p>
            Dòng thiếu nội dung, quá dài hoặc trùng cặp mặt trước/mặt sau sẽ
            được báo trong preview. Tên file/sheet giữ trong nguồn, không sửa
            ghi chú.
          </p>
          <pre className="overflow-auto text-sm">
            front,back,reading,note,type{`\n`}勉強,Việc học,べんきょう,Ôn bài
            6,VOCABULARY
          </pre>
          <button className="study-button" onClick={() => download("csv")}>
            Tải mẫu CSV
          </button>{" "}
          <button className="study-button" onClick={() => download("json")}>
            Tải mẫu JSON
          </button>
        </div>
      )}
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
      {preview && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Xem trước: {preview.source}</h3>
          <p className="study-copy">
            Bản nháp giữ khi đăng nhập tại đây; tải lại hoặc đóng trang có thể
            cần chọn lại tệp.
          </p>
          <label className="block">
            Tên thư mục
            <input
              className="study-input mt-1"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <ImportPreviewEditor preview={preview} onChange={setPreview} />
          <div className="flex gap-2">
            <button
              className="study-button study-button-primary"
              disabled={busy || !name.trim() || !preview.cards.length}
              onClick={() => void create()}
            >
              Tạo bộ thẻ
            </button>
            <button
              className="study-button"
              disabled={busy}
              onClick={closeDraft}
            >
              Hủy
            </button>
          </div>
        </div>
      )}
      {creating && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(true);
          }}
        >
          <h3>Tạo bộ thẻ thủ công</h3>
          <label className="block">
            Tên bộ thẻ
            <input
              className="study-input"
              maxLength={200}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={allowEmpty}
              onChange={(e) => setAllowEmpty(e.target.checked)}
            />
            Tạo bộ trống
          </label>
          {allowEmpty ? (
            <p className="study-copy">
              Bộ trống chưa thể học. Bạn cần thêm thẻ sau khi tạo.
            </p>
          ) : (
            <>
              {manualCards.map((c, i) => (
                <div key={c.id} className="space-y-2">
                  <CardFields
                    card={c}
                    onChange={(card) =>
                      setManualCards((items) =>
                        items.map((v, n) => (n === i ? card : v)),
                      )
                    }
                  />
                  {manualCards.length > 1 && (
                    <button
                      type="button"
                      className="study-button"
                      onClick={() =>
                        setManualCards((items) =>
                          items.filter((_, n) => n !== i),
                        )
                      }
                    >
                      Bỏ thẻ {i + 1}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="study-button"
                onClick={() =>
                  setManualCards((items) => [...items, blankCard()])
                }
              >
                Thêm một thẻ
              </button>
            </>
          )}
          <div className="flex gap-2">
            <button
              className="study-button study-button-primary"
              disabled={busy || !name.trim()}
            >
              Tạo và thêm thẻ
            </button>
            <button type="button" className="study-button" onClick={closeDraft}>
              Hủy
            </button>
          </div>
        </form>
      )}
      {result && (
        <section
          className="rounded-xl border border-[var(--color-border)] p-4 space-y-3"
          aria-label="Kết quả import"
        >
          <h3>Đã tạo {result.deck.name}</h3>
          <p>
            {result.deck.cardCount} thẻ được tạo · {result.skipped} dòng bỏ qua
          </p>
          {result.issues.map((issue) => (
            <p key={issue} className="study-copy">
              {issue}
            </p>
          ))}
          <button className="study-button" onClick={() => open(result.deck)}>
            Quản lý bộ
          </button>{" "}
          {result.deck.cardCount > 0 && (
            <button
              className="study-button study-button-primary"
              onClick={() => chooseStudy(result.deck)}
            >
              Bắt đầu học
            </button>
          )}
        </section>
      )}
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
              onClick={() => setCustomizing(true)}
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
      {!active && !preview && !creating && (
        <>
          {leadingDeck}
          {!user ? (
            <p className="study-copy">
              Đăng nhập khi tạo bộ hoặc để quản lý các bộ thẻ cá nhân của bạn.
            </p>
          ) : (
            <>
              <label className="block">
                Sắp xếp
                <select
                  className="study-input !w-auto"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setDeckPage(0);
                  }}
                >
                  <option value="updatedAt,desc">Cập nhật mới nhất</option>
                  <option value="name,asc">Tên A–Z</option>
                  <option value="position,asc">Thứ tự tùy chỉnh</option>
                </select>
              </label>
              {loading ? (
                <p role="status">Đang tải bộ thẻ…</p>
              ) : decks.content.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {decks.content.map((d) => (
                    <article
                      key={d.id}
                      className="rounded-xl border border-[var(--color-border)] p-4 space-y-3"
                    >
                      <p className="study-eyebrow">
                        {d.sourceType === "MANUAL" ? "Tạo thủ công" : "Import"}
                      </p>
                      <h3 className="text-lg font-semibold break-words">
                        {d.name}
                      </h3>
                      <p>
                        {d.cardCount} thẻ · {d.newCount} mới · {d.dueCount} đến
                        hạn
                      </p>
                      {!d.cardCount && (
                        <p className="study-copy">
                          Chưa có thẻ. Mở Quản lý để thêm thẻ.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="study-button"
                          onClick={() => open(d)}
                        >
                          Quản lý
                        </button>
                        {d.cardCount > 0 && (
                          <button
                            className="study-button study-button-primary"
                            onClick={() => chooseStudy(d)}
                          >
                            Bắt đầu học
                          </button>
                        )}
                        <button
                          className="study-button"
                          disabled={busy}
                          aria-label={`Đưa bộ ${d.name} lên`}
                          onClick={() => void shiftDeck(d.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="study-button"
                          disabled={busy}
                          aria-label={`Đưa bộ ${d.name} xuống`}
                          onClick={() => void shiftDeck(d.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="study-copy">
                  Chưa có bộ thẻ. Tạo thủ công hoặc Import để bắt đầu.
                </p>
              )}
              <Pagination
                value={deckPage}
                pages={decks.totalPages}
                total={decks.totalElements}
                onChange={setDeckPage}
              />
            </>
          )}
        </>
      )}
      {customizing && active && (
        <DeckCustomizeDialog
          deck={{
            id: active.id,
            name: active.name,
            source: active.sourceName || "",
            format: active.importFormat || "",
            position: active.position,
            createdAt: active.createdAt,
            template: normalizeDeckTemplate(active.templateConfig),
            cards: cards.content.map(asImported),
          }}
          busy={busy}
          onCancel={() => setCustomizing(false)}
          onSave={(template) =>
            void operation(async () => {
              await updateDeck(active.id, { templateConfig: template });
              await refreshActive();
              setCustomizing(false);
            })
          }
        />
      )}
    </section>
  );
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
