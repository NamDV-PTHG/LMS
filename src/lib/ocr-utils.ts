/**
 * ocr-utils.ts
 *
 * Shared OCR utilities: render PDF pages or arbitrary images to PNG buffers,
 * then run Tesseract.js (vie+eng) to extract text.
 *
 * Uses dynamic imports so webpack doesn't bundle pdfjs-dist / tesseract.js
 * (they are listed in serverComponentsExternalPackages in next.config.js).
 */

import path from 'path';
import { pathToFileURL } from 'url';

// ── PDF rendering via pdfjs-dist + @napi-rs/canvas ───────────────────────────

/**
 * Render each page of a PDF to a PNG Buffer.
 * @param buffer  Raw PDF bytes
 * @param maxPages  Cap to avoid very long processing (default 25)
 */
export async function renderPdfPages(buffer: Buffer, maxPages = 25): Promise<Buffer[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as string) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createCanvas } = await import('@napi-rs/canvas' as string) as any;

  const workerAbsPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerAbsPath).href;

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
  }).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const images: Buffer[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2× ≈ 150 dpi → good OCR accuracy
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toBuffer('image/png'));
    page.cleanup();
  }

  return images;
}

// ── Tesseract.js OCR ─────────────────────────────────────────────────────────

/**
 * Run Tesseract.js OCR on an array of image Buffers (PNG/JPG/etc).
 * Language data is cached in .tesseract-lang/ on first run.
 */
export async function ocrImages(images: Buffer[]): Promise<string> {
  if (images.length === 0) return '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createWorker } = await import('tesseract.js' as string) as any;

  const worker = await createWorker(['vie', 'eng'], 1, {
    cacheMethod: 'write',
    langPath: path.resolve(process.cwd(), '.tesseract-lang'),
  });

  const parts: string[] = [];
  for (const img of images) {
    const { data } = await worker.recognize(img);
    const t = (data.text as string).trim();
    if (t) parts.push(t);
  }

  await worker.terminate();
  return parts.join('\n\n');
}
