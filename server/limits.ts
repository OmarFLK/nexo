import {createHash} from 'node:crypto';
import {database} from './database.ts';
import {HttpError} from './http.ts';
export async function consumeLimit(scope:string,maximum:number,windowMs:number){
  const db=await database(),table=db.kind==='postgres'?'nexo_login_limits':'login_limits',now=Date.now(),key=createHash('sha256').update(scope).digest('hex');
  await db.query(`DELETE FROM ${table} WHERE reset_at<?`,[now]);
  const [row]=await db.query(`INSERT INTO ${table}(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN ${table}.reset_at<? THEN 1 ELSE ${table}.attempts+1 END,reset_at=CASE WHEN ${table}.reset_at<? THEN excluded.reset_at ELSE ${table}.reset_at END RETURNING attempts`,[key,now+windowMs,now,now]);
  if(Number(row.attempts)>maximum)throw new HttpError('Limite de requisições atingido. Aguarde e tente novamente.',429);
}
