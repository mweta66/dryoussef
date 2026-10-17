const core=require('./core.cjs');
const branches={alex:{name:'الإسكندرية',address:'',phone:'',enabled:true},matrouh:{name:'مطروح',address:'',phone:'',enabled:true},dmn:{name:'دمنهور',address:'',phone:'',enabled:true},libya:{name:'ليبيا',address:'',phone:'',enabled:true}};
function replaceBranches(original,uid){
 if(core.role(original,uid).r!=='admin')core.fail('غير مصرح',403);
 // Restrict this local operator reset to the known old or new clinic branches.
 if(core.branchIds(original).some(b=>!Object.hasOwn(branches,b)))core.fail('توجد فروع إضافية؛ راجع البيانات قبل الاستبدال',409);
 const s=structuredClone(original);
 for(const field of ['bookings','patients','files','complaints','inbox','deletedBookings','sequences','sessions','attachments'])s[field]={};
 s.settings||={};s.settings.branches=structuredClone(branches);
 s.settings.sched=Object.fromEntries(Object.keys(branches).map(b=>[b,{mode:'flexible',weekly:{},exceptions:{}}]));
 s.settings.site||={};s.settings.site.branches=Object.fromEntries(Object.entries(branches).map(([b,{name,address,phone}])=>[b,{name,address,phone}]));
 s.audit=[{action:'replaceClinicBranches',actor:uid,at:new Date().toISOString()}];
 core.rebuild(s);return s;
}
module.exports={replaceBranches};
