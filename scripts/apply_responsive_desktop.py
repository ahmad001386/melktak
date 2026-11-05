import os
import re

print("--- 1. Preparing Responsive CSS ---")
responsive_css = """
/* =========================================================================
   MELKTAK WINDOWS & DESKTOP RESPONSIVE ENGINE (RTL)
   ========================================================================= */

@media (min-width: 768px) {
  /* 1. Hide Mobile Bottom Navigation on Desktop */
  .melktak-bottom-nav,
  nav.fixed.bottom-0 {
    display: none !important;
  }

  /* 2. Show Desktop Right Sidebar on Desktop */
  .melktak-desktop-sidebar {
    display: flex !important;
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 260px !important;
    height: 100vh !important;
    background-color: #ffffff !important;
    border-left: 1px solid #e2e8f0 !important;
    z-index: 50 !important;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.03) !important;
  }

  /* 3. Shift and Expand Top Header across Workspace */
  header.sticky.top-0 {
    margin-right: 260px !important;
    margin-left: 0 !important;
    width: calc(100% - 260px) !important;
    max-width: none !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }
  header.sticky.top-0 > div {
    max-width: 1400px !important;
    margin: 0 auto !important;
    width: 100% !important;
  }

  /* 4. Shift and Expand Main Content Area across Workspace */
  main {
    margin-right: 260px !important;
    margin-left: 0 !important;
    width: calc(100% - 260px) !important;
    max-width: none !important;
    padding: 24px 32px 48px 32px !important;
  }
  main > div {
    max-width: 1400px !important;
    margin: 0 auto !important;
    width: 100% !important;
  }

  /* 5. Responsive Multi-Column Grids for Pages on Desktop */
  /* Properties list container -> 2 to 3 column grid */
  main .space-y-3:has(> div:has(.border)) {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
    gap: 16px !important;
    margin-top: 12px !important;
  }
  main .space-y-3:has(> div:has(.border)) > :not(:last-child) {
    margin-bottom: 0 !important;
    margin-top: 0 !important;
  }

  /* Customer list container -> 2 to 3 column grid */
  main .space-y-3:has(> div:has(button[title*="تماس"])) {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)) !important;
    gap: 16px !important;
  }

  /* Tasks list container -> 2 column grid */
  main .space-y-2\\.5 {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
    gap: 14px !important;
  }
  main .space-y-2\\.5 > :not(:last-child) {
    margin-bottom: 0 !important;
  }

  /* Metrics in Dashboard -> 4 columns on desktop */
  main .grid-cols-3 {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 16px !important;
  }

  /* Dialogs & Modals on Desktop: centered, spacious, not crammed */
  .fixed.inset-0 .max-w-md {
    max-width: 640px !important;
    border-radius: 1.25rem !important;
  }
}

@media (max-width: 767.98px) {
  /* On Mobile (< 768px), desktop sidebar is 100% hidden, bottom nav 100% normal */
  .melktak-desktop-sidebar {
    display: none !important;
  }
  .melktak-bottom-nav,
  nav.fixed.bottom-0 {
    display: block !important;
  }
}
"""

for css_file in ["public/assets/index-app.css", "dist/assets/index-app.css"]:
    if os.path.exists(css_file):
        with open(css_file, "r", encoding="utf-8") as f:
            css_content = f.read()
        # Remove any previous additions if present
        if "/* MELKTAK WINDOWS & DESKTOP RESPONSIVE ENGINE (RTL) */" in css_content:
            css_content = css_content.split("/* MELKTAK WINDOWS & DESKTOP RESPONSIVE ENGINE (RTL) */")[0]
        if "@media (min-width: 768px)" in css_content:
            css_content = css_content.split("@media (min-width: 768px)")[0]
        css_content = css_content.strip() + "\n" + responsive_css.strip() + "\n"
        with open(css_file, "w", encoding="utf-8") as f:
            f.write(css_content)
        print(f"Updated {css_file}")

print("--- 2. Updating index-app.js ---")
sidebar_component_js = """
var MelktakSidebar = ({activeTab: e, onSelectTab: t, onOpenQuickAdd: n, overdueCount: r = 0}) => {
  let { user: o, tenant: s, logout: c } = T();
  let roleTitle = o?.role_code === 'SUPER_ADMIN' ? 'مدیر ارشد سامانه' : o?.role_code === 'ADMIN' || o?.role_code === 'OWNER' ? 'مدیر آژانس' : 'مشاور املاک';
  return (0, S.jsxs)('aside', {
    className: 'melktak-desktop-sidebar hidden md:flex flex-col fixed top-0 right-0 w-64 h-screen bg-white border-l border-[#E2E8F0] z-40 shadow-sm p-4 select-none justify-between',
    children: [
      (0, S.jsxs)('div', {
        className: 'space-y-4',
        children: [
          (0, S.jsxs)('div', {
            className: 'flex items-center gap-2.5 pb-3 border-b border-slate-100',
            children: [
              (0, S.jsx)('img', {
                src: 'https://cdn.imgurl.ir/uploads/n255498_melktak1.png',
                alt: 'ملک تک',
                className: 'w-10 h-10 rounded-xl object-contain bg-blue-50 p-1 border border-blue-100 shadow-xs'
              }),
              (0, S.jsxs)('div', {
                className: 'flex-1 min-w-0',
                children: [
                  (0, S.jsxs)('div', {
                    className: 'flex items-center gap-1.5',
                    children: [
                      (0, S.jsx)('h1', { className: 'text-xs font-black text-[#172033] truncate', children: s?.name || 'ملک تک' }),
                      (0, S.jsx)('span', { className: 'text-[9px] font-bold text-[#145DB5] bg-blue-50 px-1 rounded border border-blue-100 shrink-0', children: 'ویندوز' })
                    ]
                  }),
                  (0, S.jsx)('p', { className: 'text-[10px] text-[#667085] truncate mt-0.5', children: s?.agency_code ? `کد دفتر: ${s.agency_code}` : 'سامانه جامع املاک' })
                ]
              })
            ]
          }),
          (0, S.jsxs)('button', {
            onClick: n,
            className: 'w-full flex items-center justify-center gap-2 bg-[#145DB5] text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-md hover:bg-[#0F4383] active:scale-98 transition cursor-pointer',
            children: [
              (0, S.jsx)(He, { className: 'w-4 h-4 stroke-[2.5]' }),
              (0, S.jsx)('span', { children: 'ثبت سریع (ملک / متقاضی)' })
            ]
          }),
          (0, S.jsxs)('nav', {
            className: 'space-y-1',
            children: [
              (0, S.jsxs)('button', {
                onClick: () => t('home'),
                className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${e === 'home' ? 'bg-blue-50 text-[#145DB5]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`,
                children: [
                  (0, S.jsx)(De, { className: `w-4 h-4 ${e === 'home' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                  (0, S.jsx)('span', { children: 'امروز (میز کار)' })
                ]
              }),
              (0, S.jsxs)('button', {
                onClick: () => t('properties'),
                className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${e === 'properties' ? 'bg-blue-50 text-[#145DB5]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`,
                children: [
                  (0, S.jsx)(R, { className: `w-4 h-4 ${e === 'properties' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                  (0, S.jsx)('span', { children: 'فایل‌های املاک' })
                ]
              }),
              (0, S.jsxs)('button', {
                onClick: () => t('customers'),
                className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${e === 'customers' ? 'bg-blue-50 text-[#145DB5]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`,
                children: [
                  (0, S.jsx)(dt, { className: `w-4 h-4 ${e === 'customers' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                  (0, S.jsx)('span', { children: 'مشتریان و متقاضیان' })
                ]
              }),
              (0, S.jsxs)('button', {
                onClick: () => t('tasks'),
                className: `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${e === 'tasks' ? 'bg-blue-50 text-[#145DB5]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`,
                children: [
                  (0, S.jsxs)('div', {
                    className: 'flex items-center gap-3',
                    children: [
                      (0, S.jsx)(nt, { className: `w-4 h-4 ${e === 'tasks' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                      (0, S.jsx)('span', { children: 'پیگیری‌ها و وظایف' })
                    ]
                  }),
                  r > 0 ? (0, S.jsx)('span', { className: 'bg-rose-600 text-white rounded-full text-[10px] font-bold px-2 py-0.5', children: r }) : null
                ]
              }),
              (0, S.jsxs)('button', {
                onClick: () => t('more'),
                className: `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${e === 'more' ? 'bg-blue-50 text-[#145DB5]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`,
                children: [
                  (0, S.jsx)(ge, { className: `w-4 h-4 ${e === 'more' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                  (0, S.jsx)('span', { children: 'امکانات بیشتر و تنظیمات' })
                ]
              })
            ]
          })
        ]
      }),
      (0, S.jsxs)('div', {
        className: 'pt-3 border-t border-slate-100 space-y-2.5',
        children: [
          (0, S.jsxs)('div', {
            className: 'flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100',
            children: [
              (0, S.jsxs)('div', {
                className: 'flex-1 min-w-0 pr-1',
                children: [
                  (0, S.jsx)('p', { className: 'text-xs font-bold text-[#172033] truncate', children: o?.display_name || 'کاربر سیستم' }),
                  (0, S.jsx)('p', { className: 'text-[10px] text-[#667085] truncate', children: roleTitle })
                ]
              }),
              (0, S.jsx)('button', {
                type: 'button',
                onClick: () => c && c(),
                className: 'p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition cursor-pointer',
                title: 'خروج از حساب',
                children: (0, S.jsx)(q, { className: 'w-4 h-4' })
              })
            ]
          }),
          (0, S.jsxs)('div', {
            className: 'flex items-center justify-between text-[10px] text-slate-400 px-1',
            children: [
              (0, S.jsxs)('div', {
                className: 'flex items-center gap-1.5',
                children: [
                  (0, S.jsx)('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' }),
                  (0, S.jsx)('span', { children: 'متصل به سرور' })
                ]
              }),
              (0, S.jsx)('span', { children: 'v2.0 دسکتاپ' })
            ]
          })
        ]
      })
    ]
  });
};
"""

for js_file in ["public/assets/index-app.js", "dist/assets/index-app.js"]:
    if not os.path.exists(js_file):
        continue
    with open(js_file, "r", encoding="utf-8") as f:
        c = f.read()

    # 1. Update jn with class 'melktak-bottom-nav'
    c = c.replace(
        "className:`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-lg pb-safe",
        "className:`melktak-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-lg pb-safe md:hidden"
    )

    # 2. Add MelktakSidebar definition right before Hn()
    if "var MelktakSidebar" not in c:
        pos_hn = c.find("function Hn()")
        if pos_hn != -1:
            c = c[:pos_hn] + sidebar_component_js + "\n" + c[pos_hn:]
            print(f"Injected MelktakSidebar component definition before Hn() in {js_file}")

    # 3. In Hn() return JSX, make sure MelktakSidebar is rendered
    # Look for jn render in Hn
    # Remove any old Dn render that was added
    c = c.replace("(0,S.jsx)(Dn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z}),", "")
    c = c.replace("(0,S.jsx)(Dn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z})", "")

    # Now add MelktakSidebar next to jn
    old_jn_render = "(0,S.jsx)(jn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z})"
    new_jn_render = "(0,S.jsx)(jn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z}),(0,S.jsx)(MelktakSidebar,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z})"

    if old_jn_render in c and "MelktakSidebar" not in c.split("function Hn()")[1]:
        c = c.replace(old_jn_render, new_jn_render, 1)
        print(f"Injected MelktakSidebar render inside Hn() in {js_file}")

    with open(js_file, "w", encoding="utf-8") as f:
        f.write(c)

print("--- 3. Updating cache version in index.html & public/index.html & sw.js ---")
# Update index.html and public/index.html to use ?v=10 for cache busting
for hfile in ["index.html", "public/index.html", "dist/index.html"]:
    if os.path.exists(hfile):
        with open(hfile, "r", encoding="utf-8") as f:
            h = f.read()
        h = re.sub(r'src="/assets/index-app\.js\?v=\d+"', 'src="/assets/index-app.js?v=10"', h)
        h = re.sub(r'href="/assets/index-app\.css\?v=\d+"', 'href="/assets/index-app.css?v=10"', h)
        with open(hfile, "w", encoding="utf-8") as f:
            f.write(h)
        print(f"Updated cache version ?v=10 in {hfile}")

# Update sw.js cache name
for swfile in ["public/sw.js", "dist/sw.js"]:
    if os.path.exists(swfile):
        with open(swfile, "r", encoding="utf-8") as f:
            sw = f.read()
        sw = re.sub(r"const CACHE_NAME = 'melktak-pwa-v\d+';", "const CACHE_NAME = 'melktak-pwa-v5';", sw)
        with open(swfile, "w", encoding="utf-8") as f:
            f.write(sw)
        print(f"Updated cache name to melktak-pwa-v5 in {swfile}")

print("All modifications completed successfully!")
