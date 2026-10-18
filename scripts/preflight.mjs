import {publicOrigin,proxySecret} from '../server/config.ts';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {randomUUID} from 'node:crypto';
process.env.NODE_ENV='production';
try{
  if(process.env.NEXO_TEST_MODE==='1')throw Error('NEXO_TEST_MODE=1 não é permitido no início de produção.');
  if(!publicOrigin())throw Error('Configure NEXO_APP_URL.');proxySecret();
  if(process.env.DATABASE_MIGRATION_URL)throw Error('Remova DATABASE_MIGRATION_URL do runtime de produção.');
  if(process.env.NEXO_API_URL){
    if(process.env.DATABASE_URL)throw Error('A interface não deve receber credenciais do banco.');
    const url=new URL(process.env.NEXO_API_URL);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.origin===publicOrigin())throw Error('NEXO_API_URL inválida.');
    const response=await fetch(new URL('/api/health',url),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Backend indisponível.');
  }else{
    if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL com o papel restrito do Neon.');
    if(!process.env.NEXO_DATA_DIR||!isAbsolute(process.env.NEXO_DATA_DIR))throw Error('Configure o disco persistente de fotos em NEXO_DATA_DIR.');
    const {database}=await import('../server/database.ts');const db=await database();
    const users=await db.query('SELECT id FROM nexo_users');if(users.length!==1)throw Error('Provisione a conta proprietária antes de publicar.');
    await mkdir(process.env.NEXO_DATA_DIR,{recursive:true});const check=join(process.env.NEXO_DATA_DIR,'.check-'+randomUUID());await writeFile(check,'',{flag:'wx',mode:0o600});await unlink(check);
  }
  console.log('Configuração de produção verificada.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(process.env.DATABASE_URL){const {pool}=await import('../server/postgres.ts');await pool().end();}}
