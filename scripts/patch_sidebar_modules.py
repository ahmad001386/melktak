import os
import re

print("--- Step 1: Crafting MelktakSidebar with all requested modules ---")

sidebar_component_js = """
var MelktakSidebar = ({activeTab: e, onSelectTab: t, onOpenQuickAdd: n, overdueCount: r = 0}) => {
  let { user: o, tenant: s, logout: c } = T();
  let [activeSubmod, setActiveSubmod] = (0, _.useState)('hub');

  (0, _.useEffect)(() => {
    let handler = (ev) => {
      if (ev.detail) setActiveSubmod(ev.detail);
    };
    window.addEventListener('melktak:open-submodule', handler);
    return () => window.removeEventListener('melktak:open-submodule', handler);
  }, []);

  let roleTitle = o?.role_code === 'SUPER_ADMIN' ? 'مدیر ارشد سامانه' : o?.role_code === 'ADMIN' || o?.role_code === 'OWNER' ? 'مدیر آژانس' : 'مشاور املاک';
  let isManager = o?.role_code === 'ADMIN' || o?.role_code === 'OWNER' || o?.role_code === 'SUPER_ADMIN' || o?.role_code === 'BRANCH_MANAGER';

  let navTo = (tab) => {
    setActiveSubmod('');
    t(tab);
  };

  let openSub = (mod) => {
    setActiveSubmod(mod);
    window.melktakPendingSubmodule = mod;
    t('more');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('melktak:open-submodule', { detail: mod }));
    }, 40);
  };

  let itemClass = (isActive) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
      isActive ? 'bg-blue-50 text-[#145DB5] shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (0, S.jsxs)('aside', {
    className: 'melktak-desktop-sidebar hidden md:flex flex-col fixed top-0 right-0 w-64 h-screen bg-white border-l border-[#E2E8F0] z-50 shadow-sm select-none justify-between',
    children: [
      (0, S.jsxs)('div', {
        className: 'flex flex-col flex-1 min-h-0',
        children: [
          (0, S.jsxs)('div', {
            className: 'p-4 pb-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0',
            children: [
              (0, S.jsx)('img', {
                src: 'https://cdn.imgurl.ir/uploads/n255498_melktak1.png',
                alt: 'ملک تک',
                className: 'w-10 h-10 rounded-xl object-contain bg-blue-50 p-1 border border-blue-100 shadow-2xs shrink-0'
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
                  (0, S.jsx)('p', { className: 'text-[10px] text-[#667085] truncate mt-0.5', children: s?.agency_code ? `کد دفتر: ${s.agency_code}` : 'سامانه مدیریت املاک' })
                ]
              })
            ]
          }),

          (0, S.jsx)('div', {
            className: 'p-3 pb-2 shrink-0',
            children: (0, S.jsxs)('button', {
              onClick: n,
              className: 'w-full flex items-center justify-center gap-2 bg-[#145DB5] text-white py-2 px-3 rounded-xl text-xs font-bold shadow-md hover:bg-[#0F4383] active:scale-98 transition cursor-pointer',
              children: [
                (0, S.jsx)(He, { className: 'w-4 h-4 stroke-[2.5]' }),
                (0, S.jsx)('span', { children: 'ثبت سریع (ملک / متقاضی)' })
              ]
            })
          }),

          (0, S.jsxs)('div', {
            className: 'flex-1 overflow-y-auto px-3 space-y-4 py-1 no-scrollbar',
            children: [
              (0, S.jsxs)('div', {
                children: [
                  (0, S.jsx)('span', { className: 'text-[10px] font-black text-slate-400 block px-2 mb-1 uppercase tracking-wider', children: 'میز کار و فایلینگ' }),
                  (0, S.jsxs)('div', {
                    className: 'space-y-0.5',
                    children: [
                      (0, S.jsxs)('button', {
                        onClick: () => navTo('home'),
                        className: itemClass(e === 'home'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(De, { className: `w-4 h-4 ${e === 'home' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'امروز (میز کار)' })
                            ]
                          }),
                          null
                        ]
                      }),
                      (0, S.jsxs)('button', {
                        onClick: () => navTo('properties'),
                        className: itemClass(e === 'properties'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(R, { className: `w-4 h-4 ${e === 'properties' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'فایل‌های املاک' })
                            ]
                          }),
                          null
                        ]
                      }),
                      (0, S.jsxs)('button', {
                        onClick: () => navTo('customers'),
                        className: itemClass(e === 'customers'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(dt, { className: `w-4 h-4 ${e === 'customers' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'مشتریان و متقاضیان' })
                            ]
                          }),
                          null
                        ]
                      }),
                      (0, S.jsxs)('button', {
                        onClick: () => navTo('tasks'),
                        className: itemClass(e === 'tasks'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(nt, { className: `w-4 h-4 ${e === 'tasks' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'پیگیری‌ها و وظایف' })
                            ]
                          }),
                          r > 0 ? (0, S.jsx)('span', { className: 'bg-rose-600 text-white rounded-full text-[10px] font-bold px-1.5 py-0.2', children: r }) : null
                        ]
                      })
                    ]
                  })
                ]
              }),

              (0, S.jsxs)('div', {
                children: [
                  (0, S.jsx)('span', { className: 'text-[10px] font-black text-slate-400 block px-2 mb-1 uppercase tracking-wider', children: 'اسناد و معاملات' }),
                  (0, S.jsxs)('div', {
                    className: 'space-y-0.5',
                    children: [
                      (0, S.jsxs)('button', {
                        onClick: () => openSub('documents'),
                        className: itemClass(e === 'more' && activeSubmod === 'documents'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(be, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'documents' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'اسناد و مدارک' })
                            ]
                          }),
                          null
                        ]
                      }),
                      (0, S.jsxs)('button', {
                        onClick: () => openSub('transactions'),
                        className: itemClass(e === 'more' && activeSubmod === 'transactions'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(Ee, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'transactions' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'مدیریت قراردادها' })
                            ]
                          }),
                          null
                        ]
                      })
                    ]
                  })
                ]
              }),

              (0, S.jsxs)('div', {
                children: [
                  (0, S.jsx)('span', { className: 'text-[10px] font-black text-slate-400 block px-2 mb-1 uppercase tracking-wider', children: 'مدیریت آژانس و نظارت' }),
                  (0, S.jsxs)('div', {
                    className: 'space-y-0.5',
                    children: [
                      isManager ? (0, S.jsxs)('button', {
                        onClick: () => openSub('report'),
                        className: itemClass(e === 'more' && activeSubmod === 'report'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(oe, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'report' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'گزارش عملکرد' })
                            ]
                          }),
                          null
                        ]
                      }) : null,

                      isManager ? (0, S.jsxs)('button', {
                        onClick: () => openSub('branches'),
                        className: itemClass(e === 'more' && activeSubmod === 'branches'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(re, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'branches' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'مدیریت شعب' })
                            ]
                          }),
                          null
                        ]
                      }) : null,

                      isManager ? (0, S.jsxs)('button', {
                        onClick: () => openSub('agents'),
                        className: itemClass(e === 'more' && activeSubmod === 'agents'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(dt, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'agents' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'مدیریت مشاورین' })
                            ]
                          }),
                          null
                        ]
                      }) : null,

                      isManager ? (0, S.jsxs)('button', {
                        onClick: () => openSub('settings'),
                        className: itemClass(e === 'more' && activeSubmod === 'settings'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(ge, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'settings' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'تنظیمات دفتر' })
                            ]
                          }),
                          null
                        ]
                      }) : null,

                      isManager ? (0, S.jsxs)('button', {
                        onClick: () => openSub('audit'),
                        className: itemClass(e === 'more' && activeSubmod === 'audit'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(ke, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'audit' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'گزارش ممیزی' })
                            ]
                          }),
                          null
                        ]
                      }) : null,

                      (0, S.jsxs)('button', {
                        onClick: () => openSub('security'),
                        className: itemClass(e === 'more' && activeSubmod === 'security'),
                        children: [
                          (0, S.jsxs)('div', {
                            className: 'flex items-center gap-2.5',
                            children: [
                              (0, S.jsx)(ke, { className: `w-4 h-4 ${e === 'more' && activeSubmod === 'security' ? 'text-[#145DB5]' : 'text-slate-400'}` }),
                              (0, S.jsx)('span', { children: 'امنیت و گذرواژه' })
                            ]
                          }),
                          null
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }),

      (0, S.jsxs)('div', {
        className: 'p-3 border-t border-slate-100 space-y-2 shrink-0 bg-slate-50/50',
        children: [
          (0, S.jsxs)('div', {
            className: 'flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 shadow-2xs',
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
                className: 'p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition cursor-pointer',
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
              (0, S.jsx)('span', { children: 'ملک تک ویندوز' })
            ]
          })
        ]
      })
    ]
  });
};
"""

print("--- Step 2: Inlining event listener in On component ---")
on_effect_code = """
(0, _.useEffect)(() => {
  let applySub = (mod) => {
    if (!mod) return;
    if (mod === 'transactions' || mod === 'report' || mod === 'branches' || mod === 'agents' || mod === 'subscription' || mod === 'hub') {
      g(mod);
    } else if (mod === 'documents') {
      ee(!0);
    } else if (mod === 'settings') {
      E(!0);
    } else if (mod === 'audit') {
      Le();
    } else if (mod === 'security') {
      M(!0);
    }
  };
  if (window.melktakPendingSubmodule) {
    let p = window.melktakPendingSubmodule;
    window.melktakPendingSubmodule = null;
    applySub(p);
  }
  let hnd = (ev) => {
    applySub(ev.detail);
  };
  window.addEventListener('melktak:open-submodule', hnd);
  return () => window.removeEventListener('melktak:open-submodule', hnd);
}, []);
"""

for js_path in ["public/assets/index-app.js", "dist/assets/index-app.js"]:
    if not os.path.exists(js_path):
        continue
    with open(js_path, "r", encoding="utf-8") as f:
        c = f.read()

    # Replace MelktakSidebar definition
    if "var MelktakSidebar = " in c:
        pos_start = c.find("var MelktakSidebar = ")
        pos_end = c.find("function Hn()", pos_start)
        c = c[:pos_start] + sidebar_component_js.strip() + "\n" + c[pos_end:]
        print(f"Replaced MelktakSidebar in {js_path}")
    else:
        pos_hn = c.find("function Hn()")
        if pos_hn != -1:
            c = c[:pos_hn] + sidebar_component_js.strip() + "\n" + c[pos_hn:]
            print(f"Injected MelktakSidebar before Hn in {js_path}")

    # Inject on_effect_code in On component if not already there
    if "window.melktakPendingSubmodule" not in c:
        # find where On hooks are initialized
        pos_on = c.find("On=({")
        if pos_on != -1:
            # find first useEffect in On
            pos_eff = c.find("(0,_.useEffect)(()=>", pos_on)
            if pos_eff != -1:
                c = c[:pos_eff] + on_effect_code.strip() + "\n" + c[pos_eff:]
                print(f"Injected submodule listener inside On() in {js_path}")

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(c)

print("--- Step 3: Updating index-app.css with desktop styles for all submodules ---")
responsive_css_extension = """
/* =========================================================================
   MELKTAK WINDOWS & DESKTOP SUBMODULES & FULL RESPONSIVE EXPANSION
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
    box-shadow: -2px 0 12px rgba(0, 0, 0, 0.04) !important;
  }

  /* 3. Shift and Expand Top Header across Workspace */
  header.sticky.top-0,
  div.sticky.top-0 {
    margin-right: 260px !important;
    margin-left: 0 !important;
    width: calc(100% - 260px) !important;
    max-width: none !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }
  header.sticky.top-0 > div,
  div.sticky.top-0 > div {
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

  /* 5. Subviews (Transactions, Report, Branches, Agents) Full-width responsiveness */
  .min-h-screen.bg-\\[\\#F7F9FC\\] > .max-w-4xl,
  main .max-w-4xl,
  .max-w-4xl {
    max-width: 1400px !important;
  }

  /* Branches list in Cn -> 2 or 3 columns grid */
  main .space-y-3:has(.rounded-2xl) {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
    gap: 16px !important;
  }

  /* Agents list in ln -> 2 or 3 columns grid */
  main .space-y-2\.5:has(.rounded-2xl),
  main .space-y-2:has(.rounded-2xl) {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)) !important;
    gap: 14px !important;
  }

  /* Properties list -> 2 to 3 columns grid */
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

  /* Customer list -> 2 to 3 columns grid */
  main .space-y-3:has(> div:has(button[title*="تماس"])) {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)) !important;
    gap: 16px !important;
  }

  /* Tasks list -> 2 column grid */
  main .space-y-2\\.5 {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)) !important;
    gap: 14px !important;
  }
  main .space-y-2\\.5 > :not(:last-child) {
    margin-bottom: 0 !important;
  }

  /* Metrics in Dashboard & Reports -> 4 columns on desktop */
  main .grid-cols-3,
  main .grid-cols-2 {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
    gap: 16px !important;
  }

  /* Dialogs & Modals on Desktop: centered, spacious, not crammed */
  .fixed.inset-0 .max-w-md,
  .fixed.inset-0 .max-w-lg {
    max-width: 820px !important;
    border-radius: 1.25rem !important;
  }
  .fixed.inset-0 .max-w-2xl {
    max-width: 950px !important;
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
        if "/* MELKTAK WINDOWS & DESKTOP RESPONSIVE ENGINE (RTL) */" in css_content:
            css_content = css_content.split("/* MELKTAK WINDOWS & DESKTOP RESPONSIVE ENGINE (RTL) */")[0]
        if "/* MELKTAK WINDOWS & DESKTOP SUBMODULES & FULL RESPONSIVE EXPANSION */" in css_content:
            css_content = css_content.split("/* MELKTAK WINDOWS & DESKTOP SUBMODULES & FULL RESPONSIVE EXPANSION */")[0]
        if "@media (min-width: 768px)" in css_content:
            css_content = css_content.split("@media (min-width: 768px)")[0]
        css_content = css_content.strip() + "\n" + responsive_css_extension.strip() + "\n"
        with open(css_file, "w", encoding="utf-8") as f:
            f.write(css_content)
        print(f"Updated responsive CSS in {css_file}")

print("--- Step 4: Bumping cache version in HTML and sw.js ---")
for hfile in ["index.html", "public/index.html", "dist/index.html"]:
    if os.path.exists(hfile):
        with open(hfile, "r", encoding="utf-8") as f:
            h = f.read()
        h = re.sub(r'src="/assets/index-app\.js\?v=\d+"', 'src="/assets/index-app.js?v=12"', h)
        h = re.sub(r'href="/assets/index-app\.css\?v=\d+"', 'href="/assets/index-app.css?v=12"', h)
        with open(hfile, "w", encoding="utf-8") as f:
            f.write(h)
        print(f"Updated cache version ?v=12 in {hfile}")

for swfile in ["public/sw.js", "dist/sw.js"]:
    if os.path.exists(swfile):
        with open(swfile, "r", encoding="utf-8") as f:
            sw = f.read()
        sw = re.sub(r"const CACHE_NAME = 'melktak-pwa-v\d+';", "const CACHE_NAME = 'melktak-pwa-v6';", sw)
        with open(swfile, "w", encoding="utf-8") as f:
            f.write(sw)
        print(f"Updated cache name to melktak-pwa-v6 in {swfile}")

print("All updates applied successfully!")
