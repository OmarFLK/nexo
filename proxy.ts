import {NextResponse,type NextRequest} from 'next/server';
import {randomBytes} from 'node:crypto';
import {proxySecret,isProduction} from './server/config';

export function proxy(request:NextRequest){
  const headers=new Headers(request.headers);
  // Never forward a client-supplied gateway credential.
  headers.delete('x-nexo-proxy-secret');
  if(request.nextUrl.pathname.startsWith('/api/')&&process.env.NEXO_API_URL){
    headers.set('x-nexo-proxy-secret',proxySecret());
    const target=new URL(request.nextUrl.pathname+request.nextUrl.search,process.env.NEXO_API_URL);
    const response=NextResponse.rewrite(target,{request:{headers}});
    response.headers.set('Cache-Control','no-store');return response;
  }
  if(request.nextUrl.pathname.startsWith('/api/'))return NextResponse.next();
  const nonce=randomBytes(24).toString('base64');
  const development=process.env.NODE_ENV==='development';
  const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'",`connect-src 'self'${development?' ws: wss:':''}`,"img-src 'self' data: blob:","font-src 'self'","object-src 'none'","frame-src 'none'","frame-ancestors 'none'","base-uri 'self'","form-action 'self'",...(isProduction()?["upgrade-insecure-requests"]:[])].join('; ');
  headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
  const response=NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy',csp);
  response.headers.set('Cache-Control','private, no-store, max-age=0');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg).*)']};
