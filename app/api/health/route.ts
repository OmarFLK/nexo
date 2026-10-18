export const runtime='nodejs';
export const dynamic='force-dynamic';
import {database} from '../../../server/database';
export async function GET(){try{const db=await database();await db.query('SELECT 1 AS ready');return Response.json({status:'ok',...(process.env.NEXO_TEST_MODE==='1'?{testMode:true}:{})},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
