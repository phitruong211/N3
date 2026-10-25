import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Download } from '@/components/ui/icons';
import { checkImportText, type ImportCheck } from '@/lib/ankiImport';
import { builtinNoteTypes } from '@/lib/deckFormat';
import { buildFormattingPrompt, buildStructurePrompt, exampleDeckFile } from '@/lib/deckPrompts';
import { downloadFile } from '@/lib/download';

const MARKDOWN_SAMPLE = `# Tên bộ thẻ
勉強[べんきょう]する :: học, học tập :: べんきょうする
先生[せんせい] :: giáo viên

# Hoặc viết từng thẻ thành một khối "khóa: giá trị", cách nhau bằng dòng trống:
# type: vocab
# front: 切符[きっぷ]
# back: vé
# example: 切符を買います。 | | Tôi mua vé.
`;

function PromptSection({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setError(true); }
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">{title}</h4>
      <button type="button" className="study-button" aria-label={`Sao chép ${title}`} onClick={() => void copy()}>
        {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Đã sao chép' : 'Sao chép prompt'}
      </button>
    </div>
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{text}</pre>
    {error && <p role="status" className="text-[var(--color-error)]">Chưa sao chép được. Bạn có thể chọn nội dung prompt phía trên để sao chép thủ công.</p>}
  </section>;
}

/** Walks a user from "I have some text or a spreadsheet" to a file the importer accepts. */
export function ImportGuide({ onUsePaste }: { onUsePaste: (text: string, format: 'json' | 'markdown' | 'table') => void }) {
  const types = useMemo(() => builtinNoteTypes(), []);
  const [typeId, setTypeId] = useState(types[0].id);
  const [pasted, setPasted] = useState('');
  const [format, setFormat] = useState<'markdown' | 'table'>('markdown');
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const type = types.find(item => item.id === typeId)!;
  const sample = exampleDeckFile(type);
  const asJson = /^\s*[[{]/.test(pasted);
  const filename = asJson ? 'dán.json' : format === 'markdown' ? 'dán.md' : 'dán.txt';
  const errors = check?.issues.filter(issue => issue.severity === 'error') ?? [];
  const warnings = check?.issues.filter(issue => issue.severity === 'warning') ?? [];

  return <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]">Hướng dẫn: định dạng tệp, prompt AI và dán nội dung</summary>
    <div className="mt-4 space-y-6 text-sm leading-relaxed">
      <section className="space-y-2">
        <p>Mọi loại tệp (JSON, CSV, TSV, TXT, Markdown, Excel) đều được đưa về một định dạng chung <code>.sonhat.json</code>. Tệp này mô tả cả loại thẻ (các trường và bố cục hai mặt) lẫn nội dung thẻ. Bạn cũng có thể xuất bất kỳ bộ thẻ nào ra đúng định dạng này để sao lưu hoặc gửi cho người khác.</p>
        <label className="block max-w-sm">Soạn prompt và tệp mẫu cho loại thẻ
          <select className="study-input mt-1" value={typeId} onChange={event => setTypeId(event.target.value)}>
            {types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </section>

      <PromptSection title="1. Prompt cấu trúc tệp" text={buildStructurePrompt(type)} />
      <PromptSection title="2. Prompt định dạng HTML/CSS (tùy chọn)" text={buildFormattingPrompt()} />

      <section className="space-y-3">
        <h4 className="font-semibold">3. Tệp mẫu</h4>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="study-button" onClick={() => downloadFile('mau-bo-the.sonhat.json', JSON.stringify(sample, null, 2), 'application/json')}><Download size={16} /> Tải .sonhat.json</button>
          <button type="button" className="study-button" onClick={() => downloadFile('mau-bo-the.md', MARKDOWN_SAMPLE)}><Download size={16} /> Tải Markdown</button>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(sample, null, 2)}</code></pre>
      </section>

      <section className="space-y-3">
        <h4 className="font-semibold">4. Dán nội dung để kiểm tra rồi nhập</h4>
        <p>Dán JSON (<code>.sonhat.json</code> hoặc mảng thẻ cũ), Markdown hoặc dữ liệu bảng. Dạng dòng: <code>mặt trước :: mặt sau :: cách đọc</code>.</p>
        {!asJson && <label className="block max-w-sm">Định dạng văn bản
          <select className="study-input mt-1" value={format} onChange={event => { setFormat(event.target.value as 'markdown' | 'table'); setCheck(null); }}>
            <option value="markdown">Markdown (:: hoặc khối khóa: giá trị)</option>
            <option value="table">Bảng (CSV, TSV, dấu chấm phẩy)</option>
          </select>
        </label>}
        <label className="block">Nội dung
          <textarea className="study-input mt-1 min-h-40 font-mono text-xs" value={pasted} placeholder={'勉強[べんきょう]する :: học :: べんきょうする'} onChange={event => { setPasted(event.target.value); setCheck(null); }} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="study-button" disabled={!pasted.trim()} onClick={() => setCheck(checkImportText(pasted, filename))}>Kiểm tra</button>
          <button type="button" className="study-button study-button-primary" disabled={!pasted.trim() || (check !== null && check.cards === 0)} onClick={() => onUsePaste(pasted, asJson ? 'json' : format)}>Xem trước và nhập</button>
        </div>
        {check && <div role="status" className="space-y-2 rounded-xl bg-[var(--color-surface-alt)] p-3">
          <p className="font-semibold">{check.cards} thẻ hợp lệ{check.skipped ? ` · ${check.skipped} thẻ bị bỏ qua` : ''}{warnings.length ? ` · ${warnings.length} cảnh báo` : ''}</p>
          {[...errors, ...warnings].slice(0, 30).map((issue, index) => <p key={index} className={`flex items-start gap-2 text-xs ${issue.severity === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span><strong>{issue.path || 'Tệp'}</strong>: {issue.message}</span></p>)}
          {errors.length + warnings.length > 30 && <p className="text-xs text-[var(--color-text-secondary)]">… và {errors.length + warnings.length - 30} vấn đề khác.</p>}
        </div>}
      </section>
    </div>
  </details>;
}
