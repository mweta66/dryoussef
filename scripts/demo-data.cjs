const {randomBytes,scryptSync}=require('node:crypto');
const core=require('../functions/core.cjs');
function makeDemo() {
 const state={roles:{},settings:{avg:15,sched:{dmn:{d:[0,4],f:'14:00',t:'18:00'},alex:{d:[1,2,3,6],f:'14:00',t:'18:00'}}},bookings:{},sequences:{}};
 const accounts=[];
 for(const [uid,u,r,br] of [['demo_doctor','doctor','doctor',null],['demo_dmn','sec-dmn','sec','dmn'],['demo_alex','sec-alex','sec','alex']]){
  const password=randomBytes(12).toString('base64url'),salt=randomBytes(16).toString('hex');
  state.roles[uid]={u,r,...(br?{br}:{})};
  accounts.push({uid,u,password,salt,hash:scryptSync(password,salt,32).toString('hex')});
 }
 let i=0;
 const baseline=core.today();
 for(let offset=-2;offset<=2;offset++){
  const time=new Date(baseline+'T12:00:00Z');time.setUTCDate(time.getUTCDate()+offset);
  const d=time.toISOString().slice(0,10);state.bookings[d]={};
  for(const b of ['dmn','alex'])for(let no=1;no<=6;no++){
   i++;const id='demo_booking_'+i;
   state.bookings[d][id]={id,no,date:d,b,name:'مريضة تجريبية '+String(i).padStart(3,'0'),phone:'010000'+String(i).padStart(5,'0'),v:no%2?'exam':'cons',s:['wait','exam','done','no','cx','wait'][no-1],nt:'بيانات اصطناعية للاختبار فقط — لا تستخدم للتواصل',rev:1};
   state.sequences[d+'_'+b]=no;
  }
 }
 core.rebuild(state);return {state,accounts,baseline};
}
module.exports={makeDemo};
