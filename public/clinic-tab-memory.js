(function(){
 const key=()=>AUTH?.uid?'clinic_staff_section_'+AUTH.uid:null;
 if(key())try{const saved=new URL(location.href).searchParams.get('section')||sessionStorage.getItem(key());if(/^[a-z]{2,20}$/.test(saved||''))tab=saved}catch{}
 let last=tab,popping=false;const previous=render;
 render=function(){if(me&&staffView()&&workspaceTabs().some(x=>x[0]===tab)){if(last!==tab&&document.querySelector('.mod')?.dataset.privateDirty==='true'&&!confirm('توجد تعديلات غير محفوظة. الانتقال للقسم الجديد؟')){tab=last;return}try{sessionStorage.setItem(key(),tab);const url=new URL(location.href);url.searchParams.set('section',tab);if(url.href!==location.href){if(!popping&&last!==tab)history.pushState({section:tab},'',url);else history.replaceState({section:tab},'',url)}}catch{}last=tab}return previous()};
 window.addEventListener('popstate',()=>{if(!me||!staffView())return;const next=new URL(location.href).searchParams.get('section');if(!workspaceTabs().some(x=>x[0]===next))return;popping=true;tab=next;render();popping=false});
})();
