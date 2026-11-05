#!/usr/bin/env python3
import os

EDIT_STATE_CODE = """let[edFn,setEdFn]=(0,_.useState)(e.first_name||''),[edLn,setEdLn]=(0,_.useState)(e.last_name||''),[edPh,setEdPh]=(0,_.useState)(e.phone||''),[edSPh,setEdSPh]=(0,_.useState)(e.secondary_phone||''),[edCt,setEdCt]=(0,_.useState)(e.customer_type||'BUYER'),[edTp,setEdTp]=(0,_.useState)(e.temperature||'WARM'),[edLs,setEdLs]=(0,_.useState)(e.lead_status||'NEW'),[edBMax,setEdBMax]=(0,_.useState)(e.budget_max||''),[edBMin,setEdBMin]=(0,_.useState)(e.budget_min||''),[edAr,setEdAr]=(0,_.useState)(e.preferred_area_text||''),[edNt,setEdNt]=(0,_.useState)(e.notes||''),[edLdg,setEdLdg]=(0,_.useState)(!1);(0,_.useEffect)(()=>{setEdFn(e.first_name||'');setEdLn(e.last_name||'');setEdPh(e.phone||'');setEdSPh(e.secondary_phone||'');setEdCt(e.customer_type||'BUYER');setEdTp(e.temperature||'WARM');setEdLs(e.lead_status||'NEW');setEdBMax(e.budget_max||'');setEdBMin(e.budget_min||'');setEdAr(e.preferred_area_text||'');setEdNt(e.notes||'');},[e]);let onSaveCustomerEdit=async ev=>{ev.preventDefault();if(edLdg)return;if(!edFn.trim()||!edLn.trim()){Me('نام و نام خانوادگی متقاضی الزامی است.');return;}setEdLdg(!0);try{let payload={first_name:edFn.trim(),last_name:edLn.trim(),phone:edPh.trim(),secondary_phone:edSPh.trim()||void 0,customer_type:edCt,temperature:edTp,lead_status:edLs,budget_max:edBMax?Number(edBMax):void 0,budget_min:edBMin?Number(edBMin):void 0,preferred_area_text:edAr.trim()||void 0,notes:edNt.trim()||void 0};let res=await b.patch(`/api/v1/customers/${e.id}`,payload);if(res.success){Object.assign(e,payload);e.display_name=`${edFn.trim()} ${edLn.trim()}`;Me('مشخصات متقاضی با موفقیت ویرایش و ذخیره شد.');s('REQUIREMENTS');i&&i();}else{Me(res.error?.message||'خطا در ذخیره تغییرات مشتری.');}}catch(err){Me('خطا در برقراری ارتباط با سرور.');}finally{setEdLdg(!1);}};"""

EDIT_FORM_JSX = """o===`EDIT`&&(0,S.jsxs)(`form`,{onSubmit:onSaveCustomerEdit,className:`space-y-3.5 p-1 bg-white rounded-xl`,children:[(0,S.jsxs)(`div`,{className:`grid grid-cols-2 gap-2.5`,children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`نام`}),(0,S.jsx)(`input`,{type:`text`,value:edFn,onChange:ev=>setEdFn(ev.target.value),className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`نام خانوادگی`}),(0,S.jsx)(`input`,{type:`text`,value:edLn,onChange:ev=>setEdLn(ev.target.value),className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`})]})]}),(0,S.jsxs)(`div`,{className:`grid grid-cols-2 gap-2.5`,children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`شماره تلفن همراه`}),(0,S.jsx)(`input`,{type:`tel`,dir:`ltr`,value:edPh,onChange:ev=>setEdPh(ev.target.value),className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`شماره دوم (اختیاری)`}),(0,S.jsx)(`input`,{type:`tel`,dir:`ltr`,value:edSPh,onChange:ev=>setEdSPh(ev.target.value),className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`})]})]}),(0,S.jsxs)(`div`,{className:`grid grid-cols-2 gap-2.5`,children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`نوع متقاضی`}),(0,S.jsxs)(`select`,{value:edCt,onChange:ev=>setEdCt(ev.target.value),className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`,children:[(0,S.jsx)(`option`,{value:`BUYER`,children:`متقاضی خرید`}),(0,S.jsx)(`option`,{value:`TENANT`,children:`مستأجر`}),(0,S.jsx)(`option`,{value:`INVESTOR`,children:`سرمایه‌گذار`}),(0,S.jsx)(`option`,{value:`SELLER`,children:`فروشنده`}),(0,S.jsx)(`option`,{value:`LANDLORD`,children:`موجر`})]})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`دمای پیگیری`}),(0,S.jsxs)(`select`,{value:edTp,onChange:ev=>setEdTp(ev.target.value),className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`,children:[(0,S.jsx)(`option`,{value:`HOT`,children:`داغ (فوری)`}),(0,S.jsx)(`option`,{value:`WARM`,children:`گرم (معمولی)`}),(0,S.jsx)(`option`,{value:`COLD`,children:`سرد`})]})]})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`سقف بودجه اعلامی (تومان)`}),(0,S.jsx)(`input`,{type:`number`,inputMode:`numeric`,value:edBMax,onChange:ev=>setEdBMax(ev.target.value),placeholder:`مثلاً 5000000000`,className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5] font-mono`}),edBMax&&toWords(edBMax)&&(0,S.jsx)(`div`,{className:`mt-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold`,children:toWords(edBMax)})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`حداقل بودجه (تومان)`}),(0,S.jsx)(`input`,{type:`number`,inputMode:`numeric`,value:edBMin,onChange:ev=>setEdBMin(ev.target.value),placeholder:`مثلاً 3000000000`,className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5] font-mono`}),edBMin&&toWords(edBMin)&&(0,S.jsx)(`div`,{className:`mt-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold`,children:toWords(edBMin)})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`مناطق و محله‌های مورد نظر`}),(0,S.jsx)(`input`,{type:`text`,value:edAr,onChange:ev=>setEdAr(ev.target.value),placeholder:`مثلاً: عظیمیه، مهرشهر، گوهردشت`,className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{className:`block text-xs font-semibold text-slate-600 mb-1`,children:`یادداشت‌های پرونده`}),(0,S.jsx)(`textarea`,{rows:2,value:edNt,onChange:ev=>setEdNt(ev.target.value),placeholder:`توضیحات و اولویت‌های متقاضی...`,className:`w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-[#145DB5]`})]}),(0,S.jsxs)(`div`,{className:`flex items-center gap-2 pt-2 border-t border-slate-200`,children:[(0,S.jsx)(`button`,{type:`submit`,disabled:edLdg,className:`flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition disabled:opacity-50`,children:edLdg?`در حال ذخیره...`:`ذخیره تغییرات مشخصات متقاضی`}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>s(`REQUIREMENTS`),className:`px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition`,children:`انصراف`})]})]}),"""

targets = [
    'public/assets/index-app.js',
    'public/assets/index-C5RZm4w3.js'
]

for file_path in targets:
    if not os.path.exists(file_path):
        continue
    print(f"=== Adding Customer Edit to {file_path} ===")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Inject state hooks into tn
    tn_hook_target = "tn=({customer:e,properties:t,isOpen:n,onClose:r,onRefresh:i,onOpenQuickAddTask:a})=>{let[o,s]=(0,_.useState)(`REQUIREMENTS`),"
    if tn_hook_target in content and "onSaveCustomerEdit" not in content:
        content = content.replace(tn_hook_target, tn_hook_target + EDIT_STATE_CODE)
        print("  [+] Injected EDIT_STATE_CODE into tn")
    elif "onSaveCustomerEdit" in content:
        print("  [.] EDIT_STATE_CODE already injected")
    else:
        print("  [!] Error: tn_hook_target not found!")

    # 2. Add Edit button in header right next to WhatsApp button
    whatsapp_target = "(0,S.jsx)(Ie,{className:`w-3.5 h-3.5`}),(0,S.jsx)(`span`,{children:`واتس‌اپ`})]})]})]})"
    edit_header_btn = whatsapp_target + ",(0,S.jsxs)(`button`,{type:`button`,onClick:()=>s(o===`EDIT`?`REQUIREMENTS`:`EDIT`),className:`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition text-xs shrink-0 ${o===`EDIT`?`bg-amber-600 text-white border-amber-600`:`bg-white border-slate-300 text-slate-700 hover:border-[#145DB5] hover:text-[#145DB5]`}`,children:[(0,S.jsx)(`span`,{children:o===`EDIT`?`بازگشت`:`ویرایش متقاضی`})]})"
    if whatsapp_target in content and "ویرایش متقاضی" not in content:
        content = content.replace(whatsapp_target, edit_header_btn, 1)
        print("  [+] Injected Edit Customer button into header")
    elif "ویرایش متقاضی" in content:
        print("  [.] Edit button already injected into header")
    else:
        print("  [!] Error: whatsapp_target not found!")

    # 3. Add 6th tab to tabs bar (change grid-cols-5 to grid-cols-6)
    old_grid = "className:`grid grid-cols-5 border-b border-slate-100 bg-slate-50 text-[11px] font-bold`"
    new_grid = "className:`grid grid-cols-6 border-b border-slate-100 bg-slate-50 text-[11px] font-bold`"
    if old_grid in content:
        content = content.replace(old_grid, new_grid, 1)
        print("  [+] Changed tabs grid to grid-cols-6")

    # Add the edit tab button after the DOCUMENTS tab button
    docs_tab_target = "(0,S.jsx)(`button`,{onClick:()=>s(`DOCUMENTS`),className:`py-2 text-center transition flex items-center justify-center gap-1 ${o===`DOCUMENTS`?`bg-white text-[#145DB5] border-b-2 border-[#145DB5]`:`text-slate-600 hover:text-slate-900`}`,children:`مدارک`})"
    edit_tab_btn = docs_tab_target + ",(0,S.jsx)(`button`,{type:`button`,onClick:()=>s(`EDIT`),className:`py-2 text-center transition flex items-center justify-center gap-1 ${o===`EDIT`?`bg-white text-amber-700 border-b-2 border-amber-600 font-extrabold`:`text-slate-600 hover:text-slate-900`}`,children:`ویرایش`})"
    if docs_tab_target in content and "onClick:()=>s(`EDIT`)" not in content:
        content = content.replace(docs_tab_target, edit_tab_btn, 1)
        print("  [+] Added Edit tab button to tabs bar")

    # 4. Inject EDIT_FORM_JSX before o===`REQUIREMENTS`
    body_target = "overflow-y-auto flex-1 text-xs`,children:[o===`REQUIREMENTS`"
    new_body = "overflow-y-auto flex-1 text-xs`,children:[" + EDIT_FORM_JSX + "o===`REQUIREMENTS`"
    if body_target in content and "onSaveCustomerEdit" in content and "o===`EDIT`" not in content:
        content = content.replace(body_target, new_body, 1)
        print("  [+] Injected EDIT_FORM_JSX into modal body")
    elif "o===`EDIT`" in content:
        print("  [.] EDIT_FORM_JSX already injected")
    else:
        print("  [!] Error: body_target not found!")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"=== Saved {file_path} ===")

print("Customer edit patching complete!")
