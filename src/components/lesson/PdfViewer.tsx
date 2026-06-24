'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker — served from public folder (copy during build)
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(crypto.randomUUID());
  const pageEnterTime = useRef<number>(Date.now());

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);

  // Disable right-click, Ctrl+S, Ctrl+P
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'S', 'P'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const container = containerRef.current;
    container?.addEventListener('contextmenu', prevent);
    window.addEventListener('keydown', preventKeys);

    return () => {
      container?.removeEventListener('contextmenu', prevent);
      window.removeEventListener('keydown', preventKeys);
    };
  }, []);

  // Fetch PDF URL and load document
  useEffect(() => {
    fetch(`/api/assets/${assetId}/view-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.success) throw new Error(data.error ?? 'Không thể tải tài liệu');

        const loadingTask = pdfjsLib.getDocument(data.data.viewUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);

        trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'open', {
          totalPages: pdf.numPages,
        });
      })
      .catch((err) => {
        setError(err.message ?? 'Lỗi khi tải tài liệu');
        setIsLoading(false);
      });
  }, [assetId, accessToken, enrollmentId]);

  // Render page to canvas with watermark overlay
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // ── Watermark overlay ───────────────────────────────────
      const watermarkText = `${userFullName} · ${userEmail} · ${new Date().toLocaleString('vi-VN')}`;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#333';
      ctx.font = `${Math.floor(viewport.width / 30)}px Arial`;
      ctx.textAlign = 'center';

      // Diagonal watermarks across the page
      const step = viewport.height / 4;
      for (let y = step; y < viewport.height; y += step) {
        ctx.save();
        ctx.translate(viewport.width / 2, y);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(watermarkText, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },
    [pdfDoc, scale, userFullName, userEmail],
  );

  // Re-render on page change
  useEffect(() => {
    if (!pdfDoc) return;
    renderPage(currentPage);

    // Track page view
    const now = Date.now();
    const timeOnPrev = Math.floor((now - pageEnterTime.current) / 1000);
    if (currentPage > 1) {
      trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'page_leave', {
        pageNumber: currentPage - 1,
        timeOnPageSec: timeOnPrev,
      });
    }
    pageEnterTime.current = now;

    trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'page_view', {
      pageNumber: currentPage,
      totalPages,
    });

    // Complete when reaching last page
    if (currentPage === totalPages && totalPages > 0) {
      onComplete?.();
    }
  }, [currentPage, pdfDoc, renderPage, assetId, enrollmentId, accessToken, totalPages, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackDoc(assetId, enrollmentId, sessionId.current, accessToken, 'close', {
        pageNumber: currentPage,
        totalPages,
        timeOnPageSec: Math.floor((Date.now() - pageEnterTime.current) / 1000),
      });
    };
  }, [assetId, enrollmentId, accessToken, currentPage, totalPages]);

  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-100 ${className}`}>
        <span className="text-muted-foreground text-sm">Đang tải tài liệu...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 bg-red-50 ${className}`}>
        <span className="text-destructive text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center select-none ${className}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-white border-b px-4 py-2 w-full shadow-sm">
        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
        >
          ‹ Trước
        </button>
        <span className="text-sm text-muted-foreground flex-1 text-center">
          Trang {currentPage} / {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
        >
          Sau ›
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            −
          </button>
          <span className="text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-auto max-h-[80vh] mt-2">
        <canvas ref={canvasRef} className="shadow-lg" />
        {/* Invisible overlay div to block drag-copy */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ userSelect: 'none' }}
          onMouseDown={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
