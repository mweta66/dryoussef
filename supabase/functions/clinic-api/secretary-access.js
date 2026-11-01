import * as core from './core.js';
import * as perms from './permissions.js';
const action='secretaryClinicalAccessUpgrade',version=1;
function upgrade(original,uid){
 if(core.role(original,uid).r!=='admin')core.fail('تفعيل قراءة ملف الطبيب للسكرتارية متاح للأدمن فقط',403);
 if(Number(original.settings?.secretaryClinicalAccessVersion)>=version)return {state:original,changed:false,updated:0};
 const state=structuredClone(original),branches=new Set(core.branchIds(state));let updated=0;
 for(const role of Object.values(state.roles||{})){
  if(role.r!=='sec'||role.enabled===false||role.archivedAt||role.deletePending||!branches.has(role.br))continue;
  const permissions={...role.permissions,...Object.fromEntries(perms.secretaryReadGrants.map(key=>[key,true]))};
  if(JSON.stringify(permissions)!==JSON.stringify(role.permissions||{})){role.permissions=permissions;updated++;}
 }
 state.settings||={};state.settings.secretaryClinicalAccessVersion=version;return {state,changed:true,updated};
}
async function handle(adapter,input,uid){let result;await adapter.mutate(state=>{result=upgrade(state,uid);return result.state});return {ok:true,changed:result.changed,updated:result.updated,version};}
export {action,upgrade,handle};
