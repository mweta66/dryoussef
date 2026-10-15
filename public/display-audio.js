/* Queue-display audio only. Patient and staff pages never load this module. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else root.createClinicQueueAudio=factory;
})(typeof window!=='undefined'?window:globalThis,function(options){
 const music=options.music,chime=options.chime,changed=options.onState||(()=>{}),error=options.onError||(()=>{});
 let enabled=false,pending=false,suspended=false,destroyed=false,queue=null,ready=false,lastNumber=null,ducked=false,restoreTimer=null;
 let musicVolume=.18,chimeVolume=.65;
 const clamp=x=>Math.min(1,Math.max(0,Number(x)||0));
 function volumes(){music.volume=musicVolume*(ducked?.22:1);chime.volume=chimeVolume;}
 function restore(){clearTimeout(restoreTimer);restoreTimer=null;ducked=false;volumes();}
 function stopChime(){chime.pause();try{chime.currentTime=0}catch(e){}restore();}
 function state(){changed({enabled,pending,musicVolume,chimeVolume});}
 function attempt(media){return Promise.resolve().then(()=>media.play());}
 async function enable(){
  if(pending||destroyed)return;pending=true;state();
  // Unlock both elements within the actual click, before any asynchronous work.
  let musicPlay,chimePlay;chime.volume=0;
  try{musicPlay=music.play();chimePlay=chime.play()}catch(e){musicPlay=Promise.reject(e);chimePlay=Promise.resolve()}
  let timer;
  const unlocked=Promise.allSettled([Promise.resolve(musicPlay),Promise.resolve(chimePlay)]);
  try{
   const results=await Promise.race([unlocked,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),12000)})]);
   if(destroyed)return;
   if(results[0].status==='rejected')throw results[0].reason;
   enabled=true;stopChime();
   if(suspended)music.pause();
   if(results[1].status==='rejected')error('الموسيقى تعمل، لكن تعذر تهيئة نغمة الدور. أوقف الصوت وشغّله مجددًا.');
  }catch(e){enabled=false;music.pause();stopChime();error('تعذر تشغيل الصوت. تحقق من اتصالك وصلاحية الصوت للمتصفح ثم حاول مجددًا.');}
  finally{clearTimeout(timer);pending=false;state();}
  // A late media download must not start playing after a failed enable or teardown.
  unlocked.then(()=>{if(!enabled||destroyed||suspended){music.pause();stopChime()}});
 }
 function disable(){enabled=false;music.pause();stopChime();state();}
 function ring(){
  if(!enabled||pending||suspended||destroyed||chimeVolume===0)return;
  stopChime();ducked=true;volumes();
  restoreTimer=setTimeout(restore,Math.min(30000,(Number.isFinite(chime.duration)?chime.duration:8)*1000+500));
  attempt(chime).then(()=>{if(!enabled||suspended||destroyed)stopChime()}).catch(()=>{restore();error('تعذر تشغيل تنبيه الدور. أوقف الصوت وشغّله مجددًا.');});
 }
 function update(data){
  if(suspended){resetQueue();return;}
  const key=data.branch+'|'+data.date;
  if(key!==queue){queue=key;ready=false;lastNumber=null;stopChime();}
  const current=data.status==='running'&&Number.isFinite(data.current)&&data.current>0?data.current:null;
  if(!ready){ready=true;lastNumber=current;return;}
  // Pausing, ending or temporarily hiding a number never re-announces that same ticket.
  if(current===null||current===lastNumber)return;
  lastNumber=current;ring();
 }
 function resetQueue(){queue=null;ready=false;lastNumber=null;stopChime();}
 function setSuspended(value){suspended=!!value;if(suspended){music.pause();resetQueue()}else if(enabled&&!destroyed){attempt(music).catch(()=>{disable();error('اضغط تشغيل الصوت لاستئناف الموسيقى.');});}}
 function setVolumes(background,notification){musicVolume=clamp(background);chimeVolume=clamp(notification);volumes();state();}
 function mediaError(){restore();if(enabled)error('تعذر تحميل أحد ملفات الصوت. تحقق من الاتصال ثم أعد تشغيل الصوت.');}
 chime.addEventListener('ended',restore);chime.addEventListener('error',mediaError);music.addEventListener('error',mediaError);
 volumes();
 return {enable,disable,update,resetQueue,setSuspended,setVolumes,getState:()=>({enabled,pending,musicVolume,chimeVolume}),destroy(){destroyed=true;disable();chime.removeEventListener('ended',restore);chime.removeEventListener('error',mediaError);music.removeEventListener('error',mediaError)}};
});

if(typeof window!=='undefined'&&document.getElementById('display-music')){
 const button=document.getElementById('display-audio-toggle'),status=document.getElementById('display-audio-status'),musicSlider=document.getElementById('display-music-volume'),chimeSlider=document.getElementById('display-chime-volume');
 window.DisplayAudio=createClinicQueueAudio({music:document.getElementById('display-music'),chime:document.getElementById('display-chime'),onState(s){button.disabled=s.pending;musicSlider.disabled=s.pending;chimeSlider.disabled=s.pending;button.textContent=s.pending?'جارٍ تشغيل الصوت…':s.enabled?'إيقاف الصوت':'تشغيل الصوت';button.setAttribute('aria-pressed',String(s.enabled));musicSlider.value=Math.round(s.musicVolume*100);chimeSlider.value=Math.round(s.chimeVolume*100);document.getElementById('display-music-level').textContent=musicSlider.value+'%';document.getElementById('display-chime-level').textContent=chimeSlider.value+'%';},onError(message){status.textContent=message;status.dataset.error='true';}});
 let levels;try{levels=JSON.parse(localStorage.getItem('clinic_display_audio_volumes'))}catch(e){}
 DisplayAudio.setVolumes(Number.isFinite(levels?.music)?levels.music:.18,Number.isFinite(levels?.chime)?levels.chime:.65);
 button.addEventListener('click',async()=>{status.textContent='';status.dataset.error='false';if(DisplayAudio.getState().enabled){DisplayAudio.disable();status.textContent='الصوت متوقف.';}else{await DisplayAudio.enable();if(DisplayAudio.getState().enabled&&!status.textContent)status.textContent='الموسيقى مستمرة، والتنبيه يعمل عند دخول رقم جديد للكشف.';}});
 function saveLevels(){DisplayAudio.setVolumes(Number(musicSlider.value)/100,Number(chimeSlider.value)/100);try{localStorage.setItem('clinic_display_audio_volumes',JSON.stringify({music:Number(musicSlider.value)/100,chime:Number(chimeSlider.value)/100}))}catch(e){}}
 musicSlider.addEventListener('input',saveLevels);chimeSlider.addEventListener('input',saveLevels);
 document.addEventListener('visibilitychange',()=>{DisplayAudio.setSuspended(document.hidden);if(!document.hidden)refreshDisplay()});
 window.addEventListener('pagehide',()=>DisplayAudio.setSuspended(true));window.addEventListener('pageshow',()=>{if(!document.hidden)DisplayAudio.setSuspended(false)});
}
