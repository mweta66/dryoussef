const schedule=require('./schedule.cjs'),branchConfig=require('./branches.cjs');
const perms=require('./permissions.cjs');
const core=require('./core.cjs');
function publicQueue(s,b,d=core.today()){
 if(!core.branchIds(s,true).includes(b))core.fail('الفرع غير متاح للعرض العام',404);core.date(d);const rows=Object.values(s.bookings?.[d]||{}).filter(x=>x.b===b).sort(core.queueOrder),session=s.sessions?.[d+'_'+b],active=rows.find(x=>x.s==='exam'),running=(!core.presence(s,d)||core.presence(s,d)===b)&&(session?.status==='running'||!session&&!!active);
 const registry=branchConfig.branches(s),planned=schedule.availability(registry,s.settings?.sched||{},d),time=d===core.today()?new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()):null,plannedBranch=schedule.choose(registry,s.settings?.sched||{},d,time);
 const operational=Object.values(s.bookings?.[d]||{}).some(x=>x.s==='exam')||Object.entries(s.sessions||{}).some(([key,value])=>key.startsWith(d+'_')&&['running','paused'].includes(value.status));
 const selected=s.sessions?.[d+'_presence'],freshManual=selected?.source==='manual'&&Number.isFinite(Date.parse(selected.selectedAt))&&(!s.settings?.scheduleUpdatedAt||Date.parse(selected.selectedAt)>=Date.parse(s.settings.scheduleUpdatedAt));
 const followBranch=operational||freshManual?core.presence(s,d):plannedBranch||(planned.flexible.includes(core.presence(s,d))?core.presence(s,d):null);
 const livePresence=operational||freshManual?core.presence(s,d):null;
 return {branch:b,date:d,plannedBranch,plannedBranches:planned.scheduled.map(x=>x.id),followBranch,presence:livePresence,status:livePresence&&livePresence!==b?'absent':session?.status||(active?'running':'not_started'),current:running&&active?active.no:null,currentEmergency:!!(running&&active?.v==='emergency'),next:rows.filter(x=>x.s==='wait').slice(0,8).map(x=>({no:x.no,emergency:x.v==='emergency'})),waiting:rows.filter(x=>x.s==='wait').length};
}
module.exports={publicQueue};
