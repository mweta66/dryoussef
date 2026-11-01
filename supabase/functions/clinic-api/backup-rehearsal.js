import * as core from './core.js';
import * as perms from './permissions.js';
import * as recovery from './complete-backup.js';
function rehearse(payload){const counts=recovery.graphCheck(recoveryState(payload));return {at:new Date().toISOString(),status:'passed_with_limitations',scope:'state-json',counts,clinicalVerified:true,imagesVerified:false,completeSystemRecovery:false,authCredentialsIncluded:false,warning:'تم فحص اتساق JSON فقط؛ تحقق أصول التقارير يحتاج تجربة الاستعادة الكاملة.'};}
function recoveryState(payload){return JSON.parse(JSON.stringify(payload));}
async function handle(adapter,input,uid){const s=await adapter.read();if(core.role(s,uid).r!=='admin')core.fail('تجربة الاستعادة متاحة للأدمن فقط',403);perms.requirePermission(core.role(s,uid),'data.export');if(input.action==='backupRehearsalStatus')return adapter.readRehearsalResult?adapter.readRehearsalResult():s.backupRehearsal||null;
 const backup=input.source==='current'?{payload:s,created_at:new Date().toISOString(),version:null}:await adapter.latestBackup?.();if(!backup?.payload)core.fail('لا توجد نسخة آلية مسجلة لتجربتها؛ يمكنك تجربة النسخة الحالية',404);
 const source={kind:input.source==='current'?'current':'automatic',createdAt:backup.created_at,version:backup.version},bundle=await recovery.buildRecoveryBundle(adapter,backup.payload,source),result={...await recovery.verifyRecoveryBundle(bundle),backupAt:backup.created_at,version:backup.version,source:source.kind};
 // Never run a live import, mutate state, grant a role, or upload/delete a report during rehearsal.
 if(adapter.recordRehearsalResult)await adapter.recordRehearsalResult(result);return result;
}
export {handle,rehearse};
