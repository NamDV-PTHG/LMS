import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleApiError } from '@/app/api/error-handler';

/** Return list of root drives/dirs when no path given (Windows: C:\ D:\ …, Unix: /) */
function getRoots(): { name: string; path: string; type: 'drive' | 'dir' }[] {
  if (process.platform === 'win32') {
    // A–Z drive letters
    const drives: { name: string; path: string; type: 'drive' | 'dir' }[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drivePath = `${letter}:\\`;
      try {
        fs.accessSync(drivePath, fs.constants.F_OK);
        drives.push({ name: `${letter}:`, path: drivePath, type: 'drive' });
      } catch { /* drive not mounted */ }
    }
    return drives;
  }
  return [{ name: '/', path: '/', type: 'dir' }];
}

/** List immediate subdirectories of a given path */
async function listDirs(dirPath: string): Promise<{ name: string; path: string; writable: boolean }[]> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('$'));
  const result = await Promise.all(
    dirs.map(async (e) => {
      const full = path.join(dirPath, e.name);
      let writable = false;
      try { await fs.promises.access(full, fs.constants.W_OK); writable = true; } catch { /* not writable */ }
      return { name: e.name, path: full, writable };
    }),
  );
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

// GET /api/admin/backup/browse?path=C:\backups
export const GET = withRole(['group_admin'], async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const reqPath = url.searchParams.get('path') ?? '';

    if (!reqPath) {
      // Return drives / root
      const roots = getRoots();
      return NextResponse.json({ success: true, data: { path: '', parent: null, items: roots } });
    }

    const normalized = path.resolve(reqPath);
    // Security: do not allow traversal via resolve — just list what they asked
    let stat: fs.Stats;
    try { stat = await fs.promises.stat(normalized); } catch {
      return NextResponse.json({ success: false, error: 'Đường dẫn không tồn tại' }, { status: 404 });
    }
    if (!stat.isDirectory()) {
      return NextResponse.json({ success: false, error: 'Đường dẫn không phải thư mục' }, { status: 400 });
    }

    const items = await listDirs(normalized);
    const parentPath = path.dirname(normalized);
    const parent = parentPath !== normalized ? parentPath : null; // at root when dirname === self

    // Check if current dir is writable
    let currentWritable = false;
    try { await fs.promises.access(normalized, fs.constants.W_OK); currentWritable = true; } catch { /* */ }

    return NextResponse.json({
      success: true,
      data: { path: normalized, parent, writable: currentWritable, items },
    });
  } catch (err) {
    return handleApiError(err);
  }
});

// POST /api/admin/backup/browse  { path: "C:\backups\lms" }
export const POST = withRole(['group_admin'], async (req: NextRequest) => {
  try {
    const { path: newPath } = await req.json();
    if (!newPath || typeof newPath !== 'string') {
      return NextResponse.json({ success: false, error: 'Thiếu đường dẫn' }, { status: 400 });
    }
    const normalized = path.resolve(newPath);
    await fs.promises.mkdir(normalized, { recursive: true });
    // Verify writable
    await fs.promises.access(normalized, fs.constants.W_OK);
    return NextResponse.json({ success: true, data: { path: normalized } });
  } catch (err) {
    return handleApiError(err);
  }
});
