// @ts-nocheck
import { Router, Request, Response } from "express";
import { getPlatformPath, platformAdminAllowed } from "../../config/runtime.js";
import { postgresDb } from "../../db/postgres.js";

export const platformUiRouter = Router();
platformUiRouter.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// Platform Login Page HTML
platformUiRouter.get("/login", (req: Request, res: Response) => {
  if (req.query && "token" in req.query && typeof req.query.token === "string" && req.query.token.trim()) {
    return res.redirect(302, getPlatformPath() + "/login");
  }
  res.send(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ورود به مدیریت کلان پلتفرم | Amlak OS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/index-app.css">
  <script src="/assets/tailwind.js"></script>
  <style>
    body { font-family: 'Vazirmatn', sans-serif; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-800/90 rounded-2xl border border-slate-700 shadow-2xl p-6 sm:p-8 backdrop-blur-md">
    <div class="text-center mb-6">
      <div class="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
        <svg class="w-8 h-8 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
        </svg>
      </div>
      <h1 class="text-xl font-black text-white">پرتال مدیریت کلان پلتفرم</h1>
      <p class="text-xs text-slate-400 mt-1">Amlak OS • دسترسی اختصاصی مدیران کلان SaaS</p>
    </div>

    <div id="error-msg" class="hidden mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center"></div>

    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1.5">نام کاربری مدیریت کلان</label>
        <input type="text" id="username" required dir="ltr" placeholder="نام کاربری مدیر" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1.5">رمز عبور امن</label>
        <input type="password" id="password" required dir="ltr" placeholder="••••••••••••" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
      </div>

      <button type="submit" id="submit-btn" class="w-full bg-amber-500 hover:bg-amber-450 active:scale-98 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 mt-2">
        <span>ورود به پنل مدیریت</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
      </button>
    </form>

    <div class="mt-6 pt-4 border-t border-slate-700/60 text-center">
      <a href="/" class="text-xs text-slate-400 hover:text-amber-400 transition flex items-center justify-center gap-1">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        <span>بازگشت به پرتال آژانس‌های املاک</span>
      </a>
    </div>
  </div>

  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('error-msg');
      const btn = document.getElementById('submit-btn');
      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerText = 'در حال اعتبارسنجی...';

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      try {
        const res = await fetch('/api/v1/platform/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          window.location.href = '${getPlatformPath()}';
        } else {
          errBox.innerText = data.error?.message || 'مشخصات ورود نامعتبر است.';
          errBox.classList.remove('hidden');
        }
      } catch (err) {
        errBox.innerText = 'خطا در برقراری ارتباط با سرور پلتفرم.';
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerText = 'ورود به پنل مدیریت';
      }
    });
  </script>
</body>
</html>`);
});

// Platform Admin Dashboard HTML
platformUiRouter.get(["/", "/dashboard"], async (req: Request, res: Response, next) => {
  if (req.query && "token" in req.query && typeof req.query.token === "string" && req.query.token.trim()) {
    return res.redirect(302, getPlatformPath());
  }
  const token = req.cookies?.amlak_platform_session;
  if (!token) {
    return res.redirect(302, getPlatformPath() + "/login");
  }
  try {
    const session = await postgresDb.getPlatformSessionByToken(token);
    if (!session?.admin?.is_active || !platformAdminAllowed(session.admin.username)) {
      res.clearCookie("amlak_platform_session", { path: "/" });
      return res.redirect(302, getPlatformPath() + "/login");
    }
  } catch (error) {
    return next(error);
  }
  res.send(`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>پنل مدیریت کلان پلتفرم | Amlak OS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/index-app.css">
  <script src="/assets/tailwind.js"></script>
  <style>
    body { font-family: 'Vazirmatn', sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <!-- Top Nav -->
  <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
          OS
        </div>
        <div>
          <h1 class="text-sm font-extrabold text-white">مدیریت کلان Amlak OS</h1>
          <p class="text-[10px] text-amber-400 font-medium">Platform Administration Portal</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div id="admin-info" class="text-left hidden sm:block">
          <span id="admin-name" class="text-xs font-bold text-slate-200 block">...</span>
          <span class="text-[10px] text-slate-400">مدیر کلان سیستم</span>
        </div>
        <button id="logout-btn" class="text-xs bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 py-1.5 px-3 rounded-lg border border-slate-700 transition">
          خروج از سیستم
        </button>
      </div>
    </div>
  </header>

  <!-- Support Session Active Banner (if any) -->
  <div id="support-banner" class="hidden bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5">
    <div class="max-w-7xl mx-auto flex items-center justify-between text-xs">
      <div class="flex items-center gap-2 text-amber-300">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span class="font-bold">حالت پشتیبانی نظارتی فعال است:</span>
        <span id="support-tenant-name" class="font-semibold text-white">...</span>
        <span class="text-amber-400/80">(دسترسی صرفاً فقط‌خواندنی)</span>
      </div>
      <button id="end-support-btn" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded text-[11px] transition">
        خاتمه نشست پشتیبانی
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4" id="metrics-grid">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <span class="text-xs text-slate-400 block mb-1">کل دفاتر املاک (Tenants)</span>
        <span id="metric-tenants" class="text-2xl font-black text-white">0</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <span class="text-xs text-slate-400 block mb-1">اشتراک‌های فعال</span>
        <span id="metric-active" class="text-2xl font-black text-emerald-400">0</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <span class="text-xs text-slate-400 block mb-1">کل مشاوران فعال</span>
        <span id="metric-agents" class="text-2xl font-black text-blue-400">0</span>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <span class="text-xs text-slate-400 block mb-1">کل فایل‌های ملکی سیستم</span>
        <span id="metric-properties" class="text-2xl font-black text-amber-400">0</span>
      </div>
    </div>

    <!-- Dedicated Data Backup & Restore Center -->
    <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg font-bold">
            💾
          </div>
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              مرکز پشتیبان‌گیری، خروجی و بازیابی اطلاعات
              <span class="text-[10px] font-normal bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">Data Backup & Restore Center</span>
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">دریافت خروجی کامل داده‌های املاک (فایل‌ها، متقاضیان، مالکین، مشاوران و قراردادها) یا بازیابی مجدد اطلاعات از فایل JSON</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Tool 1: Single Agency Backup -->
        <div class="bg-slate-950/70 border border-slate-800 hover:border-blue-500/40 rounded-xl p-4 flex flex-col justify-between transition">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <span class="text-blue-400">🏢</span> پشتیبان‌گیری یک املاک خاص
              </span>
              <span class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Single Agency</span>
            </div>
            <p class="text-[11px] text-slate-400 mb-3 leading-relaxed">
              انتخاب دفتر املاک مورد نظر جهت دریافت خروجی مستقل کلیه فایل‌ها، مشتریان، مالکین و قراردادهای همان دفتر:
            </p>
            <div class="mb-3">
              <select id="quick-backup-tenant-select" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                <option value="">-- انتخاب دفتر املاک --</option>
              </select>
            </div>
          </div>
          <button id="btn-quick-export-tenant" type="button" class="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20">
            <span>💾 دریافت خروجی بک‌آپ این املاک (JSON)</span>
          </button>
        </div>

        <!-- Tool 2: Full System Backup -->
        <div class="bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 rounded-xl p-4 flex flex-col justify-between transition">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <span class="text-indigo-400">📦</span> پشتیبان‌گیری جامع کل سامانه
              </span>
              <span class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Full System</span>
            </div>
            <p class="text-[11px] text-slate-400 mb-3 leading-relaxed">
              تولید و دانلود فایل جامع شامل تمامی دفاتر املاک ثبت‌شده، شعب، فایل‌های ملکی، مشتریان و کاربران کل نرم‌افزار.
            </p>
          </div>
          <button id="btn-center-export-all" type="button" data-action="export-all" class="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 hover:text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700">
            <span>📦 دانلود پشتیبان کامل کلیه دفاتر سامانه</span>
          </button>
        </div>

        <!-- Tool 3: Import & Restore -->
        <div class="bg-slate-950/70 border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-4 flex flex-col justify-between transition">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span class="text-amber-400">📥</span> ورود و بازیابی فایل بک‌آپ
              </span>
              <span class="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Import / Restore</span>
            </div>
            <p class="text-[11px] text-slate-400 mb-3 leading-relaxed">
              بارگذاری فایل پشتیبان JSON برای بازگردانی اطلاعات؛ امکان ثبت به عنوان آژانس جدید یا بازنویسی اطلاعات روی دفتر موجود.
            </p>
          </div>
          <button id="btn-center-open-import" type="button" data-action="open-import" class="w-full bg-amber-500 hover:bg-amber-450 active:scale-95 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20">
            <span>📥 بارگذاری و بازیابی اطلاعات (Import)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Actions & Tenants Section -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div class="p-4 sm:p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-white">مدیریت آژانس‌ها و اشتراک‌ها</h2>
          <p class="text-xs text-slate-400 mt-0.5">کنترل وضعیت دسترسی، استخراج بک‌آپ، تمدید پلن و پشتیبانی نظارتی</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button id="btn-export-all" type="button" data-action="export-all" class="bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-200 hover:text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-700" title="دانلود و خروجی کامل فایل پشتیبان جامع از کل دفاتر و کاربران سامانه">
            <span>📦 پشتیبان کل سیستم</span>
          </button>
          <button id="btn-open-import" type="button" data-action="open-import" class="bg-slate-800 hover:bg-slate-750 active:scale-95 text-amber-300 hover:text-amber-200 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-amber-500/40" title="ورود و بازیابی فایل بک‌آپ (ایجاد آژانس جدید یا بازنویسی)">
            <span>📥 بازیابی فایل بک‌آپ (Import)</span>
          </button>
          <button id="btn-open-new-tenant" type="button" data-action="new-tenant" class="bg-amber-500 hover:bg-amber-450 active:scale-95 text-slate-950 font-bold text-xs py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20">
            <span>+ تعریف آژانس جدید</span>
          </button>
        </div>
      </div>

      <!-- Tenants Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-right text-xs">
          <thead class="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th class="p-3.5">نام آژانس</th>
              <th class="p-3.5">کد اختصاصی</th>
              <th class="p-3.5">مدیر آژانس (ورود به /)</th>
              <th class="p-3.5">پلن اشتراک</th>
              <th class="p-3.5">وضعیت اشتراک</th>
              <th class="p-3.5">انقضا</th>
              <th class="p-3.5">آمار شعب / مشاور</th>
              <th class="p-3.5 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody id="tenants-tbody" class="divide-y divide-slate-800 text-slate-200">
            <tr><td colspan="8" class="p-6 text-center text-slate-500">در حال بارگذاری اطلاعات دفاتر...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- P3 Support Audit Logs -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
      <h3 class="text-sm font-bold text-white mb-2">گزارشات نظارتی دسترسی پشتیبانی (P3 Audit Trail)</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-right text-xs">
          <thead class="text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-2 px-3">زمان</th>
              <th class="py-2 px-3">مدیر پلتفرم</th>
              <th class="py-2 px-3">دفتر هدف</th>
              <th class="py-2 px-3">اقدام</th>
              <th class="py-2 px-3">منبع</th>
            </tr>
          </thead>
          <tbody id="audit-tbody" class="divide-y divide-slate-800/60 text-slate-300">
            <tr><td colspan="5" class="py-4 text-center text-slate-500">در حال دریافت وقایع نظارتی...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- Modals -->
  <!-- New Tenant Modal -->
  <div id="new-tenant-modal" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 class="text-sm font-bold text-white">تعریف آژانس جدید و ایجاد حساب مدیر</h3>
          <p class="text-[11px] text-slate-400 mt-0.5">ثبت مشخصات آژانس به همراه تعریف نام کاربری و رمز عبور مدیر</p>
        </div>
        <button type="button" data-action="close-new-tenant" class="text-slate-400 hover:text-white p-1 text-base cursor-pointer">✕</button>
      </div>
      <form id="new-tenant-form" class="space-y-4 text-xs">
        <!-- بخش ۱: اطلاعات دفتر املاک -->
        <div class="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-3">
          <div class="flex items-center gap-2 text-amber-400 font-bold border-b border-slate-800/60 pb-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            <span>۱. مشخصات دفتر املاک</span>
          </div>
          <div>
            <label class="block text-slate-300 mb-1">کد اختصاصی آژانس (Agency Code) <span class="text-rose-400">*</span></label>
            <input type="text" id="nt-code" required placeholder="AMLA02" dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 uppercase text-white font-mono focus:border-amber-500 focus:outline-none">
            <p class="text-[10px] text-slate-500 mt-1">مدیر و مشاوران هنگام ورود به پرتال در صفحه اصلی (/) این کد را وارد خواهند کرد.</p>
          </div>
          <div>
            <label class="block text-slate-300 mb-1">نام دفتر املاک <span class="text-rose-400">*</span></label>
            <input type="text" id="nt-name" required placeholder="املاک رویال" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-slate-300 mb-1">شماره تماس دفتر</label>
            <input type="text" id="nt-phone" placeholder="02188990011" dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-300 mb-1">پلن اولیه</label>
              <select id="nt-plan" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
                <option value="ENTERPRISE_PRO">سازمانی پیشرفته</option>
                <option value="PROFESSIONAL">حرفه‌ای</option>
                <option value="STARTER">پایه</option>
              </select>
            </div>
            <div>
              <label class="block text-slate-300 mb-1">دوره آزمایشی (روز)</label>
              <input type="number" id="nt-trial" value="7" min="1" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
            </div>
          </div>
        </div>

        <!-- بخش ۲: تعریف حساب مدیر ارشد آژانس -->
        <div class="bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/30 space-y-3">
          <div class="flex items-center gap-2 text-amber-300 font-bold border-b border-amber-500/20 pb-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span>۲. تعریف حساب مدیر ارشد آژانس (ورود به پرتال اصلی /)</span>
          </div>
          <div>
            <label class="block text-slate-300 mb-1">نام و نام خانوادگی مدیر <span class="text-rose-400">*</span></label>
            <input type="text" id="nt-admin-name" required placeholder="مهندس علی اکبری" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-300 mb-1">نام کاربری مدیر <span class="text-rose-400">*</span></label>
              <input type="text" id="nt-admin-username" required placeholder="admin" dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none">
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-slate-300">رمز عبور مدیر <span class="text-rose-400">*</span></label>
                <button type="button" data-action="generate-random-pass" data-target="nt-admin-password" class="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer">تولید رمز ⚄</button>
              </div>
              <div class="relative">
                <input type="password" id="nt-admin-password" required placeholder="حداقل ۶ کاراکتر" dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none pr-3 pl-8">
                <button type="button" data-action="toggle-pass-visibility" data-target="nt-admin-password" class="absolute left-2.5 top-2.5 text-slate-400 hover:text-white text-xs cursor-pointer">👁</button>
              </div>
            </div>
          </div>
          <div class="text-[11px] text-amber-200/90 bg-amber-500/10 p-2.5 rounded-lg leading-relaxed border border-amber-500/20">
            💡 این اطلاعات در دیتابیس ثبت شده و مدیر آژانس می‌تواند از <strong>صفحه اصلی (/)</strong> با این <strong>کد آژانس</strong>، <strong>نام کاربری</strong> و <strong>رمز عبور</strong> وارد پنل مدیریتی آژانس شود.
          </div>
        </div>

        <button type="submit" id="nt-submit-btn" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl mt-2 transition flex items-center justify-center gap-2 text-xs">
          <span>ثبت دفتر املاک و ساخت حساب مدیر</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </button>
      </form>
    </div>
  </div>

  <!-- Tenant Created Success Modal -->
  <div id="tenant-success-modal" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div class="text-center space-y-2">
        <div class="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h3 class="text-base font-bold text-white">دفتر املاک و حساب مدیر با موفقیت ایجاد شد!</h3>
        <p class="text-xs text-slate-400">اطلاعات حساب جهت ورود مدیر به پنل اختصاصی آژانس:</p>
      </div>

      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs font-mono">
        <div class="flex items-center justify-between py-1 border-b border-slate-800/80">
          <span class="text-slate-400 font-sans">کد آژانس (Agency Code):</span>
          <span id="succ-code" class="text-amber-400 font-bold text-sm">...</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-800/80">
          <span class="text-slate-400 font-sans">نام دفتر املاک:</span>
          <span id="succ-name" class="text-white font-sans font-bold">...</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-800/80">
          <span class="text-slate-400 font-sans">نام کاربری مدیر:</span>
          <span id="succ-username" class="text-emerald-400 font-bold">...</span>
        </div>
        <div class="flex items-center justify-between py-1">
          <span class="text-slate-400 font-sans">رمز عبور مدیر:</span>
          <span id="succ-password" class="text-white font-bold">...</span>
        </div>
      </div>

      <div class="text-[11px] text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
        📌 مدیر این آژانس می‌تواند از <strong>صفحه اصلی نرم‌افزار (/)</strong> با همین کد آژانس، نام کاربری و رمز عبور وارد پنل اختصاصی آژانس خود شود.
      </div>

      <div class="flex items-center gap-2 pt-2">
        <button type="button" data-action="close-success" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition text-xs cursor-pointer">
          بستن
        </button>
        <a href="/" target="_blank" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl transition text-xs text-center flex items-center justify-center gap-1.5 cursor-pointer">
          <span>ورود به پنل آژانس (/)</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </a>
      </div>
    </div>
  </div>

  <!-- Edit Agency Manager Modal -->
  <div id="edit-manager-modal" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 class="text-sm font-bold text-white">مدیریت و ویرایش حساب مدیر آژانس</h3>
          <p class="text-[11px] text-slate-400 mt-0.5">تغییر نام، نام کاربری یا بازنشانی رمز عبور ورود مدیر به پرتال اصلی (/)</p>
        </div>
        <button type="button" data-action="close-edit-manager" class="text-slate-400 hover:text-white p-1 text-base cursor-pointer">✕</button>
      </div>

      <form id="edit-manager-form" class="space-y-3.5 text-xs">
        <input type="hidden" id="em-tenant-id">

        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span class="text-slate-400 block text-[11px]">دفتر املاک:</span>
            <span id="em-tenant-name" class="font-bold text-white">...</span>
          </div>
          <div class="text-left">
            <span class="text-slate-400 block text-[11px]">کد آژانس:</span>
            <span id="em-agency-code" class="font-mono text-amber-400 font-bold">...</span>
          </div>
        </div>

        <div>
          <label class="block text-slate-300 mb-1">نام و نام خانوادگی مدیر <span class="text-rose-400">*</span></label>
          <input type="text" id="em-admin-name" required placeholder="مهندس علی اکبری" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-slate-300 mb-1">نام کاربری مدیر (جهت ورود در /) <span class="text-rose-400">*</span></label>
          <input type="text" id="em-admin-username" required placeholder="admin" dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none">
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-slate-300">رمز عبور جدید مدیر (اختیاری)</label>
            <button type="button" data-action="generate-random-pass" data-target="em-admin-password" class="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer">تولید رمز ⚄</button>
          </div>
          <div class="relative">
            <input type="password" id="em-admin-password" placeholder="اگر مایل به تغییر رمز نیستید خالی بگذارید" dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none pr-3 pl-8">
            <button type="button" data-action="toggle-pass-visibility" data-target="em-admin-password" class="absolute left-2.5 top-2.5 text-slate-400 hover:text-white text-xs cursor-pointer">👁</button>
          </div>
          <p class="text-[10px] text-slate-500 mt-1">جهت بازنشانی رمز، رمز جدید (حداقل ۶ کاراکتر) را وارد نمایید. در غیر اینصورت خالی بگذارید.</p>
        </div>

        <div>
          <label class="block text-slate-300 mb-1">شماره تماس مدیر</label>
          <input type="text" id="em-admin-phone" placeholder="0912..." dir="ltr" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none">
        </div>

        <button type="submit" id="em-submit-btn" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl mt-2 transition flex items-center justify-center gap-2 text-xs">
          <span>ذخیره تغییرات حساب مدیر</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </button>
      </form>
    </div>
  </div>

  <!-- Delete Tenant & Subscription Modal -->
  <div id="delete-tenant-modal" class="hidden fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div class="flex items-center gap-3 border-b border-slate-800 pb-3">
        <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <div>
          <h3 class="text-sm font-bold text-white">حذف کامل اشتراک و دفتر املاک</h3>
          <p class="text-[11px] text-rose-300/80 mt-0.5">عملیات غیرقابل برگشت و همراه با پاکسازی جامع دیتابیس</p>
        </div>
      </div>

      <input type="hidden" id="del-tenant-id">

      <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <span class="text-slate-400">نام دفتر املاک:</span>
          <span id="del-tenant-name" class="font-bold text-white">...</span>
        </div>
        <div class="flex items-center justify-between border-t border-slate-800/80 pt-2">
          <span class="text-slate-400">کد اختصاصی آژانس:</span>
          <span id="del-agency-code" class="font-mono text-amber-400 font-bold">...</span>
        </div>
      </div>

      <div class="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-200 text-xs leading-relaxed space-y-1">
        <p class="font-bold">⚠️ هشدار پاکسازی کامل اطلاعات:</p>
        <p class="text-[11px] text-rose-300/90">
          با حذف این اشتراک، دفتر املاک به همراه <strong>تمامی حساب‌های کاربری، مدیر دفتر، فایل‌های ملکی، مشتریان، متقاضیان، قراردادها و سوابق پیگیری</strong> به طور دائمی از دیتابیس حذف شده و دسترسی کلیه پرسنل لغو می‌گردد.
        </p>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <button type="button" data-action="close-delete" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition text-xs cursor-pointer">
          انصراف
        </button>
        <button type="button" id="del-submit-btn" data-action="execute-delete" class="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer">
          <span>تایید و حذف دائمی</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Subscription Modal -->
  <div id="sub-modal" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-sm font-bold text-white">تمدید / مدیریت اشتراک</h3>
        <button type="button" data-action="close-sub" class="text-slate-400 hover:text-white p-1 text-base cursor-pointer">✕</button>
      </div>
      <form id="sub-form" class="space-y-3 text-xs">
        <input type="hidden" id="sub-tenant-id">
        <div>
          <label class="block text-slate-300 mb-1">دفتر املاک:</label>
          <span id="sub-tenant-name" class="font-bold text-amber-400">...</span>
        </div>
        <div>
          <label class="block text-slate-300 mb-1">پلن اشتراک</label>
          <select id="sub-plan" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white">
            <option value="ENTERPRISE_PRO">سازمانی پیشرفته (ENTERPRISE_PRO)</option>
            <option value="PROFESSIONAL">حرفه‌ای (PROFESSIONAL)</option>
            <option value="STARTER">پایه (STARTER)</option>
          </select>
        </div>
        <div>
          <label class="block text-slate-300 mb-1">دوره تمدید اشتراک</label>
          <select id="sub-duration" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white">
            <option value="7">۱ هفته (۷ روز - آزمایشی)</option>
            <option value="30">۱ ماه (۳۰ روز)</option>
            <option value="90">۳ ماه (۹۰ روز)</option>
            <option value="180">۶ ماه (۱۸۰ روز)</option>
            <option value="365">۱ سال (۳۶۵ روز)</option>
          </select>
        </div>
        <button type="submit" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg mt-2 cursor-pointer">
          ثبت و بروزرسانی اشتراک
        </button>
      </form>
    </div>
  </div>

  <!-- P3 Support Start Modal -->
  <div id="support-modal" class="hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-sm font-bold text-white">آغاز نشست پشتیبانی نظارتی (P3)</h3>
        <button type="button" data-action="close-support" class="text-slate-400 hover:text-white p-1 text-base cursor-pointer">✕</button>
      </div>
      <form id="support-form" class="space-y-3 text-xs">
        <input type="hidden" id="supp-tenant-id">
        <div>
          <label class="block text-slate-300 mb-1">دفتر هدف:</label>
          <span id="supp-tenant-name" class="font-bold text-amber-400">...</span>
        </div>
        <div>
          <label class="block text-slate-300 mb-1">دلیل مستند ورود به حساب (الزامی - حداقل ۵ حرف)</label>
          <textarea id="supp-reason" required rows="3" placeholder="بررسی مشکل گزارش شده توسط مدیر دفتر در ثبت فایل ملک..." class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"></textarea>
        </div>
        <div>
          <label class="block text-slate-300 mb-1">مدت زمان نشست (دقیقه)</label>
          <select id="supp-duration" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white">
            <option value="15">۱۵ دقیقه</option>
            <option value="30" selected>۳۰ دقیقه</option>
            <option value="60">۶۰ دقیقه</option>
          </select>
        </div>
        <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
          دسترسی پشتیبانی تماماً <strong>فقط‌خواندنی</strong> بوده و کلیه فعالیت‌ها در لاگ نظارتی ثبت می‌گردند.
        </div>
        <button type="submit" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-lg mt-2">
          تایید و شروع نشست پشتیبانی
        </button>
      </form>
    </div>
  </div>

  <!-- Import Backup Modal -->
  <div id="import-modal" class="hidden fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
            📥
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">بازیابی و ورود اطلاعات (Import Backup)</h3>
            <p class="text-[11px] text-slate-400 mt-0.5">بارگذاری فایل پشتیبان JSON و بازگردانی اطلاعات املاک</p>
          </div>
        </div>
        <button type="button" data-action="close-import" class="text-slate-400 hover:text-white p-1 text-base cursor-pointer">✕</button>
      </div>

      <form id="import-form" class="space-y-4 text-xs">
        <!-- File Upload Area -->
        <div>
          <label class="block text-slate-300 mb-1.5 font-bold">انتخاب فایل پشتیبان JSON <span class="text-rose-400">*</span></label>
          <div id="drop-zone" class="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-5 text-center cursor-pointer transition bg-slate-950/50">
            <svg class="w-8 h-8 mx-auto mb-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            <p class="text-slate-300 font-medium">برای بارگذاری فایل بک‌آپ، اینجا کلیک کنید یا فایل را بکشید و رها کنید</p>
            <p class="text-[10px] text-slate-500 mt-1">فرمت‌های مجاز: .json (تولید شده توسط سامانه Amlak OS)</p>
            <input type="file" id="imp-file-input" accept=".json,application/json" class="hidden">
          </div>
        </div>

        <!-- Parsed Preview Box -->
        <div id="imp-preview-box" class="hidden bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="text-slate-400">نام دفتر املاک در فایل:</span>
            <span id="prev-agency-name" class="font-bold text-white">...</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="text-slate-400">کد اختصاصی آژانس:</span>
            <span id="prev-agency-code" class="font-mono text-amber-400 font-bold">...</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="text-slate-400">تاریخ تهیه پشتیبان:</span>
            <span id="prev-date" class="text-slate-300">...</span>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-400">
            <div>📂 فایل‌های ملکی: <span id="prev-props" class="font-bold text-white">0</span></div>
            <div>👥 کاربران / مشاوران: <span id="prev-users" class="font-bold text-white">0</span></div>
            <div>💼 مشتریان و متقاضیان: <span id="prev-custs" class="font-bold text-white">0</span></div>
            <div>🤝 قراردادها / معاملات: <span id="prev-deals" class="font-bold text-white">0</span></div>
          </div>
        </div>

        <!-- Destination Selection -->
        <div class="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
          <label class="block text-slate-300 font-bold mb-1">نحوه بازیابی اطلاعات:</label>
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer text-slate-200">
              <input type="radio" name="imp-mode" id="imp-mode-new" value="auto_or_new" checked class="text-amber-500 focus:ring-amber-500">
              <span>ثبت به عنوان آژانس جدید (یا ایجاد با کد اختصاصی جدید)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-slate-200">
              <input type="radio" name="imp-mode" id="imp-mode-overwrite" value="overwrite_target" class="text-amber-500 focus:ring-amber-500">
              <span>بازیابی و بازنویسی اطلاعات روی یک آژانس انتخابی موجود</span>
            </label>
          </div>

          <div id="imp-target-select-container" class="hidden pt-2">
            <label class="block text-slate-400 mb-1 text-[11px]">انتخاب دفتر املاک مقصد:</label>
            <select id="imp-target-select" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white">
              <!-- populated dynamically -->
            </select>
            <p class="text-[10px] text-rose-400 mt-1">⚠️ هشدار: در صورت انتخاب بازنویسی، اطلاعات قبلی این دفتر پاک شده و با اطلاعات فایل جایگزین می‌شود.</p>
          </div>
        </div>

        <button type="submit" id="imp-submit-btn" disabled class="w-full bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg shadow-amber-500/20">
          <span>شروع عملیات بازیابی (Import)</span>
        </button>
      </form>
    </div>
  </div>

  <!-- Confirm Modal (In-DOM replacement for window.confirm to guarantee iFrame sandbox compatibility) -->
  <div id="confirm-modal" class="hidden fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div class="flex items-center gap-3">
        <div id="confirm-icon-box" class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg font-bold">⚠️</div>
        <div>
          <h3 id="confirm-title" class="text-sm font-bold text-white">تأیید عملیات</h3>
          <p id="confirm-subtitle" class="text-xs text-slate-400 mt-0.5">لطفاً برای ادامه عملیات را تأیید کنید.</p>
        </div>
      </div>
      <div id="confirm-message" class="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800 leading-relaxed whitespace-pre-line"></div>
      <div class="flex items-center gap-2 pt-2">
        <button type="button" id="confirm-cancel-btn" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition text-xs cursor-pointer">انصراف</button>
        <button type="button" id="confirm-ok-btn" class="flex-1 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold py-2.5 rounded-xl transition text-xs cursor-pointer">تأیید و ادامه</button>
      </div>
    </div>
  </div>

  <!-- Toast Notifications Container -->
  <div id="toast-container" class="fixed top-5 left-5 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"></div>

  <script>
    // --- Toast & In-DOM Confirmation System (iFrame Safe) ---
    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-xl text-xs font-medium transition-all duration-300 transform translate-y-2 opacity-0 ' +
        (type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-emerald-300' :
         type === 'error' ? 'bg-slate-900 border-rose-500/50 text-rose-300' :
         'bg-slate-900 border-blue-500/50 text-blue-300');
      const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
      toast.innerHTML = \`
        <span class="text-sm shrink-0">\${icon}</span>
        <div class="flex-1 leading-relaxed">\${message}</div>
        <button type="button" class="text-slate-400 hover:text-white text-xs cursor-pointer px-1">✕</button>
      \`;
      toast.querySelector('button').onclick = () => {
        toast.remove();
      };
      container.appendChild(toast);
      requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      });
      setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 4500);
    }

    let activeConfirmHandler = null;
    function showConfirmModal(opts = {}) {
      const modal = document.getElementById('confirm-modal');
      if (!modal) return;
      document.getElementById('confirm-title').innerText = opts.title || 'تأیید عملیات';
      document.getElementById('confirm-subtitle').innerText = opts.subtitle || 'لطفاً برای ادامه عملیات را تأیید فرمایید.';
      document.getElementById('confirm-message').innerText = opts.message || '';
      const okBtn = document.getElementById('confirm-ok-btn');
      okBtn.innerText = opts.confirmText || 'تأیید و ادامه';
      const iconBox = document.getElementById('confirm-icon-box');
      if (opts.danger) {
        okBtn.className = 'flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition text-xs cursor-pointer shadow-lg shadow-rose-600/30';
        iconBox.className = 'w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-lg font-bold';
        iconBox.innerText = '🚨';
      } else {
        okBtn.className = 'flex-1 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold py-2.5 rounded-xl transition text-xs cursor-pointer shadow-lg shadow-amber-500/20';
        iconBox.className = 'w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg font-bold';
        iconBox.innerText = '⚠️';
      }
      activeConfirmHandler = opts.onConfirm || null;
      modal.classList.remove('hidden');
    }

    function closeConfirmModal() {
      document.getElementById('confirm-modal')?.classList.add('hidden');
      activeConfirmHandler = null;
    }

    document.getElementById('confirm-ok-btn')?.addEventListener('click', () => {
      const handler = activeConfirmHandler;
      closeConfirmModal();
      if (typeof handler === 'function') {
        handler();
      }
    });

    // Fallbacks to avoid iframe crashes if third-party/legacy calls occur
    window.alert = function(msg) { showToast(String(msg), 'info'); };
    window.confirm = function() { return true; };

    let activeSupportSession = null;

    function apiFetch(url, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      return fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      });
    }

    async function init() {
      try { localStorage.removeItem('amlak_platform_token'); } catch(e){}
      try { sessionStorage.removeItem('amlak_platform_token'); } catch(e){}
      try {
        const meRes = await apiFetch('/api/v1/platform/auth/me');
        const meData = await meRes.json();
        if (!meRes.ok || !meData.success) {
          window.location.href = '${getPlatformPath()}/login';
          return;
        }
        document.getElementById('admin-name').innerText = meData.data?.admin?.display_name || meData.data?.admin?.username;
        await loadMetrics();
        await loadTenants();
        await checkCurrentSupport();
        await loadAuditLogs();
      } catch (err) {
        console.warn('Init non-fatal error:', err);
        showToast('خطا در بررسی نشست یا دریافت اطلاعات پلتفرم. اتصال سرور را بررسی کنید.', 'error');
      }
    }

    async function loadMetrics() {
      try {
        const res = await apiFetch('/api/v1/platform/metrics');
        const data = await res.json();
        if (data.success && data.data) {
          document.getElementById('metric-tenants').innerText = data.data.total_tenants || 0;
          document.getElementById('metric-active').innerText = data.data.active_tenants || data.data.active_subscriptions || 0;
          document.getElementById('metric-agents').innerText = data.data.total_agents || 0;
          document.getElementById('metric-properties').innerText = data.data.total_properties || 0;
        }
      } catch (e) {
        showToast('خطا در بارگذاری آمار پلتفرم.', 'error');
      }
    }

    async function loadTenants() {
      try {
        const res = await apiFetch('/api/v1/platform/tenants');
        const data = await res.json();
        const tbody = document.getElementById('tenants-tbody');
        if (!data.success || !data.data) {
          tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-rose-400">خطا در بارگذاری دفاتر</td></tr>';
          return;
        }
        window.allTenantsMap = {};

        // Populate quick backup dropdown in Data Backup & Restore Center
        const qSel = document.getElementById('quick-backup-tenant-select');
        if (qSel) {
          const prev = qSel.value;
          qSel.innerHTML = '<option value="">-- انتخاب دفتر املاک --</option>' +
            data.data.map(t => '<option value="' + t.id + '">' + t.name + ' (' + t.agency_code + ')</option>').join('');
          if (prev) qSel.value = prev;
        }

        tbody.innerHTML = data.data.map(t => {
          window.allTenantsMap[t.id] = t;
          const isSuspended = t.subscription_status === 'SUSPENDED' || t.status === 'SUSPENDED';
          const expiresDate = t.subscription_expires_at ? new Date(t.subscription_expires_at).toLocaleDateString('fa-IR') : 'نامشخص';
          const adminName = t.admin_name || 'مدیر دفتر';
          const adminUsername = t.admin_username || '-';
          return \`
            <tr class="hover:bg-slate-900/60 border-b border-slate-800/60">
              <td class="p-3.5 font-bold text-white">\${t.name}</td>
              <td class="p-3.5 font-mono text-amber-400 font-bold">\${t.agency_code}</td>
              <td class="p-3.5">
                <div class="font-bold text-slate-100">\${adminName}</div>
                <div class="text-[11px] font-mono text-emerald-400 mt-0.5">کاربری: <strong>\${adminUsername}</strong></div>
              </td>
              <td class="p-3.5">\${t.plan_code || 'ENTERPRISE_PRO'}</td>
              <td class="p-3.5">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold \${isSuspended ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}">
                  \${isSuspended ? 'معلق / مسدود' : 'فعال'}
                </span>
              </td>
              <td class="p-3.5 text-slate-400">\${expiresDate}</td>
              <td class="p-3.5 text-slate-400">\${t.branches_count || 1} شعبه / \${t.agents_count || 0} مشاور</td>
              <td class="p-3.5 text-center flex items-center justify-center gap-1.5 flex-wrap">
                <button type="button" data-action="export-tenant" data-id="\${t.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition cursor-pointer flex items-center gap-1" title="دانلود و خروجی کامل فایل پشتیبان (JSON) این آژانس املاک">
                  <span>💾 خروجی بک‌آپ</span>
                </button>
                <button type="button" data-action="import-tenant-target" data-id="\${t.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer flex items-center gap-1" title="بازیابی اطلاعات از فایل بک‌آپ روی این آژانس املاک">
                  <span>📥 بازیابی</span>
                </button>
                <button type="button" data-action="edit-manager" data-id="\${t.id}" class="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition cursor-pointer" title="مدیریت حساب، نام کاربری و رمز مدیر آژانس">
                  مدیر و رمز
                </button>
                <button type="button" data-action="toggle-status" data-id="\${t.id}" data-status="\${isSuspended ? 'ACTIVE' : 'SUSPENDED'}" class="px-2 py-1 rounded text-[10px] font-bold \${isSuspended ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'} cursor-pointer" title="\${isSuspended ? 'خروج از تعلیق و مجاز شدن ورود' : 'تعلیق اشتراک و مسدودسازی کامل ورود پرسنل و مدیر'}">
                  \${isSuspended ? 'رفع تعلیق' : 'تعلیق'}
                </button>
                <button type="button" data-action="sub-modal" data-id="\${t.id}" class="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer" title="تمدید یا ارتقای پلن اشتراک">
                  تمدید پلن
                </button>
                <button type="button" data-action="support-modal" data-id="\${t.id}" class="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 cursor-pointer" title="دسترسی پشتیبانی فقط‌خواندنی">
                  پشتیبانی
                </button>
                <button type="button" data-action="delete-tenant" data-id="\${t.id}" class="px-2 py-1 rounded text-[10px] font-bold bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition cursor-pointer" title="حذف کامل اشتراک، املاک و پاکسازی کلیه کاربران و اطلاعات">
                  حذف اشتراک
                </button>
              </td>
            </tr>
          \`;
        }).join('');
      } catch (e) {
        const tbody = document.getElementById('tenants-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-rose-400">خطا در ارتباط با سرور هنگام بارگذاری دفاتر</td></tr>';
        showToast('خطا در بارگذاری فهرست آژانس‌ها.', 'error');
      }
    }

    function toggleTenantStatus(tenantId, newStatus) {
      const t = (window.allTenantsMap && window.allTenantsMap[tenantId]) || {};
      const isSuspended = newStatus === 'SUSPENDED';
      showConfirmModal({
        title: isSuspended ? 'تعلیق اشتراک دفتر املاک' : 'رفع تعلیق دفتر املاک',
        subtitle: isSuspended ? 'مسدودسازی دسترسی پرسنل و مدیر آژانس' : 'فعال‌سازی مجدد حساب',
        message: isSuspended
          ? 'آیا از تعلیق دفتر املاک «' + (t.name || '') + '» (' + (t.agency_code || '') + ') اطمینان دارید؟\\nبا تعلیق، مدیر و کلیه پرسنل این املاک دیگر قادر به ورود نخواهند بود و کلیه نشست‌های فعال آن‌ها لغو می‌گردد.'
          : 'آیا از رفع تعلیق دفتر املاک «' + (t.name || '') + '» (' + (t.agency_code || '') + ') اطمینان دارید؟',
        confirmText: isSuspended ? 'بله، تعلیق شود' : 'بله، رفع تعلیق',
        danger: isSuspended,
        onConfirm: async () => {
          try {
            const res = await apiFetch('/api/v1/platform/tenants/' + tenantId + '/status', {
              method: 'PATCH',
              body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
              showToast(isSuspended ? 'دفتر املاک با موفقیت معلق شد و دسترسی‌ها مسدود گردید.' : 'دفتر املاک با موفقیت فعال شد.', 'success');
              await loadTenants();
              await loadMetrics();
            } else {
              showToast(data.error?.message || 'خطا در تغییر وضعیت', 'error');
            }
          } catch (e) {
            showToast('خطای ارتباط با سرور در تغییر وضعیت.', 'error');
          }
        }
      });
    }

    function openDeleteTenantModal(id) {
      const t = (window.allTenantsMap && window.allTenantsMap[id]) || {};
      document.getElementById('del-tenant-id').value = id;
      document.getElementById('del-tenant-name').innerText = t.name || '...';
      document.getElementById('del-agency-code').innerText = t.agency_code || '...';
      document.getElementById('delete-tenant-modal').classList.remove('hidden');
    }

    function closeDeleteTenantModal() {
      document.getElementById('delete-tenant-modal').classList.add('hidden');
    }

    async function executeDeleteTenant() {
      const tenantId = document.getElementById('del-tenant-id').value;
      if (!tenantId) return;
      const t = (window.allTenantsMap && window.allTenantsMap[tenantId]) || {};
      const btn = document.getElementById('del-submit-btn');
      btn.disabled = true;
      btn.innerText = 'در حال پاکسازی جامع دیتابیس...';

      try {
        const res = await apiFetch('/api/v1/platform/tenants/' + tenantId, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || \`دفتر املاک «\${t.name || ''}» و تمامی اطلاعات کاربران، املاک و معاملات آن با موفقیت پاک شدند.\`, 'success');
          closeDeleteTenantModal();
          await loadTenants();
          await loadMetrics();
        } else {
          showToast(data.error?.message || 'خطا در حذف اشتراک دفتر', 'error');
        }
      } catch (err) {
        showToast('خطای ارتباط با سرور در حین حذف', 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'تایید و حذف دائمی';
      }
    }

    async function checkCurrentSupport() {
      try {
        const res = await apiFetch('/api/v1/platform/support/current');
        const data = await res.json();
        const banner = document.getElementById('support-banner');
        if (data.success && data.data) {
          activeSupportSession = data.data;
          document.getElementById('support-tenant-name').innerText = data.data.tenant_name || data.data.tenant_id;
          banner.classList.remove('hidden');
        } else {
          activeSupportSession = null;
          banner.classList.add('hidden');
        }
      } catch (e) {}
    }

    async function loadAuditLogs() {
      try {
        const res = await apiFetch('/api/v1/platform/support/audit-logs');
        const data = await res.json();
        const tbody = document.getElementById('audit-tbody');
        if (!data.success || !data.data || data.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">تاکنون رویداد پشتیبانی ثبت نشده است.</td></tr>';
          return;
        }
        tbody.innerHTML = data.data.map(log => \`
          <tr>
            <td class="py-2 px-3 text-slate-400">\${new Date(log.created_at).toLocaleTimeString('fa-IR')}</td>
            <td class="py-2 px-3 font-semibold">\${log.admin_username}</td>
            <td class="py-2 px-3 text-amber-300">\${log.tenant_name || log.tenant_id}</td>
            <td class="py-2 px-3"><span class="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">\${log.action}</span></td>
            <td class="py-2 px-3 text-slate-400 font-mono text-[10px]">\${log.resource_id || '-'}</td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    document.getElementById('end-support-btn').onclick = async () => {
      if (!activeSupportSession) return;
      try {
        const res = await apiFetch('/api/v1/platform/support/end', {
          method: 'POST',
          body: JSON.stringify({ session_id: activeSupportSession.id })
        });
        const data = await res.json();
        if (data.success) {
          showToast('نشست پشتیبانی با موفقیت خاتمه یافت.', 'info');
          checkCurrentSupport();
          loadAuditLogs();
        }
      } catch (e) {
        showToast('خطا در خاتمه نشست پشتیبانی', 'error');
      }
    };

    document.getElementById('logout-btn').onclick = async () => {
      try { await apiFetch('/api/v1/platform/auth/logout', { method: 'POST' }); } catch(e){}
      try { localStorage.removeItem('amlak_platform_token'); } catch(e){}
      try { sessionStorage.removeItem('amlak_platform_token'); } catch(e){}
      try { document.cookie = 'amlak_platform_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'; } catch(e){}
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('token');
      window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));
      window.location.href = '${getPlatformPath()}/login';
    };

    function openNewTenantModal() { document.getElementById('new-tenant-modal').classList.remove('hidden'); }
    function closeNewTenantModal() { document.getElementById('new-tenant-modal').classList.add('hidden'); }
    function closeSuccessModal() { document.getElementById('tenant-success-modal').classList.add('hidden'); }

    function generateRandomPass(inputId) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
      let pass = '';
      for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const el = document.getElementById(inputId);
      if (el) {
        el.value = pass;
        el.type = 'text';
      }
    }

    function togglePassVisibility(inputId) {
      const el = document.getElementById(inputId);
      if (el) {
        el.type = el.type === 'password' ? 'text' : 'password';
      }
    }

    function openEditManagerModal(id) {
      const t = (window.allTenantsMap && window.allTenantsMap[id]) || {};
      document.getElementById('em-tenant-id').value = id;
      document.getElementById('em-tenant-name').innerText = t.name || '...';
      document.getElementById('em-agency-code').innerText = t.agency_code || '...';
      document.getElementById('em-admin-name').value = t.admin_name || '';
      document.getElementById('em-admin-username').value = t.admin_username || '';
      document.getElementById('em-admin-password').value = '';
      document.getElementById('em-admin-phone').value = t.admin_phone || '';
      document.getElementById('edit-manager-modal').classList.remove('hidden');
    }
    function closeEditManagerModal() { document.getElementById('edit-manager-modal').classList.add('hidden'); }

    document.getElementById('edit-manager-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('em-submit-btn');
      btn.disabled = true;
      btn.innerText = 'در حال ذخیره تغییرات...';

      const tenantId = document.getElementById('em-tenant-id').value;
      const admin_name = document.getElementById('em-admin-name').value.trim();
      const admin_username = document.getElementById('em-admin-username').value.trim();
      const admin_password = document.getElementById('em-admin-password').value;
      const admin_phone = document.getElementById('em-admin-phone').value.trim();

      try {
        const res = await apiFetch('/api/v1/platform/tenants/' + tenantId + '/manager', {
          method: 'PATCH',
          body: JSON.stringify({
            admin_name,
            admin_username,
            admin_password: admin_password || undefined,
            admin_phone
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('مشخصات حساب مدیر آژانس با موفقیت بروزرسانی شد.', 'success');
          closeEditManagerModal();
          loadTenants();
        } else {
          showToast(data.error?.message || 'خطا در بروزرسانی مدیر', 'error');
        }
      } catch (err) {
        showToast('خطای ارتباط با سرور پلتفرم', 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'ذخیره تغییرات حساب مدیر';
      }
    };

    document.getElementById('new-tenant-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('nt-submit-btn');
      btn.disabled = true;
      btn.innerText = 'در حال ثبت دفتر و ساخت حساب مدیر...';

      const agency_code = document.getElementById('nt-code').value.trim();
      const name = document.getElementById('nt-name').value.trim();
      const phone = document.getElementById('nt-phone').value.trim();
      const plan_code = document.getElementById('nt-plan').value;
      const trial_days = Number(document.getElementById('nt-trial').value) || 7;
      const admin_name = document.getElementById('nt-admin-name').value.trim();
      const admin_username = document.getElementById('nt-admin-username').value.trim();
      const admin_password = document.getElementById('nt-admin-password').value;

      try {
        const res = await apiFetch('/api/v1/platform/tenants', {
          method: 'POST',
          body: JSON.stringify({
            agency_code,
            name,
            phone,
            plan_code,
            trial_days,
            admin_name,
            admin_username,
            admin_password
          })
        });
        const data = await res.json();
        if (data.success) {
          closeNewTenantModal();
          document.getElementById('new-tenant-form').reset();
          loadTenants();
          loadMetrics();

          // Show Success Modal with credentials
          document.getElementById('succ-code').innerText = agency_code.toUpperCase();
          document.getElementById('succ-name').innerText = name;
          document.getElementById('succ-username').innerText = data.data?.admin?.username || admin_username;
          document.getElementById('succ-password').innerText = admin_password;
          document.getElementById('tenant-success-modal').classList.remove('hidden');
          showToast('دفتر املاک جدید با موفقیت ایجاد گردید.', 'success');
        } else {
          showToast(data.error?.message || 'خطا در ثبت دفتر', 'error');
        }
      } catch (err) {
        showToast('خطای ارتباط با سرور پلتفرم', 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'ثبت دفتر املاک و ساخت حساب مدیر';
      }
    };

    function openSubModal(id) {
      const t = (window.allTenantsMap && window.allTenantsMap[id]) || {};
      document.getElementById('sub-tenant-id').value = id;
      document.getElementById('sub-tenant-name').innerText = t.name || '...';
      document.getElementById('sub-plan').value = t.plan_code || 'ENTERPRISE_PRO';
      document.getElementById('sub-modal').classList.remove('hidden');
    }
    function closeSubModal() { document.getElementById('sub-modal').classList.add('hidden'); }

    document.getElementById('sub-form').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('sub-tenant-id').value;
      const plan_code = document.getElementById('sub-plan').value;
      const duration_days = Number(document.getElementById('sub-duration').value);

      const res = await apiFetch('/api/v1/platform/tenants/' + id + '/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ plan_code, duration_days })
      });
      const data = await res.json();
      if (data.success) {
        showToast('اشتراک با موفقیت بروزرسانی شد.', 'success');
        closeSubModal();
        loadTenants();
      } else {
        showToast(data.error?.message || 'خطا در بروزرسانی', 'error');
      }
    };

    function openSupportModal(id) {
      const t = (window.allTenantsMap && window.allTenantsMap[id]) || {};
      document.getElementById('supp-tenant-id').value = id;
      document.getElementById('supp-tenant-name').innerText = t.name || '...';
      document.getElementById('supp-reason').value = '';
      document.getElementById('support-modal').classList.remove('hidden');
    }
    function closeSupportModal() { document.getElementById('support-modal').classList.add('hidden'); }

    document.getElementById('support-form').onsubmit = async (e) => {
      e.preventDefault();
      const tenant_id = document.getElementById('supp-tenant-id').value;
      const reason = document.getElementById('supp-reason').value.trim();
      const duration_minutes = Number(document.getElementById('supp-duration').value) || 30;

      const res = await apiFetch('/api/v1/platform/support/start', {
        method: 'POST',
        body: JSON.stringify({ tenant_id, reason, duration_minutes })
      });
      const data = await res.json();
      if (data.success) {
        showToast('نشست پشتیبانی نظارتی آغاز گردید.', 'success');
        closeSupportModal();
        checkCurrentSupport();
        loadAuditLogs();
      } else {
        showToast(data.error?.message || 'خطا در آغاز نشست پشتیبانی', 'error');
      }
    };

    // --- Backup & Restore (Export / Import) JS Handlers ---
    let parsedBackupData = null;

    async function exportTenantBackup(id) {
      if (!id) {
        showToast('شناسه دفتر املاک مشخص نشده است.', 'error');
        return;
      }
      const t = (window.allTenantsMap && window.allTenantsMap[id]) || {};
      showToast('در حال استخراج و آماده‌سازی فایل پشتیبان املاک «' + (t.name || 'انتخابی') + '»...', 'info');

      try {
        const res = await apiFetch('/api/v1/platform/tenants/' + id + '/export');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showToast(errData.error?.message || 'خطا در دریافت فایل پشتیبان.', 'error');
          return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const code = (t.agency_code || 'AGENCY').toUpperCase();
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = 'amlak-backup-' + code + '-' + dateStr + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          window.URL.revokeObjectURL(url);
        }, 1500);
        showToast('فایل پشتیبان املاک «' + (t.name || code) + '» با موفقیت دانلود شد.', 'success');
      } catch (err) {
        showToast('خطای ارتباط با سرور در تهیه فایل پشتیبان املاک.', 'error');
      }
    }

    function exportAllTenantsBackup() {
      showConfirmModal({
        title: 'تهیه فایل پشتیبان جامع از کل سامانه',
        subtitle: 'شامل تمامی دفاتر املاک، شعب، فایل‌ها، متقاضیان، مشاوران و قراردادها',
        message: 'آیا مایل به دانلود فایل پشتیبان جامع از کلیه اطلاعات و دفاتر املاک موجود در سیستم هستید؟ این فایل با فرمت استاندارد JSON استخراج می‌گردد.',
        confirmText: 'دانلود پشتیبان جامع کل سیستم',
        danger: false,
        onConfirm: async () => {
          showToast('در حال تجمیع داده‌ها و تولید فایل پشتیبان جامع کل دفاتر...', 'info');
          try {
            const res = await apiFetch('/api/v1/platform/backup/export-all');
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              showToast(errData.error?.message || 'خطا در دریافت فایل پشتیبان سیستم.', 'error');
              return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = 'amlak-system-full-backup-' + dateStr + '.json';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              a.remove();
              window.URL.revokeObjectURL(url);
            }, 1500);
            showToast('فایل پشتیبان جامع سیستم با موفقیت دانلود شد.', 'success');
          } catch (err) {
            showToast('خطای ارتباط با سرور در تهیه فایل پشتیبان سیستم.', 'error');
          }
        }
      });
    }

    function openImportModal(specificTenantId) {
      parsedBackupData = null;
      const fileInput = document.getElementById('imp-file-input');
      if (fileInput) fileInput.value = '';
      document.getElementById('imp-preview-box')?.classList.add('hidden');
      const submitBtn = document.getElementById('imp-submit-btn');
      if (submitBtn) submitBtn.disabled = true;

      const sel = document.getElementById('imp-target-select');
      if (sel) {
        sel.innerHTML = '<option value="">-- انتخاب دفتر املاک مقصد --</option>' +
          Object.values(window.allTenantsMap || {}).map(function(t) {
            return '<option value="' + t.id + '">' + t.name + ' (' + t.agency_code + ')</option>';
          }).join('');
      }

      if (specificTenantId) {
        const radioOverwrite = document.getElementById('imp-mode-overwrite');
        if (radioOverwrite) radioOverwrite.checked = true;
        document.getElementById('imp-target-select-container')?.classList.remove('hidden');
        if (sel) sel.value = specificTenantId;
      } else {
        const radioNew = document.getElementById('imp-mode-new');
        if (radioNew) radioNew.checked = true;
        document.getElementById('imp-target-select-container')?.classList.add('hidden');
      }

      document.getElementById('import-modal')?.classList.remove('hidden');
    }

    function closeImportModal() {
      document.getElementById('import-modal')?.classList.add('hidden');
    }

    document.querySelectorAll('input[name="imp-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const container = document.getElementById('imp-target-select-container');
        if (e.target.value === 'overwrite_target') {
          container?.classList.remove('hidden');
        } else {
          container?.classList.add('hidden');
        }
      });
    });

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('imp-file-input');

    if (dropZone && fileInput) {
      dropZone.onclick = () => fileInput.click();

      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-amber-400', 'bg-amber-500/10');
      };
      dropZone.ondragleave = () => {
        dropZone.classList.remove('border-amber-400', 'bg-amber-500/10');
      };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-amber-400', 'bg-amber-500/10');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleBackupFile(e.dataTransfer.files[0]);
        }
      };

      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          handleBackupFile(e.target.files[0]);
        }
      };
    }

    function handleBackupFile(file) {
      if (!file || !file.name.toLowerCase().endsWith('.json')) {
        showToast('لطفاً یک فایل معتبر با پسوند .json انتخاب نمایید.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          const tenantInfo = json.tenant || (Array.isArray(json.tenants) && json.tenants[0]?.tenant);
          if (!tenantInfo) {
            showToast('فایل انتخاب شده فاقد ساختار استاندارد پشتیبان Amlak OS است.', 'error');
            return;
          }
          parsedBackupData = json;
          const sum = json.summary || {};
          document.getElementById('prev-agency-name').innerText = tenantInfo.name || 'نامشخص';
          document.getElementById('prev-agency-code').innerText = tenantInfo.agency_code || '-';
          document.getElementById('prev-date').innerText = json.export_at ? new Date(json.export_at).toLocaleString('fa-IR') : 'نامشخص';
          document.getElementById('prev-props').innerText = sum.properties_count ?? (json.data?.properties?.length || 0);
          document.getElementById('prev-users').innerText = sum.users_count ?? (json.data?.users?.length || 0);
          document.getElementById('prev-custs').innerText = sum.customers_count ?? (json.data?.customers?.length || 0);
          document.getElementById('prev-deals').innerText = sum.transactions_count ?? (json.data?.transactions?.length || 0);
          document.getElementById('imp-preview-box')?.classList.remove('hidden');
          const submitBtn = document.getElementById('imp-submit-btn');
          if (submitBtn) submitBtn.disabled = false;
          showToast('فایل پشتیبان با موفقیت اعتبارسنجی شد. مشخصات را بررسی کنید.', 'success');
        } catch (err) {
          showToast('خطا در خواندن فایل JSON. از صحت فایل اطمینان حاصل کنید.', 'error');
        }
      };
      reader.readAsText(file);
    }

    const impForm = document.getElementById('import-form');
    if (impForm) {
      impForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!parsedBackupData) {
          showToast('لطفاً ابتدا فایل پشتیبان را انتخاب نمایید.', 'error');
          return;
        }

        const modeChecked = document.querySelector('input[name="imp-mode"]:checked');
        const mode = modeChecked ? modeChecked.value : 'auto_or_new';
        let targetTenantId = null;
        let overrideExisting = false;

        if (mode === 'overwrite_target') {
          targetTenantId = document.getElementById('imp-target-select').value;
          if (!targetTenantId) {
            showToast('لطفاً دفتر املاک مقصد را از لیست انتخاب کنید.', 'error');
            return;
          }
          overrideExisting = true;
          const targetTenant = (window.allTenantsMap && window.allTenantsMap[targetTenantId]) || {};

          showConfirmModal({
            title: 'تأیید بازنویسی اطلاعات دفتر املاک',
            subtitle: 'پاکسازی اطلاعات قبلی و جایگزینی کامل با فایل بک‌آپ',
            message: 'هشدار: کلیه اطلاعات موجود در دفتر املاک «' + (targetTenant.name || '') + '» پاک شده و با اطلاعات فایل پشتیبان جایگزین خواهند شد.\\nآیا از انجام این عملیات اطمینان کامل دارید؟',
            confirmText: 'بله، بازنویسی شود',
            danger: true,
            onConfirm: () => performImport(targetTenantId, overrideExisting)
          });
          return;
        }

        performImport(null, false);
      };
    }

    async function performImport(targetTenantId, overrideExisting) {
      const btn = document.getElementById('imp-submit-btn');
      btn.disabled = true;
      btn.innerText = 'در حال بازیابی اطلاعات...';
      showToast('در حال انتقال و بازیابی اطلاعات فایل به پایگاه‌داده...', 'info');

      try {
        const res = await apiFetch('/api/v1/platform/tenants/import', {
          method: 'POST',
          body: JSON.stringify({
            backup_data: parsedBackupData,
            target_tenant_id: targetTenantId,
            override_existing: overrideExisting
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'بازیابی اطلاعات با موفقیت انجام شد.', 'success');
          closeImportModal();
          await loadTenants();
          await loadMetrics();
        } else {
          showToast(data.error?.message || 'خطا در بازیابی اطلاعات.', 'error');
        }
      } catch (err) {
        showToast('خطای ارتباط با سرور در حین بازیابی اطلاعات.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'شروع عملیات بازیابی (Import)';
      }
    }

    // Expose all functions globally on window for inline handlers
    window.openNewTenantModal = openNewTenantModal;
    window.closeNewTenantModal = closeNewTenantModal;
    window.openEditManagerModal = openEditManagerModal;
    window.closeEditManagerModal = closeEditManagerModal;
    window.toggleTenantStatus = toggleTenantStatus;
    window.openSubModal = openSubModal;
    window.closeSubModal = closeSubModal;
    window.openSupportModal = openSupportModal;
    window.closeSupportModal = closeSupportModal;
    window.openDeleteTenantModal = openDeleteTenantModal;
    window.closeDeleteTenantModal = closeDeleteTenantModal;
    window.executeDeleteTenant = executeDeleteTenant;
    window.closeSuccessModal = closeSuccessModal;
    window.generateRandomPass = generateRandomPass;
    window.togglePassVisibility = togglePassVisibility;
    window.exportTenantBackup = exportTenantBackup;
    window.exportAllTenantsBackup = exportAllTenantsBackup;
    window.openImportModal = openImportModal;
    window.closeImportModal = closeImportModal;
    window.showToast = showToast;
    window.showConfirmModal = showConfirmModal;
    window.closeConfirmModal = closeConfirmModal;

    // Direct event listeners
    document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirmModal);

    // Quick single-agency backup trigger from Backup Center
    document.getElementById('btn-quick-export-tenant')?.addEventListener('click', () => {
      const sel = document.getElementById('quick-backup-tenant-select');
      const val = sel?.value;
      if (!val) {
        showToast('لطفاً ابتدا یک دفتر املاک را از منوی کشویی انتخاب کنید.', 'error');
        return;
      }
      exportTenantBackup(val);
    });

    // Event delegation for table buttons, modal close and triggers
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'new-tenant') {
        openNewTenantModal();
      } else if (action === 'close-new-tenant') {
        closeNewTenantModal();
      } else if (action === 'edit-manager') {
        openEditManagerModal(id);
      } else if (action === 'close-edit-manager') {
        closeEditManagerModal();
      } else if (action === 'toggle-status') {
        const nextStatus = btn.getAttribute('data-status');
        toggleTenantStatus(id, nextStatus);
      } else if (action === 'sub-modal') {
        openSubModal(id);
      } else if (action === 'close-sub') {
        closeSubModal();
      } else if (action === 'support-modal') {
        openSupportModal(id);
      } else if (action === 'close-support') {
        closeSupportModal();
      } else if (action === 'delete-tenant') {
        openDeleteTenantModal(id);
      } else if (action === 'close-delete') {
        closeDeleteTenantModal();
      } else if (action === 'execute-delete') {
        executeDeleteTenant();
      } else if (action === 'close-success') {
        closeSuccessModal();
      } else if (action === 'export-tenant') {
        exportTenantBackup(id);
      } else if (action === 'import-tenant-target') {
        openImportModal(id);
      } else if (action === 'open-import') {
        openImportModal();
      } else if (action === 'close-import') {
        closeImportModal();
      } else if (action === 'export-all') {
        exportAllTenantsBackup();
      } else if (action === 'close-confirm') {
        closeConfirmModal();
      } else if (action === 'generate-random-pass') {
        const targetInput = btn.getAttribute('data-target');
        generateRandomPass(targetInput);
      } else if (action === 'toggle-pass-visibility') {
        const targetInput = btn.getAttribute('data-target');
        togglePassVisibility(targetInput);
      }
    });

    // Close modals on clicking backdrop
    ['new-tenant-modal', 'tenant-success-modal', 'edit-manager-modal', 'delete-tenant-modal', 'sub-modal', 'support-modal', 'import-modal', 'confirm-modal'].forEach(function(modalId) {
      const el = document.getElementById(modalId);
      if (el) {
        el.addEventListener('click', function(e) {
          if (e.target === el) {
            el.classList.add('hidden');
          }
        });
      }
    });

    init();
  </script>
</body>
</html>`);
});
