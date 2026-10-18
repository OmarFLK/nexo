import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
mkdirSync('.sites-runtime',{recursive:true});
const folder=mkdtempSync(resolve('.sites-runtime/auth-test-'));
process.env.NEXO_DATA_DIR=folder;
process.env.NODE_ENV='test';delete process.env.DATABASE_URL;delete process.env.NEXO_APP_URL;
const {createOwner,login,logout,sessionFromCookie,sessionCookie,requireSession}=await import('../server/auth.ts');
const {getStore}=await import('../server/store.ts');
const password=randomBytes(18).toString('base64url'),email='owner@example.test';
test('owner, hashed credentials, session rotation, CSRF, logout, expiry and reset',async()=>{
  try{
    await createOwner(email,password);
    const row=getStore().database.prepare('SELECT * FROM users').get();assert.notEqual(row.password_hash,password);assert.match(row.password_hash,/^scrypt\$/);
    await assert.rejects(()=>createOwner(email,password),/já existe/);
    await assert.rejects(()=>login(email,'incorrect-password',null),e=>e.status===401);
    await assert.rejects(()=>login('absent@example.test',password,null),e=>e.status===401);
    const token=await login(email.toUpperCase(),password,null),cookie=sessionCookie(token);
    assert.match(cookie,/HttpOnly; SameSite=Strict/);
    const session=await sessionFromCookie(cookie);assert.equal(session.user.email,email);assert.equal(session.csrf.length,64);
    const request=(headers={})=>new Request('http://localhost/api/workspace',{method:'POST',headers:{host:'localhost',origin:'http://localhost',cookie,...headers}});
    await assert.rejects(()=>requireSession(request(),true),e=>e.status===403);
    assert.equal((await requireSession(request({'x-csrf-token':session.csrf}),true)).user.email,email);
    await assert.rejects(()=>requireSession(request({origin:'https://evil.example','x-csrf-token':session.csrf}),true),e=>e.status===403);
    const rotated=await login(email,password,cookie);assert.equal(await sessionFromCookie(cookie),null);
    await logout(sessionCookie(rotated));assert.equal(await sessionFromCookie(sessionCookie(rotated)),null);
    const expired=sessionCookie(await login(email,password,null));getStore().database.prepare('UPDATE sessions SET last_seen=?').run(Date.now()-31*60000);assert.equal(await sessionFromCookie(expired),null);
    const resetSession=sessionCookie(await login(email,password,null));await createOwner(email,password+'new',true);assert.equal(await sessionFromCookie(resetSession),null);
    await assert.rejects(()=>login(email,password,null),e=>e.status===401);
    const next=sessionCookie(await login(email,password+'new',null));assert.ok(await sessionFromCookie(next));
    getStore().database.prepare('UPDATE users SET email=?').run('renamed@example.test');assert.equal(await sessionFromCookie(next),null);getStore().database.prepare('UPDATE users SET email=?').run(email);
    await login(email,password+'new',null);
    await assert.rejects(()=>login(email,password+'new',null),e=>e.status===429);
    process.env.NODE_ENV='production';assert.match(sessionCookie('token'),/^__Host-nexo_session=.*; Secure$/);process.env.NODE_ENV='test';
  }finally{getStore().close();if(folder.startsWith(resolve('.sites-runtime')+sep))rmSync(folder,{recursive:true,force:true});}
});
