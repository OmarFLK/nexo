import {createHash} from 'node:crypto';
export function securityLog(event:string,identity=''){
  console.info(JSON.stringify({type:'security',event,time:new Date().toISOString(),...(identity?{subject:createHash('sha256').update(identity).digest('hex').slice(0,16)}:{})}));
}
