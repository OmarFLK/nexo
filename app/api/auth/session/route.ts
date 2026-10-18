import { requireSession } from '../../../../server/auth';
import { fail } from '../../../../server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json(await requireSession(request),{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(error);}}
