// Run on the developer's computer with DATABASE_URL pointing at an EMPTY Neon database.
import {LocalStore} from '../server/store.ts';
import {postgres,pool} from '../server/postgres.ts';
import {importLocal} from '../server/import-local.ts';
if(process.env.DATABASE_MIGRATION_URL)process.env.DATABASE_URL=process.env.DATABASE_MIGRATION_URL;
const source=new LocalStore();let client;
try{
  if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL para o Neon de destino.');
  client=await(await postgres(true)).connect();const result=await importLocal(client,source);
  console.log(`Importação concluída. ${result.products} produtos. Conta proprietária preservada. Sessões não foram transferidas.`);
  console.log('Se houver fotos, copie data/uploads para NEXO_DATA_DIR/uploads no disco persistente do Render.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{client?.release();source.close();if(process.env.DATABASE_URL)await pool().end();}
