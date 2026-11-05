import os

for path in ["public/assets/index-app.js", "dist/assets/index-app.js"]:
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update jn to have md:hidden
    old_jn_target = "jn=({activeTab:e,onSelectTab:t,onOpenQuickAdd:n,overdueCount:r=0})=>(0,S.jsx)(`nav`,{className:`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-lg pb-safe`"
    new_jn_repl = "jn=({activeTab:e,onSelectTab:t,onOpenQuickAdd:n,overdueCount:r=0})=>(0,S.jsx)(`nav`,{className:`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-lg pb-safe md:hidden`"

    if old_jn_target in content:
        content = content.replace(old_jn_target, new_jn_repl, 1)
        print(f"Updated jn in {path}")
    else:
        content = content.replace("fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-lg", "fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-lg md:hidden", 1)

    # 2. Update main className
    old_main = "className:`flex-1 max-w-md w-full mx-auto px-3.5 pt-3`"
    new_main = "className:`flex-1 max-w-md w-full mx-auto px-3.5 pt-3 md:max-w-4xl md:mr-64 md:ml-auto md:px-8 md:pt-6`"
    if old_main in content:
        content = content.replace(old_main, new_main, 1)
        print(f"Updated main in {path}")

    # 3. Add Dn component definition if not present
    if ",Dn=" not in content and "Dn=" not in content:
        target_jn_end = ",Mn=({isOpen:e"
        desktop_sidebar_code = """,Dn=({activeTab:e,onSelectTab:t,onOpenQuickAdd:n,overdueCount:r=0})=>(0,S.jsx)(`aside`,{className:`hidden md:flex flex-col fixed top-0 right-0 w-64 h-screen bg-white border-l border-[#E2E8F0] z-40 shadow-sm p-4 select-none justify-between`,children:[(0,S.jsxs)(`div`,{children:[(0,S.jsxs)(`div`,{className:`flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100`,children:[(0,S.jsx)(`img`,{src:`https://cdn.imgurl.ir/uploads/n255498_melktak1.png`,alt:`ملک تک`,className:`w-9 h-9 rounded-xl object-contain bg-blue-50 p-1 border border-blue-100`}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`h1`,{className:`text-xs font-black text-[#172033]`,children:`ملک تک`}),(0,S.jsx)(`p`,{className:`text-[10px] text-[#667085]`,children:`سامانه جامع معاملات املاک`})]})]}),(0,S.jsxs)(`div`,{className:`space-y-1.5`,children:[(0,S.jsxs)(`button`,{onClick:()=>t(`home`),className:`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${e===`home`?`bg-blue-50 text-[#145DB5]`:`text-slate-600 hover:bg-slate-50 hover:text-slate-900`}`,children:[(0,S.jsx)(De,{className:`w-4 h-4`}),(0,S.jsx)(`span`,{children:`امروز`})]}),(0,S.jsxs)(`button`,{onClick:()=>t(`properties`),className:`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${e===`properties`?`bg-blue-50 text-[#145DB5]`:`text-slate-600 hover:bg-slate-50 hover:text-slate-900`}`,children:[(0,S.jsx)(R,{className:`w-4 h-4`}),(0,S.jsx)(`span`,{children:`املاک`})]}),(0,S.jsxs)(`button`,{onClick:()=>t(`customers`),className:`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${e===`customers`?`bg-blue-50 text-[#145DB5]`:`text-slate-600 hover:bg-slate-50 hover:text-slate-900`}`,children:[(0,S.jsx)(dt,{className:`w-4 h-4`}),(0,S.jsx)(`span`,{children:`مشتریان`})]}),(0,S.jsxs)(`button`,{onClick:()=>t(`tasks`),className:`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${e===`tasks`?`bg-blue-50 text-[#145DB5]`:`text-slate-600 hover:bg-slate-50 hover:text-slate-900`}`,children:[(0,S.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,S.jsx)(nt,{className:`w-4 h-4`}),(0,S.jsx)(`span`,{children:`پیگیری‌ها`})]}),r>0&&(0,S.jsx)(`span`,{className:`bg-rose-600 text-white rounded-full text-[10px] font-bold px-2 py-0.5`,children:r})]}),(0,S.jsxs)(`button`,{onClick:()=>t(`more`),className:`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${e===`more`?`bg-blue-50 text-[#145DB5]`:`text-slate-600 hover:bg-slate-50 hover:text-slate-900`}`,children:[(0,S.jsx)(ge,{className:`w-4 h-4`}),(0,S.jsx)(`span`,{children:`بیشتر و تنظیمات`})]})]})]}),(0,S.jsxs)(`div`,{className:`space-y-3 pt-4 border-t border-slate-100`,children:[(0,S.jsxs)(`button`,{onClick:n,className:`w-full flex items-center justify-center gap-2 bg-[#145DB5] text-white py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-[#0F4383] transition`,children:[(0,S.jsx)(He,{className:`w-4 h-4`}),(0,S.jsx)(`span`,{children:`ثبت جدید (ملک / مشتری)`})]}),(0,S.jsx)(`div`,{className:`text-center text-[10px] text-slate-400`,children:`نسخه دسکتاپ ویندوز — ملک تک`})]})]})"""
        if target_jn_end in content:
            content = content.replace(target_jn_end, desktop_sidebar_code + target_jn_end, 1)
            print(f"Added Dn component in {path}")

    # 4. Render Dn in Hn return JSX
    hn_jn_target = "(0,S.jsx)(jn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z})"
    hn_jn_replacement = "(0,S.jsx)(jn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z}),(0,S.jsx)(Dn,{activeTab:n,onSelectTab:r,onOpenQuickAdd:()=>w(!0),overdueCount:z})"

    if hn_jn_target in content and "Dn" not in content.split(hn_jn_target)[0].split("function Hn()")[1]:
        content = content.replace(hn_jn_target, hn_jn_replacement, 1)
        print(f"Added Dn render in Hn for {path}")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
print("Patch script executed successfully.")
