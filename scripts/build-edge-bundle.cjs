// One-file dashboard deployment; package version pinned for reproducibility.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),args=[];
if(process.env.npm_config_cache)args.push('--cache='+process.env.npm_config_cache);
args.push('exec','--yes','--package=esbuild@0.25.10','--','esbuild','supabase/functions/clinic-api/index.js','--bundle','--format=esm','--platform=neutral','--external:node:*','--outfile=deployment/clinic-api.js');
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
