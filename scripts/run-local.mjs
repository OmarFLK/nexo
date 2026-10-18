import { spawn } from 'node:child_process';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import {networkInterfaces} from 'node:os';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [mode='dev',...options]=process.argv.slice(2);
if(!['dev','build','start'].includes(mode))throw Error('Use dev, build ou start.');
const lan=options.includes('--lan');
if(mode==='start'&&process.env.NEXO_TEST_MODE!=='1'&&!/^[a-f0-9]{64}$/.test(process.env.NEXO_PROXY_SECRET??''))throw Error('Configure NEXO_PROXY_SECRET em Vercel e Render.');
if(mode==='start'&&!process.env.NEXO_API_URL&&process.env.NEXO_TEST_MODE!=='1'){
  if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL do Neon antes de iniciar em produção.');
  if(!process.env.NEXO_APP_URL||new URL(process.env.NEXO_APP_URL).protocol!=='https:')throw Error('Configure NEXO_APP_URL com o endereço público HTTPS.');
  if(!process.env.NEXO_DATA_DIR||!isAbsolute(process.env.NEXO_DATA_DIR))throw Error('Configure NEXO_DATA_DIR com o caminho absoluto do disco persistente para as fotos.');
}
const args=[resolve(root,'node_modules/next/dist/bin/next'),mode];
if(mode!=='start')args.push('--webpack');
if(mode!=='build')args.push('--hostname',lan||mode==='start'?'0.0.0.0':'127.0.0.1','--port',process.env.PORT??'3000');
if(lan){console.log('Use no celular conectado à mesma rede Wi-Fi:');for(const items of Object.values(networkInterfaces()))for(const item of items??[])if(item.family==='IPv4'&&!item.internal)console.log(`  http://${item.address}:${process.env.PORT??'3000'}`);}
const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code)=>process.exit(code??0));
