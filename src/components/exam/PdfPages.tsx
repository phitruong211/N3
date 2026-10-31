import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const ZOOMS = [1, 1.5, 2, 3];

/** Draws the pages of a PDF in a scroll box. Phone browsers don't scroll a PDF inside an iframe, so this stands in for it there. */
export function PdfPages({ src }: { src: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1.5); // exam print is too small to read at page width on a phone

  useEffect(() => {
    let loaded: PDFDocumentProxy | undefined;
    let gone = false;
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default;
      loaded = await pdfjs.getDocument(src).promise;
      if (gone) loaded.destroy(); else setDoc(loaded);
    })().catch(() => setFailed(true));
    return () => { gone = true; loaded?.destroy(); };
  }, [src]);

  useEffect(() => {
    if (!root) return;
    const measure = () => setWidth(root.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [root]);

  const step = (dir: 1 | -1) => setZoom(current => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(current) + dir))]);

  return <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
    <div ref={setRoot} className="h-full overflow-auto overscroll-contain">
      {failed ? <p className="p-4 text-sm text-[var(--color-text-secondary)]" role="alert">Không tải được đề. Thử mở PDF ở tab mới.</p>
        : !doc ? <p className="p-4 text-sm text-[var(--color-text-secondary)]" role="status">Đang tải đề…</p>
        : <div className="space-y-2 p-1" style={{ width: `${zoom * 100}%` }}>{Array.from({ length: doc.numPages }, (_, i) => <Page key={i} doc={doc} n={i + 1} root={root} width={Math.max(0, width - 8) * zoom} />)}</div>}
    </div>
    <div className="absolute bottom-2 right-2 flex gap-1.5">
      <button className="study-button !min-h-10 !w-10 !p-0" aria-label="Thu nhỏ" disabled={zoom === ZOOMS[0]} onClick={() => step(-1)}>−</button>
      <button className="study-button !min-h-10 !w-10 !p-0" aria-label="Phóng to" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => step(1)}>+</button>
    </div>
  </div>;
}

/** One page: drawn only while near the viewport and released after, so a 40-page paper doesn't fill a phone's memory. */
function Page({ doc, n, root, width }: { doc: PDFDocumentProxy; n: number; root: HTMLElement | null; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(n <= 2);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    if (!root || !box.current) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root, rootMargin: '150% 0px' });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    if (!near || !width) { target.width = 0; return; }
    let cancelled = false;
    let task: { cancel(): void; promise: Promise<unknown> } | undefined;
    doc.getPage(n).then(page => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const viewport = page.getViewport({ scale: (width / base.width) * Math.min(devicePixelRatio, 2) });
      target.width = viewport.width;
      target.height = viewport.height;
      task = page.render({ canvasContext: target.getContext('2d')!, viewport });
      task.promise.catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; task?.cancel(); };
  }, [near, width, doc, n]);

  return <div ref={box} className="relative w-full overflow-hidden rounded bg-white" style={{ aspectRatio: `1 / ${ratio}` }}>
    <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`Trang ${n}`} role="img" />
  </div>;
}
