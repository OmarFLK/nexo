import {database,readWorkspace} from '../server/database.ts';
if(process.env.DATABASE_MIGRATION_URL)process.env.DATABASE_URL=process.env.DATABASE_MIGRATION_URL;
try{if(process.env.DATABASE_URL){const {postgres,readPostgres}=await import('../server/postgres.ts');const result=await readPostgres(await postgres(true));console.log(`Banco PostgreSQL migrado. Revisão: ${result.revision}.`);}else{await database();const result=await readWorkspace();console.log(`Banco SQLite pronto. Revisão: ${result.revision}.`);}}
finally{if(process.env.DATABASE_URL){const {pool}=await import('../server/postgres.ts');await pool().end();}else{const {getStore}=await import('../server/store.ts');getStore().close();}}
