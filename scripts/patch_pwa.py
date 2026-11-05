#!/usr/bin/env python3
import os

SW_CONTENT = """const CACHE_NAME = 'melktak-pwa-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
"""

PWA_COMPONENT_JS = """function PWAInstallCard(){let[e,t]=(0,_.useState)(null),[n,r]=(0,_.useState)(!1),[i,a]=(0,_.useState)(!1),[o,s]=(0,_.useState)(!1);return(0,_.useEffect)(()=>{let e=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;r(e);let t=/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());a(t);let n=e=>{e.preventDefault();t(e)};return window.addEventListener('beforeinstallprompt',n),window.addEventListener('appinstalled',()=>r(!0)),()=>window.removeEventListener('beforeinstallprompt',n)},[]),n?null:(0,S.jsxs)(S.Fragment,{children:[(0,S.jsxs)(`div`,{className:`bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md flex items-center justify-between mb-4`,children:[(0,S.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,S.jsx)(`div`,{className:`w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 font-bold text-lg`,children:`📱`}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`h4`,{className:`text-xs font-extrabold`,children:`نصب اپلیکیشن ملک تک (PWA)`}),(0,S.jsx)(`p`,{className:`text-[11px] text-blue-100 mt-0.5`,children:`دسترسی سریع، عملکرد آفلاین و نصب روی صفحه اصلی موبایل`})]})]}),(0,S.jsx)(`button`,{onClick:async()=>{if(e){e.prompt();let{outcome:t}=await e.userChoice;t==='accepted'&&r(!0),t(null)}else if(i){s(!0)}else{alert('برای نصب اپلیکیشن، از منوی مرورگر خود گزینه Add to Home Screen را انتخاب کنید.')}},className:`bg-white text-[#145DB5] px-3.5 py-2 rounded-xl text-xs font-black shadow-xs hover:bg-blue-50 transition active:scale-95 shrink-0`,children:`نصب اپلیکیشن`})]}),o&&(0,S.jsx)(`div`,{className:`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4`,children:(0,S.jsxs)(`div`,{className:`w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl text-xs space-y-3 text-slate-800`,children:[(0,S.jsx)(`h3`,{className:`text-sm font-black text-slate-900`,children:`نصب روی آیفون و آیپد (iOS)`}),(0,S.jsxs)(`p`,{className:`text-slate-600 leading-relaxed`,children:[`۱. دکمه `,`Share`,` را در نوار ابزار سافاری لمس کنید.`]},),(0,S.jsxs)(`p`,{className:`text-slate-600 leading-relaxed`,children:[`۲. به پایین لیست رفته و گزینه `,`Add to Home Screen`,` را انتخاب نمایید.`]}),(0,S.jsx)(`button`,{onClick:()=>s(!1),className:`w-full bg-[#145DB5] text-white py-2 rounded-xl font-bold mt-2`,children:`متوجه شدم`})]})})]})}
"""

targets = [
    'public/assets/index-app.js',
    'public/assets/index-C5RZm4w3.js'
]

# 1. Write sw.js
with open('public/sw.js', 'w', encoding='utf-8') as f:
    f.write(SW_CONTENT)
print("[+] Updated public/sw.js")

# 2. Update index.html to register service worker
with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

sw_reg_script = """    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').catch(function(err) {
            console.log('SW registration failed: ', err);
          });
        });
      }
    </script>"""

if "navigator.serviceWorker.register" not in html_content:
    html_content = html_content.replace("</head>", sw_reg_script + "\n  </head>")
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("[+] Registered Service Worker in index.html")

# 3. Inject PWAInstallCard into bundle JS files and "More" section
for file_path in targets:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        js_content = f.read()

    if "function PWAInstallCard" not in js_content:
        # Inject PWAInstallCard at the beginning
        js_content = PWA_COMPONENT_JS + js_content
        print(f"[+] Injected PWAInstallCard into {file_path}")

    # Insert PWAInstallCard into On component before "دسترسی سریع به ماژول‌ها و ابزارها"
    target_str = "(0,S.jsx)(`span`,{className:`text-xs font-bold text-[#667085] block mb-2 px-1`,children:`دسترسی سریع به ماژول‌ها و ابزارها`})"
    replacement_str = "(0,S.jsx)(PWAInstallCard,{})," + target_str

    if target_str in js_content and "(0,S.jsx)(PWAInstallCard,{})," not in js_content:
        js_content = js_content.replace(target_str, replacement_str, 1)
        print(f"[+] Added PWAInstallCard to More section in {file_path}")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"[+] Saved {file_path}")

print("PWA integration completed successfully!")
