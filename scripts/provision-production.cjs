// Trusted local administration only. Secrets and new account credentials stay
// in .private, which is never hosted or committed. The source export is read-only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const core=require('../server/core.cjs');
async function main(){
 const [configFile,sourceFile]=process.argv.slice(2);if(!configFile||!sourceFile)throw Error('Usage: provision-production.cjs PRIVATE_CONFIG SOURCE_EXPORT');
 const config=JSON.parse(fs.readFileSync(configFile,'utf8')),state=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')||!config.secretKey)throw Error('Private Supabase configuration missing');
 const call=async(p,options={})=>{const r=await fetch(config.url+p,{...options,headers:{apikey:config.secretKey,Authorization:'Bearer '+config.secretKey,'Content-Type':'application/json',...options.headers}});const j=await r.json().catch(()=>null);if(!r.ok)throw Error('Supabase returned '+r.status+' for '+p);return j};
 const rows=await call('/rest/v1/clinic_state?id=eq.true&select=payload,version');if(!rows?.[0]||Object.keys(rows[0].payload||{}).length)throw Error('Target clinic state must be newly initialized and empty');
 const existing=await call('/auth/v1/admin/users?page=1&per_page=1');if((existing.users||[]).length)throw Error('Target Auth must be empty; existing accounts are never overwritten');
 const users=[],newRoles={};
 const dir=path.resolve(__dirname,'../.private');fs.mkdirSync(dir,{recursive:true});
 for(const role of Object.values(state.roles||{})){
  const password=crypto.randomBytes(15).toString('base64url');
  const user=await call('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:role.u+'@clinic.app',password,email_confirm:true})});
  if(!user.id)throw Error('Auth did not return an account ID');newRoles[user.id]=role;users.push({username:role.u,uid:user.id,password,role:role.r,branch:role.br});
  fs.writeFileSync(path.join(dir,'production-accounts.json'),JSON.stringify(users,null,2));
 }
 if(!users.some(u=>u.role==='doctor'))throw Error('A doctor account is required');
 state.roles=newRoles;state.bookings||={};state.sequences||={};core.rebuild(state);
 const ok=await call('/rest/v1/rpc/clinic_compare_and_swap',{method:'POST',body:JSON.stringify({expected_version:rows[0].version,next_payload:state})});
 if(!ok)throw Error('The target changed during provisioning. Source and local credentials remain preserved.');
 console.log('Migrated '+users.length+' staff accounts and clinic data. New passwords saved privately; no source data changed.');
}
main().catch(e=>{console.error(e.message);process.exit(1)});
