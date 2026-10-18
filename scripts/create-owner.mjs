import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {createOwner} from '../server/auth.ts';
if(process.env.DATABASE_MIGRATION_URL)process.env.DATABASE_URL=process.env.DATABASE_MIGRATION_URL;
if(process.env.DATABASE_URL){const {postgres}=await import('../server/postgres.ts');await postgres(true);}
let password='';
try{
  let email;
  if(process.argv.includes('--stdin')){
    if(stdin.isTTY)stdin.setRawMode(true);
    console.log('Aguardando credenciais pela entrada padrão (não serão exibidas).');
    // Explicit machine-input mode. Never echo or log the contents.
    const rl=createInterface({input:stdin,crlfDelay:Infinity,terminal:false});
    const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();if(stdin.isTTY)stdin.setRawMode(false);stdin.pause();
    const data=JSON.parse(line);email=data.email;password=data.password;
  }else{
    const rl=createInterface({input:stdin,output:stdout});email=await rl.question('E-mail da conta proprietária: ');rl.close();
    if(!stdin.isTTY)throw Error('Use --stdin para entrada automatizada.');
    stdout.write('Senha (entrada oculta): ');stdin.setRawMode(true);stdin.resume();
    password=await new Promise((resolve,reject)=>{
      const input=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){cleanup();reject(Error('Cancelado.'));return;}if(char==='\r'||char==='\n'){cleanup();stdout.write('\n');resolve(password);return;}if(char==='\u007f'||char==='\b')password=password.slice(0,-1);else if(char>=' ')password+=char;}};
      function cleanup(){stdin.removeListener('data',input);stdin.setRawMode(false);stdin.pause();}
      stdin.on('data',input);
    });
  }
  if(typeof email!=='string'||typeof password!=='string')throw Error('Credenciais inválidas.');
  await createOwner(email,password,process.argv.includes('--reset-password'),true);console.log('Conta proprietária preparada.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{password='';if(process.env.DATABASE_URL){const {pool}=await import('../server/postgres.ts');await pool().end();}else{const {getStore}=await import('../server/store.ts');getStore().close();}}
