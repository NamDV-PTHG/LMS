/**
 * Capture real screenshots from LMS system for documentation.
 * Usage: node scripts/capture-screenshots.mjs
 *
 * Prerequisites: LMS running on http://localhost:3004
 * Credentials: Password@123 for all test accounts
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOTS_DIR = join(ROOT, 'docs', 'screenshots');
const BASE_URL = 'http://localhost:3004';

const CHROME_PATH = '/c/Users/Administrator/.cache/puppeteer/chrome/win64-148.0.7778.97/chrome-win64/chrome.exe';
// Normalize for Windows
const CHROME_WIN = CHROME_PATH.replace(/^\/c\//, 'C:\\').replace(/\//g, '\\');

const CREDS = {
  group_admin:   { email: 'group_admin@via.vn',   password: 'Password@123' },
  company_admin: { email: 'company_admin@via.vn',  password: 'Password@123' },
  instructor:    { email: 'instructor@via.vn',      password: 'Password@123' },
  learner:       { email: 'nam.dv@phuthaiholdings.com', password: 'Password@123' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function loginAs(page, role) {
  const cred = CREDS[role];
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(500);
  // Fill login form
  await page.evaluate(() => {
    document.querySelectorAll('input[type="email"], input[name="email"]')[0]?.focus();
  });
  await page.type('input[type="email"], input[name="email"]', cred.email, { delay: 30 });
  await page.type('input[type="password"]', cred.password, { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await wait(1500);
}

async function shot(page, filename, opts = {}) {
  const {
    fullPage = false,
    waitFor = null,
    waitMs = 1200,
    clip = null,
    selector = null,
  } = opts;

  await wait(waitMs);

  if (waitFor) {
    await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});
    await wait(500);
  }

  const outPath = join(SHOTS_DIR, filename);
  ensureDir(dirname(outPath));

  if (selector) {
    const el = await page.$(selector);
    if (el) {
      await el.screenshot({ path: outPath });
      console.log(`    ✅ ${filename}`);
      return;
    }
  }

  await page.screenshot({ path: outPath, fullPage, ...(clip ? { clip } : {}) });
  console.log(`    ✅ ${filename}`);
}

async function nav(page, path, waitMs = 2000) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(waitMs);
}

async function clickAndShot(page, clickSel, filename, waitMs = 1000) {
  await page.click(clickSel).catch(() => {});
  await wait(waitMs);
  await shot(page, filename);
}

// ── CAPTURE SESSIONS ───────────────────────────────────────────────────────

async function captureLoginPage(page) {
  console.log('\n  📄 Login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(1500);
  await shot(page, 'login-page.png', { fullPage: false });
}

async function captureAdminPages(page) {
  console.log('\n  📄 Admin pages (group_admin)...');

  // Dashboard
  await nav(page, '/dashboard', 2500);
  await shot(page, 'admin/dashboard-kpi.png', { fullPage: false });
  await shot(page, 'admin/dashboard-full.png', { fullPage: true });

  // Settings - Branding
  await nav(page, '/settings');
  await page.waitForSelector('input, [role="tablist"]', { timeout: 8000 }).catch(() => {});
  await shot(page, 'admin/settings-branding.png', { fullPage: true });

  // Settings - click SMTP tab
  await nav(page, '/settings');
  await wait(1000);
  const tabs = await page.$$('[role="tab"]');
  if (tabs.length >= 2) {
    await tabs[1].click();
    await wait(1000);
    await shot(page, 'admin/settings-smtp.png', { fullPage: true });
  }

  // Settings - Backup tab
  if (tabs.length >= 3) {
    await tabs[2].click();
    await wait(1000);
    await shot(page, 'admin/settings-backup.png', { fullPage: true });
  }

  // Organizations
  await nav(page, '/organizations');
  await shot(page, 'admin/organizations-list.png', { fullPage: true });

  // Try open create org modal
  const createBtn = await page.$('button');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const txt = await btn.evaluate(el => el.textContent?.trim());
    if (txt?.includes('Tạo phòng ban') || txt?.includes('Tạo tổ chức') || txt?.includes('Tạo công ty')) {
      await btn.click();
      await wait(800);
      await shot(page, 'admin/organizations-create-modal.png');
      await page.keyboard.press('Escape');
      await wait(500);
      break;
    }
  }

  // Org detail (click first org)
  await nav(page, '/organizations');
  const orgLinks = await page.$$('a[href*="/organizations/"]');
  if (orgLinks.length > 0) {
    await orgLinks[0].click();
    await wait(2000);
    await shot(page, 'admin/org-detail-info.png', { fullPage: true });

    // Click Users tab
    const orgTabs = await page.$$('[role="tab"]');
    if (orgTabs.length >= 2) {
      await orgTabs[1].click();
      await wait(1000);
      await shot(page, 'admin/org-detail-users.png', { fullPage: true });
    }

    // Click Org Chart tab
    if (orgTabs.length >= 3) {
      await orgTabs[2].click();
      await wait(1500);
      await shot(page, 'admin/org-chart.png', { fullPage: true });
    }
  }

  // Users
  await nav(page, '/users');
  await shot(page, 'admin/users-list.png', { fullPage: true });

  // Open create user modal
  await nav(page, '/users');
  const userBtns = await page.$$('button');
  for (const btn of userBtns) {
    const txt = await btn.evaluate(el => el.textContent?.trim());
    if (txt?.includes('Thêm người dùng') || txt?.includes('Tạo người dùng')) {
      await btn.click();
      await wait(800);
      await shot(page, 'admin/users-create-modal.png', { fullPage: false });
      await page.keyboard.press('Escape');
      await wait(500);
      break;
    }
  }

  // User detail (click first user)
  await nav(page, '/users');
  await wait(1000);
  const userLinks = await page.$$('a[href*="/users/"]');
  if (userLinks.length > 0) {
    await userLinks[0].click();
    await wait(2000);
    await shot(page, 'admin/user-detail.png', { fullPage: true });
  }

  // Positions
  await nav(page, '/positions');
  await shot(page, 'admin/positions-list.png', { fullPage: true });

  // Open create position modal
  const posBtns = await page.$$('button');
  for (const btn of posBtns) {
    const txt = await btn.evaluate(el => el.textContent?.trim());
    if (txt?.includes('Tạo vị trí')) {
      await btn.click();
      await wait(800);
      await shot(page, 'admin/positions-create-modal.png');
      await page.keyboard.press('Escape');
      await wait(500);
      break;
    }
  }

  // Reports
  await nav(page, '/reports', 3000);
  await shot(page, 'admin/reports-overview.png', { fullPage: true });

  // Operations
  await nav(page, '/operations', 2500);
  await shot(page, 'admin/operations-system.png', { fullPage: true });

  // Backup tab
  const opsTabs = await page.$$('[role="tab"]');
  if (opsTabs.length >= 2) {
    await opsTabs[1].click();
    await wait(1000);
    await shot(page, 'admin/operations-backup.png', { fullPage: true });
  }

  // Import
  await nav(page, '/import', 2000);
  await shot(page, 'admin/import-page.png', { fullPage: true });
}

async function captureInstructorPages(page) {
  console.log('\n  📄 Instructor pages...');

  // Dashboard
  await nav(page, '/dashboard', 2500);
  await shot(page, 'instructor/dashboard.png', { fullPage: true });

  // Courses list
  await nav(page, '/courses');
  await shot(page, 'instructor/courses-list.png', { fullPage: true });

  // Course detail (click first course)
  await nav(page, '/courses');
  const courseLinks = await page.$$('a[href*="/courses/"]');
  let courseId = null;
  for (const link of courseLinks) {
    const href = await link.evaluate(el => el.href);
    if (href.includes('/courses/') && !href.includes('/lessons/') && !href.includes('/wizard')) {
      courseId = href.split('/courses/')[1]?.split('/')[0];
      await link.click();
      await wait(2500);
      break;
    }
  }

  if (courseId) {
    await shot(page, 'instructor/course-editor-content.png', { fullPage: true });

    // Tab Assign
    const courseTabs = await page.$$('[role="tab"]');
    if (courseTabs.length >= 2) {
      await courseTabs[1].click();
      await wait(1000);
      await shot(page, 'instructor/course-assign-tab.png', { fullPage: true });
    }

    // Tab Ratings
    if (courseTabs.length >= 4) {
      await courseTabs[3].click();
      await wait(1000);
      await shot(page, 'instructor/course-ratings-tab.png', { fullPage: true });
    }
  }

  // Course Wizard
  await nav(page, '/courses/wizard', 2000);
  await shot(page, 'instructor/course-wizard-step1.png', { fullPage: true });

  // Question Banks
  await nav(page, '/question-banks');
  await shot(page, 'instructor/question-banks-list.png', { fullPage: true });

  // Question Bank detail (first one)
  await nav(page, '/question-banks');
  const qbLinks = await page.$$('a[href*="/question-banks/"]');
  for (const link of qbLinks) {
    const href = await link.evaluate(el => el.href);
    if (href.match(/\/question-banks\/[^/]+$/)) {
      await link.click();
      await wait(2000);
      break;
    }
  }
  await shot(page, 'instructor/question-bank-detail.png', { fullPage: true });

  // Create question tab
  const qbTabs = await page.$$('[role="tab"]');
  for (const tab of qbTabs) {
    const txt = await tab.evaluate(el => el.textContent?.trim());
    if (txt?.includes('Tạo mới') || txt?.includes('Tạo câu')) {
      await tab.click();
      await wait(800);
      await shot(page, 'instructor/question-create-form.png', { fullPage: true });
      break;
    }
  }

  // Learning Paths
  await nav(page, '/learning-paths');
  await shot(page, 'instructor/learning-paths-list.png', { fullPage: true });

  // Learning Path builder (first one)
  await nav(page, '/learning-paths');
  await wait(1000);
  const lpLinks = await page.$$('a[href*="/learning-paths/"]');
  for (const link of lpLinks) {
    const href = await link.evaluate(el => el.href);
    if (href.match(/\/learning-paths\/[^/]+$/) && !href.includes('wizard')) {
      await link.click();
      await wait(2000);
      await shot(page, 'instructor/learning-path-builder.png', { fullPage: true });
      break;
    }
  }

  // Learning Groups
  await nav(page, '/learning-groups');
  await shot(page, 'instructor/learning-groups-list.png', { fullPage: true });

  // Group detail
  await nav(page, '/learning-groups');
  await wait(1000);
  const lgLinks = await page.$$('a[href*="/learning-groups/"]');
  for (const link of lgLinks) {
    const href = await link.evaluate(el => el.href);
    if (href.match(/\/learning-groups\/[^/]+$/) && !href.includes('wizard')) {
      await link.click();
      await wait(2000);
      await shot(page, 'instructor/learning-group-detail.png', { fullPage: true });
      break;
    }
  }

  // Competency Frameworks
  await nav(page, '/competency-frameworks');
  await shot(page, 'instructor/competency-frameworks-list.png', { fullPage: true });

  // Reports
  await nav(page, '/reports', 3000);
  await shot(page, 'instructor/reports-page.png', { fullPage: true });
}

async function captureLearnerWebPages(page) {
  console.log('\n  📄 Learner web pages...');

  // My Courses
  await nav(page, '/my-courses', 2500);
  await shot(page, 'learner/web/my-courses.png', { fullPage: true });

  // My Course detail (first enrolled)
  const courseLinks = await page.$$('a[href*="/my-courses/"]');
  let myCourseId = null;
  for (const link of courseLinks) {
    const href = await link.evaluate(el => el.href);
    if (href.match(/\/my-courses\/[^/]+$/) && !href.includes('/lessons/')) {
      myCourseId = href.split('/my-courses/')[1];
      await link.click();
      await wait(2500);
      break;
    }
  }

  if (myCourseId) {
    await shot(page, 'learner/web/course-detail.png', { fullPage: true });

    // Click first lesson
    const lessonLinks = await page.$$('a[href*="/lessons/"]');
    if (lessonLinks.length > 0) {
      await lessonLinks[0].click();
      await wait(3000);
      await shot(page, 'learner/web/lesson-player.png', { fullPage: false });
    }
  }

  // My Learning Paths
  await nav(page, '/my-learning-paths', 2500);
  await shot(page, 'learner/web/my-learning-paths.png', { fullPage: true });

  // Dashboard learner
  await nav(page, '/dashboard', 2000);
  await shot(page, 'learner/web/dashboard.png', { fullPage: true });

  // Profile
  await nav(page, '/profile', 2000);
  await shot(page, 'learner/web/profile.png', { fullPage: true });
}

async function capturePWAPages(page) {
  console.log('\n  📄 PWA App pages...');
  await page.setViewport({ width: 390, height: 844 }); // iPhone 14

  // Home
  await nav(page, '/app/home', 2500);
  await shot(page, 'learner/app/home.png', { fullPage: true });

  // Courses list
  await nav(page, '/app/courses', 2000);
  await shot(page, 'learner/app/courses-list.png', { fullPage: true });

  // Course detail
  const appCourseLinks = await page.$$('a[href*="/app/courses/"]');
  for (const link of appCourseLinks) {
    const href = await link.evaluate(el => el.href);
    if (href.match(/\/app\/courses\/[^/]+$/) && !href.includes('/lessons/')) {
      await link.click();
      await wait(2500);
      await shot(page, 'learner/app/course-detail.png', { fullPage: true });

      // First lesson
      const lessonLinks = await page.$$('a[href*="/lessons/"]');
      if (lessonLinks.length > 0) {
        await lessonLinks[0].click();
        await wait(3000);
        await shot(page, 'learner/app/lesson-player.png', { fullPage: false });

        // Notes tab
        const tabs = await page.$$('[role="tab"]');
        for (const tab of tabs) {
          const txt = await tab.evaluate(el => el.textContent?.trim());
          if (txt?.includes('Ghi chú')) {
            await tab.click();
            await wait(800);
            await shot(page, 'learner/app/lesson-notes.png', { fullPage: false });
            break;
          }
        }
      }
      break;
    }
  }

  // Progress
  await nav(page, '/app/progress', 2500);
  await shot(page, 'learner/app/progress.png', { fullPage: true });

  // Notifications
  await nav(page, '/app/notifications', 2000);
  await shot(page, 'learner/app/notifications.png', { fullPage: true });

  // Profile
  await nav(page, '/app/profile', 2500);
  await shot(page, 'learner/app/profile.png', { fullPage: true });

  // Reset viewport
  await page.setViewport({ width: 1366, height: 768 });
}

// ── MARKDOWN UPDATE ────────────────────────────────────────────────────────

/**
 * Map each [HÌNH X.Y] placeholder to its screenshot file.
 * Key = exact placeholder text, Value = relative path from docs root
 */
const IMAGE_MAP = {
  // ── Admin doc ──
  'HÌNH X.Y': 'docs/screenshots/admin/dashboard-full.png',
  'HÌNH 3.1': 'docs/screenshots/login-page.png',
  'HÌNH 3.4': 'docs/screenshots/admin/dashboard-kpi.png',
  'HÌNH 4.1': 'docs/screenshots/admin/settings-branding.png',
  'HÌNH 4.2': 'docs/screenshots/admin/settings-branding.png',
  'HÌNH 4.3': 'docs/screenshots/admin/settings-branding.png',
  'HÌNH 4.4': 'docs/screenshots/admin/settings-branding.png',
  'HÌNH 4.6': 'docs/screenshots/admin/settings-branding.png',
  'HÌNH 5.3': 'docs/screenshots/admin/settings-smtp.png',
  'HÌNH 5.4': 'docs/screenshots/admin/settings-smtp.png',
  'HÌNH 6.1': 'docs/screenshots/admin/organizations-list.png',
  'HÌNH 6.2': 'docs/screenshots/admin/organizations-create-modal.png',
  'HÌNH 6.4': 'docs/screenshots/admin/org-chart.png',
  'HÌNH 7.1': 'docs/screenshots/admin/users-create-modal.png',
  'HÌNH 7.3': 'docs/screenshots/admin/users-list.png',
  'HÌNH 7.4': 'docs/screenshots/admin/user-detail.png',
  'HÌNH 8.2': 'docs/screenshots/admin/user-detail.png',
  'HÌNH 9.1': 'docs/screenshots/admin/positions-list.png',
  'HÌNH 9.2': 'docs/screenshots/admin/positions-create-modal.png',
  'HÌNH 9.3': 'docs/screenshots/admin/positions-list.png',
  'HÌNH 9.5': 'docs/screenshots/admin/user-detail.png',
  'HÌNH 10.1': 'docs/screenshots/admin/dashboard-kpi.png',
  'HÌNH 10.2': 'docs/screenshots/admin/dashboard-full.png',
  'HÌNH 11.1': 'docs/screenshots/admin/reports-overview.png',
  'HÌNH 11.3': 'docs/screenshots/admin/reports-overview.png',
  'HÌNH 11.5': 'docs/screenshots/admin/reports-overview.png',
  'HÌNH 12.2': 'docs/screenshots/admin/operations-backup.png',
  'HÌNH 12.4': 'docs/screenshots/admin/operations-backup.png',

  // ── Instructor doc ──
  'HÌNH 2.1': 'docs/screenshots/instructor/dashboard.png',
  // 3.x use same keys as admin — handled per-file below
  'HÌNH 3.2': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 3.3': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 3.5a': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 3.6': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 3.7': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 3.8': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 3.9': 'docs/screenshots/instructor/course-editor-content.png',
  'HÌNH 4.0': 'docs/screenshots/instructor/course-wizard-step1.png',
  'HÌNH 4.2': 'docs/screenshots/instructor/course-wizard-step1.png',
  'HÌNH 4.3': 'docs/screenshots/instructor/course-wizard-step1.png',
  'HÌNH 4.4': 'docs/screenshots/instructor/course-wizard-step1.png',
  'HÌNH 4.5': 'docs/screenshots/instructor/course-wizard-step1.png',
  'HÌNH 5.1': 'docs/screenshots/instructor/question-banks-list.png',
  'HÌNH 5.2': 'docs/screenshots/instructor/question-create-form.png',
  'HÌNH 5.5': 'docs/screenshots/instructor/question-bank-detail.png',
  'HÌNH 5.6': 'docs/screenshots/instructor/question-bank-detail.png',
  'HÌNH 6.5': 'docs/screenshots/instructor/course-assign-tab.png',
  'HÌNH 6.6': 'docs/screenshots/instructor/course-assign-tab.png',
  'HÌNH 7.5': 'docs/screenshots/instructor/learning-path-builder.png',
  'HÌNH 8.2': 'docs/screenshots/instructor/learning-group-detail.png',
  'HÌNH 8.3': 'docs/screenshots/instructor/learning-group-detail.png',
  'HÌNH 8.4': 'docs/screenshots/instructor/learning-group-detail.png',
  'HÌNH 9.3': 'docs/screenshots/instructor/competency-frameworks-list.png',
  'HÌNH 10.3': 'docs/screenshots/instructor/reports-page.png',
  'HÌNH 10.4': 'docs/screenshots/instructor/reports-page.png',
};

// Per-file image maps (override global for same HÌNH numbers used in multiple docs)
const IMAGE_MAP_ADMIN = {
  ...IMAGE_MAP,
  'HÌNH 3.1': 'docs/screenshots/login-page.png',
  'HÌNH 4.1': 'docs/screenshots/admin/settings-branding.png',
};

const IMAGE_MAP_INSTRUCTOR = {
  ...IMAGE_MAP,
  'HÌNH 3.1': 'docs/screenshots/instructor/courses-list.png',
  'HÌNH 4.1': 'docs/screenshots/instructor/course-wizard-step1.png',
};

const IMAGE_MAP_LEARNER = {
  // Web
  'HÌNH 2.1': 'docs/screenshots/learner/web/dashboard.png',
  'HÌNH 2.2': 'docs/screenshots/login-page.png',
  'HÌNH 2.3': 'docs/screenshots/login-page.png',
  'HÌNH 3.1': 'docs/screenshots/learner/web/dashboard.png',
  'HÌNH 3.2': 'docs/screenshots/learner/web/dashboard.png',
  'HÌNH 4.1': 'docs/screenshots/learner/web/my-courses.png',
  'HÌNH 4.2': 'docs/screenshots/learner/web/my-courses.png',
  'HÌNH 4.3': 'docs/screenshots/learner/web/my-courses.png',
  'HÌNH 5.1': 'docs/screenshots/learner/web/course-detail.png',
  'HÌNH 5.2': 'docs/screenshots/learner/web/course-detail.png',
  'HÌNH 6.1': 'docs/screenshots/learner/web/lesson-player.png',
  'HÌNH 6.2': 'docs/screenshots/learner/web/lesson-player.png',
  'HÌNH 7.1': 'docs/screenshots/learner/web/lesson-player.png',
  'HÌNH 8.1': 'docs/screenshots/learner/web/lesson-player.png',
  'HÌNH 9.1': 'docs/screenshots/learner/web/lesson-player.png',
  'HÌNH 10.1': 'docs/screenshots/learner/web/lesson-player.png',
  'HÌNH 11.1': 'docs/screenshots/learner/web/my-learning-paths.png',
  'HÌNH 11.2': 'docs/screenshots/learner/web/my-learning-paths.png',
  'HÌNH 12.1': 'docs/screenshots/learner/web/profile.png',
  'HÌNH 12.2': 'docs/screenshots/learner/web/profile.png',
  // App
  'HÌNH 13.1': 'docs/screenshots/learner/app/home.png',
  'HÌNH 13.2': 'docs/screenshots/learner/app/home.png',
  'HÌNH 14.1': 'docs/screenshots/learner/app/home.png',
  'HÌNH 14.2': 'docs/screenshots/learner/app/home.png',
  'HÌNH 14.3': 'docs/screenshots/learner/app/home.png',
  'HÌNH 14.4': 'docs/screenshots/learner/app/home.png',
  'HÌNH 15.1': 'docs/screenshots/learner/app/courses-list.png',
  'HÌNH 15.2': 'docs/screenshots/learner/app/courses-list.png',
  'HÌNH 16.1': 'docs/screenshots/learner/app/course-detail.png',
  'HÌNH 16.2': 'docs/screenshots/learner/app/course-detail.png',
  'HÌNH 17.1': 'docs/screenshots/learner/app/lesson-player.png',
  'HÌNH 17.2': 'docs/screenshots/learner/app/lesson-notes.png',
  'HÌNH 18.1': 'docs/screenshots/learner/app/progress.png',
  'HÌNH 18.2': 'docs/screenshots/learner/app/progress.png',
  'HÌNH 19.1': 'docs/screenshots/learner/app/notifications.png',
  'HÌNH 19.2': 'docs/screenshots/learner/app/notifications.png',
  'HÌNH 20.1': 'docs/screenshots/learner/app/profile.png',
  'HÌNH 20.2': 'docs/screenshots/learner/app/profile.png',
};

function updateMarkdown(mdPath, imageMap) {
  let content = readFileSync(mdPath, 'utf8');
  let count = 0;

  content = content.replace(
    /> 📸 \*\*\[([^\]]+)\]\*\* (.+)/g,
    (match, hinhId, description) => {
      const imgPath = imageMap[hinhId];
      if (imgPath && existsSync(join(ROOT, imgPath))) {
        count++;
        return `> 📸 **[${hinhId}]** ${description}\n\n![${hinhId}](${imgPath})`;
      }
      return match; // keep placeholder if no screenshot exists
    }
  );

  writeFileSync(mdPath, content, 'utf8');
  console.log(`  ✅ Updated ${mdPath.split(/[\\/]/).pop()} — ${count} images embedded`);
}

// ── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 LMS Screenshot Capture Tool\n');
  ensureDir(SHOTS_DIR);

  const browser = await puppeteer.launch({
    executablePath: CHROME_WIN,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,768',
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(20000);

    // ── 1. Login page (no auth needed) ────────────────────────────────
    console.log('📸 Capturing login page...');
    await captureLoginPage(page);

    // ── 2. Admin pages (group_admin) ──────────────────────────────────
    console.log('📸 Logging in as group_admin...');
    await loginAs(page, 'group_admin');
    await captureAdminPages(page);

    // ── 3. Instructor pages ───────────────────────────────────────────
    console.log('\n📸 Logging in as instructor...');
    await loginAs(page, 'instructor');
    await captureInstructorPages(page);

    // ── 4. Learner web pages ──────────────────────────────────────────
    console.log('\n📸 Logging in as learner...');
    await loginAs(page, 'learner');
    await captureLearnerWebPages(page);
    await capturePWAPages(page);

    // ── 5. Update markdown files ──────────────────────────────────────
    console.log('\n📝 Updating markdown files with screenshots...');
    updateMarkdown(join(ROOT, 'HUONG_DAN_ADMIN_CONG_TY.md'), IMAGE_MAP_ADMIN);
    updateMarkdown(join(ROOT, 'HUONG_DAN_GIANG_VIEN.md'), IMAGE_MAP_INSTRUCTOR);
    updateMarkdown(join(ROOT, 'HUONG_DAN_HOC_VIEN.md'), IMAGE_MAP_LEARNER);

    console.log('\n✅ All done! Screenshots saved to docs/screenshots/');
    console.log('   Run: node scripts/generate-pdf-docs.mjs  to regenerate PDFs\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }
}

main();
