import os
import urllib.request
import urllib.error
import json
import http.cookiejar
import os

BASE_URL = "http://localhost:3000"

def make_request(path, method="GET", data=None, headers=None, cookie_jar=None):
    url = BASE_URL + path
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar)) if cookie_jar else urllib.request.build_opener()
    
    try:
        with opener.open(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        try:
            return err.code, json.loads(err_body)
        except Exception:
            return err.code, {"raw": err_body}

results = []

def record(test_id, name, status, details=""):
    results.append({"id": test_id, "name": name, "status": status, "details": details})
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} [{test_id}] {name}: {status} - {details}")

print("=== شروع آزمون‌های امنیتی و اعتبارسنجی فاز G — Amlak OS ===")

# -------------------------------------------------------------
# 1. AUTHENTICATION & LOGIN
# -------------------------------------------------------------
cj_admin = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "admin",
    "password": "DemoPassword123!"
}, cookie_jar=cj_admin)
admin_token = res.get("data", {}).get("token")
if status == 200 and admin_token:
    record("G.AUTH-1", "ورود موفق مدیر ارشد دفتر املاک (ADMIN)", "PASS", f"Token: {admin_token[:15]}...")
else:
    record("G.AUTH-1", "ورود موفق مدیر ارشد دفتر املاک (ADMIN)", "FAIL", f"Status: {status}, Response: {res}")

cj_mgr = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "manager",
    "password": "DemoPassword123!"
}, cookie_jar=cj_mgr)
mgr_token = res.get("data", {}).get("token")
if status == 200 and mgr_token:
    record("G.AUTH-2", "ورود موفق مدیر شعبه (BRANCH_MANAGER)", "PASS", f"Token: {mgr_token[:15]}...")
else:
    record("G.AUTH-2", "ورود موفق مدیر شعبه (BRANCH_MANAGER)", "FAIL", f"Status: {status}")

cj_agent = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "agent",
    "password": "DemoPassword123!"
}, cookie_jar=cj_agent)
agent_token = res.get("data", {}).get("token")
if status == 200 and agent_token:
    record("G.AUTH-3", "ورود موفق مشاور عادی (AGENT)", "PASS", f"Token: {agent_token[:15]}...")
else:
    record("G.AUTH-3", "ورود موفق مشاور عادی (AGENT)", "FAIL", f"Status: {status}")

# -------------------------------------------------------------
# 2. PROHIBITION OF SESSION TOKENS IN URL QUERY STRINGS (CWE-598)
# -------------------------------------------------------------
status, res = make_request(f"/api/v1/auth/me?token={admin_token}", method="GET")
if status == 401:
    record("G.AUTH-4", "مسدودسازی ارسال توکن نشست کاربری در پارامتر URL (?token=...)", "PASS", f"Status: {status}, Code: {res.get('error', {}).get('code')}")
else:
    record("G.AUTH-4", "مسدودسازی ارسال توکن نشست کاربری در پارامتر URL (?token=...)", "FAIL", f"Query token was improperly accepted! Status: {status}")

# -------------------------------------------------------------
# 3. TENANT ISOLATION & CROSS-ENTITY INJECTION PREVENTIONS
# -------------------------------------------------------------
fake_owner_id = "a0000000-0000-4000-8000-000000000999"
status, prop_res = make_request("/api/v1/properties", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
properties = prop_res.get("data", [])
prop_id = properties[0]["id"] if properties else "00000000-0000-0000-0000-000000000001"

status, res = make_request(f"/api/v1/properties/{prop_id}/owners", method="POST", data={
    "owner_id": fake_owner_id,
    "ownership_percentage": 50,
    "is_primary_owner": False
}, headers={"Authorization": f"Bearer {admin_token}"})

if status == 404 and res.get("error", {}).get("code") == "OWNER_NOT_FOUND":
    record("G.TENANT-1", "رد اتصال مالک نامعتبر یا متعلق به آژانس دیگر به ملک (Cross-Tenant Link Blocked)", "PASS", f"Status: 404, Code: {res.get('error', {}).get('code')}")
else:
    record("G.TENANT-1", "رد اتصال مالک نامعتبر یا متعلق به آژانس دیگر به ملک (Cross-Tenant Link Blocked)", "FAIL", f"Status: {status}, Response: {res}")

fake_customer_id = "a0000000-0000-4000-8000-000000000888"
status, res = make_request(f"/api/v1/customers/{fake_customer_id}/requirements", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
if status == 404 and res.get("error", {}).get("code") == "CUSTOMER_NOT_FOUND":
    record("G.TENANT-2", "رد دسترسی به نیازمندی‌های مشتری ناموجود یا آژانس دیگر (Customer Requirements IDOR Guard)", "PASS", f"Status: 404, Code: {res.get('error', {}).get('code')}")
else:
    record("G.TENANT-2", "رد دسترسی به نیازمندی‌های مشتری ناموجود یا آژانس دیگر (Customer Requirements IDOR Guard)", "FAIL", f"Status: {status}, Response: {res}")

status, res = make_request(f"/api/v1/customers/{fake_customer_id}/timeline", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
if status == 404 and res.get("error", {}).get("code") == "CUSTOMER_NOT_FOUND":
    record("G.TENANT-3", "رد دسترسی به سوابق و تایم‌لاین مشتری نامعتبر (Customer Timeline IDOR Guard)", "PASS", f"Status: 404, Code: {res.get('error', {}).get('code')}")
else:
    record("G.TENANT-3", "رد دسترسی به سوابق و تایم‌لاین مشتری نامعتبر (Customer Timeline IDOR Guard)", "FAIL", f"Status: {status}, Response: {res}")

status, res = make_request("/api/v1/tasks", method="POST", data={
    "title": "تماس پیگیری آزمایشی",
    "customer_id": fake_customer_id,
    "due_at": "2026-10-15T15:00:00Z",
    "type": "CALL",
    "priority": "HIGH"
}, headers={"Authorization": f"Bearer {admin_token}"})

if status == 404 and res.get("error", {}).get("code") == "CUSTOMER_NOT_FOUND":
    record("G.TENANT-4", "رد ثبت وظیفه/پیگیری با شناسه مشتری خارجی یا نامعتبر (Cross-Tenant Task Foreign Key Blocked)", "PASS", f"Status: 404, Code: {res.get('error', {}).get('code')}")
else:
    record("G.TENANT-4", "رد ثبت وظیفه/پیگیری با شناسه مشتری خارجی یا نامعتبر (Cross-Tenant Task Foreign Key Blocked)", "FAIL", f"Status: {status}, Response: {res}")

status, res = make_request("/api/v1/transactions", method="POST", data={
    "property_id": prop_id,
    "transaction_type": "SALE",
    "customer_id": fake_customer_id,
    "customer_name": "مشتری غیرمجاز",
    "contract_date": "2026-10-14T10:00:00Z",
    "final_price": 5000000000
}, headers={"Authorization": f"Bearer {admin_token}"})

if status == 404 and res.get("error", {}).get("code") == "CUSTOMER_NOT_FOUND":
    record("G.TENANT-5", "رد ثبت معامله با شناسه متقاضی متعلق به آژانس دیگر یا نامعتبر (Transaction Customer Guard)", "PASS", f"Status: 404, Code: {res.get('error', {}).get('code')}")
else:
    record("G.TENANT-5", "رد ثبت معامله با شناسه متقاضی متعلق به آژانس دیگر یا نامعتبر (Transaction Customer Guard)", "FAIL", f"Status: {status}, Response: {res}")

# -------------------------------------------------------------
# 4. MULTI-BRANCH PRIVILEGE ESCALATION & AUTHORIZATION BOUNDARIES
# -------------------------------------------------------------
status, res = make_request("/api/v1/agency/settings", method="PATCH", data={
    "name": "نام آژانس تغییر یافته توسط مدیر شعبه"
}, headers={"Authorization": f"Bearer {mgr_token}"})

if status == 403 and res.get("error", {}).get("code") == "FORBIDDEN":
    record("G.RBAC-1", "مسدودسازی تغییر تنظیمات کلان آژانس توسط مدیر شعبه (Admin-Only Settings)", "PASS", f"Status: 403, Message: {res.get('error', {}).get('message')}")
else:
    record("G.RBAC-1", "مسدودسازی تغییر تنظیمات کلان آژانس توسط مدیر شعبه (Admin-Only Settings)", "FAIL", f"Status: {status}, Response: {res}")

status, res = make_request("/api/v1/agency/agents", method="POST", data={
    "username": "escalated_admin",
    "password": "EscalatedPassword123!",
    "first_name": "مدیر",
    "last_name": "جعلی",
    "phone": "09129999991",
    "role_code": "ADMIN"
}, headers={"Authorization": f"Bearer {mgr_token}"})

if status == 403 and res.get("error", {}).get("code") == "FORBIDDEN":
    record("G.RBAC-2", "مسدودسازی ارتقای سطح دسترسی و ایجاد نقش ADMIN توسط مدیر شعبه", "PASS", f"Status: 403, Code: {res.get('error', {}).get('code')}")
else:
    record("G.RBAC-2", "مسدودسازی ارتقای سطح دسترسی و ایجاد نقش ADMIN توسط مدیر شعبه", "FAIL", f"Privilege escalation allowed! Status: {status}, Response: {res}")

status, agents_res = make_request("/api/v1/agency/agents", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
agents = agents_res.get("data", [])
admin_user = next((a for a in agents if a.get("role_code") == "ADMIN"), None)
admin_user_id = admin_user["id"] if admin_user else None

if admin_user_id:
    status, res = make_request(f"/api/v1/agency/agents/{admin_user_id}/reset-password", method="POST", data={
        "password": "HackedPassword123!"
    }, headers={"Authorization": f"Bearer {mgr_token}"})

    if status == 403 and res.get("error", {}).get("code") == "FORBIDDEN":
        record("G.RBAC-3", "مسدودسازی بازنشانی رمز عبور مدیر ارشد توسط مدیر شعبه", "PASS", f"Status: 403, Code: {res.get('error', {}).get('code')}")
    else:
        record("G.RBAC-3", "مسدودسازی بازنشانی رمز عبور مدیر ارشد توسط مدیر شعبه", "FAIL", f"Status: {status}, Response: {res}")

    status, res = make_request(f"/api/v1/agency/agents/{admin_user_id}/status", method="PATCH", data={
        "is_active": False
    }, headers={"Authorization": f"Bearer {mgr_token}"})

    if status == 403 and res.get("error", {}).get("code") == "FORBIDDEN":
        record("G.RBAC-4", "مسدودسازی غیرفعال‌کردن حساب مدیر ارشد توسط مدیر شعبه", "PASS", f"Status: 403, Code: {res.get('error', {}).get('code')}")
    else:
        record("G.RBAC-4", "مسدودسازی غیرفعال‌کردن حساب مدیر ارشد توسط مدیر شعبه", "FAIL", f"Status: {status}, Response: {res}")

# -------------------------------------------------------------
# 5. PLATFORM ADMINISTRATION SECURITY
# -------------------------------------------------------------
cj_plat = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/platform/auth/login", method="POST", data={
    "username": os.environ["PLATFORM_ADMIN_USERNAME"],
    "password": os.environ["PLATFORM_ADMIN_PASSWORD"]
}, cookie_jar=cj_plat)

if status != 200:
    status, res = make_request("/api/v1/platform/auth/login", method="POST", data={
        "username": os.environ["PLATFORM_ADMIN_USERNAME"],
        "password": "SuperSecurePlatformAdmin2026!"
    }, cookie_jar=cj_plat)

plat_token = res.get("data", {}).get("token")
if status == 200 and plat_token:
    record("G.PLAT-1", "ورود امن به پنل مدیریت کلان پلتفرم با توکن اختصاصی", "PASS", f"Token: {plat_token[:15]}...")
else:
    record("G.PLAT-1", "ورود امن به پنل مدیریت کلان پلتفرم با توکن اختصاصی", "FAIL", f"Status: {status}")

status, res = make_request(f"/api/v1/platform/metrics?token={plat_token}", method="GET")
if status == 401:
    record("G.PLAT-2", "مسدودسازی ارسال توکن مدیریت پلتفرم در پارامتر URL (?token=...)", "PASS", f"Status: 401, Error: {res.get('error', {}).get('code')}")
else:
    record("G.PLAT-2", "مسدودسازی ارسال توکن مدیریت پلتفرم در پارامتر URL (?token=...)", "FAIL", f"Platform query token accepted! Status: {status}")

status, res = make_request("/api/v1/platform/metrics", method="GET", headers={"Authorization": f"Bearer {plat_token}"})
if status == 200 and res.get("success"):
    record("G.PLAT-3", "دسترسی معتبر به متریک‌های پلتفرم از طریق Authorization: Bearer", "PASS", f"Tenants count: {res.get('data', {}).get('total_tenants')}")
else:
    record("G.PLAT-3", "دسترسی معتبر به متریک‌های پلتفرم از طریق Authorization: Bearer", "FAIL", f"Status: {status}")

# -------------------------------------------------------------
# 6. RATE LIMITING HARDENING VERIFICATION
# -------------------------------------------------------------
rl_status = None
rl_res = None
for i in range(8):
    rl_status, rl_res = make_request("/api/v1/auth/login", method="POST", data={
        "agency_code": "DEMO01",
        "username": "ratelimit_target_user",
        "password": "WrongPassword123!"
    })
    if rl_status == 429:
        break

if rl_status == 429 and rl_res.get("error", {}).get("code") == "RATE_LIMITED":
    record("G.RATE-1", "اعمال محدودساز نرخ درخواست‌ها (Rate Limiter) در برابر حملات جستجوی فراگیر", "PASS", f"Triggered 429 RATE_LIMITED: {rl_res.get('error', {}).get('message')}")
else:
    record("G.RATE-1", "اعمال محدودساز نرخ درخواست‌ها (Rate Limiter) در برابر حملات جستجوی فراگیر", "FAIL", f"Last status: {rl_status}, Response: {rl_res}")

print("\n=== خلاصه نتایج ارزیابی فاز G ===")
passed = sum(1 for r in results if r['status'] == 'PASS')
failed = sum(1 for r in results if r['status'] == 'FAIL')
print(f"کل آزمون‌ها: {len(results)} | موفق: {passed} | ناموفق: {failed}")

if failed == 0:
    print("🎉 تمامی آزمون‌های امنیتی و اعتبارسنجی فاز G با موفقیت ۱۰۰٪ پاس شدند!")
