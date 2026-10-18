import sharp from 'sharp';
import {HttpError} from './http.ts';
let active=0;
export async function normalizeImage(bytes:Uint8Array,contentType:string){
  const allowed:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};
  const expected=allowed[contentType.split(';')[0].trim().toLowerCase()];
  if(!expected)throw new HttpError('Use PNG, JPEG ou WebP.',415);
  if(bytes.length>3000000)throw new HttpError('Foto deve ter até 3 MB.',413);
  const prefix=Buffer.from(bytes.subarray(0,12));
  const signature=expected==='png'?prefix.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):expected==='jpeg'?prefix[0]===255&&prefix[1]===216&&prefix[2]===255:prefix.toString('ascii',0,4)==='RIFF'&&prefix.toString('ascii',8,12)==='WEBP';
  if(!signature)throw new HttpError('O conteúdo não corresponde ao formato da foto.');
  if(active>=2)throw new HttpError('Aguarde o envio da outra foto.',429);
  active++;
  try{
    const input=sharp(bytes,{limitInputPixels:16000000,failOn:'error',animated:false});
    const meta=await input.metadata();
    if(meta.format!==expected||!meta.width||!meta.height||meta.width>6000||meta.height>6000||(meta.pages??1)>1)throw Error('Invalid image');
    // Decode and re-encode pixels. Strip EXIF/GPS, appended payloads and original metadata.
    return await input.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).timeout({seconds:5}).toBuffer();
  }catch(error){if(error instanceof HttpError)throw error;throw new HttpError('Foto inválida, corrompida ou grande demais.');}
  finally{active--;}
}
