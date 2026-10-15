const keys=['bookings.read','bookings.create','bookings.edit','bookings.status','bookings.delete','patients.read','patients.edit','patients.delete','complaints.read','complaints.create','complaints.edit','complaints.delete','notes.read','notes.edit','notifications.read','users.manage','clinic.manage','site.manage','data.export','data.delete'];
keys.push('sessions.manage','queue.configure','reports.export','audit.read');
keys.push('followups.read','followups.edit');
const administrative=['users.manage','clinic.manage','site.manage','data.export','data.delete','audit.read','patients.delete'];
const defaults={doctor:keys.filter(k=>!administrative.includes(k)),sec:['bookings.read','bookings.create','bookings.status','followups.read','followups.edit'],nurse:['patients.read','complaints.read','complaints.create'],staff:[]};
function can(r,key){if(r.r==='admin')return keys.includes(key);if(r.r==='doctor'&&administrative.includes(key))return false;return typeof r.permissions?.[key]==='boolean'?r.permissions[key]:(defaults[r.r]||[]).includes(key);}
function requirePermission(r,key){if(!can(r,key)){const e=new Error('ليس لديك صلاحية لهذه العملية');e.status=403;throw e;}}
function allBranches(r){return ['admin','doctor'].includes(r.r)||r.scope==='all';}
function normalize(r){return {...r,permissions:Object.fromEntries(keys.map(k=>[k,can(r,k)]))};}
function validateRole(r,fail){
 if(!r||!['admin','doctor','sec','nurse','staff'].includes(r.r)||!/^[a-z0-9._-]{3,64}$/.test(r.u||''))fail('بيانات المستخدم غير صحيحة');
 if(r.br!==undefined&&!['dmn','alex'].includes(r.br)||r.r==='sec'&&!r.br)fail('فرع غير صحيح');
 if(r.scope!==undefined&&!['all','branch'].includes(r.scope))fail('نطاق غير صحيح');
 if(r.enabled!==undefined&&typeof r.enabled!=='boolean')fail('حالة حساب غير صحيحة');
 if(r.permissions!==undefined&&(!r.permissions||Array.isArray(r.permissions)||Object.entries(r.permissions).some(([k,v])=>!keys.includes(k)||typeof v!=='boolean')))fail('صلاحيات غير صحيحة');
 return {r:r.r,u:r.u,br:r.br||'dmn',scope:r.scope||(r.r==='nurse'?'all':'branch'),enabled:r.enabled!==false,displayName:String(r.displayName||r.u).slice(0,100),permissions:r.permissions||{}};
}
export {keys,can,requirePermission,allBranches,normalize,validateRole};
