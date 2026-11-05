import { seedDemoData } from './fixtures/demo-data.js';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PGlite } from '@electric-sql/pglite';
import { postgresDb as db } from '../src/server/db/postgres.js';
import { authRouter } from '../src/server/modules/auth/auth.routes.js';
import { agentRouter } from '../src/server/modules/agent/agent.routes.js';
import { tasksRouter } from '../src/server/modules/tasks/tasks.routes.js';
import { propertiesRouter } from '../src/server/modules/properties/properties.routes.js';
import { transactionsRouter } from '../src/server/modules/transactions/transactions.routes.js';
import { errorMiddleware } from '../src/server/middleware/error.middleware.js';
import { taskSchedule } from '../src/shared/task-schedule.js';

let server: ReturnType<express.Express['listen']>;
let base: string, admin: any, agent: any, property: any, customer: any;
async function request(path: string, method = 'GET', body?: any, token = admin?.token) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, ...await response.json() };
}
before(async () => {
  // In-memory database: tests never initialize, reset, or mutate tracked data/.
  db.pg = new PGlite();
  db.isInitialized = true;
  await db.applyMigrations();
  await seedDemoData.call(db);
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/auth', authRouter);
  app.use('/home', agentRouter);
  app.use('/tasks', tasksRouter);
  app.use('/properties', propertiesRouter);
  app.use('/transactions', transactionsRouter);
  app.use(errorMiddleware);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  const login = async (username: string) => {
    const result = await request('/auth/login', 'POST', { agency_code: 'DEMO01', username, password: 'DemoPassword123!' }, '');
    assert.equal(result.status, 200);
    return result.data;
  };
  admin = await login('admin');
  agent = await login('agent');
  property = (await request('/properties?status=active&limit=1')).data[0];
  customer = (await db.getCustomers(admin.tenant.id))[0];
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  await db.pg.close();
});

test('Tehran day boundaries include earlier today, exclude tomorrow, and retain all open overdue statuses', () => {
  const now = new Date('2026-10-20T20:29:00Z'); // 23:59 Tehran
  const tasks = [
    { id: 'early', status: 'PENDING', due_at: '2026-10-19T21:00:00Z' },
    { id: 'past', status: 'TODO', due_at: '2026-10-18T12:00:00Z' },
    { id: 'future', status: 'TODO', due_at: '2026-10-20T20:31:00Z', type: 'VISIT' },
    { id: 'done', status: 'COMPLETED', due_at: '2026-10-20T08:00:00Z', type: 'VISIT' },
    { id: 'cancelled', status: 'CANCELLED', due_at: '2026-10-20T08:00:00Z' }
  ];
  const result = taskSchedule(tasks, now);
  assert.deepEqual(result.todayTasks.map(t => t.id), ['early']);
  assert.deepEqual(result.overdueTasks.map(t => t.id), ['past', 'early']);
  assert.deepEqual(result.upcomingVisits.map(t => t.id), ['future']);
});

test('Home and task endpoints render persisted visits and overdue tasks with consistent role scope', async () => {
  const old = await db.createTask(admin.tenant.id, agent.user.id, {
    title: 'پیگیری گذشته آزمایشی', due_at: new Date(Date.now() - 86400000).toISOString(), status: 'PENDING'
  });
  const visit = await db.createTask(admin.tenant.id, agent.user.id, {
    title: 'بازدید آینده آزمایشی', type: 'VISIT', due_at: new Date(Date.now() + 3600000).toISOString(),
    property_id: property.id, customer_id: customer.id
  });
  const home = await request('/home/home');
  assert.equal(home.status, 200);
  assert(home.data.overdueTasks.some(t => t.id === old.id));
  assert(home.data.upcomingVisits.some(t => t.id === visit.id && t.scheduled_at === t.due_at && t.property_code));
  assert.equal(home.data.metrics.upcoming_visits_count, home.data.upcomingVisits.length);
  const today = await request('/tasks/today');
  const overdue = await request('/tasks/overdue');
  assert.deepEqual(today.data.map(t => t.id).sort(), home.data.todayTasks.map(t => t.id).sort());
  assert(overdue.data.some(t => t.id === old.id));
  const agentHome = await request('/home/home', 'GET', undefined, agent.token);
  assert(agentHome.data.overdueTasks.every(t => t.assigned_user_id === agent.user.id));
  const agentList = await request('/tasks', 'GET', undefined, agent.token);
  assert(agentList.data.every(t => t.assigned_user_id === agent.user.id));
});

test('Property pagination reaches beyond 200 records, keeps a stable order, and counts filtered results', async () => {
  // Fixtures use the repository method, not a mock of pagination.
  for (let index = 0; index < 205; index++) await db.createProperty(admin.tenant.id, admin.user.id, {
    title: `ملک صفحه‌بندی ${index}`, property_type: 'APARTMENT', listing_type: 'SALE', area_sqm: 100,
    neighborhood: 'محله آزمایشی', bedrooms: index % 2 ? 4 : 5, visibility: 'AGENCY'
  }, 'ADMIN');
  const query = '/properties?status=active&search=' + encodeURIComponent('ملک صفحه‌بندی') + '&limit=10';
  const first = await request(query + '&page=1');
  const last = await request(query + '&page=21');
  assert.equal(first.meta.total, 205);
  assert.equal(first.meta.total_pages, 21);
  assert.equal(first.data.length, 10);
  assert.equal(last.data.length, 5);
  const ids = new Set<string>();
  for (let page = 1; page <= 21; page++) {
    for (const item of (await request(query + `&page=${page}`)).data) {
      assert(!ids.has(item.id)); ids.add(item.id);
    }
  }
  assert.equal(ids.size, 205);
  assert.equal((await request(query + '&bedrooms=4')).meta.total, 205);
  assert.equal((await request(query + '&bedrooms=ALL&visibility=ALL&property_status=ALL&min_price=&has_parking=false')).meta.total, 205);
  assert.equal((await request(query + '&property_status=ARCHIVED')).meta.total, 0);
});

test('Property status changes persist archive flags and restore via both profile and status endpoints', async () => {
  const id = property.id;
  let result = await request(`/properties/${id}`, 'PATCH', { status: 'ARCHIVED' });
  assert.equal(result.status, 200);
  assert.equal(result.data.is_archived, true);
  assert(result.data.archived_at);
  assert((await request('/properties?status=archived&search=' + property.code)).data.some(p => p.id === id));
  assert.equal((await request('/properties?status=active&search=' + property.code)).meta.total, 0);
  result = await request(`/properties/${id}/status`, 'PATCH', { status: 'AVAILABLE' });
  assert.equal(result.data.status, 'ACTIVE');
  assert.equal(result.data.is_archived, false);
  assert.equal(result.data.archived_at, null);
  assert.equal((await request(`/properties/${id}/status`, 'PATCH', { status: 'INVALID' })).status, 400);
  await request(`/properties/${id}/status`, 'PATCH', { status: 'ARCHIVED' });
  assert.equal((await request(`/properties/${id}`, 'PATCH', { status: 'ACTIVE' })).data.is_archived, false);
});

async function newDeal(extra = {}) {
  const result = await request('/transactions', 'POST', {
    property_id: property.id, transaction_type: 'SALE', customer_name: 'خریدار آزمایشی',
    final_price: 1000000, contract_date: new Date().toISOString(), ...extra
  });
  assert.equal(result.status, 201, JSON.stringify(result.error));
  return result.data;
}
test('Transactions persist every editable field, clear nullable fields, validate references and protect access', async () => {
  const deal = await newDeal();
  const changed = await request(`/transactions/${deal.id}`, 'PATCH', {
    transaction_type: 'RENT', customer_id: customer.id, customer_name: 'مستاجر جدید', customer_phone: '09120000001',
    owner_name: 'مالک جدید', owner_phone: '09120000002', final_price: null, deposit_amount: 0,
    rent_amount: 500000, notes: 'شرط جدید', contract_date: '2026-10-15T00:00:00.000Z', status: 'CANCELLED'
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.error));
  for (const [key, value] of Object.entries({ transaction_type: 'RENT', customer_id: customer.id,
    customer_name: 'مستاجر جدید', customer_phone: '09120000001', owner_name: 'مالک جدید',
    owner_phone: '09120000002', rent_amount: 500000, notes: 'شرط جدید', status: 'CANCELLED' })) assert.equal(changed.data[key], value);
  assert.equal(changed.data.deposit_amount, 0);
  assert.equal(new Date(changed.data.contract_date).toISOString(), '2026-10-15T00:00:00.000Z');
  const cleared = await request(`/transactions/${deal.id}`, 'PATCH', { customer_id: null, customer_phone: null, notes: null });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.error));
  assert.equal(cleared.data.notes, null);
  assert.equal(cleared.data.customer_id, null);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { transaction_type: 'SALE', final_price: 0 })).status, 400);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { contract_date: 'not-a-date' })).status, 400);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { agent_id: '00000000-0000-4000-8000-000000000999' })).status, 403);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { customer_id: '00000000-0000-4000-8000-000000000999' })).status, 404);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { notes: 'forbidden' }, agent.token)).status, 404);
  assert.equal((await request(`/transactions/${deal.id}`, 'DELETE', undefined, agent.token)).status, 404);
});

test('Deleting and cancelling contracts keeps other completed contracts closed and preserves manual archives', async () => {
  const first = await newDeal();
  const second = await newDeal();
  assert.equal((await request(`/transactions/${first.id}`, 'DELETE')).status, 200);
  assert.equal((await request(`/properties/${property.id}`)).data.status, 'DEAL');
  assert.equal((await request(`/transactions/${first.id}`)).status, 404);
  assert(!(await request('/transactions')).data.some(t => t.id === first.id));
  assert.equal((await request(`/transactions/${second.id}`, 'PATCH', { status: 'CANCELLED' })).status, 200);
  assert.equal((await request(`/properties/${property.id}`)).data.status, 'ACTIVE');
  await request(`/transactions/${second.id}`, 'PATCH', { status: 'COMPLETED' });
  await request(`/properties/${property.id}/status`, 'PATCH', { status: 'ARCHIVED' });
  await request(`/transactions/${second.id}`, 'DELETE');
  const archived = (await request(`/properties/${property.id}`)).data;
  assert.equal(archived.status, 'ARCHIVED');
  assert.equal(archived.is_archived, true);
  assert.equal((await request(`/transactions/${second.id}`, 'DELETE')).status, 404);
});

test('Changing a contract property synchronizes both properties and rejects cross-tenant references', async () => {
  const records = (await request('/properties?status=active&limit=2')).data;
  const from = records[0], to = records[1];
  const deal = await newDeal({ property_id: from.id, agent_id: agent.user.id });
  const result = await request(`/transactions/${deal.id}`, 'PATCH', { property_id: to.id });
  assert.equal(result.status, 200);
  assert.equal(result.data.property_id, to.id);
  assert.equal((await request(`/properties/${from.id}`)).data.status, 'ACTIVE');
  assert.equal((await request(`/properties/${to.id}`)).data.status, 'DEAL');
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { notes: 'ویرایش مشاور' }, agent.token)).status, 200);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { agent_id: admin.user.id }, agent.token)).status, 403);
  const tenantId = crypto.randomUUID(), userId = crypto.randomUUID();
  await db.pg.query(`INSERT INTO tenants (id, agency_code, name, slug) VALUES ($1, $2, 'دفتر آزمایشی', $2)`, [tenantId, tenantId]);
  await db.pg.query(`INSERT INTO users (id, tenant_id, username, password_hash, first_name, last_name, display_name)
    VALUES ($1, $2, 'fixture', 'unused', 'کاربر', 'آزمایشی', 'کاربر آزمایشی')`, [userId, tenantId]);
  const foreign = await db.createProperty(tenantId, userId, {
    title: 'ملک دفتر دیگر', property_type: 'APARTMENT', listing_type: 'SALE', area_sqm: 90, neighborhood: 'تهران'
  }, 'ADMIN');
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { property_id: foreign.id })).status, 404);
  assert.equal((await request(`/transactions/${deal.id}`, 'PATCH', { agent_id: userId })).status, 403);
  assert.equal((await request(`/transactions/${deal.id}`, 'DELETE', undefined, agent.token)).status, 200);
  assert.equal((await request(`/properties/${to.id}`)).data.status, 'ACTIVE');
});

test('PWA prompt is captured before More mounts, and installing clears the retained event', () => {
  const events: Record<string, Function[]> = {};
  const window = { addEventListener: (name: string, fn: Function) => (events[name] ||= []).push(fn),
    dispatchEvent: (event: Event) => events[event.type]?.forEach(fn => fn(event)), isSecureContext: true };
  vm.runInNewContext(fs.readFileSync('public/registerSW.js', 'utf8'), { window, navigator: {}, Event, console });
  let prevented = false;
  const prompt = { type: 'beforeinstallprompt', preventDefault: () => { prevented = true; } };
  window.dispatchEvent(prompt as any);
  assert(prevented);
  assert.equal((window as any).melktakInstallPrompt, prompt);
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal((window as any).melktakInstallPrompt, null);
  assert.equal((window as any).melktakAppInstalled, true);
});

test('Service Worker bypasses authenticated APIs, uploads, third parties and non-shell navigations', () => {
  const listeners: Record<string, Function> = {};
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { addEventListener: (name: string, fn: Function) => listeners[name] = fn, location: { origin: 'https://melktak.test' } }, URL, Set
  });
  for (const [url, mode = 'cors', method = 'GET'] of [
    ['https://melktak.test/api/v1/properties'], ['https://melktak.test/uploads/document.pdf'],
    ['https://example.com/image.png'], ['https://melktak.test/platform', 'navigate'],
    ['https://melktak.test/shared/property/token', 'navigate'], ['https://melktak.test/', 'cors', 'POST']
  ]) {
    let intercepted = false;
    listeners.fetch({ request: { url, mode, method }, respondWith: () => intercepted = true });
    assert.equal(intercepted, false, url);
  }
  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.lang, 'fa-IR'); assert.equal(manifest.dir, 'rtl');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(i => i.sizes === `${size}x${size}`);
    const png = fs.readFileSync('public' + icon.src);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
