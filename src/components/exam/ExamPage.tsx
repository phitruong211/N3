import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLearningStorage } from '@/hooks/useApp';
import { Check, ExternalLink, RotateCcw } from '@/components/ui/icons';
import { EmptyState, PageHeading } from '@/components/ui/StudyUI';

type Question = { prompt: string; options: string[] };
/** `questions` (optional) lets an exam without a PDF show its questions as text; it must line up with `answers`. */
type Group = { label: string; instructions?: string; passage?: string; answers: number[]; questions?: Question[] };
type Section = { id: string; title: string; minutes: number; audio?: boolean; groups: Group[] };
type Exam = { id: string; level: string; title: string; pdf?: string; audio?: string; answerPdf?: string; scriptPdf?: string; sections: Section[] };
/** answers: one array per section id, 0 = chưa chọn. */
type Answers = Record<string, number[]>;
type Draft = { step: number; startedAt: number | null; answers: Answers; secs: number[] };
type Attempt = { at: number; sections: { id: string; correct: number; total: number; secs: number }[]; answers: Answers };
type Store = { drafts: Record<string, Draft>; history: Record<string, Attempt[]> };

const STORAGE_KEY = 'nhat-jlpt-exam-v1';
const BASE = import.meta.env.BASE_URL;
const flat = (section: Section) => section.groups.flatMap(group => group.answers);
const total = (exam: Exam) => exam.sections.reduce((sum, section) => sum + flat(section).length, 0);
const minutesOf = (exam: Exam) => exam.sections.reduce((sum, section) => sum + section.minutes, 0);
const clock = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
const asset = (path: string) => `${BASE}exams/${path}`;
const newDraft = (exam: Exam): Draft => ({ step: 0, startedAt: null, secs: [], answers: Object.fromEntries(exam.sections.map(section => [section.id, flat(section).map(() => 0)])) });

/** Two-step button: the first click arms it, the second one confirms. */
function ConfirmButton({ label, confirmLabel, onConfirm, primary }: { label: string; confirmLabel: string; onConfirm: () => void; primary?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(id); }, [armed]);
  return <button className={`study-button ${primary && !armed ? 'study-button-primary' : ''}`} style={armed ? { borderColor: 'var(--color-error)', color: 'var(--color-error)' } : undefined} onClick={() => armed ? (setArmed(false), onConfirm()) : setArmed(true)}>{armed ? confirmLabel : label}</button>;
}

export function ExamPage() {
  const storage = useLearningStorage();
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [store, setStore] = useState<Store>(() => { try { return { drafts: {}, history: {}, ...storage.getJSON<Partial<Store>>(STORAGE_KEY, {}) }; } catch { return { drafts: {}, history: {} }; } });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ examId: string; attempt: Attempt } | null>(null);

  useEffect(() => {
    fetch(`${BASE}exams/index.json`).then(response => response.ok ? response.json() : Promise.reject()).then(data => setExams(data.exams)).catch(() => setFailed(true));
  }, []);
  const save = useCallback((update: (previous: Store) => Store) => setStore(previous => {
    const next = update(previous);
    try { storage.setJSON(STORAGE_KEY, next); } catch { /* the exam still works without browser storage */ }
    return next;
  }), [storage]);

  if (failed) return <EmptyState title="Không tải được danh sách đề" detail="Hãy tải lại trang và thử lần nữa." />;
  if (!exams) return <p className="study-copy" role="status">Đang tải danh sách đề…</p>;

  const active = exams.find(exam => exam.id === activeId);
  const draft = active && store.drafts[active.id];
  if (viewing) {
    const exam = exams.find(entry => entry.id === viewing.examId)!;
    return <Result exam={exam} attempt={viewing.attempt} onBack={() => setViewing(null)} onRetry={() => { save(s => ({ ...s, drafts: { ...s.drafts, [exam.id]: newDraft(exam) } })); setActiveId(exam.id); setViewing(null); }} />;
  }
  if (active && draft) {
    const setDraft = (next: Draft) => save(s => ({ ...s, drafts: { ...s.drafts, [active.id]: next } }));
    const finish = (final: Draft) => {
      const attempt: Attempt = { at: Date.now(), answers: final.answers, sections: active.sections.map((section, index) => ({ id: section.id, total: flat(section).length, secs: final.secs[index] ?? 0, correct: flat(section).filter((key, i) => final.answers[section.id]?.[i] === key).length })) };
      save(s => { const { [active.id]: _gone, ...drafts } = s.drafts; return { drafts, history: { ...s.history, [active.id]: [attempt, ...(s.history[active.id] ?? [])].slice(0, 20) } }; });
      setActiveId(null);
      setViewing({ examId: active.id, attempt });
    };
    return <Runner exam={active} draft={draft} setDraft={setDraft} finish={finish} onReset={() => { save(s => { const { [active.id]: _gone, ...drafts } = s.drafts; return { ...s, drafts }; }); setActiveId(null); }} onLeave={() => setActiveId(null)} />;
  }

  return <div className="space-y-8">
    <PageHeading title="Đề thi JLPT" subtitle="Làm đề thật như phòng thi: đồng hồ đếm ngược từng phần, chấm điểm bằng đáp án chính thức, lưu kết quả và thời gian." />
    {exams.length === 0 && <EmptyState title="Chưa có đề nào" detail="Thêm đề vào public/exams/index.json (xem docs/exams.md)." />}
    <div className="grid gap-4 lg:grid-cols-2">{exams.map(exam => {
      const history = store.history[exam.id] ?? [];
      const pending = store.drafts[exam.id];
      const best = history.reduce((max, attempt) => Math.max(max, attempt.sections.reduce((sum, section) => sum + section.correct, 0)), -1);
      return <section key={exam.id} className="study-panel space-y-4" aria-label={exam.title}>
        <div className="flex items-start justify-between gap-3"><div><p className="study-eyebrow">{exam.level} · {exam.sections.length} phần · {total(exam)} câu · {minutesOf(exam)} phút</p><h2 className="text-xl font-semibold">{exam.title}</h2></div>{best >= 0 && <span className="study-pill">Tốt nhất {best}/{total(exam)}</span>}</div>
        <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">{exam.sections.map(section => <li key={section.id} className="flex justify-between gap-3"><span>{section.title}</span><span className="tabular-nums">{flat(section).length} câu · {section.minutes} phút</span></li>)}</ul>
        <div className="flex flex-wrap gap-2">
          <button className="study-button study-button-primary" onClick={() => { if (!pending) save(s => ({ ...s, drafts: { ...s.drafts, [exam.id]: newDraft(exam) } })); setActiveId(exam.id); }}>{pending ? `Tiếp tục · phần ${pending.step + 1}/${exam.sections.length}` : 'Bắt đầu thi'}</button>
          {pending && <ConfirmButton label="Làm lại từ đầu" confirmLabel="Bấm lần nữa để xóa bài đang làm" onConfirm={() => save(s => { const { [exam.id]: _gone, ...drafts } = s.drafts; return { ...s, drafts }; })} />}
        </div>
        {history.length > 0 && <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
          <p className="text-sm font-semibold">Lịch sử làm bài</p>
          <ul className="space-y-1">{history.map(attempt => <li key={attempt.at}><button className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-hover)]" onClick={() => setViewing({ examId: exam.id, attempt })}><span>{new Date(attempt.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span><span className="tabular-nums text-[var(--color-text-secondary)]">{attempt.sections.reduce((sum, section) => sum + section.correct, 0)}/{total(exam)} · {Math.round(attempt.sections.reduce((sum, section) => sum + section.secs, 0) / 60)} phút</span></button></li>)}</ul>
          <ConfirmButton label="Xóa lịch sử" confirmLabel="Bấm lần nữa để xóa hết lịch sử" onConfirm={() => save(s => { const { [exam.id]: _gone, ...history } = s.history; return { ...s, history }; })} />
        </div>}
      </section>;
    })}</div>
  </div>;
}

function Runner({ exam, draft, setDraft, finish, onReset, onLeave }: { exam: Exam; draft: Draft; setDraft: (draft: Draft) => void; finish: (draft: Draft) => void; onReset: () => void; onLeave: () => void }) {
  const section = exam.sections[draft.step];
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const limit = section.minutes * 60;
  const used = draft.startedAt ? Math.max(0, Math.floor((now - draft.startedAt) / 1000)) : 0;
  const remaining = limit - used;
  const sheet = draft.answers[section.id];
  const [pane, setPane] = useState<'pdf' | 'sheet'>('pdf');
  const [wide, setWide] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const running = draft.startedAt !== null;
  const textual = !exam.pdf;
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => { document.removeEventListener('fullscreenchange', sync); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  const submit = useCallback((timeUp = false) => {
    const next: Draft = { ...draft, step: draft.step + 1, startedAt: null, secs: [...draft.secs, timeUp ? limit : Math.min(limit, draft.startedAt ? Math.floor((Date.now() - draft.startedAt) / 1000) : 0)] };
    if (next.step >= exam.sections.length) finish(next); else setDraft(next);
  }, [draft, exam.sections.length, finish, limit, setDraft]);
  useEffect(() => { if (draft.startedAt && remaining <= 0) submit(true); }, [draft.startedAt, remaining, submit]);

  if (!draft.startedAt) return <div className="study-panel mx-auto max-w-xl space-y-4 text-center">
    <p className="study-eyebrow">{exam.title} · phần {draft.step + 1}/{exam.sections.length}</p>
    <h2 className="text-2xl font-semibold">{section.title}</h2>
    <p className="study-copy">{sheet.length} câu · {section.minutes} phút. Đồng hồ bắt đầu chạy ngay khi bạn bấm bắt đầu và tự nộp bài khi hết giờ.</p>
    <div className="flex flex-wrap justify-center gap-2"><button className="study-button study-button-primary" onClick={() => setDraft({ ...draft, startedAt: Date.now() })}>Bắt đầu phần {draft.step + 1}</button><button className="study-button" onClick={onLeave}>Thoát, làm tiếp sau</button><ConfirmButton label="Hủy bài thi" confirmLabel="Bấm lần nữa để xóa bài" onConfirm={onReset} /></div>
  </div>;

  const blank = sheet.filter(value => !value).length;
  let counter = 0;
  const choose = (at: number, choice: number) => setDraft({ ...draft, answers: { ...draft.answers, [section.id]: sheet.map((value, i) => i === at ? (value === choice ? 0 : choice) : value) } });
  const tab = (id: 'pdf' | 'sheet', label: string) => <button className={`study-button !min-h-9 flex-1 ${pane === id ? 'study-button-primary' : ''}`} aria-pressed={pane === id} onClick={() => setPane(id)}>{label}</button>;
  return createPortal(<div className="fixed inset-0 z-[100] flex flex-col gap-2 bg-[var(--color-bg)] p-2 sm:p-3" role="region" aria-label={`Đang thi ${exam.title}`}>
    <div className="study-panel flex flex-wrap items-center justify-between gap-x-4 gap-y-2 !px-4 !py-2">
      <div className="min-w-0"><p className="study-eyebrow">{exam.title} · phần {draft.step + 1}/{exam.sections.length}</p><p className="truncate font-semibold">{section.title}</p></div>
      <p role="timer" aria-label="Thời gian còn lại" className={`font-mono text-3xl tabular-nums ${remaining <= 300 ? 'text-[var(--color-error)]' : ''}`}>{clock(remaining)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">{sheet.length - blank}/{sheet.length} câu</span>
        {!textual && <span className="hidden lg:inline-flex"><button className="study-button !min-h-9" aria-pressed={wide} onClick={() => setWide(!wide)} title="Ẩn phiếu để đề rộng hết cỡ">{wide ? 'Hiện phiếu' : 'Đề rộng'}</button></span>}
        {document.documentElement.requestFullscreen && <span className="hidden sm:inline-flex"><button className="study-button !min-h-9" aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</button></span>}
        <ConfirmButton primary label={`Nộp phần ${draft.step + 1}`} confirmLabel={blank ? `Còn ${blank} câu trống, nộp luôn?` : 'Bấm lần nữa để nộp'} onConfirm={() => submit()} />
        <button className="study-button !min-h-9" onClick={onLeave} title="Đồng hồ vẫn chạy khi bạn thoát">Thoát</button>
      </div>
    </div>
    {section.audio && exam.audio && <audio src={asset(exam.audio)} controls preload="metadata" className="h-10 w-full" aria-label="Audio phần nghe" />}
    {!textual && <div className="flex gap-2 lg:hidden">{tab('pdf', 'Đề thi')}{tab('sheet', `Phiếu trả lời (${sheet.length - blank}/${sheet.length})`)}</div>}
    <div className={`grid min-h-0 flex-1 gap-2 ${wide || textual ? '' : 'lg:grid-cols-[minmax(0,1fr)_21rem]'}`}>
      {textual ? <div className="study-panel min-h-0 overflow-y-auto !p-4 sm:!p-6 lg:col-span-full"><div className="mx-auto max-w-3xl space-y-8">
        {section.groups.every(group => !group.questions) && <p className="study-copy" role="alert">Phần này chưa có nội dung câu hỏi. Thêm `pdf` hoặc `questions` vào đề (xem docs/exams.md).</p>}
        {section.groups.map(group => <fieldset key={group.label} className="space-y-4"><legend lang="ja" className="study-eyebrow">{group.label}</legend>
          {group.instructions && <p lang="ja" className="font-jp font-semibold">{group.instructions}</p>}
          {group.passage && <p lang="ja" className="font-jp whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-4 leading-relaxed">{group.passage}</p>}
          {group.answers.map((_, index) => { const at = counter++; const question = group.questions?.[index]; return question && <div key={at} className="space-y-2"><p lang="ja" className="font-jp text-lg leading-relaxed"><span className="mr-2 tabular-nums text-[var(--color-text-secondary)]">{index + 1}.</span>{question.prompt}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={`${group.label} câu ${index + 1}`}>{question.options.map((option, i) => <button key={i} lang="ja" aria-pressed={sheet[at] === i + 1} onClick={() => choose(at, i + 1)} className={`study-button !h-auto !min-h-11 !justify-start !whitespace-normal !py-2 text-left font-jp ${sheet[at] === i + 1 ? 'study-button-primary' : ''}`}><span className="mr-2 tabular-nums">{i + 1}</span>{option}</button>)}</div></div>; })}
        </fieldset>)}
      </div></div> : <><div className={`${pane === 'pdf' ? 'flex' : 'hidden'} min-h-0 flex-col gap-1 lg:flex`}>
        <iframe title={`Đề thi ${exam.title}`} src={`${asset(exam.pdf)}#toolbar=1&navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <a className="self-end text-xs text-[var(--color-text-secondary)] underline" href={asset(exam.pdf)} target="_blank" rel="noreferrer">Không xem được đề? Mở PDF ở tab mới</a>
      </div>
      <div className={`study-panel min-h-0 space-y-4 overflow-y-auto !p-4 ${pane === 'sheet' ? 'block' : 'hidden'} ${wide ? 'lg:hidden' : 'lg:block'}`} aria-label="Phiếu trả lời" hidden={textual}>
        {section.groups.map(group => <fieldset key={group.label} className="space-y-1.5"><legend lang="ja" className="study-eyebrow mb-1">{group.label}</legend>
          {group.answers.map((_, index) => { const at = counter++; return <div key={at} className="flex items-center justify-between gap-2"><span className="w-7 text-sm tabular-nums text-[var(--color-text-secondary)]">{index + 1}</span><div className="flex gap-1.5" role="group" aria-label={`${group.label} câu ${index + 1}`}>{[1, 2, 3, 4].map(choice => <button key={choice} aria-pressed={sheet[at] === choice} className={`study-button !min-h-9 !w-11 !p-0 ${sheet[at] === choice ? 'study-button-primary' : ''}`} onClick={() => choose(at, choice)}>{choice}</button>)}</div></div>; })}
        </fieldset>)}
      </div></>}
    </div>
  </div>, document.body);
}

function Result({ exam, attempt, onBack, onRetry }: { exam: Exam; attempt: Attempt; onBack: () => void; onRetry: () => void }) {
  const correct = attempt.sections.reduce((sum, section) => sum + section.correct, 0);
  const secs = attempt.sections.reduce((sum, section) => sum + section.secs, 0);
  return <div className="space-y-6">
    <PageHeading title={`Kết quả · ${exam.title}`} subtitle={`${new Date(attempt.at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })} · đúng ${correct}/${total(exam)} câu · ${Math.round(secs / 60)} phút`} action={<div className="flex gap-2"><button className="study-button" onClick={onBack}>← Danh sách đề</button><button className="study-button study-button-primary" onClick={onRetry}><RotateCcw size={16} /> Làm lại</button></div>} />
    <div className="grid gap-3 sm:grid-cols-3">{exam.sections.map((section, index) => { const result = attempt.sections[index]; return <div key={section.id} className="study-panel"><p className="study-eyebrow">{section.title}</p><p className="text-3xl font-semibold tabular-nums">{result.correct}<span className="text-lg text-[var(--color-text-secondary)]">/{result.total}</span></p><p className="text-sm text-[var(--color-text-secondary)]">{clock(result.secs)} / {section.minutes}:00 phút</p></div>; })}</div>
    {exam.sections.map(section => { const mine = attempt.answers[section.id] ?? []; let at = 0; const wrong = section.groups.flatMap(group => group.answers.map((key, index) => ({ label: group.label, n: index + 1, key, got: mine[at++] }))).filter(item => item.got !== item.key);
      return <section key={section.id} className="study-panel space-y-3"><h3 className="text-lg font-semibold">{section.title} · {wrong.length ? `sai/bỏ trống ${wrong.length} câu` : <span className="inline-flex items-center gap-1 text-[var(--color-success)]"><Check size={16} /> đúng hết</span>}</h3>
        {wrong.length > 0 && <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">{wrong.map(item => <li key={`${item.label}-${item.n}`} className="flex justify-between gap-2 border-b border-[var(--color-border)] py-1"><span><span lang="ja">{item.label}</span> · câu {item.n}</span><span className="tabular-nums">{item.got ? <span className="text-[var(--color-error)]">{item.got}</span> : <span className="text-[var(--color-text-tertiary)]">trống</span>} → <strong className="text-[var(--color-success)]">{item.key}</strong></span></li>)}</ul>}</section>; })}
    {(exam.answerPdf || exam.scriptPdf) && <div className="flex flex-wrap gap-2">{exam.answerPdf && <a className="study-button" href={asset(exam.answerPdf)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Đáp án chi tiết</a>}{exam.scriptPdf && <a className="study-button" href={asset(exam.scriptPdf)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Script phần nghe</a>}</div>}
  </div>;
}
