import { networkInterfaces } from 'node:os';
import { DomainError } from '../lib/domain.ts';
import {trustedGateway,isProduction,publicOrigin} from './config.ts';
export class HttpError extends Error { status:number; constructor(message:string,status=400){super(message);this.status=status;} }
export function localRequest(request:Request,write=false){
  if(!trustedGateway(request))throw new HttpError('Acesso não autorizado.',403);
  const origin=request.headers.get('origin');
  const canonical=process.env.NEXO_APP_URL;
  if(process.env.NODE_ENV==='production'&&!canonical&&process.env.NEXO_TEST_MODE!=='1')throw new HttpError('Configure o endereço público do sistema.',503);
  if(canonical){
    const expected=new URL(publicOrigin()!);
    if(isProduction()&&expected.protocol!=='https:')throw new HttpError('O endereço público deve usar HTTPS.',503);
    if(write&&origin!==expected.origin)throw new HttpError('Origem não autorizada.',403);
  } else {
    const host=request.headers.get('host')??new URL(request.url).host;
    let hostname:string;try{hostname=new URL('http://'+host).hostname.replace(/^\[|\]$/g,'');}catch{throw new HttpError('Endereço inválido.',403);}
    const allowed=new Set(['localhost','127.0.0.1','::1',...Object.values(networkInterfaces()).flatMap(items=>(items??[]).map(i=>i.address)),...(process.env.NEXO_ALLOWED_HOSTS??'').split(',').filter(Boolean)]);
    if(!allowed.has(hostname))throw new HttpError('Endereço não autorizado.',403);
    if(write&&origin!==new URL('http://'+host).origin)throw new HttpError('Origem não autorizada.',403);
  }
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError('Origem não autorizada.',403);
}
export async function limitedBody(request:Request,limit:number){
  if(Number(request.headers.get('content-length'))>limit)throw new HttpError('Requisição muito grande.',413);
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  let timedOut=false;const deadline=setTimeout(()=>{timedOut=true;void reader.cancel();},10000);deadline.unref();
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new HttpError('Requisição muito grande.',413);}chunks.push(value);} }
  finally {clearTimeout(deadline);reader.releaseLock();}
  if(timedOut)throw new HttpError('Tempo de envio excedido.',408);
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function jsonBody(request:Request){
  localRequest(request,true);
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError('Envie JSON.',415);
  const raw=await limitedBody(request,65536);
  try{const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{throw new HttpError('JSON inválido.');}
}
export function fail(error:unknown){
  const message=error instanceof Error?error.message:'';
  const internal=!(error instanceof HttpError)&&!(error instanceof DomainError);
  if(internal)console.error('[Nexo] Falha interna na operação.');
  const status=error instanceof HttpError?error.status:message==='AUTH_BUSY'?429:internal?500:400;
  return Response.json({error:internal?'Não foi possível concluir a operação. Tente novamente.':message||'Não foi possível concluir a operação.'},{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'900'}:{})}});
}
