/**
 * Convert 3 LMS documentation Markdown files to styled PDF
 * Usage: node scripts/generate-pdf-docs.mjs
 */
import { mdToPdf } from 'md-to-pdf';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  body {
    font-family: 'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.7;
    color: #2C2C2A;
    margin: 0;
  }

  /* Headings */
  h1 {
    font-size: 22pt;
    font-weight: 700;
    color: #185FA5;
    border-bottom: 2px solid #185FA5;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 15pt;
    font-weight: 700;
    color: #185FA5;
    border-left: 4px solid #185FA5;
    padding-left: 10px;
    margin-top: 28px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #1e40af;
    margin-top: 20px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h4 {
    font-size: 11pt;
    font-weight: 600;
    color: #374151;
    margin-top: 14px;
    margin-bottom: 6px;
  }

  /* Paragraphs & text */
  p { margin: 0 0 8px; }
  strong { color: #111827; }

  /* Lists */
  ul, ol {
    margin: 4px 0 10px 0;
    padding-left: 22px;
  }
  li { margin-bottom: 3px; }
  li > ul, li > ol { margin-top: 3px; margin-bottom: 3px; }

  /* Task list (checklist) */
  ul li input[type="checkbox"] {
    margin-right: 6px;
    accent-color: #185FA5;
  }

  /* Blockquotes — info/warning/screenshot boxes */
  blockquote {
    border-left: 4px solid #bfdbfe;
    background: #eff6ff;
    margin: 10px 0;
    padding: 8px 14px;
    border-radius: 0 6px 6px 0;
    color: #1e3a5f;
    font-size: 10.5pt;
  }
  /* Screenshot placeholder — different color */
  blockquote:has(strong:first-child) {
    border-left-color: #93c5fd;
    background: #f0f9ff;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th {
    background: #185FA5;
    color: white;
    font-weight: 600;
    padding: 7px 10px;
    text-align: left;
  }
  td {
    padding: 6px 10px;
    border-bottom: 0.5px solid #D3D1C7;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #F8F7F4; }
  tr:hover td { background: #EEF4FC; }

  /* Code & pre */
  code {
    background: #F1EFE8;
    border: 0.5px solid #D3D1C7;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 9.5pt;
    font-family: 'Consolas', 'Courier New', monospace;
    color: #185FA5;
  }
  pre {
    background: #F8F7F4;
    border: 0.5px solid #D3D1C7;
    border-radius: 6px;
    padding: 12px 16px;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.5;
  }
  pre code {
    background: none;
    border: none;
    padding: 0;
    color: #2C2C2A;
  }

  /* Horizontal rule */
  hr {
    border: none;
    border-top: 1px solid #D3D1C7;
    margin: 20px 0;
  }

  /* Page break helpers */
  h2 { page-break-before: auto; }
  .page-break { page-break-after: always; }

  /* Cover page elements */
  .cover-title {
    font-size: 28pt;
    font-weight: 700;
    color: #185FA5;
    text-align: center;
    margin-top: 120px;
  }
`;

const PDF_OPTIONS = {
  pdf_options: {
    format: 'A4',
    margin: { top: '20mm', bottom: '22mm', left: '20mm', right: '18mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%;font-size:8pt;color:#888780;padding:0 20mm;
                  display:flex;justify-content:space-between;align-items:center;
                  border-bottom:0.5px solid #D3D1C7;padding-bottom:4px;">
        <span style="color:#185FA5;font-weight:600">LMS Phú Thái Holdings</span>
        <span class="title"></span>
      </div>`,
    footerTemplate: `
      <div style="width:100%;font-size:8pt;color:#888780;padding:0 20mm;
                  display:flex;justify-content:space-between;align-items:center;
                  border-top:0.5px solid #D3D1C7;padding-top:4px;">
        <span>Tài liệu nội bộ — Không phát hành ra ngoài</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
  },
  stylesheet_encoding: 'utf-8',
  body_class: 'markdown-body',
  highlight_style: 'github',
};

const DOCS = [
  {
    input: join(root, 'HUONG_DAN_ADMIN_CONG_TY.md'),
    output: join(root, 'HUONG_DAN_ADMIN_CONG_TY.pdf'),
    label: 'Admin công ty',
  },
  {
    input: join(root, 'HUONG_DAN_GIANG_VIEN.md'),
    output: join(root, 'HUONG_DAN_GIANG_VIEN.pdf'),
    label: 'Giảng viên / HR Manager',
  },
  {
    input: join(root, 'HUONG_DAN_HOC_VIEN.md'),
    output: join(root, 'HUONG_DAN_HOC_VIEN.pdf'),
    label: 'Học viên (Web + App)',
  },
];

async function generateAll() {
  console.log('🖨️  Generating PDF documentation...\n');

  for (const doc of DOCS) {
    process.stdout.write(`  📄 ${doc.label}... `);
    try {
      const pdf = await mdToPdf(
        { path: doc.input },
        {
          ...PDF_OPTIONS,
          dest: doc.output,
          css: CSS,
          launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        },
      );
      if (pdf) {
        const kb = Math.round(Buffer.byteLength(pdf.content ?? '') / 1024);
        console.log(`✅  ${doc.output.split(/[\\/]/).pop()} (${kb > 0 ? kb + ' KB' : 'saved'})`);
      } else {
        console.log('✅  saved');
      }
    } catch (err) {
      console.error(`❌  FAILED: ${err.message}`);
    }
  }

  console.log('\n✅  Done! 3 PDF files generated at project root.\n');
}

generateAll();
