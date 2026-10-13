import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Search, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppLoading } from "@/components/ui/AppLoading";
import {
  defaultSelection,
  dictionarySources,
  getDictionaryWord,
  searchDictionary,
  senseText,
  type DictionaryWord,
  type SearchResponse,
} from "@/lib/dictionary/api";
import "./dictionary.css";
import { clearCardDraft, cardDraftOwner } from "@/lib/dictionary/draft";
import { ApiError } from "@/lib/api";

const AddDialog = lazy(() =>
  import("./AddDictionaryCardDialog").then((m) => ({
    default: m.AddDictionaryCardDialog,
  })),
);
const DRAFT_KEY = "dictionary:pending-add";
function restoreDraft(): DictionaryWord | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    return draft &&
      Date.now() - draft.createdAt < 30 * 60_000 &&
      Array.isArray(draft.word?.senses) &&
      draft.word.senses.length
      ? draft.word
      : null;
  } catch {
    return null;
  }
}
function Attribution() {
  return (
    <footer className="dictionary-attribution">
      Dữ liệu Nhật–Anh:{" "}
      <a
        href="https://www.edrdg.org/jmdict/edict_doc.html"
        target="_blank"
        rel="noreferrer"
      >
        JMdict · EDRDG / James William Breen
      </a>{" "}
      ·{" "}
      <a
        href="https://www.edrdg.org/edrdg/licence.html"
        target="_blank"
        rel="noreferrer"
      >
        CC BY-SA 4.0
      </a>{" "}
      · <Link to="/dictionary/sources">Nguồn dữ liệu</Link>
    </footer>
  );
}
export function DictionaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get("q") || "";
  let key: string | null = null;
  if (location.pathname.startsWith("/dictionary/words/")) {
    try {
      key = decodeURIComponent(
        location.pathname.slice("/dictionary/words/".length),
      );
    } catch {
      key = "invalid";
    }
  }
  const sources = location.pathname === "/dictionary/sources";
  const {
    user,
    loading: authLoading,
    requestAuth,
    restoreError,
    retryRestore,
  } = useAuth();
  const [input, setInput] = useState(query);
  const [composing, setComposing] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchNotice, setSearchNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState<DictionaryWord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [pending, setPending] = useState<DictionaryWord | null>(restoreDraft);
  const [sourceInfo, setSourceInfo] = useState<Awaited<
    ReturnType<typeof dictionarySources>
  > | null>(null);
  const [sourceError, setSourceError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsScroll = useRef(0);
  const previousDetail = useRef<string | null>(key);
  useEffect(() => {
    if (previousDetail.current && !key)
      requestAnimationFrame(() =>
        window.scrollTo({ top: resultsScroll.current }),
      );
    else if (
      key &&
      !previousDetail.current &&
      window.matchMedia("(max-width:700px)").matches
    )
      window.scrollTo({ top: 0 });
    previousDetail.current = key;
  }, [key]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const account = useRef(cardDraftOwner() || user?.id);
  useEffect(() => {
    if (user && account.current && account.current !== user.id) {
      setPending(null);
      clearCardDraft();
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* optional draft */
      }
    }
    if (user) account.current = user.id;
  }, [user]);
  useEffect(() => {
    setInput(query);
    setCursor(null);
    setCursorStack([]);
    setSearchNotice("");
  }, [query]);
  useEffect(() => {
    if (composing || input === query || key || sources) return;
    const timer = setTimeout(() => {
      setCursor(null);
      setCursorStack([]);
      navigate(
        `/dictionary${input.trim() ? `?q=${encodeURIComponent(input)}` : ""}`,
        { replace: true },
      );
    }, 220);
    return () => clearTimeout(timer);
  }, [input, query, composing, key, sources, navigate]);
  useEffect(() => {
    const c = new AbortController();
    if (!query.trim()) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    searchDictionary(query, cursor, c.signal)
      .then((result) => {
        if (!c.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (
          !c.signal.aborted &&
          e instanceof ApiError &&
          e.code === "DICTIONARY_CURSOR_EXPIRED" &&
          cursor
        ) {
          setData(null);
          setCursor(null);
          setCursorStack([]);
          setSearchNotice(
            "Từ điển vừa cập nhật. Kết quả đã được tải lại từ trang đầu.",
          );
          return;
        }
        if (!c.signal.aborted)
          setError(e.message || "Không thể kết nối từ điển. Hãy thử lại.");
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [query, cursor, retry]);
  useEffect(() => {
    if (!key) {
      setDetail(null);
      setDetailError("");
      return;
    }
    const c = new AbortController();
    setDetailLoading(true);
    setDetail(null);
    setDetailError("");
    getDictionaryWord(key, c.signal)
      .then((w) => {
        if (!c.signal.aborted) setDetail(w);
      })
      .catch((e) => {
        if (!c.signal.aborted) setDetailError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setDetailLoading(false);
      });
    return () => c.abort();
  }, [key, retry]);
  useEffect(() => {
    const c = new AbortController();
    setSourceError("");
    dictionarySources(c.signal)
      .then((info) => {
        if (!c.signal.aborted) setSourceInfo(info);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setSourceError(e.message || "Chưa thể tải thông tin từ điển.");
      });
    return () => c.abort();
  }, [retry]);
  function add(word: DictionaryWord) {
    setPending(word);
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ word, createdAt: Date.now() }),
      );
    } catch {
      /* in-memory draft remains */
    }
    if (!user && !authLoading) requestAuth();
  }
  function closeAdd() {
    setPending(null);
    clearCardDraft();
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* optional draft */
    }
  }
  function updatePendingWord(word: DictionaryWord) {
    setPending(word);
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ word, createdAt: Date.now() }),
      );
    } catch {
      /* in-memory draft remains */
    }
  }
  const returnUrl = `/dictionary${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  const resultsCurrent =
    data?.query === query && !loading && !error && input === query;
  return (
    <main className="dictionary-page">
      <div className="dictionary-wrap">
        <header className="dictionary-header">
          <Link to="/today" className="dictionary-brand">
            <img src="/so-nhat-mark.svg" alt="" />
            SỔ NHẬT
          </Link>
          <nav aria-label="Điều hướng từ điển">
            <Link to="/decks">Bộ thẻ</Link>
            {user ? (
              <span className="dictionary-account">{user.displayName}</span>
            ) : (
              <button
                className="study-button"
                disabled={authLoading}
                onClick={requestAuth}
              >
                Đăng nhập
              </button>
            )}
          </nav>
        </header>
        <section className="dictionary-hero">
          <div>
            <p className="dictionary-eyebrow">MỖI TỪ MỚI, MỘT BƯỚC TIẾN</p>
            <h1>
              Từ điển <span lang="ja">辞書</span>
            </h1>
            <p>Tra nghĩa, chọn bộ thẻ, ghi nhớ theo nhịp của bạn.</p>
          </div>
          <BookOpen className="dictionary-hero-icon" aria-hidden="true" />
        </section>
        {sources ? (
          <section className="study-panel space-y-4">
            <Link to={returnUrl} className="inline-flex gap-2 items-center">
              <ArrowLeft size={17} />
              Quay lại tra từ
            </Link>
            <h2 className="text-xl font-semibold">Nguồn dữ liệu</h2>
            <p>
              JMdict — James William Breen và Electronic Dictionary Research and
              Development Group (EDRDG). Thành phần Nhật và Anh, CC BY-SA 4.0.
            </p>
            <p className="study-copy">
              Dữ liệu được chuẩn hóa để tìm kiếm; từng nghĩa và hạn chế cách đọc
              được giữ lại. Thẻ đã lưu giữ bản nghĩa tại thời điểm thêm, cùng
              thông tin nguồn. Nghĩa Việt chưa được tích hợp; bạn có thể tự sửa
              mặt sau của thẻ.
            </p>
            {sourceInfo && (
              <p className="study-copy">
                {sourceInfo.ready
                  ? `${sourceInfo.entryCount.toLocaleString("vi-VN")} mục từ · Nhập ngày ${new Date(sourceInfo.importedAt!).toLocaleDateString("vi-VN")}`
                  : "Dữ liệu đang được chuẩn bị."}
              </p>
            )}
            <p className="break-all text-xs study-copy">
              Phiên bản: {sourceInfo?.version || "Chưa có"}
            </p>
            <p>
              <a
                className="underline"
                href="https://www.edrdg.org/edrdg/licence.html"
                target="_blank"
                rel="noreferrer"
              >
                Giấy phép và ghi công
              </a>{" "}
              ·{" "}
              <a
                className="underline"
                href="https://www.edrdg.org/jmdict/edict_doc.html"
                target="_blank"
                rel="noreferrer"
              >
                Tài liệu JMdict
              </a>
            </p>
          </section>
        ) : (
          <>
            <form
              className="dictionary-search"
              onSubmit={(e) => {
                e.preventDefault();
                setCursor(null);
                setCursorStack([]);
                navigate(`/dictionary?q=${encodeURIComponent(input)}`);
                searchRef.current?.blur();
              }}
              role="search"
            >
              <Search aria-hidden="true" size={24} />
              <input
                ref={searchRef}
                aria-label="Tra từ điển"
                lang="ja"
                value={input}
                maxLength={100}
                placeholder="Kanji, kana, romaji hoặc nghĩa Anh…"
                autoComplete="off"
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={(e) => {
                  setInput(e.currentTarget.value);
                  setComposing(false);
                }}
                onChange={(e) => setInput(e.target.value)}
              />
              {input && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa"
                  onClick={() => {
                    setInput("");
                    navigate("/dictionary");
                    searchRef.current?.focus();
                  }}
                >
                  <X size={19} />
                </button>
              )}
              <button
                type="submit"
                className="study-button study-button-primary"
              >
                Tra từ
              </button>
            </form>
            <div className="dictionary-search-note">
              <span>Nhật → Anh · Không cần đăng nhập để tra</span>
              <span>
                {sourceInfo?.ready
                  ? `${sourceInfo.entryCount.toLocaleString("vi-VN")} mục từ`
                  : ""}
              </span>
            </div>
            {pending && !user && !authLoading && (
              <div className="dictionary-pending">
                <span>
                  Đã giữ từ{" "}
                  <strong lang="ja">{defaultSelection(pending).written}</strong>{" "}
                  để thêm vào bộ thẻ.
                </span>
                <div className="flex gap-2">
                  <button className="study-button" onClick={requestAuth}>
                    Đăng nhập để chọn bộ
                  </button>
                  <button className="study-button" onClick={closeAdd}>
                    Hủy
                  </button>
                </div>
              </div>
            )}
            {restoreError && (
              <p role="alert" className="study-panel">
                {restoreError}
                <button className="study-button ml-2" onClick={retryRestore}>
                  Thử kết nối lại
                </button>
              </p>
            )}
            <div
              className={`dictionary-content ${key ? "dictionary-show-detail" : ""}`}
            >
              <section
                className="dictionary-results"
                aria-label="Kết quả tra từ"
                aria-busy={loading}
              >
                {searchNotice && (
                  <p className="study-copy mb-3 text-sm" role="status">
                    {searchNotice}
                  </p>
                )}
                {loading && <AppLoading message="Đang tìm mục từ…" />}
                {error && (
                  <div className="study-panel space-y-3" role="alert">
                    <p>{error}</p>
                    <button
                      className="study-button"
                      onClick={() => {
                        setCursor(null);
                        setCursorStack([]);
                        setRetry((r) => r + 1);
                      }}
                    >
                      Thử lại
                    </button>
                  </div>
                )}
                {!query && !loading && (
                  <div className="dictionary-empty">
                    <span className="dictionary-empty-kanji" lang="ja">
                      言葉
                    </span>
                    <h2>Gặp một từ mới?</h2>
                    <p>Tra cách đọc và nghĩa, rồi thêm vào bộ thẻ của bạn.</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                      {["食べる", "勉強", "neko", "ありがとう"].map((q) => (
                        <button
                          className="study-button"
                          key={q}
                          onClick={() => {
                            setInput(q);
                            navigate(`/dictionary?q=${encodeURIComponent(q)}`);
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    {sourceInfo && !sourceInfo.ready && (
                      <p className="mt-5" role="status">
                        Từ điển đang được chuẩn bị.
                      </p>
                    )}
                  </div>
                )}
                {data && (
                  <>
                    <div className="dictionary-result-label">
                      <span>
                        {resultsCurrent
                          ? `Kết quả cho “${query}”`
                          : "Kết quả trước đó"}
                      </span>
                      <small>Trang {cursorStack.length + 1}</small>
                    </div>
                    {data.items.map((hit) => {
                      const choice = defaultSelection(
                        hit.word,
                        hit.matchedForm,
                        hit.matchedSenseId,
                      );
                      return (
                        <article
                          key={hit.word.key}
                          className="dictionary-result"
                        >
                          <div className="dictionary-result-top">
                            <Link
                              onClick={() => {
                                resultsScroll.current = window.scrollY;
                              }}
                              to={`/dictionary/words/${encodeURIComponent(hit.word.key)}?q=${encodeURIComponent(query)}`}
                              className="dictionary-word-link"
                            >
                              <h2 lang="ja">{choice.written}</h2>
                              <span lang="ja">{choice.reading}</span>
                            </Link>
                            {hit.word.common && (
                              <span className="dictionary-common">
                                Thông dụng
                              </span>
                            )}
                          </div>
                          <p className="dictionary-meaning">
                            {senseText(choice.sense)}
                          </p>
                          <div className="dictionary-result-bottom">
                            <span>
                              {hit.matchType === "meaning"
                                ? "Khớp nghĩa Anh"
                                : hit.matchType === "deinflected"
                                  ? `${query} → ${hit.matchedForm}`
                                  : hit.matchType === "prefix"
                                    ? "Khớp đầu từ"
                                    : "Khớp từ / cách đọc"}
                            </span>
                            <button
                              className="study-button"
                              disabled={!resultsCurrent || authLoading}
                              onClick={() =>
                                add({
                                  ...hit.word,
                                  preferredSelection: {
                                    written: choice.written,
                                    reading: choice.reading,
                                    senseId: choice.sense.id,
                                  },
                                })
                              }
                            >
                              <Plus size={16} />
                              Thêm vào bộ thẻ
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {resultsCurrent && !data.items.length && (
                      <div className="dictionary-empty">
                        <h2>Chưa tìm thấy từ phù hợp</h2>
                        <p>
                          Thử cách viết khác, dạng từ điển hoặc nghĩa tiếng Anh.
                          Một số dạng chia chưa được hỗ trợ.
                        </p>
                      </div>
                    )}
                    {resultsCurrent &&
                      (cursorStack.length > 0 || data.nextCursor) && (
                        <div className="dictionary-pagination">
                          <button
                            className="study-button"
                            disabled={!cursorStack.length}
                            onClick={() => {
                              setCursor(cursorStack[cursorStack.length - 1]);
                              setCursorStack((s) => s.slice(0, -1));
                            }}
                          >
                            Trang trước
                          </button>
                          <button
                            className="study-button"
                            disabled={!data.nextCursor}
                            onClick={() => {
                              setCursorStack((s) => [...s, cursor]);
                              setCursor(data.nextCursor);
                            }}
                          >
                            Trang tiếp
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                  </>
                )}
              </section>
              {key && (
                <aside className="dictionary-detail">
                  <Link className="dictionary-back" to={returnUrl}>
                    <ArrowLeft size={17} />
                    Quay lại kết quả
                  </Link>
                  {detailLoading && <AppLoading message="Đang mở mục từ…" />}
                  {detailError && (
                    <div role="alert">
                      <p>{detailError}</p>
                      <button
                        className="study-button mt-3"
                        onClick={() => setRetry((r) => r + 1)}
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                  {detail && (
                    <>
                      <p className="dictionary-caption mt-6">MỤC TỪ · JMdict</p>
                      <h2 className="dictionary-detail-word" lang="ja">
                        {defaultSelection(detail).written}
                      </h2>
                      <p lang="ja" className="dictionary-detail-reading">
                        {detail.readings.map((r) => r.text).join(" · ")}
                      </p>
                      {detail.writtenForms.length > 1 && (
                        <p className="study-copy mt-2" lang="ja">
                          Cách viết khác:{" "}
                          {detail.writtenForms.slice(1).join(" · ")}
                        </p>
                      )}
                      <button
                        className="study-button study-button-primary mt-5"
                        disabled={authLoading}
                        onClick={() => add(detail)}
                      >
                        <Plus size={17} />
                        Thêm vào bộ thẻ
                      </button>
                      <ol className="dictionary-senses">
                        {detail.senses.map((s, i) => (
                          <li key={`${s.id}-${i}`}>
                            <span className="dictionary-sense-number">
                              {i + 1}
                            </span>
                            <div>
                              <p className="dictionary-pos">
                                {s.partsOfSpeech.join(" · ")}
                              </p>
                              <p>{senseText(s)}</p>
                              {s.writtenForms.length > 0 && (
                                <small>
                                  Cách viết: {s.writtenForms.join(", ")}
                                </small>
                              )}
                              {s.readings.length > 0 && (
                                <small>Cách đọc: {s.readings.join(", ")}</small>
                              )}
                              {s.notes.length > 0 && (
                                <p className="study-copy text-xs mt-2">
                                  {s.notes.join(" · ")}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
        {sourceError && (
          <p className="study-copy text-sm" role="status">
            {sourceError}
          </p>
        )}
        <Attribution />
      </div>
      {pending && user && !authLoading && (
        <Suspense fallback={<AppLoading message="Đang mở hộp chọn bộ thẻ…" />}>
          <AddDialog
            key={`${user.id}:${pending.key}`}
            word={pending}
            onUpdateWord={updatePendingWord}
            onClose={closeAdd}
          />
        </Suspense>
      )}
    </main>
  );
}
