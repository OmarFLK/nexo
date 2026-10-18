import { cookies } from 'next/headers';
import type { Session } from './auth';
import {proxySecret} from './config';
export async function pageSession():Promise<Session|null>{
  const cookie=(await cookies()).toString();
  if(!cookie)return null;
  if(process.env.NEXO_API_URL){
    const response=await fetch(new URL('/api/auth/session',process.env.NEXO_API_URL),{headers:{Cookie:cookie,'x-nexo-proxy-secret':proxySecret()},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(response.status===401)return null;
    if(!response.ok)throw Error('Não foi possível conectar ao sistema. Tente novamente em instantes.');
    return response.json();
  }
  const {sessionFromCookie}=await import('./auth');return sessionFromCookie(cookie);
}
