import {readFile,readdir,mkdir,mkdtemp,writeFile,lstat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
// An allowlist avoids publishing retired scaffolds, local accounts, images and Git history.
const files=['.gitignore','.env.example','.node-version','.npmrc','.github/workflows/ci.yml','.github/dependabot.yml','AGENTS.md','README.md','SECURITY.md','SECURITY_REVIEW.md','DEPLOY.md','ARCHITECTURE.md','DATABASE_SCHEMA.md','API_INTEGRATIONS.md','IMPLEMENTATION_PLAN.md','next.config.ts','proxy.ts','package.json','package-lock.json','tsconfig.json','postcss.config.mjs','render.yaml','vercel.json','iniciar-nexo.cmd','lib/domain.ts','lib/price-for-profit.ts','public/favicon.svg',...['run-local','database','create-owner','import-local','qa','typecheck','prepare-release','preflight'].map(name=>'scripts/'+name+'.mjs')];
async function collect(folder){for(const name of await readdir(folder)){const path=folder+'/'+name,info=await lstat(path);if(info.isSymbolicLink())throw Error('Symlinks are not included in releases.');if(info.isDirectory())await collect(path);else files.push(path);}}
for(const folder of ['app','server','tests','scripts/sql'])await collect(folder);
await mkdir('.sites-runtime',{recursive:true});const output=await mkdtemp(resolve('.sites-runtime/release-'));
const checks=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,/scrypt\$131072\$8\$1\$[a-f0-9]{48}\$[a-f0-9]{128}/,/\bAKIA[0-9A-Z]{16}\b/];
const manifest=[];
for(const path of [...new Set(files)].sort()){
  if(/(?:^|\/)\.env(?!\.example$)|\.(?:sqlite|db|pem|key|p12|log)$/i.test(path))throw Error('Private file in release: '+path);
  const contents=await readFile(path);const text=contents.toString('utf8');
  if(checks.some(pattern=>pattern.test(text)))throw Error('Possible secret detected in '+path+'; contents were not printed.');
  const credentials=[...text.matchAll(/postgres(?:ql)?:\/\/([^:\s]+):([^@\s]+)@/g)];
  if(credentials.some(([,user,password])=>user!=='USUARIO'||password!=='SENHA'))throw Error('Possible database credential detected in '+path);
  const target=join(output,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,contents);manifest.push({path,sha256:createHash('sha256').update(contents).digest('hex'),bytes:contents.length});
}
await writeFile(join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,files:manifest.length,bytes:manifest.reduce((n,f)=>n+f.bytes,0),secretScan:'passed'}));
