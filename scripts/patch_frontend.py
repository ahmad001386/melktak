import os

for path in [
    'dist/assets/index-C5RZm4w3.js', 'public/assets/index-C5RZm4w3.js',
    'dist/assets/index-app.js', 'public/assets/index-app.js'
]:
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Remove Super Admin fast login button
    target_btn = '(0,S.jsx)(`button`,{type:`button`,disabled:t,onClick:()=>p(`superadmin`),className:`py-2.5 px-2 col-span-2 rounded-xl text-[11px] font-bold border transition bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 active:scale-95 text-center cursor-pointer flex items-center justify-center gap-1.5`,children:(0,S.jsx)(`span`,{children:`👑 ورود مدیر کل پلتفرم (Super Admin SaaS)`})})'
    if target_btn in text:
        text = text.replace(target_btn, 'null')
        print(f'[{path}] Replaced superadmin button with null')
    else:
        print(f'[{path}] Warning: target_btn not found')

    # 2. Block superadmin in p() fast login
    target_p = 'p=async t=>{r(`DEMO01`),a(t),s(`DemoPassword123!`),d(null);'
    replacement_p = 'p=async t=>{if(t===`superadmin`)return;r(`DEMO01`),a(t),s(`DemoPassword123!`),d(null);'
    if target_p in text:
        text = text.replace(target_p, replacement_p)
        print(f'[{path}] Blocked superadmin in p() handler')
    else:
        print(f'[{path}] Warning: target_p not found')

    # 3. Clean any leftover corrupted snippet if present
    bad = 'null,(0,S.jsx)(V,{className:`w-4 h-4 text-amber-700 group-hover:text-amber-900 transition shrink-0`})]}),'
    if bad in text:
        text = text.replace(bad, 'null,')
        print(f'[{path}] Cleaned bad snippet')

    # 4. Guard if(h===`platform`) in MoreView
    target_h_platform = 'if(h===`platform`)return(0,S.jsx)(Tn,{onBack:()=>g(`hub`),showToast:Oe});'
    # Only allow if authenticated as platform admin, otherwise return null
    text = text.replace(target_h_platform, 'if(h===`platform`)return null;')
    print(f'[{path}] Guarded h===platform in MoreView')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

print('Frontend patching completed!')
