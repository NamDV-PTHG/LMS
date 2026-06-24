import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { inflateRawSync } from 'zlib';

/**
 * POST /api/wizard/extract-text
 * Extracts plain text from an uploaded document (TXT, PDF, DOCX).
 * Used by the AI Course Wizard to populate the reference document field.
 */

/** Parse DOCX (ZIP) and extract text from word/document.xml */
function extractDocxText(buffer: Buffer): string {
  let offset = 0;
  while (offset < buffer.length - 30) {
    // ZIP local file header signature: PK\x03\x04
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
          // Stored — no compression
          xmlBuf = buffer.slice(dataStart, dataStart + compSize);
        } else if (compMethod === 8) {
          // Deflate
          xmlBuf = inflateRawSync(buffer.slice(dataStart, dataStart + compSize));
        } else {
          return '';
        }
        return stripDocxXml(xmlBuf.toString('utf-8'));
      }

      // Advance to next entry
      const nextOffset = dataStart + compSize;
      if (nextOffset <= offset) break; // guard infinite loop
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

/** Extract text from PDF using pdfjs-dist (legacy Node.js build) */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid bundling issues; legacy build works without worker in Node.js
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);

  // Suppress the worker warning in Node.js
  try { (pdfjs as any).GlobalWorkerOptions.workerSrc = ''; } catch { /* ignore */ }

  const loadingTask = (pdfjs as any).getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
  });

  const doc = await loadingTask.promise;
  const parts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .map((item) => item.str ?? '')
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (pageText) parts.push(pageText);
  }

  return parts.join('\n\n');
}

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

    if (ext === 'txt') {
      text = buffer.toString('utf-8');
    } else if (ext === 'pdf') {
      try {
        text = await extractPdfText(buffer);
      } catch (e) {
        console.error('[extract-text] PDF error:', e);
        return NextResponse.json(
          { success: false, error: 'Không thể đọc file PDF. Thử chuyển sang TXT.' },
          { status: 422 },
        );
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

    return NextResponse.json({ success: true, data: { text: text.trim(), filename: file.name } });
  } catch (err) {
    console.error('[extract-text]', err);
    return NextResponse.json({ success: false, error: 'Lỗi xử lý file' }, { status: 500 });
  }
});
