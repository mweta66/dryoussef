(function(){
 const fallback='01275884716';
 function href(number){let value=String(number??fallback).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\s()+-]/g,'');if(/^01[0125]\d{8}$/.test(value))value='20'+value.slice(1);else if(value.startsWith('00'))value=value.slice(2);return /^[1-9]\d{7,14}$/.test(value)?'https://wa.me/'+value:null;}
 function update(number,visible=true){
  let link=document.getElementById('patient-whatsapp');const isPatient=document.documentElement.hasAttribute('data-clinic-public')||document.body?.hasAttribute('data-public-branch');
  if(!isPatient||typeof staffView==='function'&&staffView())visible=false;
  const url=href(number);if(!link&&visible&&url){link=document.createElement('a');link.id='patient-whatsapp';link.className='patient-whatsapp';link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','فتح شات واتساب مع العيادة');link.innerHTML='<svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.6 10.6 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm6-8c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.5.3-.4.9-1.6.1-.2 0-.4 0-.6l-1-2.3c-.2-.5-.4-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.3 0 1.4 1 2.7 1.2 2.9.1.2 2 3.1 4.9 4.4 1.8.8 2.5.8 3.4.7.5-.1 1.8-.8 2-1.5.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4z"/></svg><span>واتساب</span>';document.body.append(link);}
  if(link){link.hidden=!visible||!url;if(url)link.href=url;}
 }
 window.ClinicWhatsApp={href,update};
 if(typeof applySite==='function'){const before=applySite;applySite=function(site){before(site);update(site.whatsappPhone===undefined?fallback:site.whatsappPhone);};}
 if(typeof draw==='function'){const beforeDraw=draw;draw=function(){beforeDraw();update(typeof SITE==='object'?SITE.whatsappPhone:undefined);};}
 document.addEventListener('DOMContentLoaded',()=>{if(!document.body.hasAttribute('data-public-branch'))update(typeof SITE==='object'?SITE.whatsappPhone:undefined);});
})();
