/* One date/branch picker for new requests, rescheduling and staff approval. */
function bindAppointmentAvailability({dateId='f_date',branchId='f_branch',slotId='f_slot',kindId=null,enabled=()=>true,allowedBranches=null,preferredBranch=''}={}){
 const form=document.querySelector('.mod'),date=document.getElementById(dateId),branch=document.getElementById(branchId),slot=document.getElementById(slotId),kind=kindId&&document.getElementById(kindId);
 let version=0,choices=[],ready=false;const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');branch.after(status);
 function visible(node,show){if(!node)return;node.hidden=!show;node.disabled=!show;const label=form.querySelector('label[for="'+node.id+'"]');if(label)label.hidden=!show;}
 function times(){if(!slot)return;slot.replaceChildren(new Option('بدون تحديد',''));for(const time of choices.find(x=>x.id===branch.value)?.slots||[])slot.add(new Option(time,time));}
 async function refresh(){
  const generation=++version,show=enabled()&&(!kind||kind.value!=='cancel');ready=false;visible(date,show);visible(branch,show);visible(slot,show);status.hidden=!show;if(!show)return;
  const requestedDate=date.value,previous=branch.value||preferredBranch;branch.disabled=true;branch.replaceChildren(new Option('جارٍ تحميل الفروع المتاحة…',''));if(slot){slot.disabled=true;slot.replaceChildren(new Option('جارٍ التحميل…',''));}status.textContent='';
  try{const result=await gateway('bookingAvailability',{date:requestedDate},false);if(generation!==version||form!==document.querySelector('.mod')||date.value!==requestedDate)return;
   choices=result.branches.filter(x=>!x.full&&(x.scheduled||x.flexible)&&(!allowedBranches||allowedBranches.includes(x.id)));
   branch.replaceChildren(new Option(choices.length?'اختر الفرع المتاح':'لا توجد مواعيد متاحة في هذا اليوم',''));for(const x of choices)branch.add(new Option(x.name,x.id));
   if(choices.some(x=>x.id===previous))branch.value=previous;else if(choices.length===1)branch.value=choices[0].id;
   ready=true;branch.disabled=!choices.length;if(slot)slot.disabled=!choices.length;times();status.textContent=choices.length?'الفروع المعروضة متاحة حسب جدول الطبيب في اليوم المختار.':'اختر يومًا آخر أو تواصل مع السكرتارية.';
  }catch(e){if(generation!==version||form!==document.querySelector('.mod'))return;branch.replaceChildren(new Option('تعذر تحميل المواعيد',''));status.textContent=errMsg(e);}
 }
 date.min=today();date.addEventListener('change',refresh);branch.addEventListener('change',times);if(kind)kind.addEventListener('change',refresh);refresh();
 return {refresh,get ready(){return ready&&!!branch.value&&!branch.disabled;}};
}
