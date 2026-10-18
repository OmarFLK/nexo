import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {normalizeImage} from '../server/images.ts';
import {trustedGateway,publicOrigin} from '../server/config.ts';
import {jsonBody,limitedBody,fail} from '../server/http.ts';
import {applyCommand,emptyState,validateCommand,pricing} from '../lib/domain.ts';
test('production gateway requires a server credential and an exact HTTPS origin',()=>{
  const previous={...process.env};try{
    process.env.NODE_ENV='production';delete process.env.NEXO_TEST_MODE;process.env.NEXO_PROXY_SECRET=randomBytes(32).toString('hex');process.env.NEXO_APP_URL='https://nexo.example';
    assert.equal(publicOrigin(),'https://nexo.example');
    assert.equal(trustedGateway(new Request('https://api.example')),false);
    assert.equal(trustedGateway(new Request('https://api.example',{headers:{'x-nexo-proxy-secret':process.env.NEXO_PROXY_SECRET}})),true);
    process.env.NEXO_APP_URL='https://nexo.example/path';assert.throws(publicOrigin);
    process.env.NEXO_APP_URL='http://nexo.example';assert.throws(publicOrigin);
  }finally{for(const key of ['NODE_ENV','NEXO_TEST_MODE','NEXO_PROXY_SECRET','NEXO_APP_URL'])previous[key]===undefined?delete process.env[key]:process.env[key]=previous[key];}
});
test('images are decoded, normalized and stripped; malformed, spoofed and oversized images are refused',async()=>{
  const original=await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();
  const result=await normalizeImage(Buffer.concat([original,Buffer.from('<script>alert(1)</script>')]),'image/png');
  assert.equal((await sharp(result).metadata()).format,'webp');assert.equal(result.includes(Buffer.from('<script>')),false);assert.equal((await sharp(result).metadata()).exif,undefined);
  await assert.rejects(()=>normalizeImage(original,'image/jpeg'),e=>e.status===400);
  await assert.rejects(()=>normalizeImage(Buffer.from('<svg/>'),'image/svg+xml'),e=>e.status===415);
  await assert.rejects(()=>normalizeImage(original.subarray(0,12),'image/png'),e=>e.status===400);
  const large=await sharp({create:{width:6001,height:1,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(()=>normalizeImage(large,'image/png'),e=>e.status===400);
});
test('body limits apply to streaming payloads and internal errors do not leak details',async()=>{
  const request=new Request('http://localhost/api',{method:'POST',body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1024));controller.close();}}),duplex:'half'});
  await assert.rejects(()=>limitedBody(request,512),e=>e.status===413);
  const error=fail(Error('postgresql://secret@host/private/path'));assert.equal(error.status,500);assert.ok(!(await error.text()).includes('secret'));
  process.env.NODE_ENV='test';delete process.env.NEXO_APP_URL;
  await assert.rejects(()=>jsonBody(new Request('http://localhost/api',{method:'POST',headers:{Host:'localhost',Origin:'http://localhost','Content-Type':'not-application/json'},body:'{}'})),e=>e.status===415);
});
test('commands reject invalid structures, injected fields, unsafe identifiers and invalid dates',()=>{
  const command=(type,payload)=>({id:crypto.randomUUID(),type,payload});
  assert.throws(()=>validateCommand(command('stock',{productId:'x',stock:999})),/Campo/);
  assert.throws(()=>validateCommand({...command('stock',{}),id:'../private'}),/inválido/);
  assert.throws(()=>validateCommand(command('__proto__',{})),/inválido/);
  assert.throws(()=>validateCommand(command('rules',JSON.parse('{"rules":{"__proto__":{}}}'))),/inválido/);
  assert.throws(()=>applyCommand(emptyState(),command('product',{name:'bad',sku:'bad',cost:0,price:0,components:[null]}),'test'),/kit/);
  assert.throws(()=>applyCommand(emptyState(),command('entry',{name:'bad',kind:'expense',amount:1,due:'2026-02-30'}),'test'),/Data/);
  const result=pricing({cost:100000000000000,price:1,shipping:0,packaging:0,fixed:0},{commission:9999,tax:0,payment:0,reserve:0,target:0});assert.equal(result.breakEven,null);
});
