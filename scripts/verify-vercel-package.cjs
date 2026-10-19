/* Verify the upload boundary, not just a build with excluded source still present. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-vercel-'));
const files=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
try{
 const ignored=new Set(files(['ls-files','-ci','-z','--exclude-from=.vercelignore']));
 for(const name of files(['ls-files','-z'])){if(ignored.has(name))continue;const source=path.join(root,name);if(!fs.existsSync(source)||!fs.statSync(source).isFile())continue;const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}
 assert.equal(fs.existsSync(path.join(dir,'server')),false,'Private server source must remain excluded');assert.equal(fs.existsSync(path.join(dir,'supabase')),false,'Supabase source must remain excluded');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'vercel.json'))).buildCommand,'npm run build:site');
 execFileSync('npm',['run','build:site'],{cwd:dir,stdio:'pipe'});
 const publicDir=path.join(dir,'public'),html=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
 for(const id of ['patient-whatsapp','patient-whatsapp-contact'])assert.ok(html.includes('id="'+id+'"'),'Missing static WhatsApp link: '+id);
 for(const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^" ]*)?)"/g)){const asset=match[1].split('?')[0];if(/^https?:/.test(asset))continue;assert.ok(fs.existsSync(path.join(publicDir,asset.replace(/^\//,''))),'Missing patient asset: '+asset);}
 for(const id of ['alex','matrouh','dmn','libya'])assert.ok(fs.existsSync(path.join(publicDir,'branches',id+'.html')));
 const handler=require(path.join(dir,'api/branch.js')),res={headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
 Promise.resolve(handler({query:{branch:'unknown'}},res)).then(()=>{assert.equal(res.statusCode,404);assert.ok(res.body.includes('noindex'));assert.equal(fs.existsSync(path.join(dir,'server')),false);assert.equal(fs.existsSync(path.join(dir,'supabase')),false);console.log('Vercel-filtered upload builds successfully, patient assets and WhatsApp links exist, and branch API loads without private source.');fs.rmSync(dir,{recursive:true,force:true});}).catch(error=>{fs.rmSync(dir,{recursive:true,force:true});console.error(error);process.exitCode=1;});
}catch(error){fs.rmSync(dir,{recursive:true,force:true});throw error;}
