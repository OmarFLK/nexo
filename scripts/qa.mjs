import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
mkdirSync('.sites-runtime',{recursive:true});
const folder=mkdtempSync(resolve('.sites-runtime/qa-auth-'));
process.env.NEXO_DATA_DIR=folder;process.env.NEXO_TEST_MODE='1';delete process.env.DATABASE_URL;delete process.env.NEXO_API_URL;delete process.env.NEXO_APP_URL;
const email='qa@example.test',password=randomBytes(24).toString('base64url');
const {createOwner}=await import('../server/auth.ts');await createOwner(email,password);
const {getStore}=await import('../server/store.ts');getStore().close();
const port=process.env.QA_PORT??'3001';const base=`http://127.0.0.1:${port}`;
const proxyMode=process.argv.includes('--proxy'),frontendUrl='http://127.0.0.1:3002';
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production',PORT:port,QA_URL:proxyMode?frontendUrl:base,QA_EMAIL:email,QA_PASSWORD:password,QA_ALLOW_WRITE:'1',...(proxyMode?{NEXO_APP_URL:frontendUrl,NEXO_PROXY_SECRET:randomBytes(32).toString('hex')}:{})};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',port],{env,stdio:['ignore','pipe','pipe']});
server.stdout.on('data',data=>process.stdout.write(data));server.stderr.on('data',data=>process.stderr.write(data));
const run=script=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${script}: ${code}`)));});
let frontend;
try{
  let ready=false;for(let n=0;n<120;n++){try{const response=await fetch(base+'/api/health');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw Error('Servidor de QA não iniciou.');
  const health=await(await fetch(base+'/api/health')).json();if(!health.testMode)throw Error('A porta está ocupada por outro servidor.');
  if(proxyMode){
    frontend=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3002'],{env:{...env,NODE_ENV:'development',NEXO_API_URL:base,NEXO_BUILD_DIR:'.sites-runtime/frontend-next'},stdio:['ignore','pipe','pipe']});
    frontend.stderr.on('data',data=>process.stderr.write(data));
    let ready=false;for(let n=0;n<120;n++){try{const response=await fetch(frontendUrl+'/login');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Frontend de QA não iniciou.');
  }
  if(process.argv.includes('--browser'))await run('tests/browser.mjs');
  await run('tests/api.mjs');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{frontend?.kill();server.kill();}
