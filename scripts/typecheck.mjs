import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
for(const args of [[resolve('node_modules/next/dist/bin/next'),'typegen'],[resolve('node_modules/typescript/bin/tsc'),'--noEmit']]){const child=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});if(child.status!==0)process.exit(child.status??1);}
