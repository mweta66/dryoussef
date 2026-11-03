const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const manifest=require('../fixtures/training-branch-assignments-500.json'),phone=Object.keys(manifest)[0],releaseVersion=require('../clinic-release.json').version;
const child=`import {pathToFileURL} from 'node:url';
const state=JSON.parse(process.argv[2]);let handler;console.info=()=>{};
globalThis.Deno={env:{get:name=>name==='SUPABASE_URL'?'https://isolated.invalid':name==='SUPABASE_SERVICE_ROLE_KEY'?'local-test-only':undefined},serve:fn=>{handler=fn}};
globalThis.fetch=async(url,options={})=>{const u=new URL(url),body=JSON.parse(options.body||'{}');let data;
if(u.pathname==='/auth/v1/user')data={id:'qa_admin'};
else if(u.pathname==='/rest/v1/rpc/clinic_session_active')data=true;
else if(u.pathname==='/rest/v1/clinic_state')data=[{version:1,payload:state}];
else if(u.pathname==='/rest/v1/rpc/clinic_read_slice')data=Object.fromEntries(body.fields.map(k=>[k,state[k]||{}]));
else throw Error('Unexpected network access in isolated package test: '+u.pathname);
return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})};
await import(pathToFileURL(process.argv[1]).href);if(typeof handler!=='function')throw Error('No Edge handler registered');
const invoke=(body,token)=>handler(new Request('https://isolated.invalid/clinic-api',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
const settings=await invoke({action:'get',path:'settings'});if(settings.status!==200||!(await settings.json()).data.branches.alex)throw Error('Public settings did not load');
const denied=await invoke({action:'systemVersion'});if(denied.status!==401)throw Error('Protected action was not rejected');
const token='test.'+Buffer.from(JSON.stringify({session_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})).toString('base64url')+'.test';
const training=await invoke({action:'organizeTrainingPreview',accounts:{dmn:'one',libya:'two'}},token);const result=await training.json();if(training.status!==200||result.data.missing!==499)throw Error('Embedded training map did not execute: '+training.status);
const version=await invoke({action:'systemVersion'},token);const release=(await version.json()).data;if(version.status!==200||release.version!==process.argv[3])throw Error('Wrong bundled release');
console.log(JSON.stringify({publicSettings:true,protectedDenied:true,trainingMapExecuted:true,release:release.version}));`;
function run(root,entry){
 const state={roles:{qa_admin:{r:'admin',u:'admin'},one:{r:'staff',u:'data-one'},two:{r:'staff',u:'data-two'}},settings:{branches:Object.fromEntries(['alex','matrouh','dmn','libya'].map(b=>[b,{name:b}]))},patients:{[phone]:{n:'مريضة اختبار التعبئة',d:'2026-11-01'}},bookings:{}};
 const result=spawnSync(process.execPath,['--input-type=module','-e',child,path.join(root,entry),JSON.stringify(state),releaseVersion],{cwd:root,encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr||result.stdout);assert.equal(JSON.parse(result.stdout.trim().split('\n').at(-1)).trainingMapExecuted,true);
}
test('Edge source directory starts and uses its training map without any fixtures directory',()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-source-only-'));try{fs.cpSync('supabase/functions/clinic-api',temp,{recursive:true});fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');assert.equal(fs.existsSync(path.join(temp,'fixtures')),false);run(temp,'index.js');}finally{fs.rmSync(temp,{recursive:true,force:true})}});
test('single-file dashboard bundle runs in an empty directory with no sibling modules or fixtures',()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clinic-bundle-only-'));try{const source=fs.readFileSync('deployment/clinic-api.js','utf8');assert.ok(source.startsWith('// CLINIC_API_BUNDLE_START '+releaseVersion+'\n'));assert.ok(source.trimEnd().endsWith('// CLINIC_API_BUNDLE_END '+releaseVersion));fs.writeFileSync(path.join(temp,'index.mjs'),source);run(temp,'index.mjs');}finally{fs.rmSync(temp,{recursive:true,force:true})}});
