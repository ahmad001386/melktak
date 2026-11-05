import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { PGlite } from '@electric-sql/pglite';

test('production starts with private configuration, hides old UI path and preserves database across restart', {timeout:45000}, async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'melktak-production-'));
  const listener=net.createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));
  const port=(listener.address() as net.AddressInfo).port;await new Promise<void>(r=>listener.close(()=>r()));
  const panel='/office-'+crypto.randomBytes(16).toString('hex');
  const password=crypto.randomBytes(24).toString('base64');
  const env={...process.env,NODE_ENV:'production',PORT:String(port),DATA_DIR:dir,SEED_DEMO_DATA:'false',PLATFORM_PATH:panel,PLATFORM_ADMIN_USERNAME:'startup_admin',PLATFORM_ADMIN_PASSWORD:password};
  let child:ReturnType<typeof spawn>;
  const base=`http://127.0.0.1:${port}`;
  async function start(){
    child=spawn(process.execPath,['--import','tsx','server.ts'],{env,stdio:'ignore'});
    for(let i=0;i<150;i++){
      if(child.exitCode!==null)throw new Error('Production server exited during initialization');
      try{if((await fetch(base+'/api/v1/health')).ok)return;}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error('Production readiness timeout');
  }
  async function stop(){if(child&&child.exitCode===null&&child.signalCode===null){const done=new Promise<void>(r=>child.once('exit',()=>r()));child.kill('SIGTERM');await done;}}
  async function login(){const r=await fetch(base+'/api/v1/platform/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'startup_admin',password})});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0];}
  try{
    await start();
    assert.equal((await fetch(base+'/platform/login')).status,404);
    const response=await fetch(base+panel+'/login');assert.equal(response.status,200);assert.match(response.headers.get('cache-control')!,/no-store/);
    const html=await response.text();assert.ok(html.includes(panel));assert.ok(!html.includes(password));
    const root=await fetch(base+'/');assert.equal(root.status,200);assert.ok(!(await root.text()).includes(panel));
    const unauth=await fetch(base+panel,{redirect:'manual'});assert.equal(unauth.status,302);assert.equal(unauth.headers.get('location'),panel+'/login');
    const cookie=await login();assert.equal((await fetch(base+panel,{headers:{cookie}})).status,200);
    await stop();
    const db=new PGlite(path.join(dir,'amlak_postgres'));
    assert.equal((await db.query<{count:number}>('SELECT count(*)::int AS count FROM tenants')).rows[0].count,0);
    await db.exec("CREATE TABLE deployment_marker (value TEXT); INSERT INTO deployment_marker VALUES ('persistent');");await db.close();
    await start();await login();await stop();
    const reopened=new PGlite(path.join(dir,'amlak_postgres'));
    try{assert.equal((await reopened.query<{value:string}>('SELECT value FROM deployment_marker')).rows[0].value,'persistent');}finally{await reopened.close();}
  }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
