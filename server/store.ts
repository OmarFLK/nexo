import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DomainError, applyCommand, emptyState, type State, type Command } from '../lib/domain.ts';

type RecordRow = { data: string };
export class LocalStore {
  database: DatabaseSync;
  cache: { revision: number; state: State } | null = null;
  constructor(filename = resolve(process.env.NEXO_DATA_DIR ?? 'data', 'nexo.sqlite')) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const migrations = resolve('server/migrations');
    for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
      this.database.exec('BEGIN IMMEDIATE');
      try {
        if (this.database.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) { this.database.exec('COMMIT'); continue; }
        this.database.exec(readFileSync(resolve(migrations, name), 'utf8'));
        this.database.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(name, new Date().toISOString());
        this.database.exec('COMMIT');
      } catch (error) { this.database.exec('ROLLBACK'); throw error; }
    }
  }

  private entities<T>(table: string, descending = false): T[] {
    return (this.database.prepare(`SELECT data FROM ${table} ORDER BY rowid ${descending ? 'DESC' : 'ASC'}`).all() as RecordRow[]).map(row => JSON.parse(row.data));
  }

  read(): { revision: number; state: State } {
    // Todas as leituras pertencem ao mesmo snapshot, inclusive com outro processo aberto.
    this.database.exec('BEGIN');
    try { const result = this.load(); this.database.exec('COMMIT'); return { revision: result.revision, state: structuredClone(result.state) }; }
    catch(error) { this.database.exec('ROLLBACK'); throw error; }
  }

  private load(): { revision: number; state: State } {
    const row = this.database.prepare("SELECT value FROM app_settings WHERE key='revision'").get() as {value:string};
    const revision = Number(row.value);
    if (this.cache?.revision === revision) return this.cache;
    const state = emptyState();
    state.products = this.entities('products');
    state.movements = this.entities('stock_movements', true);
    state.orders = this.entities('orders', true);
    const contacts = this.database.prepare('SELECT kind,data FROM contacts ORDER BY rowid').all() as {kind:string;data:string}[];
    state.customers = contacts.filter(c => c.kind === 'customer').map(c => JSON.parse(c.data));
    state.suppliers = contacts.filter(c => c.kind === 'supplier').map(c => JSON.parse(c.data));
    state.purchases = this.entities('purchases', true);
    state.entries = this.entities('finance_entries', true);
    state.scenarios = this.entities('pricing_scenarios');
    const notes=this.database.prepare("SELECT value FROM app_settings WHERE key='notes'").get() as {value:string}|undefined;
    if(notes)state.notes=JSON.parse(notes.value);
    state.audit = this.entities('audit_log', true);
    state.applied = (this.database.prepare('SELECT id FROM commands ORDER BY rowid').all() as {id:string}[]).map(c => c.id);
    const rules = this.database.prepare("SELECT value FROM app_settings WHERE key='pricing_rules'").get() as {value:string}|undefined;
    if (rules) state.rules = JSON.parse(rules.value);
    this.cache = { revision, state };
    return this.cache;
  }

  execute(command: Command, actor = 'Nexo'): {revision:number;state:State} {
    if (!command || typeof command.id !== 'string' || !command.id || command.id.length > 100 || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) throw new DomainError('Comando inválido.');
    const hash = createHash('sha256').update(JSON.stringify({type:command.type,payload:command.payload})).digest('hex');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.database.prepare('SELECT payload_hash FROM commands WHERE id=?').get(command.id) as {payload_hash:string}|undefined;
      if (previous && previous.payload_hash !== hash) throw new DomainError('Identificador já usado em outra operação.');
      const current = this.load();
      if (previous) { this.database.exec('COMMIT'); return {revision:current.revision,state:structuredClone(current.state)}; }
      const next = applyCommand(current.state, command, actor);
      const run = (sql:string, values:SQLInputValue[]) => this.database.prepare(sql).run(...values);
      const changed = <T extends {id:string}>(nextItems:T[], oldItems:T[]) => nextItems.filter(p => JSON.stringify(p) !== JSON.stringify(oldItems.find(old => old.id === p.id)));
      for (const p of changed(next.products,current.state.products)) {
        run('INSERT INTO products(id,sku,name,cost_cents,price_cents,stock,reserved,data) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,name=excluded.name,cost_cents=excluded.cost_cents,price_cents=excluded.price_cents,stock=excluded.stock,reserved=excluded.reserved,data=excluded.data',[p.id,p.sku,p.name,p.cost,p.price,p.stock,p.reserved,JSON.stringify(p)]);
      }
      for (const p of changed(next.products,current.state.products)) {
        run('DELETE FROM kit_components WHERE kit_id=?',[p.id]);
        for (const c of p.components) run('INSERT INTO kit_components VALUES(?,?,?)',[p.id,c.productId,c.quantity]);
        for (const [channel,price] of Object.entries(p.channelPrices)) run('INSERT INTO channel_prices VALUES(?,?,?) ON CONFLICT(product_id,channel) DO UPDATE SET price_cents=excluded.price_cents',[p.id,channel,price]);
        for (const [ordinal,c] of [...p.costHistory].reverse().entries()) run('INSERT OR IGNORE INTO cost_history VALUES(?,?,?,?,?)',[p.id,ordinal,c.cost,c.date,c.reason]);
      }
      for (const [kind, contacts] of [['customer',next.customers],['supplier',next.suppliers]] as const) for (const c of contacts) run('INSERT OR IGNORE INTO contacts VALUES(?,?,?,?)',[c.id,kind,c.name,JSON.stringify(c)]);
      for (const o of changed(next.orders,current.state.orders).reverse()) {
        run('INSERT INTO orders VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data',[o.id,o.productId,o.status,o.quantity,o.price,o.profit,JSON.stringify(o)]);
        for (const i of o.items) run('INSERT OR IGNORE INTO order_items VALUES(?,?,?)',[o.id,i.productId,i.quantity]);
      }
      for (const m of next.movements.filter(m => !current.state.movements.some(old => old.id===m.id)).reverse()) run('INSERT INTO stock_movements VALUES(?,?,?,?,?,?,?,?,?)',[m.id,m.productId,m.quantity,m.reserved,m.balance,m.date,m.actor,m.reason,JSON.stringify(m)]);
      for (const p of changed(next.purchases,current.state.purchases).reverse()) run('INSERT INTO purchases VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET received=excluded.received,data=excluded.data',[p.id,p.productId,p.supplier,p.quantity,p.received,p.cost,JSON.stringify(p)]);
      for (const e of changed(next.entries,current.state.entries).reverse()) run('INSERT INTO finance_entries VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET settled=excluded.settled,data=excluded.data',[e.id,e.type,e.amount,Number(e.settled),e.due,JSON.stringify(e)]);
      for (const c of next.scenarios) run('INSERT OR IGNORE INTO pricing_scenarios VALUES(?,?)',[c.id,JSON.stringify(c)]);
      run("INSERT INTO app_settings VALUES('notes',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(next.notes)]);
      run("INSERT INTO app_settings VALUES('pricing_rules',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(next.rules)]);
      run('INSERT INTO commands VALUES(?,?,?)',[command.id,hash,new Date().toISOString()]);
      const audit=next.audit[0];run('INSERT INTO audit_log VALUES(?,?,?,?,?)',[audit.id,audit.actor,audit.date,audit.type,JSON.stringify(audit)]);
      const revision=current.revision+1;
      run("UPDATE app_settings SET value=? WHERE key='revision'",[String(revision)]);
      this.database.exec('COMMIT');this.cache={revision,state:next};return {revision,state:structuredClone(next)};
    } catch(error) { this.database.exec('ROLLBACK'); this.cache=null; throw error; }
  }

  close() { this.database.close();this.cache=null; }
}

const globalStore=globalThis as typeof globalThis & {nexoStore?:LocalStore};
export function getStore() { return globalStore.nexoStore ??= new LocalStore(); }
