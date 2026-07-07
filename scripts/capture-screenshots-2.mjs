/**
 * Second pass — capture missing/detail screenshots.
 * Run after capture-screenshots.mjs
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
const BASE = 'http://localhost:3004';
const CHROME = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-148.0.7778.97\\chrome-win64\\chrome.exe';

const CREDS = {
  group_admin: { email: 'group_admin@via.vn', password: 'Password@123' },
  instructor:  { email: 'instructor@via.vn',   password: 'Password@123' },
  learner:     { email: 'nam.dv@phuthaiholdings.com', password: 'Password@123' },
};

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, filename, fullPage = false) {
  ensureDir(dirname(join(SHOTS, filename)));
  await page.screenshot({ path: join(SHOTS, filename), fullPage });
  console.log(`  ✅ ${filename}`);
}

async function nav(page, path, ms = 2000) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 25000 });
  await wait(ms);
}

async function loginAs(page, role) {
  const c = CREDS[role];
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(800);
  await page.type('input[type="email"]', c.email, { delay: 40 });
  await page.type('input[type="password"]', c.password, { delay: 40 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await wait(1500);
}

// Find first course ID from the courses list
async function getFirstCourseId(page) {
  await nav(page, '/courses');
  const links = await page.$$('a[href*="/courses/"]');
  for (const l of links) {
    const href = await l.evaluate(el => el.href);
    const m = href.match(/\/courses\/([a-z0-9-]+)$/);
    if (m) return m[1];
  }
  return null;
}

async function getFirstQbId(page) {
  await nav(page, '/question-banks');
  const links = await page.$$('a[href*="/question-banks/"]');
  for (const l of links) {
    const href = await l.evaluate(el => el.href);
    const m = href.match(/\/question-banks\/([a-z0-9-]+)$/);
    if (m) return m[1];
  }
  return null;
}

async function getFirstLpId(page) {
  await nav(page, '/learning-paths');
  const links = await page.$$('a[href*="/learning-paths/"]');
  for (const l of links) {
    const href = await l.evaluate(el => el.href);
    const m = href.match(/\/learning-paths\/([a-z0-9-]+)$/);
    if (m) return m[1];
  }
  return null;
}

async function getFirstLgId(page) {
  await nav(page, '/learning-groups');
  const links = await page.$$('a[href*="/learning-groups/"]');
  for (const l of links) {
    const href = await l.evaluate(el => el.href);
    const m = href.match(/\/learning-groups\/([a-z0-9-]+)$/);
    if (m) return m[1];
  }
  return null;
}

async function getMyCourseId(page) {
  await nav(page, '/my-courses');
  const links = await page.$$('a[href*="/my-courses/"]');
  for (const l of links) {
    const href = await l.evaluate(el => el.href);
    const m = href.match(/\/my-courses\/([a-z0-9-]+)$/);
    if (m) return m[1];
  }
  return null;
}

async function getAppCourseId(page) {
  await nav(page, '/app/courses');
  const links = await page.$$('a[href*="/app/courses/"]');
  for (const l of links) {
    const href = await l.evaluate(el => el.href);
    const m = href.match(/\/app\/courses\/([a-z0-9-]+)$/);
    if (m) return m[1];
  }
  return null;
}

// Click button by text
async function clickBtn(page, texts) {
  const btns = await page.$$('button');
  for (const btn of btns) {
    const txt = await btn.evaluate(el => el.textContent?.trim() ?? '');
    if (texts.some(t => txt.includes(t))) {
      await btn.click();
      return true;
    }
  }
  return false;
}

// Click tab by text
async function clickTab(page, texts) {
  const tabs = await page.$$('[role="tab"], button');
  for (const tab of tabs) {
    const txt = await tab.evaluate(el => el.textContent?.trim() ?? '');
    if (texts.some(t => txt.includes(t))) {
      await tab.click();
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('🚀 Screenshot Capture — Pass 2\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();
  await page.setDefaultTimeout(20000);

  try {
    // ── GROUP ADMIN ──────────────────────────────────────────────────
    console.log('📸 group_admin pages...');
    await loginAs(page, 'group_admin');

    // Settings - SMTP tab
    await nav(page, '/settings');
    await wait(800);
    if (await clickTab(page, ['Mail', 'SMTP', 'Email'])) {
      await wait(1000);
      await shot(page, 'admin/settings-smtp.png', true);
    }

    // Settings - Backup tab
    await nav(page, '/settings');
    await wait(800);
    if (await clickTab(page, ['Backup', 'Sao lưu'])) {
      await wait(1000);
      await shot(page, 'admin/settings-backup.png', true);
    }

    // Org detail
    await nav(page, '/organizations');
    await wait(800);
    const orgLinks = await page.$$('a[href*="/organizations/"]');
    if (orgLinks.length) {
      const href = await orgLinks[0].evaluate(el => el.href);
      const id = href.split('/organizations/')[1];
      await nav(page, `/organizations/${id}`);
      await shot(page, 'admin/org-detail-info.png', true);

      await clickTab(page, ['Người dùng', 'Users', 'Thành viên']);
      await wait(800);
      await shot(page, 'admin/org-detail-users.png', true);

      await clickTab(page, ['Sơ đồ', 'Org', 'Chart']);
      await wait(1000);
      await shot(page, 'admin/org-chart.png', true);
    }

    // Users - open create modal
    await nav(page, '/users');
    await wait(800);
    if (await clickBtn(page, ['Thêm người dùng', 'Tạo người dùng', 'Thêm user'])) {
      await wait(1000);
      await shot(page, 'admin/users-create-modal.png', false);
      await page.keyboard.press('Escape');
      await wait(400);
    }

    // User detail
    await nav(page, '/users');
    await wait(800);
    const userLinks = await page.$$('a[href*="/users/"]');
    if (userLinks.length) {
      await userLinks[0].click();
      await wait(2000);
      await shot(page, 'admin/user-detail.png', true);
    }

    // Positions - create modal
    await nav(page, '/positions');
    await wait(800);
    if (await clickBtn(page, ['Tạo vị trí', 'Thêm vị trí'])) {
      await wait(800);
      await shot(page, 'admin/positions-create-modal.png', false);
      await page.keyboard.press('Escape');
      await wait(400);
    }

    // Organizations create modal
    await nav(page, '/organizations');
    await wait(800);
    if (await clickBtn(page, ['Tạo phòng ban', 'Thêm phòng', 'Tạo công ty', 'Tạo tổ chức'])) {
      await wait(800);
      await shot(page, 'admin/organizations-create-modal.png', false);
      await page.keyboard.press('Escape');
      await wait(400);
    }

    // Operations backup tab
    await nav(page, '/operations');
    await wait(1500);
    if (await clickTab(page, ['Backup', 'Sao lưu', 'Lưu trữ'])) {
      await wait(1000);
      await shot(page, 'admin/operations-backup.png', true);
    }

    // AI Config
    await nav(page, '/ai-config', 2000);
    await shot(page, 'admin/ai-config.png', true);

    // ── INSTRUCTOR ────────────────────────────────────────────────────
    console.log('\n📸 instructor pages...');
    await loginAs(page, 'instructor');

    const courseId = await getFirstCourseId(page);
    if (courseId) {
      await nav(page, `/courses/${courseId}`, 2500);
      await shot(page, 'instructor/course-editor-content.png', true);

      // Tab Phân phối (Assign)
      if (await clickTab(page, ['Phân phối', 'Assign', 'Giao học'])) {
        await wait(1000);
        await shot(page, 'instructor/course-assign-tab.png', true);
      }

      // Tab Chia sẻ
      if (await clickTab(page, ['Chia sẻ', 'Share'])) {
        await wait(800);
        await shot(page, 'instructor/course-share-tab.png', true);
      }

      // Tab Ratings
      await nav(page, `/courses/${courseId}`, 2000);
      if (await clickTab(page, ['Đánh giá', 'Rating'])) {
        await wait(800);
        await shot(page, 'instructor/course-ratings-tab.png', true);
      }
    }

    // QBank detail + question form
    const qbId = await getFirstQbId(page);
    if (qbId) {
      await nav(page, `/question-banks/${qbId}`, 2000);
      await shot(page, 'instructor/question-bank-detail.png', true);

      // Create question tab
      if (await clickTab(page, ['Tạo mới', 'Thêm câu'])) {
        await wait(800);
        await shot(page, 'instructor/question-create-form.png', true);
      }

      // Pending approval tab
      await nav(page, `/question-banks/${qbId}`, 1500);
      if (await clickTab(page, ['Chờ duyệt', 'Duyệt', 'Pending'])) {
        await wait(800);
        await shot(page, 'instructor/question-pending.png', true);
      }

      // Categories tab
      await nav(page, `/question-banks/${qbId}`, 1500);
      if (await clickTab(page, ['Danh mục', 'Category', 'Năng lực'])) {
        await wait(800);
        await shot(page, 'instructor/question-categories.png', true);
      }
    }

    // Learning path builder
    const lpId = await getFirstLpId(page);
    if (lpId) {
      await nav(page, `/learning-paths/${lpId}`, 2000);
      await shot(page, 'instructor/learning-path-builder.png', true);

      // Open enroll modal
      if (await clickBtn(page, ['Đăng ký', 'Enroll'])) {
        await wait(800);
        await shot(page, 'instructor/learning-path-enroll-modal.png', false);
        await page.keyboard.press('Escape');
        await wait(400);
      }
    }

    // Learning group detail
    const lgId = await getFirstLgId(page);
    if (lgId) {
      await nav(page, `/learning-groups/${lgId}`, 2000);
      await shot(page, 'instructor/learning-group-detail.png', true);

      // Courses tab
      if (await clickTab(page, ['Khóa học', 'Course'])) {
        await wait(800);
        await shot(page, 'instructor/learning-group-courses.png', true);
      }

      // Rules tab
      if (await clickTab(page, ['Quy tắc', 'Rule', 'Tự động'])) {
        await wait(800);
        await shot(page, 'instructor/learning-group-rules.png', true);
      }
    }

    // Competency framework detail
    await nav(page, '/competency-frameworks');
    const cfLinks = await page.$$('a[href*="/competency-frameworks/"]');
    if (cfLinks.length) {
      await cfLinks[0].click();
      await wait(2000);
      await shot(page, 'instructor/competency-framework-detail.png', true);
    }

    // ── LEARNER WEB ────────────────────────────────────────────────────
    console.log('\n📸 learner web pages...');
    await loginAs(page, 'learner');

    const myCourseId = await getMyCourseId(page);
    if (myCourseId) {
      await nav(page, `/my-courses/${myCourseId}`, 2500);
      await shot(page, 'learner/web/course-detail.png', true);

      // First lesson
      const lessonLinks = await page.$$('a[href*="/lessons/"]');
      if (lessonLinks.length) {
        const lessonHref = await lessonLinks[0].evaluate(el => el.href);
        await page.goto(lessonHref, { waitUntil: 'networkidle2', timeout: 20000 });
        await wait(3000);
        await shot(page, 'learner/web/lesson-player.png', false);

        // If quiz
        if (await clickBtn(page, ['Bắt đầu làm bài', 'Bắt đầu', 'Làm bài'])) {
          await wait(1000);
          await shot(page, 'learner/web/lesson-quiz.png', false);
          await page.keyboard.press('Escape');
        }
      }
    }

    // Forgot password page
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1000);
    await shot(page, 'login-forgot-password.png', false);

    // ── LEARNER APP (mobile viewport) ────────────────────────────────
    console.log('\n📸 learner PWA pages (mobile)...');
    await page.setViewport({ width: 390, height: 844 });

    await loginAs(page, 'learner');

    const appCourseId = await getAppCourseId(page);
    if (appCourseId) {
      await nav(page, `/app/courses/${appCourseId}`, 2500);
      await shot(page, 'learner/app/course-detail.png', true);

      // First lesson
      const appLessonLinks = await page.$$('a[href*="/lessons/"]');
      if (appLessonLinks.length) {
        const href = await appLessonLinks[0].evaluate(el => el.href);
        await page.goto(href, { waitUntil: 'networkidle2', timeout: 20000 });
        await wait(3000);
        await shot(page, 'learner/app/lesson-player.png', false);

        // Notes tab
        if (await clickTab(page, ['Ghi chú', 'Note'])) {
          await wait(600);
          await shot(page, 'learner/app/lesson-notes.png', false);
        }
      }
    }

    console.log('\n✅ Pass 2 complete. Now updating markdown...\n');
    await updateAllMarkdown();

  } finally {
    await browser.close();
  }
}

// ── Update markdown ─────────────────────────────────────────────────────────

function embedImages(content, imageMap) {
  let count = 0;
  return {
    content: content.replace(
      /> 📸 \*\*\[([^\]]+)\]\*\* (.+)/g,
      (match, id, desc) => {
        const p = imageMap[id];
        if (p && existsSync(join(ROOT, p))) {
          count++;
          // Already embedded? Don't double-add
          return match; // will handle separately
        }
        return match;
      }
    ),
    count,
  };
}

async function updateAllMarkdown() {
  const adminMap = buildMap('admin');
  const instrMap = buildMap('instructor');
  const learnerMap = buildMap('learner');

  patchMd(join(ROOT, 'HUONG_DAN_ADMIN_CONG_TY.md'), adminMap);
  patchMd(join(ROOT, 'HUONG_DAN_GIANG_VIEN.md'), instrMap);
  patchMd(join(ROOT, 'HUONG_DAN_HOC_VIEN.md'), learnerMap);
}

function buildMap(role) {
  // Scan docs/screenshots/<role>/ and build a map based on filenames
  // This is supplemental — adds any images that pass 2 captured
  const base = join(SHOTS, role);
  const map = {};
  return map;
}

function patchMd(mdPath, extraMap) {
  let content = readFileSync(mdPath, 'utf8');

  // For lines that already have an image on the next line, skip
  // For placeholder lines without image below, add image if exists
  const lines = content.split('\n');
  const out = [];
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/> 📸 \*\*\[([^\]]+)\]\*\*/);
    if (m) {
      out.push(line);
      // Check if next non-empty line is already an image
      const next = lines[i + 1] ?? '';
      if (!next.startsWith('![')) {
        // Try to find a matching screenshot
        const id = m[1];
        const imgPath = resolveImage(id, mdPath);
        if (imgPath) {
          out.push('');
          out.push(`![${id}](${imgPath})`);
          count++;
        }
      }
    } else {
      out.push(line);
    }
  }

  writeFileSync(mdPath, out.join('\n'), 'utf8');
  console.log(`  ✅ ${mdPath.split(/[\\/]/).pop()} — ${count} additional images embedded`);
}

function resolveImage(hinhId, mdPath) {
  const isAdmin = mdPath.includes('ADMIN');
  const isInstr = mdPath.includes('GIANG_VIEN');
  const isLearner = mdPath.includes('HOC_VIEN');

  const ADMIN_MAP = {
    'HÌNH X.Y': 'admin/dashboard-full.png',
    'HÌNH 3.1': 'login-page.png',
    'HÌNH 3.4': 'admin/dashboard-kpi.png',
    'HÌNH 4.1': 'admin/settings-branding.png',
    'HÌNH 4.2': 'admin/settings-branding.png',
    'HÌNH 4.3': 'admin/settings-branding.png',
    'HÌNH 4.4': 'admin/settings-branding.png',
    'HÌNH 4.6': 'admin/settings-branding.png',
    'HÌNH 5.3': 'admin/settings-smtp.png',
    'HÌNH 5.4': 'admin/settings-smtp.png',
    'HÌNH 6.1': 'admin/organizations-list.png',
    'HÌNH 6.2': 'admin/organizations-create-modal.png',
    'HÌNH 6.4': 'admin/org-chart.png',
    'HÌNH 7.1': 'admin/users-create-modal.png',
    'HÌNH 7.3': 'admin/users-list.png',
    'HÌNH 7.4': 'admin/user-detail.png',
    'HÌNH 8.2': 'admin/user-detail.png',
    'HÌNH 9.1': 'admin/positions-list.png',
    'HÌNH 9.2': 'admin/positions-create-modal.png',
    'HÌNH 9.3': 'admin/positions-list.png',
    'HÌNH 9.5': 'admin/user-detail.png',
    'HÌNH 10.1': 'admin/dashboard-kpi.png',
    'HÌNH 10.2': 'admin/dashboard-full.png',
    'HÌNH 11.1': 'admin/reports-overview.png',
    'HÌNH 11.3': 'admin/reports-overview.png',
    'HÌNH 11.5': 'admin/reports-overview.png',
    'HÌNH 12.2': 'admin/operations-backup.png',
    'HÌNH 12.4': 'admin/operations-backup.png',
  };

  const INSTR_MAP = {
    'HÌNH 2.1': 'instructor/dashboard.png',
    'HÌNH 3.1': 'instructor/courses-list.png',
    'HÌNH 3.2': 'instructor/course-editor-content.png',
    'HÌNH 3.3': 'instructor/course-editor-content.png',
    'HÌNH 3.4': 'instructor/course-editor-content.png',
    'HÌNH 3.5a': 'instructor/course-editor-content.png',
    'HÌNH 3.6': 'instructor/course-editor-content.png',
    'HÌNH 3.7': 'instructor/course-editor-content.png',
    'HÌNH 3.8': 'instructor/course-editor-content.png',
    'HÌNH 3.9': 'instructor/course-editor-content.png',
    'HÌNH 4.0': 'instructor/course-wizard-step1.png',
    'HÌNH 4.1': 'instructor/course-wizard-step1.png',
    'HÌNH 4.2': 'instructor/course-wizard-step1.png',
    'HÌNH 4.3': 'instructor/course-wizard-step1.png',
    'HÌNH 4.4': 'instructor/course-wizard-step1.png',
    'HÌNH 4.5': 'instructor/course-wizard-step1.png',
    'HÌNH 5.1': 'instructor/question-banks-list.png',
    'HÌNH 5.2': 'instructor/question-create-form.png',
    'HÌNH 5.5': 'instructor/question-pending.png',
    'HÌNH 5.6': 'instructor/question-categories.png',
    'HÌNH 6.5': 'instructor/course-assign-tab.png',
    'HÌNH 6.6': 'instructor/course-share-tab.png',
    'HÌNH 7.1': 'instructor/learning-path-builder.png',
    'HÌNH 7.5': 'instructor/learning-path-enroll-modal.png',
    'HÌNH 8.2': 'instructor/learning-group-detail.png',
    'HÌNH 8.3': 'instructor/learning-group-rules.png',
    'HÌNH 8.4': 'instructor/learning-group-detail.png',
    'HÌNH 9.3': 'instructor/competency-framework-detail.png',
    'HÌNH 10.3': 'instructor/reports-page.png',
    'HÌNH 10.4': 'instructor/reports-page.png',
  };

  const LEARNER_MAP = {
    'HÌNH 2.1': 'login-page.png',
    'HÌNH 2.2': 'login-page.png',
    'HÌNH 2.3': 'login-forgot-password.png',
    'HÌNH 3.1': 'learner/web/dashboard.png',
    'HÌNH 3.2': 'learner/web/dashboard.png',
    'HÌNH 3.3': 'learner/web/dashboard.png',
    'HÌNH 3.4': 'learner/web/dashboard.png',
    'HÌNH 4.1': 'learner/web/my-courses.png',
    'HÌNH 4.2': 'learner/web/my-courses.png',
    'HÌNH 4.3': 'learner/web/my-courses.png',
    'HÌNH 4.4': 'learner/web/my-courses.png',
    'HÌNH 4.5': 'learner/web/my-courses.png',
    'HÌNH 4.6': 'learner/web/my-courses.png',
    'HÌNH 5.1': 'learner/web/course-detail.png',
    'HÌNH 5.2': 'learner/web/course-detail.png',
    'HÌNH 5.3': 'learner/web/course-detail.png',
    'HÌNH 5.4': 'learner/web/course-detail.png',
    'HÌNH 5.5': 'learner/web/course-detail.png',
    'HÌNH 6.1': 'learner/web/lesson-player.png',
    'HÌNH 6.2': 'learner/web/lesson-player.png',
    'HÌNH 6.3': 'learner/web/lesson-player.png',
    'HÌNH 6.4': 'learner/web/lesson-player.png',
    'HÌNH 7.1': 'learner/web/lesson-player.png',
    'HÌNH 7.2': 'learner/web/lesson-player.png',
    'HÌNH 8.1': 'learner/web/lesson-quiz.png',
    'HÌNH 8.2': 'learner/web/lesson-quiz.png',
    'HÌNH 8.3': 'learner/web/lesson-quiz.png',
    'HÌNH 9.1': 'learner/web/lesson-player.png',
    'HÌNH 9.2': 'learner/web/lesson-player.png',
    'HÌNH 10.1': 'learner/web/lesson-player.png',
    'HÌNH 10.2': 'learner/web/lesson-player.png',
    'HÌNH 11.1': 'learner/web/my-learning-paths.png',
    'HÌNH 11.2': 'learner/web/my-learning-paths.png',
    'HÌNH 11.3': 'learner/web/my-learning-paths.png',
    'HÌNH 11.4': 'learner/web/my-learning-paths.png',
    'HÌNH 11.5': 'learner/web/my-learning-paths.png',
    'HÌNH 11.6': 'learner/web/my-learning-paths.png',
    'HÌNH 12.1': 'learner/web/profile.png',
    'HÌNH 12.2': 'learner/web/profile.png',
    'HÌNH 12.3': 'learner/web/profile.png',
    'HÌNH 12.4': 'learner/web/profile.png',
    'HÌNH 13.1': 'learner/app/home.png',
    'HÌNH 13.2': 'learner/app/home.png',
    'HÌNH 13.3': 'learner/app/home.png',
    'HÌNH 13.4': 'learner/app/home.png',
    'HÌNH 14.1': 'learner/app/home.png',
    'HÌNH 14.2': 'learner/app/home.png',
    'HÌNH 14.3': 'learner/app/home.png',
    'HÌNH 14.4': 'learner/app/home.png',
    'HÌNH 14.5': 'learner/app/home.png',
    'HÌNH 14.6': 'learner/app/home.png',
    'HÌNH 14.7': 'learner/app/home.png',
    'HÌNH 15.1': 'learner/app/courses-list.png',
    'HÌNH 15.2': 'learner/app/courses-list.png',
    'HÌNH 15.3': 'learner/app/courses-list.png',
    'HÌNH 15.4': 'learner/app/courses-list.png',
    'HÌNH 15.5': 'learner/app/courses-list.png',
    'HÌNH 16.1': 'learner/app/course-detail.png',
    'HÌNH 16.2': 'learner/app/course-detail.png',
    'HÌNH 16.3': 'learner/app/course-detail.png',
    'HÌNH 16.4': 'learner/app/course-detail.png',
    'HÌNH 16.5': 'learner/app/course-detail.png',
    'HÌNH 16.6': 'learner/app/course-detail.png',
    'HÌNH 16.7': 'learner/app/course-detail.png',
    'HÌNH 17.1': 'learner/app/lesson-player.png',
    'HÌNH 17.2': 'learner/app/lesson-player.png',
    'HÌNH 17.3': 'learner/app/lesson-player.png',
    'HÌNH 17.4': 'learner/app/lesson-player.png',
    'HÌNH 17.5': 'learner/app/lesson-notes.png',
    'HÌNH 17.6': 'learner/app/lesson-player.png',
    'HÌNH 17.7': 'learner/app/lesson-player.png',
    'HÌNH 18.1': 'learner/app/progress.png',
    'HÌNH 18.2': 'learner/app/progress.png',
    'HÌNH 18.3': 'learner/app/progress.png',
    'HÌNH 18.4': 'learner/app/progress.png',
    'HÌNH 18.5': 'learner/app/progress.png',
    'HÌNH 18.6': 'learner/app/progress.png',
    'HÌNH 19.1': 'learner/app/notifications.png',
    'HÌNH 19.2': 'learner/app/notifications.png',
    'HÌNH 19.3': 'learner/app/notifications.png',
    'HÌNH 19.4': 'learner/app/notifications.png',
    'HÌNH 20.1': 'learner/app/profile.png',
    'HÌNH 20.2': 'learner/app/profile.png',
    'HÌNH 20.3': 'learner/app/profile.png',
    'HÌNH 20.4': 'learner/app/profile.png',
    'HÌNH 20.5': 'learner/app/profile.png',
    'HÌNH 20.6': 'learner/app/profile.png',
    'HÌNH 20.7': 'learner/app/profile.png',
  };

  let map;
  if (isAdmin) map = ADMIN_MAP;
  else if (isInstr) map = INSTR_MAP;
  else map = LEARNER_MAP;

  const rel = map[hinhId];
  if (!rel) return null;
  const abs = join(SHOTS, rel.replace('docs/screenshots/', ''));
  if (!existsSync(abs)) return null;
  return `docs/screenshots/${rel.replace('docs/screenshots/', '')}`;
}

main();
