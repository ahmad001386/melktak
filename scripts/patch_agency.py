import re

with open('src/server/modules/agency/agency.routes.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Add subscription middleware import
if 'subscriptionEnforcementMiddleware' not in text:
    text = text.replace(
        'import{authMiddleware}from"../../middleware/auth.middleware.js";',
        'import{authMiddleware}from"../../middleware/auth.middleware.js";import{subscriptionEnforcementMiddleware}from"../../middleware/subscription.middleware.js";'
    )
    text = text.replace(
        'agencyRouter.use(authMiddleware);',
        'agencyRouter.use(authMiddleware);agencyRouter.use(subscriptionEnforcementMiddleware);'
    )

# Disallow self-service renewal
renewal_forbidden = 'agencyRouter.post("/subscription/renew",requireManagerRole,async(req,res)=>{return res.status(403).json({success:false,error:{code:"FORBIDDEN",message:"تمدید یا ارتقای پلن اشتراک تنها توسط مدیریت کلان پلتفرم امکان‌پذیر است. لطفاً جهت فعال‌سازی مجدد با پشتیبانی سامانه تماس حاصل فرمایید."}});});'

text = re.sub(
    r'agencyRouter\.post\(["\']/subscription/renew["\'].*?\}\);',
    renewal_forbidden,
    text
)

with open('src/server/modules/agency/agency.routes.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated agency.routes.ts successfully!')
