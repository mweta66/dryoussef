const keys=['bookings.read','bookings.create','bookings.edit','bookings.status','bookings.delete','patients.read','patients.edit','patients.delete','complaints.read','complaints.create','complaints.edit','complaints.delete','notes.read','notes.edit','notifications.read','users.manage','clinic.manage','site.manage','data.export','data.delete'];
keys.push('patients.print','display.manage','data.import','data.restore','audit.details','attachments.read','attachments.create','attachments.delete','attachments.own.delete','sessions.manage','queue.configure','reports.export','audit.read');

const administrative=['display.manage','data.import','data.restore','audit.details','attachments.own.delete','users.manage','clinic.manage','site.manage','data.export','data.delete','audit.read','patients.delete'];
const defaults={doctor:keys.filter(k=>!administrative.includes(k)),sec:['patients.print','bookings.read','bookings.create','bookings.status'],nurse:['bookings.read','bookings.create','bookings.status','patients.print','patients.read','complaints.read','complaints.create','attachments.read','attachments.create','attachments.own.delete'],staff:['patients.print']};
function can(r,key){if(!keys.includes(key))return false;if(r.r==='admin')return keys.includes(key);return typeof r.permissions?.[key]==='boolean'?r.permissions[key]:(defaults[r.r]||[]).includes(key);}
function requirePermission(r,key){if(!can(r,key)){const e=new Error('ليس لديك صلاحية لهذه العملية');e.status=403;throw e;}}
function allBranches(r){return r.r==='admin'||r.scope==='all'||['doctor','nurse'].includes(r.r)&&r.scope===undefined;}
function normalize(r){return {...r,permissions:Object.fromEntries(keys.map(k=>[k,can(r,k)]))};}
function validateRole(r,fail,branches=['dmn','alex']){
 if(!r||!['admin','doctor','sec','nurse','staff'].includes(r.r)||!/^[a-z0-9._-]{3,64}$/.test(r.u||''))fail('بيانات المستخدم غير صحيحة');
 if(r.br!==undefined&&!branches.includes(r.br)||r.r==='sec'&&!r.br)fail('فرع غير صحيح');
 if(r.scope!==undefined&&!['all','branch'].includes(r.scope))fail('نطاق غير صحيح');
 if(r.enabled!==undefined&&typeof r.enabled!=='boolean')fail('حالة حساب غير صحيحة');
 if(r.permissions!==undefined&&(!r.permissions||Array.isArray(r.permissions)||Object.entries(r.permissions).some(([k,v])=>!keys.includes(k)||typeof v!=='boolean')))fail('صلاحيات غير صحيحة');
 return {r:r.r,u:r.u,br:r.br||branches[0],scope:r.scope||(['nurse','doctor'].includes(r.r)?'all':'branch'),enabled:r.enabled!==false,displayName:String(r.displayName||r.u).slice(0,100),permissions:r.permissions||{}};
}
module.exports={keys,can,requirePermission,allBranches,normalize,validateRole};
