import { Pool, type PoolClient } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DomainError, applyCommand, emptyState, type Command, type State } from '../lib/domain.ts';
import {isProduction} from './config.ts';

// One pool per process. Render owns DB access; the Vercel frontend only proxies the API.
const globals = globalThis as typeof globalThis & { nexoPool?: Pool; nexoMigration?: Promise<void>;nexoReady?:Promise<void> };
export function pool() {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL não configurada.');
  if(globals.nexoPool)return globals.nexoPool;
  const url=new URL(process.env.DATABASE_URL);
  const tls=process.env.NODE_ENV==='production'||url.hostname.endsWith('.neon.tech');
  if(tls)for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
  const db=new Pool({connectionString:url.toString(),...(tls?{ssl:{rejectUnauthorized:true},enableChannelBinding:true}:{}),max:5,connectionTimeoutMillis:15000,idleTimeoutMillis:30000});
  db.on('error',()=>console.error('[Nexo] Conexão ociosa com o banco foi encerrada.'));
  return globals.nexoPool=db;
}
export async function migratePostgres(database: Pick<PoolClient, 'query'>) {
  await database.query('BEGIN');
  try {
    await database.query("SET LOCAL statement_timeout='20s'");
    await database.query('SELECT pg_advisory_xact_lock(72401381)');
    await database.query('CREATE TABLE IF NOT EXISTS nexo_schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const directory=resolve('server/postgres');
    for(const name of (await readdir(directory)).filter(name=>/^\d+_.+\.sql$/.test(name)).sort()){
      const version=Number(name.split('_')[0]);
      if((await database.query('SELECT version FROM nexo_schema_migrations WHERE version=$1',[version])).rows.length)continue;
      await database.query(await readFile(resolve(directory,name),'utf8'));
      await database.query('INSERT INTO nexo_schema_migrations(version) VALUES($1)',[version]);
    }
    await database.query("INSERT INTO nexo_workspace(id,state) VALUES('nexo',$1::jsonb) ON CONFLICT DO NOTHING", [JSON.stringify(emptyState())]);
    await database.query('COMMIT');
  } catch (error) { await database.query('ROLLBACK'); throw error; }
}
export async function assertRuntimeRole(database:Pick<PoolClient,'query'>){
  const result=await database.query("SELECT current_user AS name, EXISTS(SELECT 1 FROM pg_class WHERE relname LIKE 'nexo_%' AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_tables, has_table_privilege(current_user,'nexo_users','UPDATE') OR has_table_privilege(current_user,'nexo_users','INSERT') OR has_table_privilege(current_user,'nexo_audit','DELETE') OR has_table_privilege(current_user,'nexo_commands','DELETE') OR has_schema_privilege(current_user,'public','CREATE') OR (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS excessive");
  if(result.rows[0].owns_tables||result.rows[0].excessive)throw Error('O runtime deve usar um papel restrito, separado da conta de migração. Consulte DEPLOY.md.');
}
export async function postgres(migrate=false) {
  const db = pool();
  if(migrate||!isProduction()){
    if (!globals.nexoMigration) globals.nexoMigration = (async () => { const client = await db.connect(); try { await migratePostgres(client); } finally { client.release(); } })().catch(error => { globals.nexoMigration = undefined; throw error; });
    await globals.nexoMigration;
  }else{
    if(!globals.nexoReady)globals.nexoReady=(async()=>{if(!(await db.query('SELECT version FROM nexo_schema_migrations WHERE version=1')).rows.length)throw Error('Execute a migração antes de iniciar.');await assertRuntimeRole(db);})().catch(error=>{globals.nexoReady=undefined;throw error;});
    await globals.nexoReady;
  }
  return db;
}
export async function readPostgres(database: Pick<PoolClient, 'query'>) {
  const { rows } = await database.query("SELECT revision,state FROM nexo_workspace WHERE id='nexo'");
  return { revision: Number(rows[0].revision), state: rows[0].state as State };
}
export async function executePostgres(database: Pick<PoolClient, 'query'>, command: Command, actor: string) {
  if (!command || typeof command.id !== 'string' || !command.id || command.id.length > 100 || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) throw new DomainError('Comando inválido.');
  const hash = createHash('sha256').update(JSON.stringify({type:command.type,payload:command.payload})).digest('hex');
  await database.query('BEGIN');
  try {
    await database.query("SET LOCAL statement_timeout='20s'");
    // Serialize the single store. Stock validation, audit and command receipt commit together.
    const { rows } = await database.query("SELECT revision,state FROM nexo_workspace WHERE id='nexo' FOR UPDATE");
    const current = { revision: Number(rows[0].revision), state: rows[0].state as State };
    const prior = await database.query('SELECT payload_hash FROM nexo_commands WHERE id=$1', [command.id]);
    if (prior.rows[0]) {
      if (prior.rows[0].payload_hash !== hash) throw new DomainError('Identificador já usado em outra operação.');
      await database.query('COMMIT'); return current;
    }
    const state = applyCommand(current.state, command, actor);
    const revision = current.revision + 1;
    await database.query("UPDATE nexo_workspace SET state=$1::jsonb,revision=$2,updated_at=now() WHERE id='nexo'", [JSON.stringify(state),revision]);
    await database.query('INSERT INTO nexo_commands(id,payload_hash,actor) VALUES($1,$2,$3)', [command.id,hash,actor]);
    await database.query('INSERT INTO nexo_audit(id,actor,operation,data) VALUES($1,$2,$3,$4::jsonb)', [command.id,actor,command.type,JSON.stringify(state.audit[0])]);
    await database.query('COMMIT'); return { revision, state };
  } catch (error) { await database.query('ROLLBACK'); throw error; }
}
