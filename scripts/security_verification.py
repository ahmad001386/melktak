import os
import urllib.request
import urllib.error
import json
import http.cookiejar

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

print("=== شروع آزمون‌های امنیتی و اعتبارسنجی اصلاحات Amlak OS (P0-P3) ===")

# --- P0.1 Tests ---
# Test 1: Seeded demo superadmin cannot login through tenant login
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "superadmin",
    "password": "DemoPassword123!"
})
if status in [401, 403]:
    record("P0.1-A", "مسدودسازی ورود حساب دمو superadmin در احراز هویت آژانس", "PASS", f"Status: {status}, Error: {res.get('error', {}).get('code')}")
else:
    record("P0.1-A", "مسدودسازی ورود حساب دمو superadmin در احراز هویت آژانس", "FAIL", f"Unexpected status: {status}")

# Test 2: Unauthenticated direct access to platform metrics rejected
status, res = make_request("/api/v1/platform/metrics", method="GET")
if status == 401:
    record("P0.3-A", "رد دسترسی غیرمجاز به API متریک‌های پلتفرم", "PASS", f"Status: {status}, Code: {res.get('error', {}).get('code')}")
else:
    record("P0.3-A", "رد دسترسی غیرمجاز به API متریک‌های پلتفرم", "FAIL", f"Unexpected status: {status}")

# Test 3: Normal tenant admin cannot access platform APIs
cj_admin = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "admin",
    "password": "DemoPassword123!"
}, cookie_jar=cj_admin)
admin_token = res.get("data", {}).get("token")

status, res = make_request("/api/v1/platform/metrics", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
if status in [401, 403]:
    record("P0.3-B", "عدم دسترسی مدیر عادی دفتر (ADMIN) به API های مدیریت کلان پلتفرم", "PASS", f"Status: {status}, Code: {res.get('error', {}).get('code')}")
else:
    record("P0.3-B", "عدم دسترسی مدیر عادی دفتر (ADMIN) به API های مدیریت کلان پلتفرم", "FAIL", f"Tenant admin reached platform API! Status: {status}")

# --- P0.2 Platform Admin Auth Tests ---
cj_plat = http.cookiejar.CookieJar()
# First provision or check platform admin credentials
status, res = make_request("/api/v1/platform/auth/login", method="POST", data={
    "username": os.environ["PLATFORM_ADMIN_USERNAME"],
    "password": os.environ["PLATFORM_ADMIN_PASSWORD"]
}, cookie_jar=cj_plat)

if status != 200:
    status, res = make_request("/api/v1/platform/auth/login", method="POST", data={
        "username": os.environ["PLATFORM_ADMIN_USERNAME"],
        "password": "SuperSecurePlatformAdmin2026!"
    }, cookie_jar=cj_plat)

if status != 200:
    print(f"Platform admin login response: {status}, {res}")
    plat_token = None
else:
    plat_token = res.get("data", {}).get("token")
    record("P0.2-A", "احراز هویت اختصاصی مدیریت کلان پلتفرم (/api/v1/platform/auth/login)", "PASS", "نشست امن با موفقیت ایجاد شد.")

if plat_token:
    status, res = make_request("/api/v1/platform/metrics", method="GET", headers={"Authorization": f"Bearer {plat_token}"})
    if status == 200 and res.get("success"):
        record("P0.3-C", "دسترسی معتبر مدیر کلان پلتفرم به متریک‌ها و آژانس‌ها", "PASS", f"Tenants count: {res.get('data', {}).get('total_tenants')}")
    else:
        record("P0.3-C", "دسترسی معتبر مدیر کلان پلتفرم به متریک‌ها و آژانس‌ها", "FAIL", f"Status: {status}")

# --- P1 Multi-Branch Authorization Tests ---
# Test Agent transaction isolation
cj_agent = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "agent",
    "password": "DemoPassword123!"
}, cookie_jar=cj_agent)
agent_token = res.get("data", {}).get("token")

status, res = make_request("/api/v1/transactions", method="GET", headers={"Authorization": f"Bearer {agent_token}"})
if status == 200 and res.get("success"):
    txs = res.get("data", [])
    # Verify all returned transactions belong to this agent
    agent_id = "c1a11111-2222-3333-4444-555555555551"
    all_mine = all(t.get("agent_id") == agent_id for t in txs)
    record("P1.3-A", "محدودسازی لیست معاملات مشاور عادی فقط به معاملات خودش", "PASS" if all_mine else "FAIL", f"Total: {len(txs)}, All assigned: {all_mine}")
else:
    record("P1.3-A", "محدودسازی لیست معاملات مشاور عادی فقط به معاملات خودش", "FAIL", f"Status: {status}")

# Test Branch Manager performance report restricted
cj_mgr = http.cookiejar.CookieJar()
status, res = make_request("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "manager",
    "password": "DemoPassword123!"
}, cookie_jar=cj_mgr)
mgr_token = res.get("data", {}).get("token")

status, res = make_request("/api/v1/transactions/report/performance", method="GET", headers={"Authorization": f"Bearer {mgr_token}"})
if status == 200 and res.get("success"):
    record("P1.1-A", "دسترسی مدیر شعبه به گزارش عملکرد شعبه خود", "PASS", "گزارش عملکرد دریافت شد.")
else:
    record("P1.1-A", "دسترسی مدیر شعبه به گزارش عملکرد شعبه خود", "FAIL", f"Status: {status}")

# --- P2 Subscription Enforcement Tests ---
# Test self-service renewal is forbidden
status, res = make_request("/api/v1/agency/subscription/renew", method="POST", data={
    "plan_code": "ENTERPRISE_PRO",
    "duration_months": 12
}, headers={"Authorization": f"Bearer {admin_token}"})
if status == 403:
    record("P2.2-A", "مسدودسازی تمدید خودسرانه اشتراک توسط آژانس (/subscription/renew)", "PASS", f"Status: 403 FORBIDDEN, message: {res.get('error', {}).get('message')}")
else:
    record("P2.2-A", "مسدودسازی تمدید خودسرانه اشتراک توسط آژانس (/subscription/renew)", "FAIL", f"Unexpected status: {status}")

# --- P3 Controlled Read-Only Support Access Tests ---
if plat_token:
    tenant_id = "e2b17b3c-53f0-466d-9279-d102e5b7b001"
    # 1. Start support session
    status, res = make_request("/api/v1/platform/support/start", method="POST", data={
        "tenant_id": tenant_id,
        "reason": "بررسی مشکل ثبت فایل ملک توسط مشتری",
        "duration_minutes": 30
    }, headers={"Authorization": f"Bearer {plat_token}"})

    if status == 201 and res.get("success"):
        supp_session = res.get("data", {})
        session_id = supp_session.get("id")
        record("P3.1-A", "آغاز نشست پشتیبانی نظارتی توسط مدیر پلتفرم", "PASS", f"Session ID: {session_id}")

        # 2. Test READ access with x-support-session-id
        status, read_res = make_request("/api/v1/properties", method="GET", headers={"x-support-session-id": session_id})
        if status == 200 and read_res.get("success"):
            record("P3.2-A", "دسترسی خواندنی به پرونده‌های دفتر در حالت پشتیبانی", "PASS", f"Properties read: {len(read_res.get('data', []))}")
        else:
            record("P3.2-A", "دسترسی خواندنی به پرونده‌های دفتر در حالت پشتیبانی", "FAIL", f"Status: {status}")

        # 3. Test MUTATION (POST) is STRICTLY BLOCKED with 403 SUPPORT_READ_ONLY
        status, mut_res = make_request("/api/v1/properties", method="POST", data={
            "title": "ملک تستی نظارتی",
            "property_type": "APARTMENT",
            "listing_type": "SALE"
        }, headers={"x-support-session-id": session_id})
        if status == 403 and mut_res.get("error", {}).get("code") == "SUPPORT_READ_ONLY":
            record("P3.2-B", "مسدودسازی قطعی ثبت یا تغییر داده در حالت پشتیبانی (Read-Only Enforcement)", "PASS", f"Status: 403, Code: {mut_res.get('error', {}).get('code')}")
        else:
            record("P3.2-B", "مسدودسازی قطعی ثبت یا تغییر داده در حالت پشتیبانی (Read-Only Enforcement)", "FAIL", f"Mutation was not blocked! Status: {status}")

        # 4. End support session
        status, end_res = make_request("/api/v1/platform/support/end", method="POST", data={"session_id": session_id}, headers={"Authorization": f"Bearer {plat_token}"})
        if status == 200 and end_res.get("success"):
            record("P3.1-B", "خاتمه نشست پشتیبانی و باطل‌سازی دسترسی", "PASS", "نشست با موفقیت خاتمه یافت.")

        # 5. Subsequent access rejected
        status, after_res = make_request("/api/v1/properties", method="GET", headers={"x-support-session-id": session_id})
        if status == 403 and after_res.get("error", {}).get("code") == "SUPPORT_SESSION_INVALID":
            record("P3.1-C", "رد دسترسی پس از خاتمه نشست پشتیبانی", "PASS", "دسترسی مسدود گردید.")
        else:
            record("P3.1-C", "رد دسترسی پس از خاتمه نشست پشتیبانی", "FAIL", f"Status: {status}")
    else:
        record("P3.1-A", "آغاز نشست پشتیبانی نظارتی توسط مدیر پلتفرم", "FAIL", f"Status: {status}, {res}")

print("\n=== خلاصه نتایج ارزیابی امنیتی ===")
passed = sum(1 for r in results if r['status'] == 'PASS')
failed = sum(1 for r in results if r['status'] == 'FAIL')
print(f"کل آزمون‌ها: {len(results)} | موفق: {passed} | ناموفق: {failed}")
