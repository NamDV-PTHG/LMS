/**
 * Copy static assets needed at runtime into public/.
 * Run before dev/build.
 */
const fs = require('fs');
const path = require('path');

const copies = [
  {
    src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
    dest: 'public/pdf.worker.min.mjs',
  },
];

for (const { src, dest } of copies) {
  const srcPath = path.resolve(__dirname, '..', src);
  const destPath = path.resolve(__dirname, '..', dest);

  if (!fs.existsSync(srcPath)) {
    console.warn(`[copy-assets] Source not found, skipping: ${src}`);
    continue;
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log(`[copy-assets] Copied: ${src} → ${dest}`);
}
