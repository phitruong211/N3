import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/lib/api";
import { browseLibrary, type LibraryPage } from "@/lib/deckSharing";
import { AppLoading } from "@/components/ui/AppLoading";
import { SharedPageLayout } from "./SharedPageLayout";

const LEVELS = ["", "N5", "N4", "N3", "N2", "N1"];

/** The public library: decks people chose to share with everyone. Browsing needs no account; saving does. */
export function ExplorePage() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<LibraryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    browseLibrary({ query, level, sort, page }, controller.signal).then(next => { if (!controller.signal.aborted) setResult(next); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ApiError ? reason.message : "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, level, sort, page, attempt]);
  const search = (event: FormEvent) => { event.preventDefault(); setPage(0); setQuery(draft); };
  const choose = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(0); };

  return <SharedPageLayout>
    <section className="shared-hero"><div className="shared-hero-copy"><p className="study-eyebrow">THƯ VIỆN CỘNG ĐỒNG</p><h1>Khám phá bộ thẻ</h1>
      <p className="shared-meta">Bộ thẻ do người học chia sẻ. Xem trước tự do; đăng nhập để lưu thành bản riêng với lịch ôn của bạn.</p></div></section>
    <form className="mb-5 flex flex-wrap items-end gap-3" role="search" onSubmit={search}>
      <label className="min-w-56 flex-1 text-sm">Tìm bộ thẻ
        <input className="study-input mt-1" type="search" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Tên bộ, mô tả hoặc người chia sẻ" />
      </label>
      <button type="submit" className="study-button study-button-primary">Tìm</button>
      <label className="text-sm">Sắp xếp
        <select className="study-input mt-1" value={sort} onChange={event => choose(setSort)(event.target.value as "recent" | "popular")}><option value="recent">Mới nhất</option><option value="popular">Nhiều lượt lưu</option></select>
      </label>
    </form>
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Lọc theo cấp độ">
      {LEVELS.map(item => <button key={item || "all"} type="button" className={`study-button !min-h-9 ${level === item ? "study-button-primary" : ""}`} aria-pressed={level === item} onClick={() => choose(setLevel)(item)}>{item || "Tất cả"}</button>)}
    </div>
    {error && <div className="shared-error" role="alert"><p>{error}</p><button type="button" className="study-button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}
    {loading && !result ? <AppLoading message="Đang tải thư viện…" /> : result && <>
      <p className="study-copy mb-3 text-sm" role="status">{result.total.toLocaleString("vi-VN")} bộ thẻ{query ? ` cho “${query}”` : ""}{level ? ` · ${level}` : ""}</p>
      {result.items.length === 0 ? <p className="study-copy">Chưa có bộ thẻ phù hợp. Thử từ khóa hoặc cấp độ khác.</p> : <ul className="grid gap-3 sm:grid-cols-2" aria-busy={loading}>
        {result.items.map(item => <li key={item.token}><Link className="study-panel block h-full space-y-2 hover:border-[var(--color-accent)]" to={`/shared/${encodeURIComponent(item.token)}`}>
          <div className="flex items-start justify-between gap-2"><h2 className="break-words text-base font-semibold">{item.name}</h2>{item.level && <span className="study-pill">{item.level}</span>}</div>
          {item.description && <p className="study-copy line-clamp-3 text-sm">{item.description}</p>}
          <p className="study-copy text-xs">{item.cardCount.toLocaleString("vi-VN")} thẻ · {item.author} · {item.downloads.toLocaleString("vi-VN")} lượt lưu</p>
        </Link></li>)}
      </ul>}
      {result.totalPages > 1 && <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Phân trang">
        <button type="button" className="study-button" disabled={page <= 0 || loading} onClick={() => setPage(page - 1)}>Trước</button>
        <span className="study-copy text-sm">Trang {page + 1} / {result.totalPages}</span>
        <button type="button" className="study-button" disabled={page >= result.totalPages - 1 || loading} onClick={() => setPage(page + 1)}>Sau</button>
      </nav>}
    </>}
    <footer className="shared-footer"><p>Mỗi bộ do chính người đăng chịu trách nhiệm về nội dung. Thấy nội dung vi phạm bản quyền hoặc không phù hợp? Mở bộ thẻ và chọn “Báo cáo bộ thẻ này”.</p></footer>
  </SharedPageLayout>;
}
