import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { inflateRawSync, inflateSync } from 'zlib';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * POST /api/wizard/extract-text
 * Extracts plain text from an uploaded document (TXT, PDF, DOCX).
 * For text-based PDFs: native stream parser (no external deps).
 * For scanned PDFs: OCR via pdfjs-dist (render) + tesseract.js (recognize).
 */

// ── Route config ──────────────────────────────────────────────────────────────
export const maxDuration = 120; // OCR on large PDFs can take a while

// ── DOCX extractor ────────────────────────────────────────────────────────────

function extractDocxText(buffer: Buffer): string {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (
      buffer[offset] === 0x50 && buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04
    ) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize   = buffer.readUInt32LE(offset + 18);
      const fnLen      = buffer.readUInt16LE(offset + 26);
      const extraLen   = buffer.readUInt16LE(offset + 28);
      const fnStart    = offset + 30;
      const filename   = buffer.slice(fnStart, fnStart + fnLen).toString('utf-8');
      const dataStart  = fnStart + fnLen + extraLen;

      if (filename === 'word/document.xml') {
        let xmlBuf: Buffer;
        if (compMethod === 0) {
          xmlBuf = buffer.slice(dataStart, dataStart + compSize);
        } else if (compMethod === 8) {
          xmlBuf = inflateRawSync(buffer.slice(dataStart, dataStart + compSize));
        } else {
          return '';
        }
        return stripDocxXml(xmlBuf.toString('utf-8'));
      }

      const nextOffset = dataStart + compSize;
      if (nextOffset <= offset) break;
      offset = nextOffset;
    } else {
      offset++;
    }
  }
  return '';
}

function stripDocxXml(xml: string): string {
  return xml
    .replace(/<w:br[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Native PDF text extractor (no deps) ──────────────────────────────────────

function decodePdfString(s: string): string {
  return s.replace(/\\([nrtbf\\()\r]|\d{1,3})/g, (_, c: string) => {
    if (c === 'n') return '\n';
    if (c === 'r') return '\r';
    if (c === 't') return '\t';
    if (c === 'b') return '\b';
    if (c === 'f') return '\f';
    if (c === '\\') return '\\';
    if (c === '(') return '(';
    if (c === ')') return ')';
    if (c === '\r') return '';
    return String.fromCharCode(parseInt(c, 8));
  });
}

function decodeHexString(hex: string): string {
  const cleaned = hex.replace(/\s/g, '');
  if (cleaned.toLowerCase().startsWith('fffe')) {
    const bytes = Buffer.from(cleaned, 'hex');
    try { return bytes.swap16().toString('utf16le').replace(/\0/g, ''); } catch { return ''; }
  }
  if (cleaned.toLowerCase().startsWith('feff')) {
    const bytes = Buffer.from(cleaned, 'hex');
    try { return bytes.toString('utf16le'); } catch { return ''; }
  }
  try { return Buffer.from(cleaned, 'hex').toString('latin1'); } catch { return ''; }
}

function parseContentStream(stream: string, out: string[]): void {
  const btEt = /BT([\s\S]*?)ET/g;
  let block: RegExpExecArray | null;

  while ((block = btEt.exec(stream)) !== null) {
    const b = block[1];
    const lineTexts: string[] = [];
    let m: RegExpExecArray | null;

    // (literal) Tj
    const tjLit = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    while ((m = tjLit.exec(b)) !== null) lineTexts.push(decodePdfString(m[1]));

    // <hex> Tj
    const tjHex = /<([0-9a-fA-F\s]+)>\s*Tj/g;
    while ((m = tjHex.exec(b)) !== null) lineTexts.push(decodeHexString(m[1]));

    // [(literal | <hex> | -num)...] TJ
    const tjArr = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArr.exec(b)) !== null) {
      const inner = m[1];
      let sm: RegExpExecArray | null;
      const strLit = /\(((?:[^()\\]|\\.)*)\)/g;
      while ((sm = strLit.exec(inner)) !== null) lineTexts.push(decodePdfString(sm[1]));
      const strHex = /<([0-9a-fA-F\s]+)>/g;
      while ((sm = strHex.exec(inner)) !== null) lineTexts.push(decodeHexString(sm[1]));
    }

    if (lineTexts.length > 0) {
      out.push(lineTexts.join(''));
      out.push('\n');
    }
  }
}

function extractPdfTextNative(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const out: string[] = [];

  const streamSig = /stream\r?\n/g;
  let sigMatch: RegExpExecArray | null;

  while ((sigMatch = streamSig.exec(raw)) !== null) {
    const streamStart = sigMatch.index + sigMatch[0].length;
    const endIdx = raw.indexOf('endstream', streamStart);
    if (endIdx === -1) continue;

    const dictRegion = raw.slice(Math.max(0, sigMatch.index - 400), sigMatch.index);
    if (/\/Subtype\s*\/(Image|XML)/.test(dictRegion)) continue;

    const isFlate = /\/Filter\s*\/FlateDecode/.test(dictRegion)
      || /\/Filter\s*\[.*?\/FlateDecode/.test(dictRegion);

    const streamBuf = Buffer.from(raw.slice(streamStart, endIdx), 'binary');

    if (isFlate) {
      try {
        const decompressed = inflateSync(streamBuf);
        parseContentStream(decompressed.toString('latin1'), out);
      } catch { /* skip non-decompressible streams */ }
    } else {
      parseContentStream(raw.slice(streamStart, endIdx), out);
    }
  }

  if (out.length === 0) parseContentStream(raw, out);

  return out.join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── OCR pipeline: pdfjs-dist (render) + tesseract.js (recognize) ─────────────

/**
 * Render PDF pages to PNG buffers using pdfjs-dist + @napi-rs/canvas.
 * pdfjs-dist and @napi-rs/canvas must be in serverExternalPackages so webpack
 * doesn't bundle them — they need native Node.js module resolution.
 */
async function renderPdfPages(buffer: Buffer, maxPages = 15): Promise<Buffer[]> {
  // Dynamic imports — these are excluded from webpack via serverExternalPackages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as string) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createCanvas } = await import('@napi-rs/canvas' as string) as any;

  // Worker must be a file:// URL on Windows (absolute paths not accepted by ESM loader)
  const workerAbsPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
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
    const viewport = page.getViewport({ scale: 2.0 }); // 2x = ~150dpi equivalent → good OCR accuracy
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toBuffer('image/png'));
    page.cleanup();
  }

  return images;
}

/**
 * Run Tesseract.js OCR on an array of PNG buffers.
 * Downloads language data on first run (~few MB), cached afterward.
 */
async function ocrPages(images: Buffer[]): Promise<string> {
  // Dynamic import — excluded from webpack via serverExternalPackages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createWorker } = await import('tesseract.js' as string) as any;

  // Vietnamese + English — covers most Vietnamese documents
  const worker = await createWorker(['vie', 'eng'], 1, {
    cacheMethod: 'write',
    // Store language data in a persistent dir so it survives restarts
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

// ── Route handler ─────────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Thiếu file' }, { status: 400 });
    }

    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = '';
    let usedOcr = false;

    if (ext === 'txt') {
      text = buffer.toString('utf-8');

    } else if (ext === 'pdf') {
      // Step 1: try native text extraction (fast, no deps)
      try {
        text = extractPdfTextNative(buffer);
      } catch (e) {
        console.error('[extract-text] native PDF error:', e);
      }

      // Step 2: if little/no text found → likely a scanned PDF → run OCR
      const MIN_NATIVE_CHARS = 80;
      if (text.replace(/\s/g, '').length < MIN_NATIVE_CHARS) {
        console.log('[extract-text] Native extraction insufficient, falling back to OCR...');
        try {
          const pages = await renderPdfPages(buffer);
          if (pages.length === 0) {
            return NextResponse.json(
              { success: false, error: 'Không thể render trang PDF để OCR' },
              { status: 422 },
            );
          }
          text = await ocrPages(pages);
          usedOcr = true;
        } catch (e) {
          console.error('[extract-text] OCR error:', e);
          return NextResponse.json(
            { success: false, error: 'Không thể đọc file PDF. File có thể bị hỏng hoặc được bảo vệ.' },
            { status: 422 },
          );
        }
      }

    } else if (ext === 'docx') {
      text = extractDocxText(buffer);
      if (!text) {
        return NextResponse.json(
          { success: false, error: 'Không thể đọc file DOCX. Thử chuyển sang PDF hoặc TXT.' },
          { status: 422 },
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Chỉ hỗ trợ file TXT, PDF, DOCX' },
        { status: 400 },
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { success: false, error: 'File không có nội dung text có thể đọc được' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { text: text.trim(), filename: file.name, usedOcr },
    });
  } catch (err) {
    console.error('[extract-text]', err);
    return NextResponse.json({ success: false, error: 'Lỗi xử lý file' }, { status: 500 });
  }
});
