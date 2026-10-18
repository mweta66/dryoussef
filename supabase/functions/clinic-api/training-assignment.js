import assignments from '../../../fixtures/training-branch-assignments-500.json' with {type:'json'};
import * as core from './core.js';
const grants=['patients.print','patients.read','patients.edit','bookings.read','bookings.create','bookings.edit','bookings.status','complaints.read','complaints.create','attachments.read','attachments.create'];
function preview(state,uid,accounts){
 if(core.role(state,uid).r!=='admin')core.fail('تنظيم بيانات التدريب متاح للأدمن فقط',403);
 if(!accounts||typeof accounts.dmn!=='string'||typeof accounts.libya!=='string'||accounts.dmn===accounts.libya)core.fail('اختر حسابين مختلفين لإدخال البيانات');
 const roles=[];
 for(const [branch,username,name]of [['dmn','dmn-sec','دمنهور'],['libya','libya-sec','ليبيا']]){
  const id=accounts[branch],old=state.roles?.[id];
  if(!old||!['staff','sec'].includes(old.r)||old.enabled===false||old.archivedAt||old.deletePending)core.fail('اختر حساب إدخال بيانات فعالًا لكل مجموعة');
  if(old.r==='sec'&&old.br!==branch)core.fail('حساب السكرتارية المختار تابع لفرع آخر؛ اختر حساب الفرع الصحيح',409);
  if(Object.entries(state.roles).some(([other,r])=>other!==id&&r.u===username))core.fail('اسم الدخول '+username+' مستخدم بالفعل',409);
  roles.push({uid:id,before:old,role:{...old,u:username,r:'sec',br:branch,scope:'branch',displayName:name,permissions:{...old.permissions,...Object.fromEntries(grants.map(key=>[key,true]))}}});
 }
 const counts={alex:0,matrouh:0,dmn:0,libya:0};for(const [phone,b]of Object.entries(assignments))if(state.patients?.[phone])counts[b]++;
 return {roles,counts,missing:500-Object.values(counts).reduce((a,b)=>a+b,0)};
}
function organize(original,uid){
 if(core.role(original,uid).r!=='admin')core.fail('غير مصرح',403);
 const s=structuredClone(original);if(!core.branchIds(s).includes('libya'))core.fail('فرع ليبيا غير موجود',409);
 for(const [phone,branch]of Object.entries(assignments))if(s.patients?.[phone])s.patients[phone].br=branch;
 return s;
}

export {preview,organize};
