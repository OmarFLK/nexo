import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {LocalStore} from '../server/store.ts';

const root=resolve('.sites-runtime');mkdirSync(root,{recursive:true});
function fixture(t){const folder=mkdtempSync(join(root,'sqlite-test-'));const filename=join(folder,'nexo.sqlite');const store=new LocalStore(filename);t.after(()=>{store.close();assert.ok(folder.startsWith(root+sep));rmSync(folder,{recursive:true,force:true});});return {store,filename};}
const operation=(type,payload,id=crypto.randomUUID())=>({id,type,payload});
function seed(store,quantity=20){const c=operation('product',{name:'Test product',sku:'TEST-1',cost:10000,price:20000,initial:quantity});store.execute(c);return c.id;}

test('notas persistem entre conexões, editam e excluem sem guardar o texto na auditoria',t=>{
  const {store,filename}=fixture(t);const note=operation('note',{title:'Lembrete',body:'Primeira linha\nSegunda linha'});
  store.execute(note);const second=new LocalStore(filename);try{
  assert.equal(second.read().state.notes[0].body,note.payload.body);
  store.execute(operation('note',{id:note.id,title:'Atualizada',body:'Texto revisado'}));assert.equal(second.read().state.notes[0].title,'Atualizada');
  assert.equal(JSON.stringify(second.read().state.audit).includes('Texto revisado'),false);
  const revision=second.read().revision;assert.throws(()=>store.execute(operation('note',{id:note.id,title:'',body:'x'})));assert.throws(()=>store.execute(operation('note',{title:'x',body:'x'.repeat(10001)})));assert.equal(second.read().revision,revision);
  const remove=operation('deleteNote',{id:note.id});store.execute(remove);store.execute(remove);assert.deepEqual(second.read().state.notes,[]);
  assert.throws(()=>store.execute(operation('note',{id:note.id,title:'x',body:'x'})),/não encontrada/);
  }finally{second.close();}
});

test('banco inicia somente com a loja Nexo e nenhum dado comercial',t=>{const {store}=fixture(t);const {state,revision}=store.read();assert.equal(revision,0);for(const key of ['products','orders','movements','entries','purchases','customers','suppliers'])assert.equal(state[key].length,0);assert.equal(state.rules.tax,0);assert.deepEqual({...store.database.prepare('SELECT * FROM stores').get()},{id:'nexo',name:'Nexo'});assert.throws(()=>store.database.prepare("INSERT INTO stores VALUES('other','Other')").run(),/CHECK/);});
test('persistência após reabrir, ledger e restrições do banco',t=>{const {store,filename}=fixture(t);const id=seed(store);const second=new LocalStore(filename);assert.equal(second.read().state.products[0].stock,20);store.execute(operation('stock',{productId:id,kind:'in',quantity:5,reason:'Test receipt'}));assert.equal(second.read().state.products[0].stock,25);assert.equal(store.database.prepare('SELECT SUM(quantity_delta) AS total FROM stock_movements').get().total,25);assert.throws(()=>store.database.prepare('UPDATE stock_movements SET balance=0').run(),/imutáveis/);assert.throws(()=>store.database.prepare('UPDATE products SET stock=-1').run(),/CHECK/);second.close();});
test('idempotência persistida e rejeição de mesma chave com conteúdo diferente',t=>{const {store}=fixture(t);const id=seed(store);const c=operation('stock',{productId:id,kind:'in',quantity:2,reason:'Test receipt'});const first=store.execute(c);const second=store.execute(c);assert.equal(first.revision,second.revision);assert.equal(second.state.products[0].stock,22);assert.throws(()=>store.execute({...c,payload:{...c.payload,quantity:3}}),/outra operação/);assert.equal(store.read().state.products[0].stock,22);});
test('falha na auditoria desfaz saldo, movimento e comando na mesma transação',t=>{const {store}=fixture(t);const id=seed(store);const revision=store.read().revision;store.database.exec("CREATE TRIGGER reject_test BEFORE INSERT ON audit_log WHEN NEW.type='stock' BEGIN SELECT RAISE(ABORT,'test rollback'); END;");const c=operation('stock',{productId:id,kind:'in',quantity:4,reason:'Test rollback'});assert.throws(()=>store.execute(c),/rollback/);const result=store.read();assert.equal(result.revision,revision);assert.equal(result.state.products[0].stock,20);assert.equal(result.state.movements.length,1);assert.equal(store.database.prepare('SELECT id FROM commands WHERE id=?').get(c.id),undefined);});
test('duas conexões concorrentes não conseguem vender a mesma unidade',async t=>{const {store,filename}=fixture(t);const id=seed(store,1);const code=`const {parentPort,workerData}=require('node:worker_threads');import(workerData.module).then(({LocalStore})=>{const s=new LocalStore(workerData.filename);try{s.execute(workerData.command);parentPort.postMessage(true)}catch{parentPort.postMessage(false)}finally{s.close()}}).catch(e=>{throw e});`;
  const attempt=()=>new Promise((res,rej)=>{const w=new Worker(code,{eval:true,workerData:{module:pathToFileURL(resolve('server/store.ts')).href,filename,command:operation('order',{productId:id,quantity:1,price:20000,channel:'Test',paid:true})},execArgv:['--experimental-strip-types']});w.on('message',res);w.on('error',rej);});
  assert.deepEqual((await Promise.all([attempt(),attempt()])).sort(),[false,true]);const state=store.read().state;assert.equal(state.orders.length,1);assert.equal(state.products[0].reserved,1);assert.equal(state.products[0].stock,1);
});
test('venda local concluída baixa na hora, devolução restaura e lucro histórico é preservado',t=>{const {store}=fixture(t);const id=seed(store);const sale=operation('order',{productId:id,quantity:2,price:20000,channel:'Venda direta',paid:true,fulfilled:true});let next=store.execute(sale).state;assert.equal(next.products[0].stock,18);assert.equal(next.products[0].reserved,0);assert.equal(next.orders[0].status,'Entregue');const saved=structuredClone(next.orders[0]);next=store.execute(operation('rules',{rules:{commission:2000,tax:1000,reserve:500,payment:100,target:2000}})).state;assert.deepEqual(next.orders[0],saved);next=store.execute(operation('orderStatus',{orderId:sale.id,status:'Devolvido'})).state;assert.equal(next.products[0].stock,20);assert.equal(next.orders[0].status,'Devolvido');});
