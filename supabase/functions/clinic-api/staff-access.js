import * as perms from './permissions.js';
import * as branches from './branches.js';
const queueGrants=['bookings.read','bookings.create','bookings.status','patients.print','patients.read','patients.edit'];
const nurseGrants=[...queueGrants,'requests.read','patients.read','complaints.read','complaints.create','attachments.read','attachments.create','attachments.own.delete'];
function plan(state,uid,core){
 if(core.role(state,uid).r!=='admin')core.fail('ضبط حسابات الفروع متاح للأدمن فقط',403);
 const registry=branches.branches(state),roles=Object.entries(state.roles||{}),staff=[];
 for(const [branch,username]of [['alex','alex-sec'],['matrouh','matrouh-sec'],['dmn','dmn-sec'],['libya','libya-sec']]){
  if(!registry[branch])core.fail('أضف فرع '+branch+' قبل ضبط حساباته',409);
  const named=roles.find(([,r])=>r.u===username);
  if(named&&(!['sec','staff'].includes(named[1].r)||named[1].br!==branch||named[1].archivedAt||named[1].deletePending))core.fail('اسم '+username+' مرتبط بحساب مختلف أو مؤرشف؛ راجعه من المستخدمين أولًا',409);
  const matches=roles.filter(([,r])=>r.r==='sec'&&r.br===branch&&r.enabled!==false&&!r.archivedAt&&!r.deletePending);
  if(!named&&matches.length>1)core.fail('يوجد أكثر من حساب سكرتارية للفرع '+registry[branch].name+'؛ حدّد الحساب المطلوب بتسميته '+username+' أولًا',409);
  const dataMatches=roles.filter(([,r])=>r.r==='staff'&&r.br===branch&&r.enabled!==false&&!r.archivedAt&&!r.deletePending&&/data/i.test(r.u));
  if(!named&&!matches.length&&dataMatches.length>1)core.fail('يوجد أكثر من حساب داتا للفرع '+registry[branch].name+'؛ راجع الحساب المطلوب أولًا',409);
  const selected=named||matches[0]||dataMatches[0],old=selected?.[1]||{};
  const role={...old,u:username,r:'sec',br:branch,scope:'branch',enabled:true,displayName:old.displayName||'سكرتارية '+registry[branch].name,permissions:{...old.permissions,...Object.fromEntries(queueGrants.map(key=>[key,true]))}};
  staff.push({before:selected?.[1]||null,uid:selected?.[0]||null,username,create:!selected,role:perms.validateRole(role,core.fail,Object.keys(registry))});
 }
 for(const [id,old]of roles.filter(([,r])=>r.r==='nurse'&&r.enabled!==false&&!r.archivedAt&&!r.deletePending)){
  staff.push({before:old,uid:id,username:old.u,create:false,role:perms.validateRole({...old,scope:'all',permissions:{...old.permissions,...Object.fromEntries(nurseGrants.map(key=>[key,true]))}},core.fail,Object.keys(registry))});
 }
 return {staff};
}
export {plan,queueGrants,nurseGrants};
