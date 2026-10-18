import { timingSafeEqual } from 'node:crypto';
export const isProduction=()=>process.env.NODE_ENV==='production'&&process.env.NEXO_TEST_MODE!=='1';
export function publicOrigin(){
  const value=process.env.NEXO_APP_URL;if(!value)return null;
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(isProduction()&&url.protocol!=='https:'))throw Error('NEXO_APP_URL deve ser uma origem HTTPS, sem caminho ou credenciais.');
  return url.origin;
}
export function proxySecret(){
  const secret=process.env.NEXO_PROXY_SECRET??'';
  if(isProduction()&&!/^[a-f0-9]{64}$/.test(secret))throw Error('Configure NEXO_PROXY_SECRET com 32 bytes aleatórios em hexadecimal.');
  return secret;
}
export function trustedGateway(request:Request){
  if(!isProduction())return true;
  const expected=Buffer.from(proxySecret()),received=Buffer.from(request.headers.get('x-nexo-proxy-secret')??'');
  return expected.length===received.length&&timingSafeEqual(expected,received);
}
