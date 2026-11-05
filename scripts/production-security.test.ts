import assert from 'node:assert/strict';
import { test, after, before } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { getPlatformPath, getPlatformCredentials, platformAdminAllowed } from '../src/server/config/runtime.js';
import { postgresDb as db } from '../src/server/db/postgres.js';
import { platformRouter } from '../src/server/modules/platform/platform.routes.js';
import { healthRouter } from '../src/server/modules/health/health.routes.js';
import { subscriptionEnforcementMiddleware } from '../src/server/middleware/subscription.middleware.js';
import { errorMiddleware } from '../src/server/middleware/error.middleware.js';
let server: any, base: string;
const password = crypto.randomBytes(24).toString('hex');
before(async () => {
  db.pg = new PGlite(); db.isInitialized = true;
  await db.applyMigrations();
  const app = express(); app.use(express.json(), cookieParser());
  app.use('/platform', platformRouter); app.use('/health', healthRouter);
  app.get('/subscription', (req: any, res, next) => { req.tenant = {subscription_status: 'EXPIRED'}; next(); }, subscriptionEnforcementMiddleware, (req, res) => res.sendStatus(200));
  app.use(errorMiddleware);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(r)); await db.pg.close(); });
test('production requires credentials and a literal non-default path', () => {
  assert.throws(() => getPlatformCredentials({NODE_ENV:'production'}));
  assert.throws(() => getPlatformPath({NODE_ENV:'production'}));
  for (const value of ['/platform', '/a/b', '/<script>alert(1)</script>', '/api-secret123456789']) assert.throws(() => getPlatformPath({PLATFORM_PATH:value}));
  assert.equal(getPlatformPath({PLATFORM_PATH:'/office-83a74b792fd39a7a'}),'/office-83a74b792fd39a7a');
  assert.equal(getPlatformCredentials({NODE_ENV:'test'}),null);
});
test('bootstrap creates no default account; environment rotates password and revokes sessions', async () => {
  delete process.env.PLATFORM_ADMIN_USERNAME; delete process.env.PLATFORM_ADMIN_PASSWORD;
  await db.bootstrapPlatformAdminIfConfigured();
  assert.equal((await db.pg.query('SELECT * FROM platform_admins')).rows.length,0);
  process.env.PLATFORM_ADMIN_USERNAME='security_test'; process.env.PLATFORM_ADMIN_PASSWORD=password;
  await db.bootstrapPlatformAdminIfConfigured();
  const admin = await db.getPlatformAdminByUsername('security_test');
  const token = await db.createPlatformSession(admin.id,'127.0.0.1','test');
  assert.ok(await db.getPlatformSessionByToken(token));
  process.env.PLATFORM_ADMIN_PASSWORD=crypto.randomBytes(24).toString('hex');
  await db.bootstrapPlatformAdminIfConfigured();
  assert.equal(await db.getPlatformSessionByToken(token),null);
  process.env.PLATFORM_ADMIN_PASSWORD=password; await db.bootstrapPlatformAdminIfConfigured();
});
test('platform requires its own session; forged forwarding headers do not bypass login limit', async () => {
  assert.equal((await fetch(base+'/platform/tenants')).status,401);
  for(let i=0;i<6;i++) {
    const response=await fetch(base+'/platform/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':`192.0.2.${i}`},body:JSON.stringify({username:'unknown_user',password:'incorrect-password'})});
    assert.equal(response.status,i<5?401:429);
  }
  const response=await fetch(base+'/platform/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'security_test',password})});
  assert.equal(response.status,200); assert.match(response.headers.get('set-cookie')!,/HttpOnly/);
});
test('production refuses legacy platform identities and their existing sessions', async () => {
  const legacy=await db.createPlatformAdmin({username:'legacy_admin',password_hash:bcrypt.hashSync(password,10),display_name:'Test legacy'});
  const token=await db.createPlatformSession(legacy.id,'127.0.0.1','test');
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try {
    assert.equal(platformAdminAllowed('legacy_admin'), false); assert.equal(platformAdminAllowed('security_test'), true);
    const login=await fetch(base+'/platform/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'legacy_admin',password})});
    assert.equal(login.status,401);
    assert.equal((await fetch(base+'/platform/tenants',{headers:{Authorization:`Bearer ${token}`}})).status,401);
  } finally { if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old; }
});
test('expired subscription is blocked even without expiration date', async()=>{assert.equal((await fetch(base+'/subscription')).status,403);});
test('health reports unavailable database without leaking internal errors', async()=>{
  const original=db.init;db.init=async()=>{throw new Error('private internal path');};
  try {const r=await fetch(base+'/health');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private internal/);}finally{db.init=original;}
});
test('failed database initialization preserves files and never falls back to memory', async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'melktak-failure-')); const old=process.env.DATA_DIR;process.env.DATA_DIR=root;
  const instance=new (db.constructor as any)();
  instance.applyMigrations=async()=>{await writeFile(path.join(root,'amlak_postgres','preserve-marker'),'keep');throw new Error('migration failure');};
  try {await assert.rejects(instance.init(),/migration failure/);assert.equal(instance.isInitialized,false);assert.equal(await readFile(path.join(root,'amlak_postgres','preserve-marker'),'utf8'),'keep');}
  finally{if(old===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=old;await rm(root,{recursive:true,force:true});}
});
test('public login bundle contains no demo credentials or quick-login panel', async()=>{
  const bundle=await readFile('public/assets/index-app.js','utf8');
  assert.doesNotMatch(bundle,/DemoPassword123!|ورود سریع با یک کلیک/);
});

test('removes known demo logins and sessions while preserving records and unrelated users', async () => {
  const { seedDemoData } = await import('./fixtures/demo-data.js');
  await seedDemoData.call(db);
  const tenant='e2b17b3c-53f0-466d-9279-d102e5b7b001';
  const user='c1a11111-2222-3333-4444-555555555551';
  const unrelated=crypto.randomUUID();
  await db.pg.query(`INSERT INTO users (id,tenant_id,username,password_hash,first_name,last_name,display_name) VALUES ($1,$2,'real_owner',$3,'Real','Owner','Real owner')`,[unrelated,tenant,bcrypt.hashSync(password,10)]);
  const session=await db.createSession(user,tenant,'127.0.0.1','test');
  const counts=async()=> (await db.pg.query(`SELECT (SELECT count(*) FROM properties)::int AS properties, (SELECT count(*) FROM tasks)::int AS tasks, (SELECT count(*) FROM transactions)::int AS transactions, (SELECT count(*) FROM documents)::int AS documents`)).rows[0];
  const original=await counts();
  await db.removeDemoLogins();
  assert.deepEqual(await counts(),original);
  assert.equal(await db.getSessionByToken(session),null);
  assert.equal((await db.pg.query('SELECT * FROM users WHERE tenant_id=$1 AND is_active=true',[tenant])).rows.length,1);
  const archived=(await db.pg.query('SELECT * FROM users WHERE id=$1',[user])).rows[0];
  assert.equal(archived.is_active,false);assert.match(archived.username,/^archived-/);
  assert.equal(archived.phone,null);assert.equal(archived.email,null);
  assert.equal(bcrypt.compareSync('DemoPassword123!',archived.password_hash),false);
  await db.removeDemoLogins();
  assert.equal((await db.pg.query('SELECT password_hash FROM users WHERE id=$1',[user])).rows[0].password_hash,archived.password_hash);
  assert.equal((await db.pg.query('SELECT is_active FROM users WHERE id=$1',[unrelated])).rows[0].is_active,true);
  const bundle=await readFile('public/assets/index-app.js','utf8');
  assert.doesNotMatch(bundle,/پشتیبانی چندمستأجری ایزوله|نگارش 1.0.0 فاز B1/);
});
