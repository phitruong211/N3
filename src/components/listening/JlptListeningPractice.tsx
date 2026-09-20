import { useRef, useState } from 'react';
import { Check, Headphones, RotateCcw, Volume2 } from 'lucide-react';
import { examItems, type ExamLevel } from './examData';

type Scores = Record<string, number>;
const STORAGE_KEY = 'nhat-jlpt-listening-scores-v1';

function readScores(): Scores {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Scores; }
  catch { return {}; }
}

export function JlptListeningPractice() {
  const [level, setLevel] = useState<ExamLevel>('N4');
  const [selectedId, setSelectedId] = useState('n4-station');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState<Scores>(readScores);
  const [speed, setSpeed] = useState(1);
  const [audioFailed, setAudioFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const items = examItems.filter(item => item.level === level);
  const item = examItems.find(entry => entry.id === selectedId) ?? items[0];
  const correct = item.questions.filter((question, index) => answers[index] === question.answer).length;

  const selectItem = (id: string) => {
    audioRef.current?.pause();
    setSelectedId(id);
    setAnswers({});
    setSubmitted(false);
    setSpeed(1);
    setAudioFailed(false);
  };
  const selectLevel = (next: ExamLevel) => {
    setLevel(next);
    selectItem(examItems.find(entry => entry.level === next)!.id);
  };
  const submit = () => {
    if (Object.keys(answers).length !== item.questions.length) return;
    const next = { ...scores, [item.id]: Math.max(scores[item.id] ?? 0, correct) };
    setScores(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSubmitted(true);
  };
  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  return <div className="space-y-5">
    <section className="study-panel space-y-4">
      <div>
        <p className="study-eyebrow">Bài tự biên soạn · phong cách JLPT</p>
        <h2 className="text-xl font-semibold">Nghe và chọn đáp án</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Nghe trước, trả lời trắc nghiệm, rồi xem đáp án và bản dịch từng câu. Audio là giọng đọc tổng hợp tiếng Nhật.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cấp độ bài thi">
        {(['N4', 'N3', 'N2'] as const).map(next => <button key={next} className={`study-button ${level === next ? 'study-button-primary' : ''}`} aria-pressed={level === next} onClick={() => selectLevel(next)}>{next} <span className="text-xs opacity-75">({examItems.filter(entry => entry.level === next).length})</span></button>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((entry, index) => <button key={entry.id} onClick={() => selectItem(entry.id)} aria-current={item.id === entry.id ? 'true' : undefined} className={`text-left rounded-xl border p-3 cursor-pointer transition-colors ${item.id === entry.id ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'}`}>
          <span className="block text-xs text-[var(--color-text-secondary)]">Bài {index + 1} · {entry.category}</span>
          <span className="block font-semibold mt-1">{entry.title}</span>
          {scores[entry.id] !== undefined && <span className="text-xs text-[var(--color-accent-text)]">Điểm tốt nhất: {scores[entry.id]}/{entry.questions.length}</span>}
        </button>)}
      </div>
    </section>

    <section className="study-panel space-y-5" aria-label={`Bài nghe ${item.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="study-eyebrow">{item.level} · {item.category} · {item.questions.length} câu hỏi</p><h3 className="text-xl font-semibold">{item.title}</h3></div><span className="study-pill inline-flex items-center gap-1"><Headphones size={14} /> Luyện thi</span></div>
      <div className="rounded-xl bg-[var(--color-surface-alt)] p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><Volume2 size={17} /> Nghe đoạn hội thoại / thông báo</p>
        <audio key={item.id} ref={audioRef} src={`${import.meta.env.BASE_URL}audio/jlpt/${item.id}.m4a`} controls preload="metadata" className="w-full" aria-label={`Audio bài ${item.title}`} onError={() => setAudioFailed(true)} />
        {audioFailed && <p role="alert" className="text-sm text-[var(--color-error)]">Không tải được audio. Hãy tải lại trang và thử lần nữa.</p>}
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[var(--color-text-secondary)]">Tốc độ</span>{[0.8, 1, 1.2].map(rate => <button key={rate} className={`study-button !min-h-8 !px-2 !py-1 !text-xs ${speed === rate ? 'study-button-primary' : ''}`} aria-pressed={speed === rate} onClick={() => { setSpeed(rate); if (audioRef.current) audioRef.current.playbackRate = rate; }}>{rate}×</button>)}</div>
      </div>
      <div className="space-y-5">{item.questions.map((question, questionIndex) => <fieldset key={questionIndex} className="space-y-2">
        <legend className="font-semibold mb-2">Câu {questionIndex + 1}. {question.prompt}</legend>
        <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => {
          const isCorrect = submitted && optionIndex === question.answer;
          const isWrong = submitted && answers[questionIndex] === optionIndex && !isCorrect;
          return <label key={optionIndex} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${isCorrect ? 'border-[var(--color-success)] bg-[var(--color-success-subtle)]' : isWrong ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}>
            <input type="radio" name={`${item.id}-question-${questionIndex}`} checked={answers[questionIndex] === optionIndex} disabled={submitted} onChange={() => setAnswers(previous => ({ ...previous, [questionIndex]: optionIndex }))} className="mt-1 accent-[var(--color-accent)]" />
            <span className="text-sm">{String.fromCharCode(65 + optionIndex)}. {option}</span>
          </label>;
        })}</div>
        {submitted && <p className="text-sm text-[var(--color-text-secondary)]"><strong>{answers[questionIndex] === question.answer ? 'Đúng.' : `Đáp án: ${String.fromCharCode(65 + question.answer)}.`}</strong> {question.explanation}</p>}
      </fieldset>)}</div>
      {!submitted ? <button className="study-button study-button-primary" disabled={Object.keys(answers).length !== item.questions.length} onClick={submit}><Check size={16} /> Nộp bài và xem lời dịch</button> : <div className="flex flex-wrap items-center gap-3"><p role="status" className="font-semibold">Kết quả: {correct}/{item.questions.length} câu đúng</p><button className="study-button" onClick={retry}><RotateCcw size={16} /> Làm lại</button><button className="study-button" onClick={() => selectItem(items[(items.findIndex(entry => entry.id === item.id) + 1) % items.length].id)}>Bài tiếp theo →</button></div>}
    </section>

    {submitted && <section className="study-panel space-y-4" aria-label="Lời thoại và bản dịch từng câu">
      <div><p className="study-eyebrow">Đối chiếu sau khi làm bài</p><h3 className="text-xl font-semibold">Lời thoại và dịch từng câu</h3></div>
      <ol className="space-y-3">{item.transcript.map((line, index) => <li key={index} className="rounded-xl border border-[var(--color-border)] p-4 space-y-2"><p className="text-xs text-[var(--color-text-tertiary)]">Câu {index + 1}</p><p lang="ja" className="font-jp text-lg leading-relaxed">{line.ja}</p><p className="text-sm text-[var(--color-text-secondary)]">{line.vi}</p></li>)}</ol>
    </section>}
  </div>;
}
