const perms=require('./permissions.cjs');
const core=require('./core.cjs');
function publicQueue(s,b,d=core.today()){
 if(!core.branchIds(s).includes(b))core.fail('اختر الفرع');core.date(d);const rows=Object.values(s.bookings?.[d]||{}).filter(x=>x.b===b).sort(core.queueOrder),session=s.sessions?.[d+'_'+b],active=rows.find(x=>x.s==='exam'),running=(!core.presence(s,d)||core.presence(s,d)===b)&&(session?.status==='running'||!session&&!!active);
 return {branch:b,date:d,presence:core.presence(s,d),status:core.presence(s,d)&&core.presence(s,d)!==b?'absent':session?.status||(active?'running':'not_started'),current:running&&active?active.no:null,next:rows.filter(x=>x.s==='wait').slice(0,8).map(x=>({no:x.no,emergency:x.v==='emergency'})),waiting:rows.filter(x=>x.s==='wait').length};
}
module.exports={publicQueue};
