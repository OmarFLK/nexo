import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const options = { N:131072, r:8, p:1, maxmem:192*1024*1024 };
let active=0;
async function derive(password:string,salt:string) {
  if(active>=2)throw Error('AUTH_BUSY');
  active++;
  try { return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,options,(error,key)=>error?reject(error):resolve(key))); }
  finally { active--; }
}
export async function hashPassword(password:string) {
  if(password.length<12||Buffer.byteLength(password)>256)throw Error('Use uma senha de 12 a 256 bytes.');
  const salt=randomBytes(24).toString('hex');
  return `scrypt$131072$8$1$${salt}$${(await derive(password,salt)).toString('hex')}`;
}
export async function verifyPassword(password:string,encoded:string) {
  const parts=encoded.split('$');
  if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$131072$8$1'||!/^[a-f0-9]{48}$/.test(parts[4])||!/^[a-f0-9]{128}$/.test(parts[5]))return false;
  return timingSafeEqual(await derive(password,parts[4]),Buffer.from(parts[5],'hex'));
}
export const dummyPasswordHash=`scrypt$131072$8$1$${'0'.repeat(48)}$${'0'.repeat(128)}`;
