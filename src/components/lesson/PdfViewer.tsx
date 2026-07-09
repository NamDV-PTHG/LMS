'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// ── Types ─────────────────────────────────────────────────────

interface PdfViewerProps {
  assetId: string;
  enrollmentId?: string;
  accessToken: string;
  userFullName: string;
  userEmail: string;
  onComplete?: () => void;
  className?: string;
}

// ── Tracking ──────────────────────────────────────────────────

function trackDoc(
  assetId: string,
  enrollmentId: string | undefined,
  sessionId: string,
  accessToken: string,
  eventType: 'open' | 'page_view' | 'page_leave' | 'close' | 'download_attempt',
  extra?: { pageNumber?: number; totalPages?: number; timeOnPageSec?: number; scrollDepthPct?: number },
) {
  fetch('/api/tracking/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ assetId, enrollmentId, sessionId, eventType, ...extra }),
  }).catch(() => {});
}

// ── Component ─────────────────────────────────────────────────

export function PdfViewer({
  assetId,
  enrollmentId,
  accessToken,
  userFullName,
  userEmail,
  onComplete,
  className,
}: PdfViewerProps) {
  const containerRef  = useRef<HTMLDivElement>(null);  // outermost (for fullscreen)
  const scrollRef     = useRef<HTMLDivElement>(null);  // scrollable pages area
  const sessionId     = useRef(crypto.randomUUID());
  const pageEnterTime = useRef(Date.now());
  const isRendering   = useRef(false);
  const completedRef  = useRef(false);

  const [pdfDoc, setPdfDoc]           = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages]   = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomFactor, setZoomFactor]   = useState(1.0);   // 1.0 = fit to container width
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // One canvas ref per page (populated when pages render in DOM)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageRefs   = useRef<(HTMLDivElement | null)[]>([]);

  // ── Security: block right-click & Ctrl+S/P ─────────────────
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'S', 'P'].includes(e.key)) e.preventDefault();
    };
    const el = containerRef.current;
    el?.addEventListener('contextmenu', prevent);
    window.addEventListener('keydown', preventKeys);
    return () => {
      el?.removeEventListener('contextmenu', prevent);
      window.removeEventListener('keydown', preventKeys);
    };
  }, []);

  // ── Fullscreen change listener ──────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Load PDF ────────────────────────────────────────────────
  useEffect(() => {
    const task = pdfjsLib.getDocument({
      url: `/api/assets/${assetId}/content`,
      httpHeaders: { Authorization: `Bearer ${accessToken}` },
      withCredentials: false,
    });

    task.promise
      .then((pdf) => {
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        pageRefs.current   = new Array(pdf.numPages).fill(null);
        setIsLoading(false);
        trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'open', {
          totalPages: pdf.numPages,
        });
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Lỗi khi tải tài liệu');
        setIsLoading(false);
      });

    return () => { task.destroy(); };
  }, [assetId, accessToken, enrollmentId]); // eslint-disable-line

  // ── Render one page to its canvas ──────────────────────────
  const renderOnePage = useCallback(
    async (pageNum: number, availableWidth: number) => {
      if (!pdfDoc) return;
      const canvas = canvasRefs.current[pageNum - 1];
      if (!canvas) return;

      const page = await pdfDoc.getPage(pageNum);
      const naturalVp = page.getViewport({ scale: 1 });

      // fit-width scale * user zoom
      const fitScale  = availableWidth / naturalVp.width;
      const finalScale = Math.max(0.3, Math.min(fitScale * zoomFactor, 5));
      const viewport  = page.getViewport({ scale: finalScale });

      // Use devicePixelRatio for sharp rendering on HiDPI screens
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = viewport.width  * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width  = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Watermark
      const wm = `${userFullName} · ${userEmail} · ${new Date().toLocaleString('vi-VN')}`;
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#333';
      ctx.font = `${Math.max(11, Math.floor(viewport.width / 38))}px Arial`;
      ctx.textAlign = 'center';
      const step = viewport.height / 4;
      for (let y = step; y < viewport.height; y += step) {
        ctx.save();
        ctx.translate(viewport.width / 2, y);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(wm, 0, 0);
        ctx.restore();
      }
      ctx.restore();

      page.cleanup();
    },
    [pdfDoc, zoomFactor, userFullName, userEmail],
  );

  // ── Render all pages sequentially ──────────────────────────
  const renderAllPages = useCallback(async () => {
    if (!pdfDoc || !scrollRef.current) return;
    if (isRendering.current) return;
    isRendering.current = true;
    setLoadingPages(true);

    // Available width = scroll container minus padding (16px each side)
    const availableWidth = scrollRef.current.clientWidth - 32;
    if (availableWidth <= 0) { isRendering.current = false; return; }

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      await renderOnePage(i, availableWidth);
    }

    isRendering.current = false;
    setLoadingPages(false);
  }, [pdfDoc, renderOnePage]);

  // Trigger render when PDF loads
  useEffect(() => {
    if (pdfDoc) renderAllPages();
  }, [pdfDoc, renderAllPages]);

  // ── Re-render on container resize (window / fullscreen) ────
  useEffect(() => {
    if (!scrollRef.current || !pdfDoc) return;
    const ro = new ResizeObserver(() => { renderAllPages(); });
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [pdfDoc, renderAllPages]);

  // ── IntersectionObserver — track visible page ───────────────
  useEffect(() => {
    if (!scrollRef.current || totalPages === 0) return;
    const visibility = new Map<number, number>();

    const observers = pageRefs.current.map((el, idx) => {
      if (!el) return null;
      const io = new IntersectionObserver(
        ([entry]) => {
          visibility.set(idx + 1, entry.intersectionRatio);
          let maxRatio = -1, maxPage = 1;
          visibility.forEach((ratio, pg) => {
            if (ratio > maxRatio) { maxRatio = ratio; maxPage = pg; }
          });
          setCurrentPage(maxPage);
        },
        { root: scrollRef.current, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
      );
      io.observe(el);
      return io;
    });

    return () => observers.forEach((io) => io?.disconnect());
  }, [totalPages]);

  // ── Completion: trigger once when reaching last page ────────
  useEffect(() => {
    if (currentPage === totalPages && totalPages > 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [currentPage, totalPages, onComplete]);

  // ── Page tracking on scroll ─────────────────────────────────
  const prevTrackedPage = useRef(1);
  useEffect(() => {
    if (currentPage === prevTrackedPage.current) return;
    const now = Date.now();
    trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'page_leave', {
      pageNumber: prevTrackedPage.current,
      timeOnPageSec: Math.floor((now - pageEnterTime.current) / 1000),
    });
    pageEnterTime.current = now;
    prevTrackedPage.current = currentPage;
    trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'page_view', {
      pageNumber: currentPage,
      totalPages,
    });
  }, [currentPage, assetId, enrollmentId, accessToken, totalPages]);

  // ── Cleanup tracking on unmount ─────────────────────────────
  useEffect(() => {
    return () => {
      trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'close', {
        pageNumber: prevTrackedPage.current,
        totalPages,
        timeOnPageSec: Math.floor((Date.now() - pageEnterTime.current) / 1000),
      });
    };
  }, [assetId, enrollmentId, accessToken, totalPages]); // eslint-disable-line

  // ── Scroll to page ──────────────────────────────────────────
  const scrollToPage = (n: number) => {
    const el = pageRefs.current[n - 1];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Fullscreen toggle ───────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // ── Zoom ────────────────────────────────────────────────────
  const zoomOut = () => setZoomFactor((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const zoomIn  = () => setZoomFactor((z) => Math.min(3.0, +(z + 0.25).toFixed(2)));
  const zoomReset = () => setZoomFactor(1.0);

  // ─────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 bg-muted rounded-xl ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-subtle">Đang tải tài liệu...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 bg-danger-tint border border-danger/20 rounded-xl ${className}`}>
        <span className="text-[12px] text-danger">{error}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col rounded-xl overflow-hidden border border-default bg-[#f0f0f0] select-none ${className}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-surface border-b border-default px-3 py-1.5 shadow-sm flex-shrink-0">
        {/* Page indicator + jump */}
        <div className="flex items-center gap-1.5 text-[11px] text-subtle">
          <span className="hidden sm:inline">Trang</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const n = Math.max(1, Math.min(totalPages, Number(e.target.value)));
              scrollToPage(n);
            }}
            className="w-10 text-center border border-default rounded px-1 py-0.5 text-[11px] text-content bg-surface focus:outline-none focus:border-primary"
          />
          <span>/ {totalPages}</span>
        </div>

        <div className="flex-1" />

        {/* Loading indicator */}
        {loadingPages && (
          <span className="text-[10px] text-faint hidden sm:inline">Đang render...</span>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            title="Thu nhỏ"
            className="w-6 h-6 flex items-center justify-center border border-default rounded text-subtle hover:bg-muted text-[13px] leading-none"
          >
            −
          </button>
          <button
            onClick={zoomReset}
            title="Vừa màn hình"
            className="px-1.5 h-6 border border-default rounded text-[10px] text-subtle hover:bg-muted min-w-[42px]"
          >
            {Math.round(zoomFactor * 100)}%
          </button>
          <button
            onClick={zoomIn}
            title="Phóng to"
            className="w-6 h-6 flex items-center justify-center border border-default rounded text-subtle hover:bg-muted text-[13px] leading-none"
          >
            +
          </button>
        </div>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          className="w-6 h-6 flex items-center justify-center border border-default rounded text-subtle hover:bg-muted"
        >
          {isFullscreen ? (
            /* compress icon */
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
              <path d="M5.5 0v5.5H0v1h6.5V0h-1zm5 0v1H16V0h-5.5zm0 10.5V16h1v-5.5H5.5V16h1v-5.5h4z"/>
            </svg>
          ) : (
            /* expand icon */
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
              <path d="M1.5 1h4V0H0v5.5h1V1.5l4.5 4.5.7-.7L1.5 1zM11 0v1h3.5l-4.5 4.5.7.7L15 1.5V5h1V0h-5zm4 15H11.5v1H16v-5h-1v3.5l-4.5-4.5-.7.7L14.5 15zM0 11v5h5v-1H1.5l4.5-4.5-.7-.7L0.5 15H1v-4H0z"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Scrollable pages area ── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden flex-1"
        style={{ height: isFullscreen ? 'calc(100vh - 40px)' : 'min(75vh, 900px)' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 py-4 px-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => { pageRefs.current[pageNum - 1] = el; }}
              className="relative w-full flex justify-center"
              id={`pdf-page-${pageNum}`}
            >
              <canvas
                ref={(el) => { canvasRefs.current[pageNum - 1] = el; }}
                className="shadow-lg max-w-full"
                style={{ display: 'block' }}
              />
              {/* Page number badge */}
              <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
                {pageNum}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
