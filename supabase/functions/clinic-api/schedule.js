 const weekDays=[6,0,1,2,3,4,5];
 function validDate(date){const parsed=new Date(date+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;}
 function availability(registry,schedules,date){
  const result={scheduled:[],flexible:[]};if(!validDate(date))return result;const day=new Date(date+'T12:00:00Z').getUTCDay();
  for(const [id,branch]of Object.entries(registry)){
   if(branch.enabled===false)continue;const schedule=schedules[id];
   if(Object.hasOwn(schedule?.exceptions||{},date)){const slots=schedule.exceptions[date];if(slots.length)result.scheduled.push({id,slots});continue;}
   if(schedule?.mode==='days'){if(schedule.d?.includes(day))result.scheduled.push({id,slots:[],dayOnly:true});continue;}
   if(!schedule||schedule.mode==='flexible'){result.flexible.push(id);continue;}
   const slots=schedule.mode==='weekly'?schedule.weekly?.[day]||[]:schedule.d?.includes(day)?[{f:schedule.f,t:schedule.t}]:[];
   if(slots.length)result.scheduled.push({id,slots});
  }
  return result;
 }
 function choose(registry,schedules,date,time){const items=availability(registry,schedules,date).scheduled;if(items.length===1)return items[0].id;if(time&&items.every(item=>!item.dayOnly)){const active=items.filter(item=>item.slots.some(slot=>slot.f<=time&&time<slot.t));if(active.length===1)return active[0].id;}return null;}
 function nextDate(registry,schedules,branch,from){
  if(!validDate(from)||!registry[branch]||registry[branch].enabled===false)return null;
  for(let offset=0;offset<367;offset++){const parsed=new Date(from+'T12:00:00Z');parsed.setUTCDate(parsed.getUTCDate()+offset);const date=parsed.toISOString().slice(0,10),available=availability(registry,schedules,date);if(available.scheduled.some(x=>x.id===branch)||available.flexible.includes(branch))return date;}return null;
 }

export {weekDays,availability,choose,nextDate};
