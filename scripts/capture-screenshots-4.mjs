/**
 * Pass 4 — recapture all list/overview pages with fixed login.
 * Run: node scripts/capture-screenshots-4.mjs
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
const BASE = 'http://localhost:3004';
const CHROME = 'C:/Users/Administrator/.cache/puppeteer/chrome/win64-148.0.7778.97/chrome-win64/chrome.exe';

const CREDS = {
  group_admin: { email: 'group_admin@via.vn', password: 'Admin@123' },
  instructor:  { email: 'instructor@via.vn',  password: 'Admin@123' },
  learner:     { email: 'nam.dv@phuthaiholdings.com', password: 'Admin@123' },
};

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, filename, fullPage = true) {
  const abs = join(SHOTS, filename);
  ensureDir(dirname(abs));
  await page.screenshot({ path: abs, fullPage });
  console.log(`  ✅ ${filename}`);
}

async function nav(page, path, ms = 2000) {
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
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 25000 });
  await wait(800);

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) { await emailInput.click({ clickCount: 3 }); await emailInput.type(c.email, { delay: 30 }); }
  const passInput = await page.$('input[type="password"]');
  if (passInput) { await passInput.click({ clickCount: 3 }); await passInput.type(c.password, { delay: 30 }); }
  await page.click('button[type="submit"]');

  try {
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 12000 });
  } catch {
    await wait(3000);
  }
  await wait(1500);
  const url = page.url();
  console.log(url.includes('/login') ? `  ❌ Login FAILED for ${role}` : `  🔑 Logged in as ${role}`);
}

async function main() {
  console.log('🚀 Screenshot Capture — Pass 4 (list/overview pages)\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.setDefaultTimeout(25000);

  try {
    // ── GROUP ADMIN list pages ────────────────────────────────────────────────
    console.log('📸 [group_admin] List & overview pages...');
    await loginAs(page, 'group_admin');

    await nav(page, '/dashboard');       await shot(page, 'admin/dashboard-kpi.png');
    await nav(page, '/dashboard');       await shot(page, 'admin/dashboard-full.png');
    await nav(page, '/organizations');   await shot(page, 'admin/organizations-list.png');
    await nav(page, '/users');           await shot(page, 'admin/users-list.png');
    await nav(page, '/positions');       await shot(page, 'admin/positions-list.png');
    await nav(page, '/reports/company'); await shot(page, 'admin/reports-overview.png');
    await nav(page, '/import');          await shot(page, 'admin/import-page.png');
    await nav(page, '/login-page');      // just get the login page
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(1500); await shot(page, 'login-page.png', false);

    // ── INSTRUCTOR list pages ─────────────────────────────────────────────────
    console.log('\n📸 [instructor] List pages...');
    await loginAs(page, 'instructor');

    await nav(page, '/dashboard');           await shot(page, 'instructor/dashboard.png');
    await nav(page, '/courses');             await shot(page, 'instructor/courses-list.png');
    await nav(page, '/courses/wizard');      await shot(page, 'instructor/course-wizard-step1.png');
    await nav(page, '/question-banks');      await shot(page, 'instructor/question-banks-list.png');
    await nav(page, '/learning-paths');      await shot(page, 'instructor/learning-paths-list.png');
    await nav(page, '/learning-groups');     await shot(page, 'instructor/learning-groups-list.png');
    await nav(page, '/competency-frameworks'); await shot(page, 'instructor/competency-frameworks-list.png');
    await nav(page, '/reports/company');     await shot(page, 'instructor/reports-page.png');

    // ── LEARNER WEB list pages ────────────────────────────────────────────────
    console.log('\n📸 [learner] Web list pages...');
    await loginAs(page, 'learner');

    await nav(page, '/dashboard');           await shot(page, 'learner/web/dashboard.png');
    await nav(page, '/my-courses');          await shot(page, 'learner/web/my-courses.png');
    await nav(page, '/my-learning-paths');   await shot(page, 'learner/web/my-learning-paths.png');
    await nav(page, '/profile');             await shot(page, 'learner/web/profile.png');

    // ── LEARNER APP list pages (mobile) ──────────────────────────────────────
    console.log('\n📸 [learner] App mobile list pages...');
    await page.setViewport({ width: 390, height: 844 });
    await loginAs(page, 'learner');

    await nav(page, '/app');             await shot(page, 'learner/app/home.png', false);
    await nav(page, '/app/courses');     await shot(page, 'learner/app/courses-list.png', false);
    await nav(page, '/app/progress');    await shot(page, 'learner/app/progress.png', false);
    await nav(page, '/app/notifications'); await shot(page, 'learner/app/notifications.png', false);
    await nav(page, '/app/profile');     await shot(page, 'learner/app/profile.png', false);

    console.log('\n✅ Pass 4 complete!\n');
  } finally {
    await browser.close();
  }
}

main();
