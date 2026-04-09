import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Layout for mapping highlights: cw/ch are the PDF page box in CSS px (scroll content uses full page height). */
export type PdfPageLayoutInfo = {
  /** CSS pixels per PDF page unit (viewport scale 1). */
  scale: number;
  pageW: number;
  pageH: number;
  cw: number;
  ch: number;
};

type PdfJsPreviewProps = {
  dataUrl: string;
  className?: string;
  onPdfLayout?: (layout: PdfPageLayoutInfo | null) => void;
  /**
   * fitWidth: scale to viewer width, full page height (scroll parent to see rest).
   * cover: fill the viewer box; may crop (e.g. compact modals).
   */
  fitMode?: 'fitWidth' | 'cover';
};

/**
 * Renders the first PDF page to a canvas (no iframe) so native browser PDF
 * hover chrome (Safari/Chrome) never appears.
 */
export function PdfJsPreview({
  dataUrl,
  className = '',
  onPdfLayout,
  fitMode = 'fitWidth',
}: PdfJsPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const loadTaskRef = useRef<{ destroy?: () => void } | null>(null);
  const onPdfLayoutRef = useRef(onPdfLayout);
  onPdfLayoutRef.current = onPdfLayout;
  const fitModeRef = useRef(fitMode);
  fitModeRef.current = fitMode;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !dataUrl.startsWith('data:application/pdf')) {
      return;
    }

    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const runDraw = async () => {
      if (cancelled) return;
      const mode = fitModeRef.current;
      const cw = root.clientWidth;
      const ch = root.clientHeight;
      if (cw < 2 || (mode === 'cover' && ch < 2)) {
        onPdfLayoutRef.current?.(null);
        return;
      }

      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      loadTaskRef.current?.destroy?.();
      loadTaskRef.current = null;

      try {
        const loadingTask = pdfjsLib.getDocument({ url: dataUrl });
        loadTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onPdfLayoutRef.current?.(null);
          return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const base = page.getViewport({ scale: 1 });
        const scaleW = cw / base.width;
        const scaleH = ch / base.height;
        const cssFitScale =
          mode === 'cover' ? Math.max(scaleW, scaleH) : scaleW;
        if (cssFitScale <= 0) {
          onPdfLayoutRef.current?.(null);
          return;
        }

        const scale = cssFitScale * dpr;
        const viewport = page.getViewport({ scale });

        const w = Math.max(1, Math.floor(viewport.width));
        const h = Math.max(1, Math.floor(viewport.height));
        canvas.width = w;
        canvas.height = h;
        const cssW = base.width * cssFitScale;
        const cssH = base.height * cssFitScale;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const task = page.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;

        requestAnimationFrame(() => {
          if (cancelled) return;
          const cb = onPdfLayoutRef.current;
          if (!cb) return;
          const r = rootRef.current;
          if (!r) return;
          const cw2 = r.clientWidth;
          if (cw2 < 2) {
            cb(null);
            return;
          }
          const m = fitModeRef.current;
          const chOut = m === 'cover' ? r.clientHeight : base.height * cssFitScale;
          if (m === 'cover' && chOut < 2) {
            cb(null);
            return;
          }
          cb({
            scale: cssFitScale,
            pageW: base.width,
            pageH: base.height,
            cw: cw2,
            ch: chOut,
          });
        });
      } catch (e) {
        if (cancelled) return;
        console.error('PdfJsPreview:', e);
        onPdfLayoutRef.current?.(null);
      }
    };

    const scheduleDraw = () => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        void runDraw();
      }, 48);
    };

    const ro = new ResizeObserver(scheduleDraw);
    ro.observe(root);
    void runDraw();

    return () => {
      cancelled = true;
      if (resizeTimer != null) clearTimeout(resizeTimer);
      ro.disconnect();
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      loadTaskRef.current?.destroy?.();
      loadTaskRef.current = null;
      onPdfLayoutRef.current?.(null);
    };
  }, [dataUrl, fitMode]);

  const fitClass = fitMode === 'fitWidth' ? ' pdf-js-preview-root--fit-width' : '';

  return (
    <div
      ref={rootRef}
      className={`pdf-js-preview-root${fitClass}${className ? ` ${className}` : ''}`}
      aria-label="PDF preview"
    >
      <canvas ref={canvasRef} aria-hidden={true} />
    </div>
  );
}
