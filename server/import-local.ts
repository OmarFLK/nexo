import type {PoolClient} from 'pg';
import type {LocalStore} from './store.ts';
export async function importLocal(client:Pick<PoolClient,'query'>,source:LocalStore){
  const snapshot=source.read();
  const owner=source.database.prepare('SELECT * FROM users').get() as {id:string;email:string;password_hash:string;created_at:string}|undefined;
  if(!owner)throw Error('Crie a conta proprietária antes de importar.');
  await client.query('BEGIN');
  try{
    const destination=await client.query("SELECT revision FROM nexo_workspace WHERE id='nexo' FOR UPDATE");
    const users=await client.query('SELECT id FROM nexo_users');
    const commands=await client.query('SELECT id FROM nexo_commands LIMIT 1');
    if(Number(destination.rows[0].revision)!==0||users.rows.length||commands.rows.length)throw Error('Destino já possui dados. A importação não sobrescreve um banco existente.');
    await client.query("UPDATE nexo_workspace SET revision=$1,state=$2::jsonb,updated_at=now() WHERE id='nexo'",[snapshot.revision,JSON.stringify(snapshot.state)]);
    await client.query('INSERT INTO nexo_users(id,email,password_hash,created_at) VALUES($1,$2,$3,$4)',[owner.id,owner.email.toLowerCase(),owner.password_hash,owner.created_at]);
    // Include only immutable receipts represented in the snapshot, even if the source is in use.
    const included=new Set(snapshot.state.applied);
    const receipts=source.database.prepare('SELECT * FROM commands ORDER BY rowid').all().filter(row=>included.has(String(row.id)));
    for(const row of receipts){
      const audit=source.database.prepare('SELECT * FROM audit_log WHERE id=?').get(row.id)!;
      await client.query('INSERT INTO nexo_commands(id,payload_hash,actor,created_at) VALUES($1,$2,$3,$4)',[row.id,row.payload_hash,audit.actor,row.created_at]);
      await client.query('INSERT INTO nexo_audit(id,actor,operation,data,created_at) VALUES($1,$2,$3,$4::jsonb,$5)',[row.id,audit.actor,audit.type,audit.data,audit.date]);
    }
    await client.query('COMMIT');return {products:snapshot.state.products.length,revision:snapshot.revision};
  }catch(error){await client.query('ROLLBACK');throw error;}
}
