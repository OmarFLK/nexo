import { readWorkspace,executeWorkspace } from '../../../server/database';
import { requireSession } from '../../../server/auth';
import { jsonBody, fail } from '../../../server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request:Request){
  try{await requireSession(request);const result=await readWorkspace();return Response.json({store:{id:'nexo',name:'Nexo'},...result},{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}
}
export async function POST(request:Request){
  try{const session=await requireSession(request,true);const body=await jsonBody(request);return Response.json(await executeWorkspace(body.command,session.user.email),{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}
}
