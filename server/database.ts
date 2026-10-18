import type { Command } from '../lib/domain.ts';
export async function database(migrate=false) {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && process.env.NEXO_TEST_MODE !== '1') throw Error('Configure DATABASE_URL no backend antes de publicar.');
  if (process.env.DATABASE_URL) {
    const { postgres } = await import('./postgres.ts');
    const db = await postgres(migrate);
    return {
      kind: 'postgres' as const,
      async query(sql:string, args:unknown[] = []):Promise<Record<string,unknown>[]> { let index=0; return (await db.query(sql.replace(/\?/g, () => '$' + (++index)),args)).rows; },
    };
  }
  const { getStore } = await import('./store.ts');
  const store = getStore();
  return { kind:'sqlite' as const, async query(sql:string,args:unknown[]=[]):Promise<Record<string,unknown>[]> {
    const stmt = store.database.prepare(sql);
    if (/^\s*(SELECT|INSERT.*RETURNING)/is.test(sql)) return stmt.all(...args as import('node:sqlite').SQLInputValue[]) as Record<string,unknown>[];
    stmt.run(...args as import('node:sqlite').SQLInputValue[]); return [];
  } };
}
export async function readWorkspace() {
  if (process.env.DATABASE_URL) { const { postgres, readPostgres } = await import('./postgres.ts'); return readPostgres(await postgres()); }
  await database(); const {getStore} = await import('./store.ts'); return getStore().read();
}
export async function executeWorkspace(command:Command,actor:string) {
  if (process.env.DATABASE_URL) { const { postgres, executePostgres } = await import('./postgres.ts'); const client = await (await postgres()).connect(); try { return await executePostgres(client, command, actor); } finally { client.release(); } }
  await database(); const {getStore} = await import('./store.ts'); return getStore().execute(command,actor);
}
