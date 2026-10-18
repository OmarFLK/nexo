import { requireSession,logout,sessionCookie } from '../../../../server/auth';
import { fail } from '../../../../server/http';
export const runtime='nodejs';
export async function POST(request:Request){
  try{await requireSession(request,true);await logout(request.headers.get('cookie'));return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie('',0),'Cache-Control':'no-store'}});}catch(error){return fail(error);}
}
