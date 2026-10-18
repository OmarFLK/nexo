import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.QA_URL??'http://127.0.0.1:3001';
const cdp=process.env.QA_CDP??'http://127.0.0.1:9222';
assert.equal(process.env.QA_ALLOW_WRITE,'1');assert.equal((await (await fetch(base+'/api/health')).json()).testMode,true);
const page=await (await fetch(cdp+'/json/new?'+encodeURIComponent(base),{method:'PUT'})).json();
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();const errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let n=0;n<100;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw Error('Timeout: '+expression);}
async function click(text,selector='button'){await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing: '+${JSON.stringify(text)});e.click()})()`);await delay(150);}
async function fill(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field');const setter=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await delay(50);}
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:base});await until(`document.querySelector('#email')`);
assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.ok(!(await evaluate('document.body.innerText')).toLowerCase().includes('local'));
mkdirSync('.sites-runtime/screenshots-local',{recursive:true});await shot('mobile-login');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await shot('desktop-login');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await fill('#email',process.env.QA_EMAIL);await fill('#password','incorrect-password');await click('Entrar');await until(`document.querySelector('[role=alert]')`);
await fill('#password',process.env.QA_PASSWORD);await click('Entrar');await until(`document.querySelector('.local-label')?.textContent==='Conectado'`);await delay(300);
mkdirSync('.sites-runtime/screenshots-local',{recursive:true});async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync('.sites-runtime/screenshots-local/'+name+'.png',Buffer.from(r.data,'base64'));}
assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.ok(!(await evaluate('document.body.innerText')).includes('demonstração'));assert.ok((await evaluate('document.body.innerText')).includes('Seu estoque começa aqui'));await shot('mobile-empty');
await click('Precificação','.sidebar .nav-item');
assert.equal(await evaluate("document.querySelector('h1').textContent"),'Precificação');
assert.equal(await evaluate("document.querySelector('[aria-label=\"Preço de venda\"]')"),null);
assert.ok(!(await evaluate('document.body.innerText')).includes('Margem que eu quero'));
await fill('[aria-label="Nome da peça"]','Peça sem cadastro');
await fill('[aria-label="Custo de compra"]','100');
await fill('[aria-label="Lucro desejado"]','50');
await until("document.querySelector('.banner-price>strong')?.textContent.includes('150,00')");
assert.ok((await evaluate("document.querySelector('.goal-confirmation').textContent")).includes('50,00'));
await fill('[aria-label="Lucro desejado"]','80');
await until("document.querySelector('.banner-price>strong')?.textContent.includes('180,00')");
await evaluate("document.querySelector('.pricing-expenses').open=true");
await fill('[aria-label="Comissão (%)"]','10');
await until("document.querySelector('.banner-price>strong')?.textContent.includes('200,00')");
await fill('[aria-label="Frete pago por mim"]','10');
await until("document.querySelector('.banner-price>strong')?.textContent.includes('211,11')");
assert.ok((await evaluate("document.querySelector('.goal-confirmation').textContent")).includes('80,00'));
await fill('[aria-label="Impostos (%)"]','90');
await until("document.querySelector('[role=alert]')?.textContent.includes('100%')");
await click('Limpar','.simulation button');
await fill('[aria-label="Custo de compra"]','100');await fill('[aria-label="Lucro desejado"]','50');await fill('[aria-label="Nome da peça"]','Peça sem cadastro');
assert.ok((await evaluate("document.querySelector('.banner-margin>strong').textContent")).includes('33,33%'));
assert.equal(await evaluate("getComputedStyle(document.querySelector('.sale-banner')).position"),'sticky');
assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
await shot('mobile-pricing');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await shot('desktop-pricing');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await click('Vendas','.sidebar .nav-item');await click('Precificação','.sidebar .nav-item');assert.equal(await evaluate(`document.querySelector('[aria-label="Nome da peça"]').value`),'Peça sem cadastro');await send('Page.reload');await until(`document.querySelector('.local-label')?.textContent==='Conectado'`);await click('Precificação','.sidebar .nav-item');assert.equal(await evaluate(`document.querySelector('[aria-label="Nome da peça"]').value`),'');
await click('Estoque','.sidebar .nav-item');await click('Adicionar produto','.page-heading button');await fill('[name=name]','UI test product');await fill('[name=sku]','UI-'+Date.now());await fill('[name=cost]','100');await fill('[name=price]','200');await fill('[name=initial]','20');await click('Salvar','.modal-actions button');await until(`!document.querySelector('[role=dialog]')`);assert.ok((await evaluate(`document.querySelector('.inventory').textContent`)).includes('20'));await shot('mobile-stock');
await click('Movimentar','.product-actions button');await fill('[name=quantity]','5');await click('Salvar','.modal-actions button');await until(`!document.querySelector('[role=dialog]')`);assert.ok((await evaluate(`document.querySelector('.inventory').textContent`)).includes('25'));
await click('Precificação','.sidebar .nav-item');
await evaluate("document.querySelector('.optional-stock').open=true");
await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Carregar produto do estoque\"]');e.value=[...e.options].find(x=>x.text.includes('UI test')).value;e.dispatchEvent(new Event('change',{bubbles:true}))})()");
await fill('[aria-label="Lucro desejado"]','50');await until("document.querySelector('.banner-price>strong')?.textContent.includes('150,00')");
await click('Salvar preço no estoque');await until("document.querySelector('.toast')?.textContent.includes('Salvo')");
await click('Estoque','.sidebar .nav-item');assert.ok((await evaluate("document.querySelector('.product-numbers').textContent")).includes('150,00'));
await click('Vendas','.sidebar .nav-item');await click('Nova venda','.page-heading button');await evaluate(`(()=>{const e=document.querySelector('[name=productId]');e.value=[...e.options].find(x=>x.text.includes('UI test')).value;e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await fill('[name=quantity]','2');await click('Salvar','.modal-actions button');await until(`!document.querySelector('[role=dialog]')`);assert.ok((await evaluate(`document.querySelector('.sale-card').textContent`)).includes('Concluída'));
await click('Estoque','.sidebar .nav-item');assert.ok((await evaluate(`document.querySelector('.product-numbers').textContent`)).includes('23'));
await send('Page.reload');await until(`document.querySelector('.local-label')?.textContent==='Conectado'`);await click('Estoque','.sidebar .nav-item');assert.ok((await evaluate(`document.querySelector('.inventory').textContent`)).includes('UI test product'));
for(const name of ['Comprar','Financeiro','Clientes','Fornecedores','Integrações']){await click(name,'.sidebar .nav-item');assert.equal(await evaluate(`document.querySelector('h1').textContent`),name);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);}
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await click('Visão geral','.sidebar .nav-item');await shot('desktop-overview');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await evaluate(`document.querySelector('[aria-label="Sair da conta"]').click()`);await until(`document.querySelector('#email')`);await send('Page.navigate',{url:base});await until(`document.querySelector('#email')`);assert.deepEqual(errors,[]);
console.log(JSON.stringify({status:'passed',checks:['login, invalid password, logout and private area','free pricing without inventory','purchase cost + desired BRL profit + generated selling price','sticky mobile result','draft memory lifecycle','product and movement','immediate sale','persistence after reload','all screens','desktop and mobile overflow'],errors}));ws.close();
