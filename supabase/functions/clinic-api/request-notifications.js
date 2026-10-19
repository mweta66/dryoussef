import {createHash} from 'node:crypto';
import * as core from './core.js';
import * as perms from './permissions.js';
const kinds=['new','reschedule','cancel'];
const actions=['requestNotifications','requestNotificationRead','requestNotificationsReadAll'];
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function events(state,uid){
 const role=core.role(state,uid),readDetails=perms.can(role,'requests.read'),receipts=state.requestNotificationReads?.[uid]||{},rows=[];
 for(const request of Object.values(state.appointmentRequests||{})){
  if(!kinds.includes(request.kind)||(!perms.allBranches(role)&&request.branch!==role.br))continue;
  const common={requestId:request.id,kind:request.kind,branch:request.branch,date:request.date,status:request.status,canOpen:readDetails};
  // Receiving a notification never grants access to patient identity or request actions.
  if(readDetails)Object.assign(common,{name:request.name,phone:request.phone,requestedDate:request.requestedDate,requestedBranch:request.requestedBranch});
  const add=(suffix,event,at)=>{if(!Number.isFinite(Date.parse(at)))return;const id=request.id+':'+suffix;rows.push({...common,id,event,at,readAt:receipts[id]||null});};
  add('created','created',request.createdAt);
  if(['confirmed','rejected'].includes(request.status)&&request.decidedAt)add('decision:'+request.rev,request.status,request.decidedAt);
 }
 return rows.sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id));
}
function readAllToken(rows,uid){return digest({uid,ids:rows.map(x=>x.id)});}
function list(state,uid,input){
 const rows=events(state,uid),kind=input.kind||'all',status=input.status||'all';
 if(!['all',...kinds].includes(kind)||!['all','pending','confirmed','rejected'].includes(status)||input.unread!==undefined&&typeof input.unread!=='boolean')core.fail('فلتر إشعارات غير صحيح');
 const page=input.page??0;if(!Number.isSafeInteger(page)||page<0||page>100000)core.fail('صفحة غير صحيحة');
 const filtered=rows.filter(x=>(kind==='all'||x.kind===kind)&&(status==='all'||x.status===status)&&(!input.unread||!x.readAt));
 const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/30)-1));
 const pending=rows.filter(x=>x.event==='created'&&x.status==='pending'),minutes=state.settings?.bookingRequests?.requestOverdueMinutes||60;
 return {latestId:rows[0]?.id||null,items:filtered.slice(currentPage*30,(currentPage+1)*30),total:filtered.length,page:currentPage,pageSize:30,unread:rows.filter(x=>!x.readAt).length,pending:pending.length,overdue:pending.filter(x=>Date.now()-Date.parse(x.at)>=minutes*60000).length,newBookings:pending.filter(x=>x.kind==='new').length,reschedule:pending.filter(x=>x.kind==='reschedule').length,cancellations:pending.filter(x=>x.kind==='cancel').length,readAllToken:readAllToken(rows,uid),serverAt:new Date().toISOString()};
}
async function handle(adapter,input,uid){
 if(input.action==='requestNotifications')return list(await (adapter.readRequestNotifications?adapter.readRequestNotifications():adapter.read()),uid,input);
 if(input.action==='requestNotificationRead'&&(typeof input.id!=='string'||input.id.length>160||typeof input.read!=='boolean'))core.fail('اختر إشعارًا وحالة قراءة صحيحة');
 if(input.action==='requestNotificationsReadAll'&&typeof input.readAllToken!=='string')core.fail('حدّث الإشعارات أولًا');
 await adapter.mutate(original=>{
  const rows=events(original,uid),target=input.action==='requestNotificationRead'?rows.filter(x=>x.id===input.id):rows;
  if(input.action==='requestNotificationRead'&&!target.length)core.fail('الإشعار غير موجود في نطاق حسابك',404);
  if(input.action==='requestNotificationsReadAll'&&input.readAllToken!==readAllToken(rows,uid))core.fail('وصلت إشعارات جديدة؛ حدّث القائمة قبل تحديد الكل كمقروء',409);
  const state=structuredClone(original);state.requestNotificationReads||={};const reads=state.requestNotificationReads[uid]||={};
  const at=new Date().toISOString();for(const x of target){if(input.read===false)delete reads[x.id];else reads[x.id]=at;}
  // Keep receipts only for requests that still exist; never accept another user's identity from input.
  const known=new Set(Object.values(state.appointmentRequests||{}).flatMap(x=>[x.id+':created',x.id+':decision:'+x.rev]));
  for(const id of Object.keys(reads))if(!known.has(id))delete reads[id];
  return state;
 });
 return {ok:true};
}
export {handle,actions,events,list};
