# ملک تک
 
سامانه مدیریت املاک، مشتریان و قراردادها با React، Express و PGlite.
 
## اجرا
 
Node.js 24 لازم است.
 
```bash
npm ci --include=dev
cp .env.example .env
```
 
تنظیمات خصوصی `.env` را تکمیل کنید. برای توسعه `NODE_ENV=development` و برای تولید `NODE_ENV=production` انتخاب کنید. برنامه حساب و داده نمونه نمی‌سازد؛ داده نمونه فقط در ابزار تست جداگانه وجود دارد.
 
```bash
npm run dev
```
 
برای تولید:
 
```bash
npm run build
npm start
```
 
[راهنمای VPS، هاست، دامنه و بکاپ](DEPLOYMENT.fa.md) شامل تنظیمات مدیر پلتفرم و مسیر خصوصی پنل است. هیچ رمز یا `.env` واقعی را وارد Git نکنید. حساب‌های نمونه شناخته‌شده نصب قدیمی بدون حذف سوابق مرتبط، غیرفعال و بی‌نام می‌شوند.
 
## بررسی‌ها
 
```bash
npm run lint
node --import tsx --test scripts/production-security.test.ts scripts/production-startup.test.ts scripts/crm-regression.test.ts
```
 
تست‌ها از دیتابیس موقت استفاده می‌کنند. پرداخت واقعی و اتصال PostgreSQL مستقل هنوز پیاده‌سازی نشده‌اند.
 
## اجرای Docker
 
راهنمای ساخت، تنظیم محیط، دامنه و پشتیبان‌گیری: [DOCKER.fa.md](DOCKER.fa.md).
