// One-file dashboard deployment; package version pinned for reproducibility.
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const root=path.resolve(__dirname,'..'),args=[];
require('./sync-training-edge.cjs');
const release=JSON.parse(fs.readFileSync(path.join(root,'clinic-release.json'),'utf8')).version;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-edge-build-')),metadata=path.join(temp,'metadata.json');
if(process.env.npm_config_cache)args.push('--cache='+process.env.npm_config_cache);
args.push('exec','--yes','--package=esbuild@0.25.10','--','esbuild','supabase/functions/clinic-api/index.js','--bundle','--format=esm','--platform=neutral','--external:node:*','--banner:js=// CLINIC_API_BUNDLE_START '+release,'--footer:js=// CLINIC_API_BUNDLE_END '+release,'--metafile='+metadata,'--outfile=deployment/clinic-api.js');
try{
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0){process.exitCode=result.status??1;}
 else{const info=JSON.parse(fs.readFileSync(metadata,'utf8'));for(const output of Object.values(info.outputs))for(const item of output.imports||[])if(!item.external||!item.path.startsWith('node:'))throw Error('Dashboard bundle has an unsupported runtime import: '+item.path);}
}finally{fs.rmSync(temp,{recursive:true,force:true});}
