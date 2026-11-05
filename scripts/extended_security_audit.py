import urllib.request
import urllib.error
import json
import http.cookiejar

BASE_URL = "http://localhost:3000"

def make_req(path, method="GET", data=None, headers=None, cookie_jar=None):
    url = BASE_URL + path
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar)) if cookie_jar else urllib.request.build_opener()
    try:
        with opener.open(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        try:
            return err.code, json.loads(body)
        except Exception:
            return err.code, {"raw": body}

results = []

def record(test_id, name, status, details=""):
    results.append({"id": test_id, "name": name, "status": status, "details": details})
    symbol = "✅" if status == "PASS" else "❌"
    print(f"{symbol} [{test_id}] {name}: {status} - {details}", flush=True)

print("=== شروع آزمون‌های تکمیلی امنیت، ایزولاسیون و کنترل دسترسی (Phase G Extension) ===", flush=True)

# 1. Login with Admin
cj_admin = http.cookiejar.CookieJar()
status, res = make_req("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "admin",
    "password": "DemoPassword123!"
}, cookie_jar=cj_admin)
admin_token = res.get("data", {}).get("token")

# 2. Login with Branch Manager
cj_mgr = http.cookiejar.CookieJar()
status, res = make_req("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "manager",
    "password": "DemoPassword123!"
}, cookie_jar=cj_mgr)
mgr_token = res.get("data", {}).get("token")

# 3. Login with Agent
cj_agent = http.cookiejar.CookieJar()
status, res = make_req("/api/v1/auth/login", method="POST", data={
    "agency_code": "DEMO01",
    "username": "agent",
    "password": "DemoPassword123!"
}, cookie_jar=cj_agent)
agent_token = res.get("data", {}).get("token")

# Test G.1: Query param token elimination (CWE-598)
# Passing token via query parameter ?token= must be rejected
status, res = make_req(f"/api/v1/properties?token={agent_token}", method="GET")
if status == 401:
    record("G.1-A", "حذف پذیرش توکن در URL Query Parameters جهت جلوگیری از نشت لاگ (CWE-598)", "PASS", "توکن در کوئری پارامتر رد شد (401)")
else:
    record("G.1-A", "حذف پذیرش توکن در URL Query Parameters جهت جلوگیری از نشت لاگ (CWE-598)", "FAIL", f"Status: {status}")

# Test G.2: Branch manager cannot modify agency settings (Admin-only privilege enforcement)
status, res = make_req("/api/v1/agency/settings", method="PATCH", data={
    "commission_rate_sale": 0.02
}, headers={"Authorization": f"Bearer {mgr_token}"})
if status == 403:
    record("G.2-A", "جلوگیری از تغییر تنظیمات سراسری دفتر توسط مدیر شعبه (Admin-Only Enforcement)", "PASS", f"Status: {status}, Code: {res.get('error', {}).get('code')}")
else:
    record("G.2-A", "جلوگیری از تغییر تنظیمات سراسری دفتر توسط مدیر شعبه (Admin-Only Enforcement)", "FAIL", f"Status: {status}")

# Test G.3: Branch manager cannot reset Admin password
admin_id = "c1a11111-2222-3333-4444-555555555553"
status, res = make_req(f"/api/v1/agency/agents/{admin_id}/reset-password", method="POST", data={
    "new_password": "HackedPassword123!"
}, headers={"Authorization": f"Bearer {mgr_token}"})
if status == 403:
    record("G.3-A", "مسدودسازی تلاش مدیر شعبه برای ریست رمز عبور مدیر ارشد (Privilege Escalation Defense)", "PASS", f"Status: {status}, Error: {res.get('error', {}).get('message')}")
else:
    record("G.3-A", "مسدودسازی تلاش مدیر شعبه برای ریست رمز عبور مدیر ارشد (Privilege Escalation Defense)", "FAIL", f"Status: {status}")

# Test G.4: Branch manager cannot create an ADMIN account
status, res = make_req("/api/v1/agency/agents", method="POST", data={
    "first_name": "تستی",
    "last_name": "نامعتبر",
    "phone": "09121234567",
    "username": "rogue_admin",
    "password": "RoguePassword123!",
    "role_code": "ADMIN"
}, headers={"Authorization": f"Bearer {mgr_token}"})
if status == 403:
    record("G.4-A", "جلوگیری از ایجاد حساب مدیر ارشد توسط مدیر شعبه", "PASS", f"Status: {status}, Message: {res.get('error', {}).get('message')}")
else:
    record("G.4-A", "جلوگیری از ایجاد حساب مدیر ارشد توسط مدیر شعبه", "FAIL", f"Status: {status}")

# Test G.5: Cross-tenant / invalid customer requirements rejection
fake_customer_id = "00000000-0000-0000-0000-000000000000"
status, res = make_req(f"/api/v1/customers/{fake_customer_id}/requirements", method="GET", headers={"Authorization": f"Bearer {admin_token}"})
if status == 404:
    record("G.5-A", "رد دسترسی به نیازهای متقاضی نامعتبر یا متعلق به دفتر دیگر (404 Isolation)", "PASS", f"Status: {status}")
else:
    record("G.5-A", "رد دسترسی به نیازهای متقاضی نامعتبر یا متعلق به دفتر دیگر (404 Isolation)", "FAIL", f"Status: {status}")

# Test G.6: Task creation with non-existent customer rejected
status, res = make_req("/api/v1/tasks", method="POST", data={
    "title": "پیگیری تستی بدون مشتری معتبر",
    "customer_id": fake_customer_id,
    "due_at": "2026-10-20T10:00:00Z",
    "priority": "HIGH",
    "type": "CALL"
}, headers={"Authorization": f"Bearer {admin_token}"})
if status == 404:
    record("G.6-A", "اعتبارسنجی ارجاع مشتری در ثبت پیگیری جدید (Foreign Key Tenant Boundary)", "PASS", f"Status: {status}")
else:
    record("G.6-A", "اعتبارسنجی ارجاع مشتری در ثبت پیگیری جدید (Foreign Key Tenant Boundary)", "FAIL", f"Status: {status}")

# Test G.7: Transaction creation with non-existent property rejected
fake_prop_id = "00000000-0000-0000-0000-000000000000"
status, res = make_req("/api/v1/transactions", method="POST", data={
    "property_id": fake_prop_id,
    "transaction_type": "SALE",
    "customer_name": "مشتری تستی",
    "final_price": 5000000000,
    "contract_date": "2026-10-15"
}, headers={"Authorization": f"Bearer {admin_token}"})
if status == 404:
    record("G.7-A", "اعتبارسنجی ملک در ثبت معامله (Transaction Property Boundary)", "PASS", f"Status: {status}")
else:
    record("G.7-A", "اعتبارسنجی ملک در ثبت معامله (Transaction Property Boundary)", "FAIL", f"Status: {status}")

print("\n=== خلاصه نتایج آزمون‌های تکمیلی فاز G ===", flush=True)
passed = sum(1 for r in results if r['status'] == 'PASS')
failed = sum(1 for r in results if r['status'] == 'FAIL')
print(f"کل آزمون‌ها: {len(results)} | موفق: {passed} | ناموفق: {failed}", flush=True)
