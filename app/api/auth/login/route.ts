import { login,sessionCookie } from '../../../../server/auth';
import { jsonBody,fail } from '../../../../server/http';
export const runtime='nodejs';
export async function POST(request:Request){
  try {const body=await jsonBody(request);const token=await login(body.email,body.password,request.headers.get('cookie'));return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(token),'Cache-Control':'no-store'}});}
  catch(error){return fail(error);}
}
