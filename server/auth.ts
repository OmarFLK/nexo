import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { database } from './database.ts';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password.ts';
import { HttpError, localRequest } from './http.ts';
import {consumeLimit} from './limits.ts';
import {securityLog} from './security-log.ts';
export type Session = { user:{id:string;email:string}; csrf:string };
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const credential=(id:unknown,email:unknown,passwordHash:unknown)=>digest(JSON.stringify([id,email,passwordHash]));
export const secureCookies=()=>process.env.NODE_ENV==='production'&&process.env.NEXO_TEST_MODE!=='1';
export const cookieName=()=>secureCookies()?'__Host-nexo_session':'nexo_session';
export function cookieToken(cookie:string|null) { return cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName()+'='))?.slice(cookieName().length+1)??''; }
export function sessionCookie(token:string,maxAge=43200) { return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies()?'; Secure':''}`; }
const table=(kind:string,name:string)=>kind==='postgres'?'nexo_'+name:name;
export async function sessionFromCookie(cookie:string|null):Promise<Session|null> {
  const token=cookieToken(cookie);if(!/^[a-f0-9]{64}$/.test(token))return null;
  const db=await database(), now=Date.now();
  const rows=await db.query(`SELECT u.id,u.email,u.password_hash,s.credential_hash,s.expires_at,s.last_seen FROM ${table(db.kind,'sessions')} s JOIN ${table(db.kind,'users')} u ON u.id=s.user_id WHERE s.token_hash=?`,[digest(token)]);
  const row=rows[0];if(!row)return null;
  if(row.credential_hash!==credential(row.id,row.email,row.password_hash)||Number(row.expires_at)<=now||Number(row.last_seen)<now-30*60000){await db.query(`DELETE FROM ${table(db.kind,'sessions')} WHERE token_hash=?`,[digest(token)]);return null;}
  if(Number(row.last_seen)<now-60000)await db.query(`UPDATE ${table(db.kind,'sessions')} SET last_seen=? WHERE token_hash=?`,[now,digest(token)]);
  return {user:{id:String(row.id),email:String(row.email)},csrf:digest('csrf:'+token)};
}
export async function requireSession(request:Request,write=false) {
  localRequest(request,write);
  const session=await sessionFromCookie(request.headers.get('cookie'));
  if(!session)throw new HttpError('Sua sessão expirou. Entre novamente.',401);
  await consumeLimit(`api:${session.user.id}:${write?'write':'read'}`,write?120:600,5*60000);
  if(write){const value=request.headers.get('x-csrf-token')??'';if(!/^[a-f0-9]{64}$/.test(value)||!timingSafeEqual(Buffer.from(value),Buffer.from(session.csrf)))throw new HttpError('Atualize a página e tente novamente.',403);}
  return session;
}
export async function createOwner(email:string,password:string,reset=false,administrative=false) {
  email=email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('E-mail inválido.');
  const db=await database(administrative);const users=table(db.kind,'users'),sessions=table(db.kind,'sessions');
  const [owner]=await db.query(`SELECT id,email FROM ${users}`);
  if(owner&&!reset)throw Error('A conta proprietária já existe. Use --reset-password para trocar a senha.');
  if(owner&&owner.email!==email)throw Error('O e-mail não corresponde à conta proprietária.');
  const hash=await hashPassword(password);
  if(owner){await db.query(`UPDATE ${users} SET password_hash=? WHERE id=?`,[hash,owner.id]);await db.query(`DELETE FROM ${sessions} WHERE user_id=?`,[owner.id]);}
  else await db.query(`INSERT INTO ${users}(id,email,password_hash,created_at) VALUES(?,?,?,?)`,[randomUUID(),email,hash,new Date().toISOString()]);
}
export async function login(email:unknown,password:unknown,previousCookie:string|null) {
  const normalized=typeof email==='string'?email.trim().toLowerCase():'';
  if(!normalized||normalized.length>254||typeof password!=='string'||Buffer.byteLength(password)>256)throw new HttpError('E-mail ou senha incorretos.',401);
  const db=await database(),users=table(db.kind,'users'),sessions=table(db.kind,'sessions'),now=Date.now();
  try{await consumeLimit('login:all',30,15*60000);await consumeLimit(`login:${normalized}`,8,15*60000);}catch(error){securityLog('login_limited',normalized);throw error;}
  const [owner]=await db.query(`SELECT id,email,password_hash FROM ${users} WHERE email=?`,[normalized]);
  const valid=await verifyPassword(password,owner?String(owner.password_hash):dummyPasswordHash);
  if(!owner||!valid){securityLog('login_failed',normalized);throw new HttpError('E-mail ou senha incorretos.',401);}
  const token=randomBytes(32).toString('hex');
  const previous=cookieToken(previousCookie);
  if(previous)await db.query(`DELETE FROM ${sessions} WHERE token_hash=?`,[digest(previous)]);
  await db.query(`DELETE FROM ${sessions} WHERE expires_at<? OR last_seen<?`,[now,now-30*60000]);
  await db.query(`INSERT INTO ${sessions}(token_hash,user_id,credential_hash,expires_at,last_seen) VALUES(?,?,?,?,?)`,[digest(token),owner.id,credential(owner.id,owner.email,owner.password_hash),now+12*3600000,now]);
  securityLog('login_succeeded',normalized);
  return token;
}
export async function logout(cookie:string|null) { const db=await database();const token=cookieToken(cookie);if(token)await db.query(`DELETE FROM ${table(db.kind,'sessions')} WHERE token_hash=?`,[digest(token)]); }
