import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migratePostgres,readPostgres,executePostgres,assertRuntimeRole} from '../server/postgres.ts';
import {readFile} from 'node:fs/promises';
import {LocalStore} from '../server/store.ts';
import {importLocal} from '../server/import-local.ts';
import {dummyPasswordHash} from '../server/password.ts';
test('PostgreSQL migrations, atomic commands, replay, audit and rollback',async()=>{
  const engine=new PGlite();
  const db={query:async(sql,args)=>{if(!args&&sql.includes(';')){await engine.exec(sql);return {rows:[]};}return engine.query(sql,args);}};
  try{
    await migratePostgres(db);await migratePostgres(db);
    assert.equal((await readPostgres(db)).state.products.length,0);
    const command={id:crypto.randomUUID(),type:'product',payload:{name:'PG test',sku:'PG-1',cost:10000,price:20000,initial:1}};
    const created=await executePostgres(db,command,'owner@example.test');assert.equal(created.revision,1);
    assert.equal((await executePostgres(db,command,'owner@example.test')).revision,1);
    await assert.rejects(()=>executePostgres(db,{...command,payload:{...command.payload,initial:9}},'owner'),/Identificador/);
    const sale={id:crypto.randomUUID(),type:'order',payload:{productId:command.id,quantity:1,price:20000,channel:'Nexo',paid:true,fulfilled:true}};
    const sold=await executePostgres(db,sale,'owner@example.test');assert.equal(sold.state.products[0].stock,0);
    await assert.rejects(()=>executePostgres(db,{...sale,id:crypto.randomUUID()},'owner'),/Estoque|estoque/);
    assert.equal((await readPostgres(db)).revision,2);assert.equal((await db.query('SELECT * FROM nexo_commands')).rows.length,2);
    const audits=(await db.query('SELECT * FROM nexo_audit')).rows;assert.equal(audits.length,2);assert.equal(audits[0].actor,'owner@example.test');
    await assert.rejects(()=>db.query('DELETE FROM nexo_audit'),/immutable/);
    await assert.rejects(()=>db.query("INSERT INTO nexo_workspace(id,state) VALUES('other','{}')"),/check constraint/);
    const statement='INSERT INTO nexo_login_limits(key,attempts,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN nexo_login_limits.reset_at<$3 THEN 1 ELSE nexo_login_limits.attempts+1 END,reset_at=CASE WHEN nexo_login_limits.reset_at<$4 THEN excluded.reset_at ELSE nexo_login_limits.reset_at END RETURNING attempts';
    assert.equal((await db.query(statement,['key',100,0,0])).rows[0].attempts,1);assert.equal((await db.query(statement,['key',100,0,0])).rows[0].attempts,2);
  }finally{await engine.close();}
});
test('initial SQLite import preserves account, snapshot, audit and idempotency and refuses overwrite',async()=>{
  const source=new LocalStore(':memory:'),engine=new PGlite();
  const db={query:async(sql,args)=>{if(!args&&sql.includes(';')){await engine.exec(sql);return {rows:[]};}return engine.query(sql,args);}};
  try{
    await migratePostgres(db);
    const command={id:crypto.randomUUID(),type:'product',payload:{name:'Imported product',sku:'IMPORT-1',cost:10000,price:15000,initial:3}};
    source.execute(command,'owner@example.test');source.database.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run('owner','owner@example.test',dummyPasswordHash,new Date().toISOString());
    const result=await importLocal(db,source);assert.equal(result.products,1);assert.equal(result.revision,1);
    assert.equal((await db.query('SELECT password_hash FROM nexo_users')).rows[0].password_hash,dummyPasswordHash);
    assert.deepEqual((await readPostgres(db)).state,source.read().state);
    assert.equal((await executePostgres(db,command,'owner@example.test')).revision,1);
    await assert.rejects(()=>importLocal(db,source),/Destino já possui dados/);
    assert.equal((await readPostgres(db)).state.products[0].stock,3);
  }finally{source.close();await engine.close();}
});
test('restricted runtime can operate the store but cannot administer accounts, schema or audit',async()=>{
  const engine=new PGlite(),db={query:async(sql,args)=>{if(!args&&sql.includes(';')){await engine.exec(sql);return {rows:[]};}return engine.query(sql,args);}};
  try{
    await migratePostgres(db);await assert.rejects(()=>assertRuntimeRole(db),/restrito/);
    await engine.exec('CREATE ROLE nexo_runtime;');
    const grants=(await readFile('scripts/sql/runtime-grants.sql','utf8')).replace('GRANT CONNECT ON DATABASE neondb TO nexo_runtime;','');await engine.exec(grants);
    await engine.exec('SET ROLE nexo_runtime;');await assertRuntimeRole(db);
    const command={id:crypto.randomUUID(),type:'product',payload:{name:'Restricted',sku:'R-1',cost:10000,price:15000,initial:1}};
    assert.equal((await executePostgres(db,command,'owner@example.test')).revision,1);
    await assert.rejects(()=>db.query('DELETE FROM nexo_audit'),/permission denied/);
    await assert.rejects(()=>db.query("UPDATE nexo_users SET password_hash='malicious'"),/permission denied/);
    await assert.rejects(()=>db.query('CREATE TABLE public.evil(id text)'),/permission denied/);
  }finally{await engine.close();}
});
