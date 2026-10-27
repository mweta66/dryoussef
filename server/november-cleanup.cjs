const core=require('./core.cjs');
const perms=require('./permissions.cjs');
const provenance=require('./entry-provenance.cjs');
const CUTOFF='2026-11-01',INSTANT=Date.parse('2026-10-31T22:00:00.000Z'); // Cairo is UTC+02 on November 1.
function authorize(s,uid){if(core.role(s,uid).r!=='admin')core.fail('الحذف متاح للأدمن فقط',403);perms.requirePermission(core.role(s,uid),'data.delete');}
function protectedEntry(s,item){const m=s.recordProvenance?.[item.key];if(!m||m.origin==='training'||item.row.trainingBatch||item.row.booking?.trainingBatch)return false;return (m.origin==='manual'&&Date.parse(m.createdAt)>=INSTANT)||Date.parse(m.lastManualAt)>=INSTANT;}
function inspect(s,uid){
 authorize(s,uid);const items=provenance.entries(s),keep=new Set(items.filter(x=>protectedEntry(s,x)).map(x=>x.key)),phones=new Set(items.filter(x=>keep.has(x.key)).map(x=>x.phone).filter(Boolean)),bookingIds=new Set(items.filter(x=>keep.has(x.key)&&x.path[0]==='bookings').map(x=>x.row.id));
 // Preserve identity records required by retained visits/bookings and their check-in status.
 for(const item of items)if(item.path[0]==='patients'&&phones.has(item.phone)||item.path[0]==='checkins'&&bookingIds.has(item.path[1]))keep.add(item.key);
 const remove=items.filter(x=>!keep.has(x.key)),deleted={},retained={};
 for(const item of items){const target=keep.has(item.key)?retained:deleted;target[item.path[0]]=(target[item.path[0]]||0)+1;}
 const previewToken=JSON.stringify([s.audit?.at(-1)?.id||null,s.audit?.length||0,remove.map(x=>x.key),[...keep]]);
 return {cutoff:CUTOFF,deleted,retained,deleteCount:remove.length,retainCount:keep.size,previewToken,remove,keep};
}
function preview(s,uid){const {remove,keep,...result}=inspect(s,uid);return result;}
function apply(original,uid,input){
 const plan=inspect(original,uid);if(input.confirmation!=='DELETE_NON_MANUAL_BEFORE_NOVEMBER_2026')core.fail('تأكيد حذف البيانات القديمة مطلوب');if(input.previewToken!==plan.previewToken)core.fail('تغيرت البيانات منذ المعاينة؛ افتح ملخص الحذف مجددًا',409);
 const s=structuredClone(original);for(const item of plan.remove){let parent=s;for(const part of item.path.slice(0,-1))parent=parent?.[part];if(parent)delete parent[item.path.at(-1)];}
 for(const phone of Object.keys(s.complaintSequences||{}))if(!s.patients?.[phone])delete s.complaintSequences[phone];
 for(const batch of Object.values(s.settings?.trainingYearBatches||{}))batch.status='purged';
 // Administrative users/settings, issued ticket counters, audit, trash and report bytes remain recoverable.
 core.rebuild(s);return {state:s,summary:{cutoff:CUTOFF,deleted:plan.deleted,retained:plan.retained,deleteCount:plan.deleteCount,retainCount:plan.retainCount}};
}
async function handle(adapter,input,uid){if(input.action==='trainingCleanupPreview')return preview(await adapter.read(),uid);let summary;await adapter.mutate(s=>{const result=apply(s,uid,input);summary=result.summary;return result.state});return {ok:true,...summary};}
module.exports={CUTOFF,protectedEntry,preview,apply,handle};
