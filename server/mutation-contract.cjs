const {createHash}=require('node:crypto');
const operationalActions=new Set(['commit','patch','sessionSet','presenceSet','checkinSet','consultationComplete','consultationUrgentReview','consultationUrgentResolve','followupPlanSave','followupPlanBook','bookingContactSet','requestAssign','requestDecide']);
const receiptActions=new Set(['commit','patch','sessionSet','presenceSet','checkinSet','consultationComplete','consultationUrgentReview','consultationUrgentResolve','bookingContactSet','requestAssign','requestDecide']);
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>k!=='operationId').map(k=>[k,canonical(x[k])]));return x;}
function mutationOptions(input,uid){
 const operational=operationalActions.has(input?.action);let receipt=null;
 if(operational&&uid&&receiptActions.has(input.action)&&typeof input.operationId==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(input.operationId))receipt={key:input.operationId,uid,action:input.action,requestHash:createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex')};
 return {operational,receipt};
}
function publicReceipt(value){return value?.status==='saved'?{status:'saved',action:value.action,committedAt:value.committedAt,version:value.version}:{status:'missing'};}
module.exports={operationalActions,receiptActions,mutationOptions,publicReceipt};
