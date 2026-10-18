import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HttpError, fail, limitedBody } from '../../../server/http';
import { requireSession } from '../../../server/auth';
import {normalizeImage} from '../../../server/images';
import {consumeLimit} from '../../../server/limits';
export const runtime='nodejs';
const folder=()=>resolve(process.env.NEXO_DATA_DIR??'data','uploads');
export async function POST(request:Request){
  try{
    const session=await requireSession(request,true);
    await consumeLimit(`upload:${session.user.id}`,20,15*60000);
    if(Number(request.headers.get('content-length'))>3000000)throw new HttpError('Foto deve ter até 3 MB.',413);
    const data=await limitedBody(request,3000000);
    const normalized=await normalizeImage(data,request.headers.get('content-type')??'');
    await mkdir(folder(),{recursive:true});
    const names=await readdir(folder());if(names.length>=5000)throw new HttpError('Limite de fotos atingido.',409);
    let used=0;for(const name of names)used+=(await stat(resolve(folder(),name))).size;
    if(used+normalized.length>256*1024*1024)throw new HttpError('Espaço de fotos atingiu o limite de 256 MB.',409);
    const key=randomUUID()+'.webp';await writeFile(resolve(folder(),key),normalized,{flag:'wx',mode:0o600});return Response.json({url:'/api/upload?key='+key},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return fail(error);}
}
export async function GET(request:Request){
  try{await requireSession(request);const key=new URL(request.url).searchParams.get('key');if(!key||!/^[-a-f0-9]{36}\.(png|jpg|webp)$/.test(key))throw new HttpError('Foto não encontrada.',404);
    let bytes:Buffer;try{bytes=await readFile(resolve(folder(),key));}catch{throw new HttpError('Foto não encontrada.',404);}
    const type=key.endsWith('png')?'image/png':key.endsWith('jpg')?'image/jpeg':'image/webp';return new Response(new Uint8Array(bytes),{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
  }catch(error){return fail(error);}
}
