/* Family metadata is saved atomically with the booking, never in public tickets. */
var familyBookingForm=openForm;openForm=function(title,fields,fn){familyBookingForm(title,fields,fn);if(!fields.some(x=>x.k==='spouseName')||!fields.some(x=>x.k==='date'))return;const modal=document.querySelector('.mod'),phone=modal?.querySelector('#f_phone');if(!phone)return;for(const key of ['spouseName','spouseJob','spousePhone'])modal.querySelector('#f_'+key)?.addEventListener('input',e=>{e.target.dataset.familyChanged='1'});
 function fill(){if(!modal.isConnected)return;const patient=PT?.[norm(phone.value)];for(const key of ['spouseName','spouseJob','spousePhone']){const input=modal.querySelector('#f_'+key);if(input&&input.dataset.familyChanged!=='1')input.value=patient?.[key]||'';}}
 phone.addEventListener('input',fill);if(can('patients.read'))loadPatients().then(fill).catch(()=>{});else fill();
};
