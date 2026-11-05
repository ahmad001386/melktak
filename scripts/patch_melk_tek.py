#!/usr/bin/env python3
import os
import re

LOGO_URL = "https://cdn.imgurl.ir/uploads/n255498_melktak1.png"

# Persian numbers to words function in minified JS
TO_WORDS_JS = """function toWords(val){let n=parseInt(String(val||'').replace(/\\D/g,''),10);if(isNaN(n)||n<=0)return'';let y=['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه'],d=['','ده','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'],no=['ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'],s=['','یکصد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'],sc=['','هزار','میلیون','میلیارد','تریلیون'],f=num=>{if(num===0)return[];let r=[],c=Math.floor(num/100),m=num%100;if(c>0)r.push(s[c]);if(m>=10&&m<=19)r.push(no[m-10]);else{let dh=Math.floor(m/10),yk=m%10;if(dh>0)r.push(d[dh]);if(yk>0)r.push(y[yk]);}return r;};let ch=[],tmp=n;while(tmp>0){ch.push(tmp%1000);tmp=Math.floor(tmp/1000);}let w=[];for(let i=ch.length-1;i>=0;i--){if(ch[i]>0){let p=f(ch[i]),str=p.join(' و ');if(sc[i])str+=' '+sc[i];w.push(str);}}return'به حروف: '+w.join(' و ')+' تومان';}window.__toWords=toWords;"""

DOWNLOAD_DOC_JS = """async function downloadDocumentSafe(doc,allowArchived=false){try{let t=b.getToken(),u=`/api/v1/documents/${doc.id}/download${t?`?token=${encodeURIComponent(t)}`:''}${allowArchived?'&allow_archived=true':''}`,res=await fetch(u,{headers:t?{'Authorization':`Bearer ${t}`}:{}});if(!res.ok){let err=await res.json().catch(()=>({}));alert(err?.error?.message||'خطا در بارگیری سند از سرور.');return;}let blob=await res.blob(),bUrl=window.URL.createObjectURL(blob),a=document.createElement('a');a.href=bUrl;a.download=doc.file_name||`${doc.display_name||'document'}.pdf`;document.body.appendChild(a);a.click();setTimeout(()=>{window.URL.revokeObjectURL(bUrl);if(document.body.contains(a))document.body.removeChild(a);},1000);}catch(e){alert('خطا در دریافت فایل سند.');}}window.__downloadDoc=downloadDocumentSafe;"""

targets = [
    'public/assets/index-app.js',
    'public/assets/index-C5RZm4w3.js',
    'dist/assets/index-app.js',
    'dist/assets/index-C5RZm4w3.js'
]

for file_path in targets:
    if not os.path.exists(file_path):
        continue
    print(f"=== Patching {file_path} ===")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Inject toWords and downloadDocumentSafe near Ut function
    ut_target = "function Ut(e){if(!e||e<=0)return`توافقی`;"
    if ut_target in content and "window.__toWords" not in content:
        content = content.replace(ut_target, TO_WORDS_JS + DOWNLOAD_DOC_JS + ut_target)
        print("  [+] Injected TO_WORDS_JS and DOWNLOAD_DOC_JS")
    elif "window.__toWords" in content:
        print("  [.] toWords already injected")
    else:
        print("  [!] Warning: Ut target not found!")

    # 2. Update Login screen branding & logo
    old_login_branding = "(0,S.jsx)(`div`,{className:`w-14 h-14 rounded-2xl bg-[#145DB5] text-white mx-auto flex items-center justify-center shadow-md mb-3`,children:(0,S.jsx)(R,{className:`w-7 h-7`})}),(0,S.jsx)(`h1`,{className:`text-lg font-extrabold text-[#172033]`,children:`سامانه مدیریت معاملات و املاک`}),(0,S.jsx)(`p`,{className:`text-xs text-[#667085] mt-1 font-medium`,children:`Amlak OS • سیستم عامل یکپارچه آژانس‌های املاک و مشاوران`})"
    new_login_branding = f"(0,S.jsx)(`img`,{{src:`{LOGO_URL}`,alt:`ملک تک`,className:`w-16 h-16 rounded-2xl mx-auto shadow-md mb-3 object-contain bg-white p-1 border border-slate-200`}}),(0,S.jsx)(`h1`,{{className:`text-xl font-black text-[#172033]`,children:`ملک تک`}}),(0,S.jsx)(`p`,{{className:`text-xs text-[#667085] mt-1 font-medium`,children:`سامانه جامع و هوشمند مدیریت معاملات و املاک`}})"
    if old_login_branding in content:
        content = content.replace(old_login_branding, new_login_branding)
        print("  [+] Replaced login screen branding & logo")
    else:
        print("  [?] Login branding pattern not matched directly, checking partials")
        content = content.replace("`سامانه مدیریت معاملات و املاک`", "`ملک تک`")
        content = content.replace("`Amlak OS • سیستم عامل یکپارچه آژانس‌های املاک و مشاوران`", "`سامانه جامع و هوشمند مدیریت معاملات و املاک`")

    # 3. Update Header logo in An component
    old_header_icon = "(0,S.jsx)(`div`,{className:`w-8 h-8 rounded-lg bg-[#145DB5] text-white flex items-center justify-center font-bold text-xs shadow-xs`,children:(0,S.jsx)(re,{className:`w-4 h-4`})})"
    new_header_logo = f"(0,S.jsx)(`img`,{{src:`{LOGO_URL}`,alt:`ملک تک`,className:`w-8 h-8 rounded-lg object-contain bg-white shadow-xs border border-slate-200 p-0.5 shrink-0`}})"
    if old_header_icon in content:
        content = content.replace(old_header_icon, new_header_logo)
        print("  [+] Replaced header icon with logo")
    else:
        print("  [?] Header icon pattern not matched directly")

    # 4. Update Splash / Loading screen logo
    old_splash_icon = "(0,S.jsx)(`div`,{className:`w-12 h-12 rounded-2xl bg-[#145DB5] text-white flex items-center justify-center shadow-md animate-pulse mb-3`,children:(0,S.jsx)(R,{className:`w-6 h-6`})})"
    new_splash_logo = f"(0,S.jsx)(`img`,{{src:`{LOGO_URL}`,alt:`ملک تک`,className:`w-12 h-12 rounded-2xl shadow-md animate-pulse mb-3 object-contain bg-white p-1 border border-slate-200`}})"
    if old_splash_icon in content:
        content = content.replace(old_splash_icon, new_splash_logo)
        print("  [+] Replaced splash screen icon with logo")

    # 5. Replace any remaining "Amlak OS" in plans/more
    content = content.replace("`پلن‌های اشتراک Amlak OS`", "`پلن‌های اشتراک ملک تک`")
    content = content.replace("||`Amlak OS`", "||`ملک تک`")
    content = content.replace("Amlak OS", "ملک تک")

    # 6. Add "به حروف ... تومان" under budget input in Quick Add Customer Modal (Pn)
    old_pn_budget = "(0,S.jsx)(`input`,{type:`number`,inputMode:`numeric`,value:p,onChange:e=>m(e.target.value),placeholder:`مثلاً 6000000000 (۶ میلیارد)`,className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-[#172033] focus:border-[#145DB5] outline-none font-mono`})"
    new_pn_budget = old_pn_budget + ",p&&toWords(p)&&(0,S.jsx)(`p`,{className:`mt-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold`,children:toWords(p)})"
    if old_pn_budget in content:
        content = content.replace(old_pn_budget, new_pn_budget)
        print("  [+] Added Persian words to Quick Add Customer budget input")
    else:
        print("  [?] Pn budget input pattern not found directly")

    # 7. Add "به حروف ... تومان" under requirements modal budget input
    old_req_budget = "(0,S.jsx)(`input`,{type:`number`,value:I,onChange:e=>ne(e.target.value?Number(e.target.value):``),placeholder:`مثلا: 4500000000`,className:`w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs`})"
    new_req_budget = old_req_budget + ",I&&toWords(I)&&(0,S.jsx)(`p`,{className:`mt-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold`,children:toWords(I)})"
    if old_req_budget in content:
        content = content.replace(old_req_budget, new_req_budget)
        print("  [+] Added Persian words to Customer Requirements budget input")
    else:
        print("  [?] Req budget input pattern not found directly")

    # 8. Use downloadDocumentSafe for document downloads
    # Old P:
    # P=e=>{try{let t=b.getToken(),n=`/api/v1/documents/${e.id}/download${t?`?token=${encodeURIComponent(t)}`:``}`,r=document.createElement(`a`);r.href=n,r.download=e.file_name,r.target=`_blank`,document.body.appendChild(r),r.click(),document.body.removeChild(r)}catch{alert(`خطا در دریافت فایل سند.`)}}
    old_p_func = "P=e=>{try{let t=b.getToken(),n=`/api/v1/documents/${e.id}/download${t?`?token=${encodeURIComponent(t)}`:``}`,r=document.createElement(`a`);r.href=n,r.download=e.file_name,r.target=`_blank`,document.body.appendChild(r),r.click(),document.body.removeChild(r)}catch{alert(`خطا در دریافت فایل سند.`)}"
    new_p_func = "P=e=>{downloadDocumentSafe(e,false)"
    if old_p_func in content:
        content = content.replace(old_p_func, new_p_func)
        print("  [+] Replaced P document download with safe blob downloader")

    # Old ue:
    # ue=e=>{try{let t=b.getToken(),n=`/api/v1/documents/${e.id}/download${t?`?token=${encodeURIComponent(t)}`:``}${p?`&allow_archived=true`:``}`,r=document.createElement(`a`);r.href=n,r.download=e.file_name,r.target=`_blank`,document.body.appendChild(r),r.click(),document.body.removeChild(r)}catch{n(`خطا در دریافت فایل سند.`)}}
    old_ue_func = "ue=e=>{try{let t=b.getToken(),n=`/api/v1/documents/${e.id}/download${t?`?token=${encodeURIComponent(t)}`:``}${p?`&allow_archived=true`:``}`,r=document.createElement(`a`);r.href=n,r.download=e.file_name,r.target=`_blank`,document.body.appendChild(r),r.click(),document.body.removeChild(r)}catch{n(`خطا در دریافت فایل سند.`)}"
    new_ue_func = "ue=e=>{downloadDocumentSafe(e,p)"
    if old_ue_func in content:
        content = content.replace(old_ue_func, new_ue_func)
        print("  [+] Replaced ue document download with safe blob downloader")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"=== Saved {file_path} ===")

print("Core branding, words, and download patching complete!")
