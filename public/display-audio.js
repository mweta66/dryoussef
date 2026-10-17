/* Queue-display audio only. Patient and staff pages never load this module. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else root.createClinicQueueAudio=factory;
})(typeof window!=='undefined'?window:globalThis,function(options){
 const music=options.music,chime=options.chime,changed=options.onState||(()=>{}),error=options.onError||(()=>{});
 let enabled=false,pending=false,suspended=false,destroyed=false,queue=null,ready=false,lastNumber=null,ducked=false,restoreTimer=null,speechEpoch=0;
 let musicVolume=.18,chimeVolume=.85;
 const clamp=x=>Math.min(1,Math.max(0,Number(x)||0));
 function volumes(){music.volume=musicVolume*(ducked?.22:1);chime.volume=chimeVolume;}
 function restore(){clearTimeout(restoreTimer);restoreTimer=null;ducked=false;volumes();}
 function stopChime(){speechEpoch++;options.cancelAnnouncement?.();chime.pause();try{chime.currentTime=0}catch(e){}restore();}
 function state(){changed({enabled,pending,musicVolume,chimeVolume});}
 function attempt(media){return Promise.resolve().then(()=>media.play());}
 async function enable(){
  if(pending||destroyed)return;pending=true;state();
  // Unlock both elements within the actual click, before any asynchronous work.
  let musicPlay,chimePlay;chime.volume=0;
  try{Promise.resolve(options.unlockAnnouncement?.()).catch(()=>error("اضغط تشغيل الصوت مجددًا لتهيئة النداء العربي"));musicPlay=music.play();chimePlay=options.announce?Promise.resolve():chime.play()}catch(e){musicPlay=Promise.reject(e);chimePlay=Promise.resolve()}
  let timer;
  const unlocked=Promise.allSettled([Promise.resolve(musicPlay),Promise.resolve(chimePlay)]);
  try{
   const results=await Promise.race([unlocked,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),12000)})]);
   if(destroyed)return;
   if(results[0].status==='rejected')throw results[0].reason;
   enabled=true;stopChime();
   if(suspended)music.pause();
   if(results[1].status==='rejected')error('التلاوة تعمل، لكن تعذر تهيئة النداء. أوقف الصوت وشغّله مجددًا.');
  }catch(e){enabled=false;music.pause();stopChime();error('تعذر تشغيل الصوت. تحقق من اتصالك وصلاحية الصوت للمتصفح ثم حاول مجددًا.');}
  finally{clearTimeout(timer);pending=false;state();}
  // A late media download must not start playing after a failed enable or teardown.
  unlocked.then(()=>{if(!enabled||destroyed||suspended){music.pause();stopChime()}});
 }
 function disable(){enabled=false;music.pause();stopChime();state();}
 function ring(number=lastNumber){
  if(!enabled||pending||suspended||destroyed||chimeVolume===0)return;
  stopChime();ducked=true;volumes();
  if(options.announce){const epoch=speechEpoch;Promise.resolve().then(()=>options.announce(number,chimeVolume)).then(()=>{if(epoch===speechEpoch)restore()}).catch(e=>{if(epoch===speechEpoch){restore();error(e.message||'تعذر النداء العربي')}});return;}
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
  if(current===null){stopChime();return;}if(current===lastNumber)return;
  lastNumber=current;ring();
 }
 function resetQueue(){queue=null;ready=false;lastNumber=null;stopChime();}
 function setSuspended(value){suspended=!!value;if(suspended){music.pause();resetQueue()}else if(enabled&&!destroyed){attempt(music).catch(()=>{disable();error('اضغط تشغيل الصوت لاستئناف التلاوة.');});}}
 function setVolumes(background,notification){musicVolume=clamp(background);chimeVolume=clamp(notification);volumes();state();}
 function mediaError(){restore();if(enabled)error('تعذر تحميل أحد ملفات الصوت. تحقق من الاتصال ثم أعد تشغيل الصوت.');}
 chime.addEventListener('ended',restore);chime.addEventListener('error',mediaError);music.addEventListener('error',mediaError);
 volumes();
 return {enable,disable,update,resetQueue,testAnnouncement:number=>ring(number),setSuspended,setVolumes,getState:()=>({enabled,pending,musicVolume,chimeVolume}),destroy(){destroyed=true;disable();chime.removeEventListener('ended',restore);chime.removeEventListener('error',mediaError);music.removeEventListener('error',mediaError)}};
});

if(typeof window!=='undefined'&&document.getElementById('display-music')){
 const button=document.getElementById('display-audio-toggle'),status=document.getElementById('display-audio-status'),musicSlider=document.getElementById('display-music-volume'),chimeSlider=document.getElementById('display-chime-volume');
 const recorded=createRecordedArabicQueueSpeaker(()=>new (window.AudioContext||window.webkitAudioContext)(),url=>fetch(url));
 const speech=createArabicQueueSpeaker(window.speechSynthesis,window.SpeechSynthesisUtterance,()=>document.getElementById('display-arabic-voice').value,recorded);
 window.DisplayAudio=createClinicQueueAudio({unlockAnnouncement:()=>speech.unlock(),announce:(no,volume)=>speech.speak(no,volume),cancelAnnouncement:()=>speech.cancel(),music:document.getElementById('display-music'),chime:document.getElementById('display-chime'),onState(s){button.disabled=s.pending;musicSlider.disabled=s.pending||window.displayAppearance?.managedAudio===true;chimeSlider.disabled=s.pending||window.displayAppearance?.managedAudio===true;button.textContent=s.pending?'جارٍ تشغيل الصوت…':s.enabled?'إيقاف الصوت':'تشغيل الصوت';button.setAttribute('aria-pressed',String(s.enabled));musicSlider.value=Math.round(s.musicVolume*100);chimeSlider.value=Math.round(s.chimeVolume*100);document.getElementById('display-music-level').textContent=musicSlider.value+'%';document.getElementById('display-chime-level').textContent=chimeSlider.value+'%';},onError(message){status.textContent=message;status.dataset.error='true';}});
 let levels;try{levels=JSON.parse(localStorage.getItem('clinic_display_audio_volumes'))}catch(e){}
 DisplayAudio.setVolumes(Number.isFinite(levels?.music)?levels.music:.18,Number.isFinite(levels?.chime)?levels.chime:.85);
 button.addEventListener('click',async()=>{status.textContent='';status.dataset.error='false';if(DisplayAudio.getState().enabled){DisplayAudio.disable();status.textContent='الصوت متوقف.';}else{await DisplayAudio.enable();if(DisplayAudio.getState().enabled&&!status.textContent)status.textContent='التلاوة مستمرة، والنداء العربي يعمل عند دخول رقم جديد للكشف.';}});
 function saveLevels(){DisplayAudio.setVolumes(Number(musicSlider.value)/100,Number(chimeSlider.value)/100);try{localStorage.setItem('clinic_display_audio_volumes',JSON.stringify({music:Number(musicSlider.value)/100,chime:Number(chimeSlider.value)/100}))}catch(e){}}
 musicSlider.addEventListener('input',saveLevels);chimeSlider.addEventListener('input',saveLevels);
 const voiceSelect=document.getElementById('display-arabic-voice');function refreshVoices(){const selected=voiceSelect.value;voiceSelect.replaceChildren();const voices=speech.voices();voiceSelect.add(new Option('نداء عربي مسجل — يعمل دون أصوات النظام','recorded'));for(const voice of voices)voiceSelect.add(new Option(voice.name+' ('+voice.lang+')',voice.voiceURI));if(voices.some(x=>x.voiceURI===selected))voiceSelect.value=selected;}window.speechSynthesis?.addEventListener('voiceschanged',refreshVoices);refreshVoices();
 const tracks=window.CLINIC_QURAN_TRACKS||[],playlist=tracks.map(x=>x.src),track=document.getElementById('display-quran-track'),media=document.getElementById('display-music');track.replaceChildren();tracks.forEach((item,i)=>track.add(new Option(item.name,String(i))));function selectTrack(){const enabled=DisplayAudio.getState().enabled;DisplayAudio.disable();media.src=playlist[Number(track.value)];if(enabled)DisplayAudio.enable();}track.addEventListener('change',selectTrack);media.addEventListener('ended',()=>{track.value=String((Number(track.value)+1)%playlist.length);selectTrack()});document.getElementById('display-test-call').onclick=function(){if(!DisplayAudio.getState().enabled){status.textContent='اضغط تشغيل الصوت أولًا ثم جرّب النداء.';return}status.textContent='تجربة النداء على رقم 1';DisplayAudio.testAnnouncement(1)};
 document.addEventListener('visibilitychange',()=>{DisplayAudio.setSuspended(document.hidden);if(!document.hidden)refreshDisplay()});
 window.addEventListener('pagehide',()=>DisplayAudio.setSuspended(true));window.addEventListener('pageshow',()=>{if(!document.hidden)DisplayAudio.setSuspended(false)});
}
