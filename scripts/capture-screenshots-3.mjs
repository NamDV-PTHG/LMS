/**
 * Third pass — targeted screenshots with hardcoded DB IDs.
 * Run: node scripts/capture-screenshots-3.mjs
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

// ── Hardcoded IDs from DB ────────────────────────────────────────────────────
const IDS = {
  publishedCourseId: '15f6cd3c-b0c2-4637-b90c-5a664eb77f61', // Kỹ năng lãnh đạo
  learnerCourseId:   'ac9eca91-ffaf-4093-b467-014060f9463c', // Kỹ thuật tạo câu lệnh prompt
  videoLessonId:     '4b9cfbc9-eab9-45ff-a631-f529fa7b3221', // video lesson
  quizLessonId:      '2bddd054-7599-4851-adbd-11888257f264', // quiz lesson
  qbId:              '5bd84b06-8948-412a-86da-6ae10a746fab', // Quiz: Bài tập prompt
  lpId:              '8bb9608c-ef2c-4021-aecc-510357c957ba', // Nhập môn AI
  lgId:              '5686b3bc-bd05-4077-9f4e-4a80c7a0a36f', // Nhóm kinh doanh (rule_based)
  orgId:             '0bc5e814-1ad3-4576-9779-97da914a0f82', // Phòng IT
  cfId:              '267ec3d5-edd6-4733-a19f-5e25be56f6ca', // Khung Trưởng phòng
  userId:            '36bb0c96-7f78-4e6c-a82b-ace41fb17bce', // learner user
};

const CREDS = {
  group_admin: { email: 'group_admin@via.vn', password: 'Admin@123' },
  instructor:  { email: 'instructor@via.vn',  password: 'Admin@123' },
  learner:     { email: 'nam.dv@phuthaiholdings.com', password: 'Admin@123' },
};

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, filename, fullPage = false) {
  const abs = join(SHOTS, filename);
  ensureDir(dirname(abs));
  await page.screenshot({ path: abs, fullPage });
  console.log(`  ✅ ${filename}`);
}

async function nav(page, path, ms = 2500) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(ms);
  } catch (e) {
    console.log(`  ⚠️  nav ${path}: ${e.message.slice(0, 60)}`);
    await wait(ms);
  }
}

async function loginAs(page, role) {
  const c = CREDS[role];
  // If already logged in with cookies, go to dashboard to verify
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 25000 });
  await wait(1000);

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(c.email, { delay: 30 });
  }
  const passInput = await page.$('input[type="password"]');
  if (passInput) {
    await passInput.click({ clickCount: 3 });
    await passInput.type(c.password, { delay: 30 });
  }
  await page.click('button[type="submit"]');

  // Wait for SPA navigation (router.push) — URL should leave /login
  try {
    await page.waitForFunction(
      () => !window.location.pathname.includes('/login'),
      { timeout: 15000 }
    );
  } catch {
    // Try waiting a bit more
    await wait(3000);
  }
  await wait(1500);
  const url = page.url();
  if (url.includes('/login')) {
    console.log(`  ❌  Login FAILED for ${role}: still on ${url}`);
  } else {
    console.log(`  🔑 Logged in as ${role} → ${url}`);
  }
}

// Click first element matching text among common tab/button selectors
async function clickTab(page, texts) {
  const els = await page.$$('button, [role="tab"], a');
  for (const el of els) {
    const txt = await el.evaluate(e => e.textContent?.trim() ?? '');
    if (texts.some(t => txt.toLowerCase().includes(t.toLowerCase()))) {
      try {
        await el.click();
        await wait(1200);
        return true;
      } catch { /* skip */ }
    }
  }
  console.log(`  ⚠️  Tab not found: ${texts.join('/')}`);
  return false;
}

// Click button matching text
async function clickBtn(page, texts) {
  const btns = await page.$$('button, a[role="button"]');
  for (const btn of btns) {
    const txt = await btn.evaluate(e => e.textContent?.trim() ?? '');
    if (texts.some(t => txt.toLowerCase().includes(t.toLowerCase()))) {
      try {
        await btn.click();
        await wait(1200);
        return true;
      } catch { /* skip */ }
    }
  }
  console.log(`  ⚠️  Button not found: ${texts.join('/')}`);
  return false;
}

async function main() {
  console.log('🚀 Screenshot Capture — Pass 3 (targeted)\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.setDefaultTimeout(25000);

  try {
    // ── GROUP ADMIN ──────────────────────────────────────────────────────────
    console.log('📸 [group_admin] Settings & admin pages...');
    await loginAs(page, 'group_admin');

    // Settings - Branding (already have but redo at wider viewport)
    await nav(page, '/settings', 2000);
    await shot(page, 'admin/settings-branding.png', true);

    // Settings - SMTP tab (label: 'Mail Server')
    await nav(page, '/settings', 1500);
    if (await clickTab(page, ['Mail Server'])) {
      await shot(page, 'admin/settings-smtp.png', true);
    }

    // Org detail (direct URL)
    await nav(page, `/organizations/${IDS.orgId}`, 2500);
    await shot(page, 'admin/org-detail-info.png', true);

    // Org - Users tab (label contains 'Người dùng')
    await clickTab(page, ['Người dùng']);
    await shot(page, 'admin/org-detail-users.png', true);

    // Org chart tab (label: 'Sơ đồ tổ chức')
    await nav(page, `/organizations/${IDS.orgId}`, 1500);
    await clickTab(page, ['Sơ đồ tổ chức']);
    await shot(page, 'admin/org-chart.png', true);

    // Organizations list + open create modal
    await nav(page, '/organizations', 1500);
    await clickBtn(page, ['Tạo phòng ban', 'Tạo công ty', 'Tạo tổ chức', 'Thêm']);
    await shot(page, 'admin/organizations-create-modal.png', false);
    await page.keyboard.press('Escape'); await wait(500);

    // Users list + open create modal
    await nav(page, '/users', 1500);
    await clickBtn(page, ['Thêm người dùng']);
    await shot(page, 'admin/users-create-modal.png', false);
    await page.keyboard.press('Escape'); await wait(500);

    // User detail (direct URL)
    await nav(page, `/users/${IDS.userId}`, 2500);
    await shot(page, 'admin/user-detail.png', true);

    // Positions list + create modal
    await nav(page, '/positions', 1500);
    await clickBtn(page, ['+ Tạo vị trí mới', 'Tạo vị trí mới']);
    await shot(page, 'admin/positions-create-modal.png', false);
    await page.keyboard.press('Escape'); await wait(500);

    // Operations page
    await nav(page, '/operations', 2500);
    await shot(page, 'admin/operations-system.png', true);

    // Click Sao lưu tab then screenshot
    await nav(page, '/operations', 2000);
    await wait(500);
    if (await clickTab(page, ['Sao lưu'])) {
      await wait(1500);
      await shot(page, 'admin/operations-backup.png', true);
    } else {
      await shot(page, 'admin/operations-backup.png', true);
    }

    // Course share tab (only group_admin can see this)
    await nav(page, `/courses/${IDS.publishedCourseId}`, 2000);
    if (await clickTab(page, ['Chia sẻ với công ty', 'Chia sẻ'])) {
      await shot(page, 'instructor/course-share-tab.png', true);
    }

    // AI Config
    await nav(page, '/ai-config', 2000);
    await shot(page, 'admin/ai-config.png', true);

    // ── INSTRUCTOR ────────────────────────────────────────────────────────────
    console.log('\n📸 [instructor] Course editor & content pages...');
    await loginAs(page, 'instructor');

    // Course editor - default view (Nội dung tab)
    await nav(page, `/courses/${IDS.publishedCourseId}`, 3000);
    await shot(page, 'instructor/course-editor-content.png', true);

    // Tab Phân phối (label: '📤 Phân phối & Giao học')
    await nav(page, `/courses/${IDS.publishedCourseId}`, 2000);
    if (await clickTab(page, ['Phân phối & Giao học', 'Phân phối'])) {
      await shot(page, 'instructor/course-assign-tab.png', true);
    }

    // Tab Chia sẻ (label: '🔗 Chia sẻ với công ty')
    await nav(page, `/courses/${IDS.publishedCourseId}`, 2000);
    if (await clickTab(page, ['Chia sẻ với công ty', 'Chia sẻ'])) {
      await shot(page, 'instructor/course-share-tab.png', true);
    }

    // Tab Đánh giá (label: '⭐ Đánh giá')
    await nav(page, `/courses/${IDS.publishedCourseId}`, 2000);
    if (await clickTab(page, ['Đánh giá'])) {
      await shot(page, 'instructor/course-ratings-tab.png', true);
    }

    // Question bank detail
    await nav(page, `/question-banks/${IDS.qbId}`, 2500);
    await shot(page, 'instructor/question-bank-detail.png', true);

    // Question create form tab (label: '+ Tạo mới')
    if (await clickTab(page, ['+ Tạo mới', 'Tạo mới'])) {
      await shot(page, 'instructor/question-create-form.png', true);
    }

    // Pending tab (label: '⏳ Chờ duyệt')
    await nav(page, `/question-banks/${IDS.qbId}`, 1500);
    if (await clickTab(page, ['Chờ duyệt'])) {
      await shot(page, 'instructor/question-pending.png', true);
    }

    // Categories tab (label contains 'Danh mục năng lực')
    await nav(page, `/question-banks/${IDS.qbId}`, 1500);
    if (await clickTab(page, ['Danh mục năng lực', 'Danh mục'])) {
      await shot(page, 'instructor/question-categories.png', true);
    }

    // Learning path detail
    await nav(page, `/learning-paths/${IDS.lpId}`, 2500);
    await shot(page, 'instructor/learning-path-builder.png', true);

    // Open enroll modal (label: '+ Đăng ký học viên') - navigate fresh and wait for data
    await nav(page, `/learning-paths/${IDS.lpId}`, 3500);
    if (await clickBtn(page, ['+ Đăng ký học viên', 'Đăng ký học viên'])) {
      await wait(1000);
      await shot(page, 'instructor/learning-path-enroll-modal.png', false);
      await page.keyboard.press('Escape'); await wait(500);
    }

    // Learning group detail
    await nav(page, `/learning-groups/${IDS.lgId}`, 2500);
    await shot(page, 'instructor/learning-group-detail.png', true);

    // Courses tab in learning group (label contains 'Khóa học')
    if (await clickTab(page, ['Khóa học'])) {
      await shot(page, 'instructor/learning-group-courses.png', true);
    }

    // Rules tab (label: 'Quy tắc tự động')
    await nav(page, `/learning-groups/${IDS.lgId}`, 1500);
    if (await clickTab(page, ['Quy tắc tự động', 'Quy tắc'])) {
      await shot(page, 'instructor/learning-group-rules.png', true);
    }

    // Competency framework detail
    await nav(page, `/competency-frameworks/${IDS.cfId}`, 2500);
    await shot(page, 'instructor/competency-framework-detail.png', true);

    // ── LEARNER WEB ───────────────────────────────────────────────────────────
    console.log('\n📸 [learner] Web pages...');
    await loginAs(page, 'learner');

    // My course detail
    await nav(page, `/my-courses/${IDS.learnerCourseId}`, 3000);
    await shot(page, 'learner/web/course-detail.png', true);

    // Lesson player — video
    await nav(page, `/my-courses/${IDS.learnerCourseId}/lessons/${IDS.videoLessonId}`, 4000);
    await shot(page, 'learner/web/lesson-player.png', false);

    // Lesson — quiz
    await nav(page, `/my-courses/${IDS.learnerCourseId}/lessons/${IDS.quizLessonId}`, 3000);
    await shot(page, 'learner/web/lesson-quiz.png', false);

    // Forgot password
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(1500);
    await shot(page, 'login-forgot-password.png', false);

    // ── LEARNER APP (mobile) ──────────────────────────────────────────────────
    console.log('\n📸 [learner] App mobile pages...');
    await page.setViewport({ width: 390, height: 844 });

    await loginAs(page, 'learner');

    // App course detail
    await nav(page, `/app/courses/${IDS.learnerCourseId}`, 3000);
    await shot(page, 'learner/app/course-detail.png', true);

    // App lesson player (video)
    await nav(page, `/app/courses/${IDS.learnerCourseId}/lessons/${IDS.videoLessonId}`, 4000);
    await shot(page, 'learner/app/lesson-player.png', false);

    // App lesson notes tab (label: 'Ghi chú')
    if (await clickTab(page, ['Ghi chú'])) {
      await shot(page, 'learner/app/lesson-notes.png', false);
    } else {
      await page.evaluate(() => window.scrollTo(0, 400));
      await wait(500);
      await shot(page, 'learner/app/lesson-notes.png', false);
    }

    console.log('\n✅ All targeted screenshots done. Updating markdown...\n');
    patchAllMarkdown();

  } finally {
    await browser.close();
  }
}

// ── Markdown patching ────────────────────────────────────────────────────────

function resolveImage(hinhId, mdPath) {
  const isAdmin   = mdPath.includes('ADMIN');
  const isInstr   = mdPath.includes('GIANG_VIEN');

  const ADMIN_MAP = {
    'HÌNH 3.1':  'login-page.png',
    'HÌNH 3.4':  'admin/dashboard-kpi.png',
    'HÌNH 4.1':  'admin/settings-branding.png',
    'HÌNH 4.2':  'admin/settings-branding.png',
    'HÌNH 4.3':  'admin/settings-branding.png',
    'HÌNH 4.4':  'admin/settings-branding.png',
    'HÌNH 4.6':  'admin/settings-branding.png',
    'HÌNH 5.3':  'admin/settings-smtp.png',
    'HÌNH 5.4':  'admin/settings-smtp.png',
    'HÌNH 6.1':  'admin/organizations-list.png',
    'HÌNH 6.2':  'admin/organizations-create-modal.png',
    'HÌNH 6.3':  'admin/org-detail-info.png',
    'HÌNH 6.4':  'admin/org-chart.png',
    'HÌNH 7.1':  'admin/users-create-modal.png',
    'HÌNH 7.3':  'admin/users-list.png',
    'HÌNH 7.4':  'admin/user-detail.png',
    'HÌNH 8.2':  'admin/user-detail.png',
    'HÌNH 9.1':  'admin/positions-list.png',
    'HÌNH 9.2':  'admin/positions-create-modal.png',
    'HÌNH 9.3':  'admin/positions-list.png',
    'HÌNH 9.5':  'admin/user-detail.png',
    'HÌNH 10.1': 'admin/dashboard-kpi.png',
    'HÌNH 10.2': 'admin/dashboard-full.png',
    'HÌNH 11.1': 'admin/reports-overview.png',
    'HÌNH 11.3': 'admin/reports-overview.png',
    'HÌNH 11.5': 'admin/reports-overview.png',
    'HÌNH 12.2': 'admin/operations-backup.png',
    'HÌNH 12.4': 'admin/operations-backup.png',
    'HÌNH 12.5': 'admin/ai-config.png',
    'HÌNH 13.1': 'admin/ai-config.png',
  };

  const INSTR_MAP = {
    'HÌNH 2.1':  'instructor/dashboard.png',
    'HÌNH 3.1':  'instructor/courses-list.png',
    'HÌNH 3.2':  'instructor/course-editor-content.png',
    'HÌNH 3.3':  'instructor/course-editor-content.png',
    'HÌNH 3.4':  'instructor/course-editor-content.png',
    'HÌNH 3.5a': 'instructor/course-editor-content.png',
    'HÌNH 3.6':  'instructor/course-editor-content.png',
    'HÌNH 3.7':  'instructor/course-editor-content.png',
    'HÌNH 3.8':  'instructor/course-editor-content.png',
    'HÌNH 3.9':  'instructor/course-editor-content.png',
    'HÌNH 4.0':  'instructor/course-wizard-step1.png',
    'HÌNH 4.1':  'instructor/course-wizard-step1.png',
    'HÌNH 4.2':  'instructor/course-wizard-step1.png',
    'HÌNH 4.3':  'instructor/course-wizard-step1.png',
    'HÌNH 4.4':  'instructor/course-wizard-step1.png',
    'HÌNH 4.5':  'instructor/course-wizard-step1.png',
    'HÌNH 5.1':  'instructor/question-banks-list.png',
    'HÌNH 5.2':  'instructor/question-create-form.png',
    'HÌNH 5.3':  'instructor/question-bank-detail.png',
    'HÌNH 5.5':  'instructor/question-pending.png',
    'HÌNH 5.6':  'instructor/question-categories.png',
    'HÌNH 6.4':  'instructor/course-assign-tab.png',
    'HÌNH 6.5':  'instructor/course-assign-tab.png',
    'HÌNH 6.6':  'instructor/course-share-tab.png',
    'HÌNH 6.7':  'instructor/course-ratings-tab.png',
    'HÌNH 7.1':  'instructor/learning-path-builder.png',
    'HÌNH 7.5':  'instructor/learning-path-enroll-modal.png',
    'HÌNH 8.1':  'instructor/learning-group-detail.png',
    'HÌNH 8.2':  'instructor/learning-group-detail.png',
    'HÌNH 8.3':  'instructor/learning-group-rules.png',
    'HÌNH 8.4':  'instructor/learning-group-courses.png',
    'HÌNH 9.3':  'instructor/competency-framework-detail.png',
    'HÌNH 10.3': 'instructor/reports-page.png',
    'HÌNH 10.4': 'instructor/reports-page.png',
  };

  const LEARNER_MAP = {
    'HÌNH 2.1':  'login-page.png',
    'HÌNH 2.2':  'login-page.png',
    'HÌNH 2.3':  'login-forgot-password.png',
    'HÌNH 3.1':  'learner/web/dashboard.png',
    'HÌNH 3.2':  'learner/web/dashboard.png',
    'HÌNH 3.3':  'learner/web/dashboard.png',
    'HÌNH 3.4':  'learner/web/dashboard.png',
    'HÌNH 4.1':  'learner/web/my-courses.png',
    'HÌNH 4.2':  'learner/web/my-courses.png',
    'HÌNH 4.3':  'learner/web/my-courses.png',
    'HÌNH 4.4':  'learner/web/my-courses.png',
    'HÌNH 4.5':  'learner/web/my-courses.png',
    'HÌNH 4.6':  'learner/web/my-courses.png',
    'HÌNH 5.1':  'learner/web/course-detail.png',
    'HÌNH 5.2':  'learner/web/course-detail.png',
    'HÌNH 5.3':  'learner/web/course-detail.png',
    'HÌNH 5.4':  'learner/web/course-detail.png',
    'HÌNH 5.5':  'learner/web/course-detail.png',
    'HÌNH 6.1':  'learner/web/lesson-player.png',
    'HÌNH 6.2':  'learner/web/lesson-player.png',
    'HÌNH 6.3':  'learner/web/lesson-player.png',
    'HÌNH 6.4':  'learner/web/lesson-player.png',
    'HÌNH 7.1':  'learner/web/lesson-player.png',
    'HÌNH 7.2':  'learner/web/lesson-player.png',
    'HÌNH 8.1':  'learner/web/lesson-quiz.png',
    'HÌNH 8.2':  'learner/web/lesson-quiz.png',
    'HÌNH 8.3':  'learner/web/lesson-quiz.png',
    'HÌNH 9.1':  'learner/web/lesson-player.png',
    'HÌNH 9.2':  'learner/web/lesson-player.png',
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

  const map = isAdmin ? ADMIN_MAP : (isInstr ? INSTR_MAP : LEARNER_MAP);
  const rel = map[hinhId];
  if (!rel) return null;
  const abs = join(SHOTS, rel);
  if (!existsSync(abs)) return null;
  return `docs/screenshots/${rel}`;
}

function patchMd(mdPath) {
  let content = readFileSync(mdPath, 'utf8');
  const lines = content.split('\n');
  const out = [];
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/> 📸 \*\*\[([^\]]+)\]\*\*/);
    if (m) {
      out.push(line);
      const next = lines[i + 1] ?? '';
      // Skip if image already embedded
      if (!next.startsWith('![')) {
        const imgPath = resolveImage(m[1], mdPath);
        if (imgPath) {
          out.push('');
          out.push(`![${m[1]}](${imgPath})`);
          count++;
        }
      }
    } else {
      out.push(line);
    }
  }

  writeFileSync(mdPath, out.join('\n'), 'utf8');
  console.log(`  ✅ ${mdPath.split(/[\\/]/).pop()} — ${count} images embedded`);
}

function patchAllMarkdown() {
  patchMd(join(ROOT, 'HUONG_DAN_ADMIN_CONG_TY.md'));
  patchMd(join(ROOT, 'HUONG_DAN_GIANG_VIEN.md'));
  patchMd(join(ROOT, 'HUONG_DAN_HOC_VIEN.md'));
}

main();
