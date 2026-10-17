function adminPage(){return /(?:^|\/)admin\.html$/.test(String(location.pathname||""))}
function staffView(){return location.hash==="#staff"||location.hash==="#admin"}
function openAdmin(){if(!me||me.role!=="admin")return;if(!adminPage()){location.replace("admin.html#admin");return}if(location.hash!=="#admin")location.hash="admin";else render()}
var PT=null,PTt=0,SEL="",QS="",CL=[],INBOX={},gotFirst=false,actx=null,TITLE0=document.title,featureBusy=false;
var ID=/^[A-Za-z0-9_-]{1,128}$/;
var CONFIG=window.CLINIC_CONFIG||{};

var PHONE="01275884716",FACE="doctor.jpg";
document.documentElement.style.setProperty("--face","url("+FACE+")");
var I={pin:'<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',phone:'<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',user:'<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',bell:'<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',check:'<path d="M20 6L9 17l-5-5"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',search:'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',moon:'<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',users:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',chart:'<path d="M18 20V10M12 20V4M6 20v-6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>'};
function ic(n,s){return '<svg class="i" width="'+(s||18)+'" height="'+(s||18)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[n]+'</svg>'}
var DAYS=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
var BR={dmn:{name:"فرع دمنهور",addr:"متفرع من شارع عبد السلام الشاذلي، أمام مدرسة الكرمة الخاصة لغات",tel:"0453366103"},alex:{name:"فرع الإسكندرية",addr:"شارع مصطفى كامل (أمام البوابة الرئيسية لنادي سموحة)",tel:"034041033"}};
function branchOptions(active){return Object.keys(BR).filter(b=>!active||BR[b].enabled!==false).map(b=>[b,BR[b].name+(BR[b].enabled===false?' (متوقف)':'')])}
var ST={wait:["في الانتظار",""],exam:["جاري الكشف","pri"],done:["تم الكشف","ok"],no:["لم يحضر","bad"],cx:["ملغي","bad"]};
var VT={exam:"كشف",cons:"استشارة",follow:"متابعة",emergency:"طوارئ - أولوية"};
function pad(n){return n<10?"0"+n:""+n}
function today(){var parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),o={};parts.forEach(function(p){o[p.type]=p.value});return o.year+"-"+o.month+"-"+o.day}
function t12(t){var a=t.split(":"),h=+a[0],s=h>=12?"م":"ص";h=h%12||12;return h+":"+a[1]+" "+s}
function freshS(){return {avg:15,seq:1,sched:{dmn:{d:[0,4],f:"14:00",t:"18:00"},alex:{d:[1,2,3,6],f:"14:00",t:"18:00"}},bk:[]}}
function freshU(){return {sec:[]}}
var S=freshS(),U=freshU(),me=null,db=null,refS=null,refU=null,F={b:"all",d:today(),v:"all",s:"all"},tab="dash",lastPh="",M=null,FF=null;
try{me=JSON.parse(sessionStorage.getItem("me"))}catch(e){}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function norm(p){return String(p).replace(/[٠-٩۰-۹]/g,function(d){var n=d.charCodeAt(0);return n>=1776?n-1776:n-1632}).replace(/[\s()+-]/g,"").replace(/^(?:0020|\+?20)(?=1)/,"0")}
function validPhone(p){return /^01[0125]\d{8}$/.test(norm(p))}
function nextNo(b,d){var m=0;S.bk.forEach(function(x){if(x.b===b&&x.date===d&&x.no>m)m=x.no});return m+1}
function dup(ph,d,id){return S.bk.some(function(x){return x.date===d&&norm(x.phone)===norm(ph)&&x.id!==id})}
function queueOrder(a,b){function rank(x){return x.s==='exam'?0:x.s==='wait'?(x.v==='emergency'?1:2):3}return rank(a)-rank(b)||a.no-b.no}function ahead(x){return S.bk.filter(function(y){return y.b===x.b&&y.date===x.date&&['wait','exam'].includes(y.s)&&queueOrder(y,x)<0}).length}
function sched(b){var s=S.sched[b];return {chips:s.d.slice().sort(function(a,b){return (a+1)%7-(b+1)%7}).map(function(i){return '<span class="chip">'+DAYS[i]+'</span>'}).join(""),time:"من "+t12(s.f)+" إلى "+t12(s.t)}}
function topbar(){var t='<span class="sp"></span><button class="gb" onclick="toggleTheme()" aria-label="الوضع الليلي">'+ic("moon",16)+'</button>';
 if(me&&me.role==="admin")t+='<button class="gb" onclick="openAdmin()">'+ic("gear",16)+' الإدارة</button><button class="gb" onclick="go(\'patient\')">واجهة المرضى</button>';t+=me?'<button class="gb" onclick="logout()">'+ic("lock",16)+' خروج</button>':'<button class="gb" onclick="go(\'staff\')">'+ic("lock",16)+' دخول الطاقم</button>';
 document.getElementById("topbar").innerHTML=t}
function toggleTheme(){var r=document.documentElement,d=r.getAttribute("data-theme")==="dark"||(!r.getAttribute("data-theme")&&matchMedia("(prefers-color-scheme:dark)").matches);r.setAttribute("data-theme",d?"light":"dark");try{localStorage.setItem("clinic_theme",d?"light":"dark")}catch(e){}}
function chk(){var p=document.getElementById("ph");document.getElementById("go").disabled=!validPhone(p.value);p.removeAttribute("aria-invalid")}
function look(){var p=document.getElementById("ph");if(!validPhone(p.value)){p.setAttribute("aria-invalid","true");p.focus();return}shown++;lastPh=norm(p.value);document.getElementById("booking-history")?.remove();document.getElementById("res").textContent="جارٍ البحث عن حجزك…";findPhoneBookings()}
function notify(message){var el=document.getElementById("notice");if(!el)return;el.textContent=message||"";el.dataset.kind=/^(تم|تمت)/.test(message||"")?"success":/تعذر|غير صحيح|NOAUTH|صلاحية|خطأ/.test(message||"")?"error":"info"}
function go(v){location.hash=v==="patient"?"":v}
function branches(){var h='<h2>'+ic("pin",20)+'الفروع ومواعيد العمل</h2><div class="branches">';for(var k in BR){var b=BR[k],s=sched(k);h+='<div class="br"><div><span class="ib">'+ic("pin")+'</span><b>'+esc(b.name)+'</b></div><p>'+esc(b.addr)+'</p><p>'+ic("phone",16)+' <a href="tel:'+b.tel+'">'+b.tel+'</a></p><div class="chips">'+s.chips+'</div><p>'+ic("clock",16)+' '+s.time+'</p></div>'}return h+'</div>'}
function doctor(){var n=Object.keys(INBOX).length,h='<h2>'+ic("chart",20)+'إدارة العيادة</h2><div class="tabs">';
 [["dash","الحجوزات والطابور"],["cases","الحالات والشكاوى"+(n?" ("+n+")":"")],["users","المستخدمون"],["sched","المواعيد"],["set","الإعدادات"]].forEach(function(t){h+='<button class="tab'+(tab===t[0]?' on':'')+'" onclick="tab=\''+t[0]+'\';render()">'+t[1]+'</button>'});
 h+='</div>';return h+'<p class="hint">إدارة جميع الفروع والحجوزات وملفات الحالات وحسابات الطاقم.</p>'+(tab==="dash"?dash():tab==="cases"?cases():tab==="users"?users():tab==="sched"?schedPage():settings())}
function sel(id,key,opts){return '<select id="'+id+'" onchange="'+(id==='fb'?'followScheduleFilter=false;':'')+'F.'+key+'=this.value;render()">'+opts.map(function(o){return'<option value="'+o[0]+'"'+(F[key]===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join("")+'</select>'}
function dash(){var L=S.bk.filter(function(x){return (F.b==="all"||x.b===F.b)&&(!F.d||x.date===F.d)&&(F.v==="all"||x.v===F.v)&&(F.s==="all"||x.s===F.s)}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:a.b<b.b?-1:a.b>b.b?1:queueOrder(a,b)});
 function c(f){return L.filter(f).length}
 var h='<div class="flt" style="margin-top:14px"><div><label for="fb">الفرع</label>'+sel("fb","b",[["all","الكل"],...branchOptions()])+'</div><div><label for="filter-date">التاريخ</label><input id="filter-date" type="date" value="'+F.d+'" onchange="F.d=this.value;render()"></div><div><label for="fv">النوع</label>'+sel("fv","v",[["all","الكل"],["exam","كشف"],["cons","استشارة"],["follow","متابعة"],["emergency","طوارئ"]])+'</div><div><label for="fs">الحالة</label>'+sel("fs","s",[["all","الكل"],["wait","في الانتظار"],["exam","جاري الكشف"],["done","تم الكشف"],["no","لم يحضر"],["cx","ملغي"]])+'</div></div>';
 h+='<div class="acts" style="margin-top:8px"><button class="btn sm x" onclick="F.d=today();render()">اليوم</button><button class="btn sm x" onclick="F.d=\'\';render()">كل الأيام</button></div>';
 h+='<div class="row" style="margin-top:14px"><div class="stat"><b>'+L.length+'</b><span>إجمالي</span></div><div class="stat"><b>'+c(function(x){return x.v==="exam"})+'</b><span>كشوفات</span></div><div class="stat"><b>'+c(function(x){return x.v==="cons"})+'</b><span>استشارات</span></div><div class="stat"><b>'+c(function(x){return x.s==="wait"||x.s==="exam"})+'</b><span>قيد الانتظار</span></div><div class="stat"><b>'+c(function(x){return x.s==="done"})+'</b><span>تم الكشف</span></div><div class="stat"><b>'+c(function(x){return x.s==="no"||x.s==="cx"})+'</b><span>لم يحضر/ملغي</span></div><div class="stat"><b>'+Object.keys(BR).map(function(b){return esc(BR[b].name)+': '+c(function(x){return x.b===b})}).join(' / ')+'</b><span>توزيع الفروع</span></div></div>';
 if(can('bookings.create'))h+='<button class="btn a" onclick="newBk()">'+ic("plus")+' حجز جديد</button>';
 if(can('bookings.create')&&can('bookings.status'))h+='<button class="btn r" onclick="newBk(\'emergency\')">حجز طوارئ - أولوية</button>';
 if(!L.length)h+='<p class="sub" style="margin-top:14px">لا توجد بيانات بهذا الفلتر.</p>';L.forEach(function(x){h+=bkItem(x,true)});return h}
function schedPage(){var h='<h2>'+ic("cal",20)+'مواعيد الفروع</h2>';for(var k in BR){var s=sched(k);h+='<div class="item"><div class="m"><b>'+esc(BR[k].name)+'</b><div class="chips">'+s.chips+'</div><small>'+s.time+'</small></div><button class="btn sm" onclick="editSched(\''+k+'\')">'+ic("edit",14)+' تعديل</button></div>'}return h}
function openForm(title,fields,fn){var h='<div class="ov" onclick="if(event.target===this)closeM()"><div class="mod" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h3 id="modal-title">'+title+'</h3>';
 fields.forEach(function(f){var v=f.v==null?"":f.v;h+='<label for="f_'+f.k+'">'+f.l+'</label>';
  if(f.t==="select")h+='<select id="f_'+f.k+'">'+f.o.map(function(o){return'<option value="'+o[0]+'"'+(o[0]==v?' selected':'')+'>'+o[1]+'</option>'}).join("")+'</select>';
  else if(f.t==="area")h+='<textarea id="f_'+f.k+'" rows="2">'+esc(v)+'</textarea>';
  else if(f.t==="days")h+='<div class="days">'+ClinicSchedule.weekDays.map(function(i){var n=DAYS[i];return'<label><input type="checkbox" class="dd" value="'+i+'"'+(v.indexOf(i)>=0?' checked':'')+'>'+n+'</label>'}).join("")+'</div>';
  else h+='<input id="f_'+f.k+'" type="'+(f.t||"text")+'" '+(f.t==="password"?'autocomplete="new-password"':'autocapitalize="none"')+' value="'+esc(v)+'">'});
 h+='<div id="fe" class="err" role="alert"></div><div class="acts" style="margin-top:14px"><button class="btn sm" onclick="doSave()">حفظ</button><button class="btn sm x" onclick="closeM()">إلغاء</button></div></div></div>';
 modalReturn=document.activeElement;M=fn;FF=fields;document.getElementById("modal").innerHTML=h;document.body.classList.add("modal-open");document.getElementById("app").inert=true;document.querySelector(".hero").inert=true;document.querySelector(".mod input,.mod select,.mod button").focus()}
var modalReturn=null,saving=false;
function closeM(){if(saving)return;document.getElementById("modal").innerHTML="";M=null;document.body.classList.remove("modal-open");document.getElementById("app").inert=false;document.querySelector(".hero").inert=false;if(modalReturn&&modalReturn.isConnected)modalReturn.focus()}
document.addEventListener("keydown",function(e){if(!modalOpen())return;if(e.key==="Escape"){e.preventDefault();closeM()}if(e.key==="Tab"){var a=Array.from(document.querySelectorAll(".mod input,.mod select,.mod textarea,.mod button")).filter(function(x){return !x.disabled}),first=a[0],last=a[a.length-1];if(!first)return;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function editBk(id){var x=S.bk.filter(function(y){return y.id===id})[0];if(x)openForm("تعديل حجز",bkFields(x),bkSave(x))}
/* ===== Supabase Auth and protected API ===== */
var DOM="@clinic.app";
try{var theme=localStorage.getItem("clinic_theme");if(theme==="dark"||theme==="light")document.documentElement.setAttribute("data-theme",theme)}catch(e){}
var SD=today(),AUTH=null,LOADED={all:0,dates:{}},rtok=0;
try{AUTH=JSON.parse(sessionStorage.getItem("clinic_supabase_auth"))}catch(e){}
if(!AUTH)me=null;
function saveAuth(){try{if(AUTH)sessionStorage.setItem("clinic_supabase_auth",JSON.stringify(AUTH));else sessionStorage.removeItem("clinic_supabase_auth")}catch(e){}}
async function gateway(action,payload,auth){
 if(!CONFIG.demo&&!CONFIG.endpoint)throw new Error("لم يكتمل إعداد اتصال Supabase بعد");
 var headers={"Content-Type":"application/json"};if(CONFIG.publishableKey)headers.apikey=CONFIG.publishableKey;if(auth)headers.Authorization="Bearer "+await token();
 var readOnly=['get','workspace','systemHealth','reportData'].includes(action);
 for(var attempt=0;attempt<(readOnly?2:1);attempt++){
  try{var r=await request(CONFIG.endpoint||"/api/clinic",{method:"POST",headers:headers,body:JSON.stringify(Object.assign({action:action},payload))}),j=await r.json();
   if(!r.ok){var error=new Error((r.status===401?"NOAUTH: ":"")+(j.error||"تعذر تنفيذ العملية")+(j.requestId&&r.status>=500?" (مرجع: "+j.requestId+")":""));error.status=r.status;throw error;}return j.data;
  }catch(e){if(!readOnly||attempt||e.status&&![502,503,504].includes(e.status))throw e;await new Promise(resolve=>setTimeout(resolve,500));}
 }
}

async function request(url,options){var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},15000);try{return await fetch(url,Object.assign({},options,{signal:controller.signal,cache:"no-store"}))}finally{clearTimeout(timer)}}
function authResult(j){return {idToken:j.access_token,refreshToken:j.refresh_token,localId:j.user?.id,expiresIn:String(j.expires_in||3600)}}
async function authCall(ep,body){
 if(CONFIG.demo){var local=await request('/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Authorization:AUTH?'Bearer '+AUTH.idToken:''},body:JSON.stringify({ep:ep,body:body})}),result=await local.json();if(!local.ok)throw new Error(result.error||'NOAUTH');return result}
 if(!CONFIG.supabaseUrl||!CONFIG.publishableKey)throw new Error('لم يكتمل إعداد اتصال Supabase بعد');
 var path,method='POST',payload,headers={'Content-Type':'application/json',apikey:CONFIG.publishableKey};
 if(ep==='signInWithPassword'){path='/token?grant_type=password';payload={email:body.email,password:body.password}}
 else if(ep==='refresh'){path='/token?grant_type=refresh_token';payload={refresh_token:body.refresh_token}}
 else if(ep==='update'){path='/user';method='PUT';payload={password:body.password};headers.Authorization='Bearer '+body.idToken}
 else throw new Error('عملية دخول غير مدعومة');
 var response=await request(CONFIG.supabaseUrl+'/auth/v1'+path,{method:method,headers:headers,body:JSON.stringify(payload)}),data=await response.json();
 if(!response.ok){var authError=new Error(data.msg||data.error_description||data.message||'NOAUTH');authError.status=response.status;throw authError;}
 if(ep==='update'){var fresh=await authCall('refresh',{refresh_token:AUTH.refresh});return fresh}return authResult(data);
}
var refreshFlight=null;
async function token(){if(!AUTH)throw new Error('NOAUTH');if(Date.now()>AUTH.exp-300000){if(!refreshFlight){var owner=AUTH;refreshFlight=authCall('refresh',{refresh_token:owner.refresh}).then(function(j){if(AUTH!==owner)throw new Error('NOAUTH');AUTH.idToken=j.idToken;AUTH.refresh=j.refreshToken;AUTH.exp=Date.now()+(+j.expiresIn)*1000;saveAuth()}).finally(function(){refreshFlight=null})}await refreshFlight}if(!AUTH)throw new Error('NOAUTH');return AUTH.idToken}
async function signOutSupabase(accessToken){if(!CONFIG.supabaseUrl)return;try{await request(CONFIG.supabaseUrl+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:CONFIG.publishableKey,Authorization:'Bearer '+accessToken}})}catch(e){}}
async function jget(path,auth){if(path.indexOf('track/')===0)return gateway('lookup',{phone:lastPh,date:path.split("/")[1]},false);return gateway('get',{path:path},auth)}
async function jpatch(updates){return gateway('patch',{updates:updates},true)}

function newId(){return crypto.randomUUID().replace(/-/g,"")}
function normSched(s){if(!s)return;Object.keys(s).forEach(function(k){if(s[k]&&s[k].d)s[k].d=Object.keys(s[k].d).map(function(i){return +s[k].d[i]})});return s}
async function loadSettings(){var st=await jget("settings");if(st){if(Number.isFinite(+st.avg)&&+st.avg>=1&&+st.avg<=180)S.avg=+st.avg;if(st.sched){var c=normSched(st.sched);Object.keys(BR).forEach(function(k){var s=c[k];if(s&&Array.isArray(s.d)&&s.d.length&&s.d.every(function(d){return Number.isInteger(d)&&d>=0&&d<=6})&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.f)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.t)&&s.f<s.t)S.sched[k]=s})}}return st}
var dataEpoch=0,writing=false;
async function refreshData(){if(!me)return;if(me.role==="nurse"){await loadPatients();await loadSettings();return}var current=me,epoch=++dataEpoch,d=current.role==="doctor"?F.d:SD,list=[],loaded={all:!d?1:0,dates:{}};
 if(current.role==="doctor"&&!d){var all=(await jget("bookings",true))||{};for(var k in all)for(var i in all[k])list.push(all[k][i]);}
 else{var rows=(await jget("bookings/"+d,true))||{};for(var j in rows)list.push(rows[j]);loaded.dates[d]=1;}
 if(epoch!==dataEpoch||me!==current||d!==(current.role==="doctor"?F.d:SD))return;
 S.bk=list;LOADED=loaded;var st;try{st=await loadSettings()}catch(e){notify("تعذر تحديث مواعيد الفروع، تُعرض آخر مواعيد متاحة.");return}
 if(epoch!==dataEpoch||me!==current)return;
 if(!st&&current.role==="doctor")await jpatch({"settings":{avg:S.avg,sched:S.sched}});
 if(current.role==="doctor"&&tab==="users"){var r=(await jget("roles",true))||{};if(epoch!==dataEpoch||me!==current)return;U.sec=[];for(var u in r)if(r[u].r==="sec"||r[u].r==="nurse")U.sec.push({id:u,u:r[u].u,r:r[u].r,br:r[u].br});}
 if(current.role==="doctor"&&tab==="cases")await loadPatients();
}
async function ensureDate(d){if(LOADED.all||LOADED.dates[d])return;var o=(await jget("bookings/"+d,true))||{};for(var i in o)S.bk.push(o[i]);LOADED.dates[d]=1}
async function commit(puts,dels){if(writing)throw new Error("عملية حفظ قيد التنفيذ. انتظر لحظة.");writing=true;try{return await commitData(puts,dels)}finally{writing=false}}
async function commitData(puts,dels){await gateway("commit",{puts:puts,dels:dels},true);await refreshData();notify("تم حفظ الحجز بنجاح")}
function modalOpen(){return !!document.getElementById("modal").innerHTML}
function staff(){if(me)return me.role==="doctor"?doctor():me.role==="nurse"?nurse():secretary();
 return '<h2>'+ic("lock",20)+'دخول الطاقم</h2><label for="u">اسم المستخدم</label><input id="u" autocomplete="username" autocapitalize="none"><label for="pw">كلمة السر</label><input id="pw" type="password" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')login()"><button class="btn" id="lb" onclick="login()">دخول</button><div class="err" id="le" role="alert"></div><p style="text-align:center"><a href="#" style="color:var(--pri)">العودة لواجهة المرضى</a></p>'}
async function login(){var u=document.getElementById("u").value.trim().toLowerCase(),p=document.getElementById("pw").value,le=document.getElementById("le"),bt=document.getElementById("lb");le.textContent="";if(!u||!p){le.textContent="اكتب اسم المستخدم وكلمة السر";return}
 bt.disabled=true;var passwordAccepted=false;
 try{var j=await authCall("signInWithPassword",{email:u+DOM,password:p,returnSecureToken:true});
  AUTH={idToken:j.idToken,refresh:j.refreshToken,uid:j.localId,exp:Date.now()+(+j.expiresIn)*1000};saveAuth();
  passwordAccepted=true;var r=await jget("roles/"+AUTH.uid,true);
  if(!r||(!["admin","doctor","sec","nurse","staff"].includes(r.r))){AUTH=null;saveAuth();le.textContent="هذا الحساب ليس له صلاحية دخول";bt.disabled=false;return}
  me={u:r.u||u,role:r.r,br:r.br,scope:r.scope,permissions:r.permissions};try{sessionStorage.setItem("me",JSON.stringify(me))}catch(e){}
  F.d=today();SD=today();if(me.role==="admin"){openAdmin();return}if(adminPage()){location.replace("index.html#staff");return}render()}
 catch(e){AUTH=null;me=null;saveAuth();try{sessionStorage.removeItem("me")}catch(_){}le.textContent=passwordAccepted?(/NOAUTH/.test(e.message)?"كلمة المرور صحيحة، لكن الحساب متوقف أو غير مصرح له بالدخول. تواصل مع الأدمن.":"تم التحقق من كلمة المرور، لكن تعذر تحميل صلاحيات الحساب. حاول مجددًا بعد لحظة."):/NETWORK|fetch|Abort|timeout/i.test(e.message)?"تعذر الاتصال بالإنترنت":e.status===429?"محاولات دخول كثيرة. انتظر قليلًا ثم حاول مجددًا.":e.status>=500?"خدمة تسجيل الدخول غير متاحة مؤقتًا. حاول بعد لحظة.":"بيانات الدخول غير صحيحة";bt.disabled=false}}
function logout(){var previous=AUTH;if(previous&&!CONFIG.demo)signOutSupabase(previous.idToken);PT=null;SEL="";CL=[];INBOX={};gotFirst=false;document.title=TITLE0;dataEpoch++;rtok++;shown++;me=null;AUTH=null;saveAuth();try{sessionStorage.removeItem("me")}catch(e){}S.bk=[];if(adminPage()){location.replace("index.html");return}if(location.hash)go("patient");else render()}
function patient(){return '<p class="sub">أدخل رقم الهاتف المسجل عند الحجز لمتابعة دورك</p><label for="ph">رقم الهاتف <b>*</b></label><input id="ph" inputmode="tel" autocomplete="tel" type="tel" dir="ltr" maxlength="20" aria-describedby="phone-help" placeholder="مثال: 01xxxxxxxxx" oninput="chk()" onkeydown="if(event.key===\'Enter\')look()">'+'<button class="btn" id="go" disabled onclick="look()">'+ic("search")+' اعرف دوري</button><p class="hint" id="phone-help">استخدم رقم الهاتف المسجل عند الحجز. يقبل الأرقام العربية ورمز مصر +20.</p><div id="res" role="status" aria-live="polite" aria-atomic="true"></div><div id="brs">'+branches()+'</div>'}
var shown=0,lastDate=today();
async function showRes(){var el=document.getElementById("res");if(!el||!lastPh)return;var k=++shown,x;
 try{x=await jget("track/"+lastDate+"/"+norm(lastPh))}catch(e){if(k===shown&&el.isConnected)el.textContent=/[\u0600-\u06ff]/.test(e.message)?e.message:"تعذر الاتصال، تأكد من الإنترنت وحاول مرة أخرى.";return}
 if(k!==shown||!el.isConnected)return;
 if(!x){el.innerHTML='<div class="err">لا يوجد حجز بهذا الرقم. تأكد من الرقم أو تواصل مع السكرتارية.</div>';return}
 if(!BR[x.b]||!ST[x.s]||!VT[x.v]||!Number.isFinite(+x.no)){el.textContent="تعذر عرض بيانات الحجز. تواصل مع السكرتارية.";return}
 var lv=x.s==="wait"||x.s==="exam",a=lv?Math.max(0,Math.floor(+x.ahead||0)):0,st=ST[x.s]||ST.wait;
 var begun=!!x.queueStarted,pending=x.sessionStatus==="ended"?"انتهت جلسة الكشف لهذا اليوم":x.sessionStatus==="paused"?"الكشف متوقف مؤقتًا":lastDate!==today()?"لا يوجد كشف مباشر لهذا اليوم":"الطبيب لم يبدأ الكشف بعد";
 var rows=[["تاريخ الحجز",x.date],["ترتيبك في الطابور",lv?(begun?a+1:pending):"-"],["عدد الحالات أمامك",lv?(begun?a:pending):"-"],["الانتظار التقريبي (دقيقة)",x.s==="wait"?(begun?x.estimatedWaitMinutes:pending):"-"],["نوع الزيارة",VT[x.v]],["الفرع",BR[x.b].name],["العنوان",BR[x.b].addr]];
 if(lv)rows.splice(3,0,["التوقيت المتوقع للكشف",x.s==="exam"&&begun?"جاري الكشف الآن":x.queueStarted&&x.expectedAt?new Intl.DateTimeFormat("ar-EG",{timeZone:"Africa/Cairo",hour:"numeric",minute:"2-digit"}).format(new Date(x.expectedAt)):pending],["متوسط الكشف بالدقائق",x.avg||S.avg]);
 var t=(x.v==="emergency"&&lv?'<div class="near">'+(x.s==='exam'?'دور الطوارئ الآن، الكشف جارٍ.':'حجز طوارئ: أولوية بعد الحالة الجاري كشفها.')+'</div>':'')+'<div class="box"><div class="ticket"><small>رقم تذكرتك</small><div class="no">'+esc(x.no)+'</div><span class="badge '+st[1]+'">'+st[0]+'</span></div><table>'+rows.map(function(q){return"<tr><th scope=\"row\">"+q[0]+"</th><td>"+esc(q[1])+"</td></tr>"}).join("")+'</table></div>';
 if(x.s==="wait"&&begun&&a<=2)t+='<div class="near">'+ic("bell")+' دورك قرب، يرجى التواجد في العيادة.</div>';
 if(x.s==="exam"&&begun)t+='<div class="near">'+ic("check")+' دورك الآن، تفضل بالدخول.</div>';
 var output=t+'<p class="hint">يتم تحديث الحالة تلقائياً. وقت الانتظار تقديري وقد يتغيّر.</p>';if(el.innerHTML!==output)el.innerHTML=output}
async function doSave(){if(saving)return;var o={};FF.forEach(function(f){if(f.t==="days"){o[f.k]=[].slice.call(document.querySelectorAll(".dd")).filter(function(c){return c.checked}).map(function(c){return +c.value})}else{var value=document.getElementById("f_"+f.k).value;o[f.k]=f.t==="password"?value:value.trim()}});
 var fe=document.getElementById("fe"),r,buttons=Array.from(document.querySelectorAll(".mod button"));saving=true;buttons.forEach(function(b){b.disabled=true});try{r=await M(o)}catch(e){r=/[؀-ۿ]/.test(e.message)?e.message:"تعذر الحفظ، تأكد من الاتصال والصلاحيات"}finally{saving=false;buttons.forEach(function(b){b.disabled=false})}
 if(typeof r==="string"){fe.textContent=r;return}closeM();notify(r&&r.successMessage||"تم الحفظ بنجاح");render()}
function bkSave(x){return async function(o){var doc=can("bookings.edit")||(can("bookings.create")&&allBranches()),b=doc?o.b:me.br,d=o.date;
 if(!o.name||!validPhone(o.phone))return"أدخل اسم المريض ورقم موبايل صحيح (11 رقماً)";if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!BR[b]||!VT[o.v]||(o.s&&!ST[o.s]))return"اختر تاريخاً وفرعاً ونوع زيارة صحيحاً";if(!doc&&d<today())return"لا يمكن الحجز في تاريخ سابق";
 await refreshData();if(can("bookings.read"))await ensureDate(d);
 if(can("bookings.read")&&dup(o.phone,d,x.id))return"هذا الرقم لديه حجز بالفعل في هذا اليوم، ولا يُسمح بحجزين في نفس اليوم";
 if(x.id){var n=Object.assign({},x,{name:o.name,phone:norm(o.phone),v:o.v,nt:o.nt,b:b,date:d});if(o.s)n.s=o.s;if(x.b!==b||x.date!==d)n.no=nextNo(b,d);await commit([{n:n,o:x}],[])}
 else await commit([{n:{id:newId(),no:nextNo(b,d),name:o.name,phone:norm(o.phone),v:o.v,nt:o.nt,s:o.v==="emergency"?"exam":"wait",b:b,date:d},o:null}],[])}}
async function delBk(id){if(!confirm("حذف هذا الحجز؟ يمكنك استرجاعه من تبويب الحجوزات المحذوفة."))return;var x=S.bk.filter(function(y){return y.id===id})[0];if(!x)return;try{await commit([],[x])}catch(e){alert("تعذر الحذف")}render()}
async function setS(id,s){var x=S.bk.filter(function(y){return y.id===id})[0];if(!x)return;try{await commit([{n:Object.assign({},x,{s:s}),o:x}],[])}catch(e){notify(e.message||"تعذر تحديث الحالة")}render()}
async function purge(m){if(!confirm(m===1?"حذف كل حجوزات الأيام السابقة؟":"حذف كل الحجوزات نهائياً؟"))return;var d=today();
 try{var all=(await jget("bookings",true))||{},L=[];for(var k in all)for(var i in all[k])if(m===2||all[k][i].date<d)L.push(all[k][i]);S.bk=L.slice();LOADED={all:1,dates:{}};
  for(var p=0;p<L.length;p+=100)await commit([],L.slice(p,p+100))}catch(e){alert("تعذر الحذف")}render()}
async function setAvg(v){var n=Math.max(1,Math.min(180,Math.round(+v||15)));try{await jpatch({"settings/avg":n});S.avg=n}catch(e){alert("تعذر الحفظ")}render()}
function settings(){return '<h2>'+ic("gear",20)+'الإعدادات</h2><label for="av">متوسط وقت الكشف (دقيقة)</label><input id="av" type="number" min="1" value="'+S.avg+'" onchange="setAvg(this.value)"><button class="btn" onclick="editPw()">'+ic("lock")+' تغيير كلمة سر الدكتور</button><button class="btn" onclick="exportAdminData()">تنزيل نسخة من بيانات العيادة</button><button class="btn" onclick="reindex()">فهرسة المرضى من الحجوزات</button><button class="btn r" onclick="purgeDemo()">حذف البيانات التجريبية فقط</button><button class="btn r" onclick="purge(1)">'+ic("trash")+' حذف حجوزات الأيام السابقة</button><button class="btn r" onclick="purge(2)">'+ic("trash")+' حذف كل الحجوزات</button>'}
function editPw(){openForm("تغيير كلمة السر",[{k:"p",l:"كلمة السر الجديدة (6 أحرف على الأقل)",t:"password"}],async function(o){if(o.p.length<6)return"6 أحرف على الأقل";var j=await authCall("update",{idToken:await token(),password:o.p,returnSecureToken:true});AUTH.idToken=j.idToken;AUTH.refresh=j.refreshToken;AUTH.exp=Date.now()+(+j.expiresIn)*1000;saveAuth()})}
function users(){var h='<h2>'+ic("users",20)+'حسابات الدخول</h2><div class="item"><div class="m"><b>حساب الدكتور</b><small dir="ltr" style="text-align:right">'+esc(me.u)+'</small></div></div>';
 U.sec.forEach(function(s){var i=esc(s.id),nm=s.r==="nurse"?"الممرضة المساعدة":"سكرتارية "+BR[s.br].name;
  h+='<div class="item"><div class="m"><b>'+nm+'</b><small dir="ltr" style="text-align:right">'+esc(s.u)+'</small></div><div class="acts">'+(s.r==="sec"?'<button class="btn sm" data-a="sb" data-id="'+i+'">'+ic("edit",14)+' الفرع</button>':'')+'<button class="btn sm" data-a="sn" data-id="'+i+'">'+ic("lock",14)+' كلمة سر جديدة</button><button class="btn sm r" data-a="sd" data-id="'+i+'">'+ic("trash",14)+' إيقاف</button></div></div>'});
 return h+'<button class="btn a" onclick="secAdd()">'+ic("plus")+' مستخدم جديد</button><p class="hint">كلمة السر الجديدة تنشئ حساباً بديلاً، والحساب القديم يتوقف عن العمل.</p>'}
async function mkUser(u,p,br){try{return(await gateway("userCreate",{u:u.toLowerCase(),p:p,br:br},true)).uid}catch(e){return e.message}}
function secAdd(){openForm("مستخدم جديد",[{k:"u",l:"اسم المستخدم (إنجليزي)",v:""},{k:"p",l:"كلمة السر",t:"password"},{k:"br",l:"نوع الحساب",t:"select",o:[...branchOptions(),["nurse","الممرضة المساعدة"]],v:"dmn"}],async function(o){var r=await mkUser(o.u,o.p,o.br);if(!/^[A-Za-z0-9]{20,}$/.test(r))return r})}
function secBr(id){var s=U.sec.filter(function(y){return y.id===id})[0];if(!s)return;openForm("فرع "+esc(s.u),[{k:"br",l:"الفرع",t:"select",o:branchOptions(),v:s.br}],async function(o){await jpatch({["roles/"+id+"/br"]:o.br})})}
function secNew(id){var s=U.sec.filter(function(y){return y.id===id})[0];if(!s)return;openForm("حساب بديل لـ "+esc(s.u),[{k:"u",l:"اسم المستخدم الجديد",v:""},{k:"p",l:"كلمة السر الجديدة",t:"password"}],async function(o){var r=await mkUser(o.u,o.p,s.r==="nurse"?"nurse":s.br);if(!/^[A-Za-z0-9]{20,}$/.test(r))return r;await jpatch({["roles/"+id]:null})})}
async function secDel(id){if(!confirm("إيقاف هذا المستخدم؟ لن يستطيع الدخول بعد الآن."))return;try{await jpatch({["roles/"+id]:null})}catch(e){alert("تعذر التنفيذ")}render()}
function editSched(k){var s=S.sched[k];openForm("مواعيد "+BR[k].name,[{k:"d",l:"أيام العمل",t:"days",v:s.d},{k:"f",l:"من الساعة",t:"time",v:s.f},{k:"t",l:"إلى الساعة",t:"time",v:s.t}],async function(o){if(!o.d.length)return"اختر يوماً واحداً على الأقل";if(!o.f||!o.t||o.f>=o.t)return"وقت النهاية يجب أن يكون بعد البداية";await jpatch({["settings/sched/"+k]:{d:o.d,f:o.f,t:o.t}});S.sched[k]={d:o.d,f:o.f,t:o.t}})}
function draw(){topbar();var c=document.getElementById("contacts");if(c)c.style.display=staffView()?"none":"";var el=document.getElementById("app");if(location.hash==="#admin"&&me&&me.role!=="admin"&&!adminAccess()){el.innerHTML='<h2>صفحة الإدارة خاصة بمدير النظام</h2><button class="btn" onclick="go(\'staff\')">العودة إلى حسابي</button>';return}if(staffView()){el.innerHTML=staff();return}el.innerHTML=patient();showRes()}
function render(){if(location.protocol==="file:"){document.getElementById("app").innerHTML='<h2>تشغيل العيادة محليًا</h2><p>لتشغيل تسجيل الدخول والحجوزات والبيانات التجريبية، افتح ملف <b dir="ltr">START-CLINIC.cmd</b> من مجلد العيادة. سيعمل الموقع تلقائيًا في المتصفح.</p><a class="btn a" href="http://127.0.0.1:4173">فتح الموقع بعد التشغيل</a><p class="sub">بيانات الدخول موجودة في ملف <b dir="ltr">.demo/guide.txt</b>. هذه نسخة تجريبية محلية.</p>';return}draw();if(typeof refreshingData!=="undefined"&&refreshingData)return;var k=++rtok;
 if(me&&staffView()&&(location.hash!=="#admin"||me.role==="doctor"||adminAccess())){refreshData().then(function(){if(k===rtok&&!busy())draw()}).catch(function(e){if(/NOAUTH|40[13]/.test(e.message)){logout()}else notify("تعذر تحديث الحجوزات. تحقق من الاتصال وحاول مجدداً.")})}
 else if(!staffView()){loadSettings().then(function(){var b=document.getElementById("brs");if(b)b.innerHTML=branches()}).catch(function(){})}}
function busy(){var a=document.activeElement;return featureBusy||adminDraftDirty()||writing||saving||modalOpen()||(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))}
window.addEventListener("hashchange",function(){dataEpoch++;rtok++;shown++;if(modalOpen()&&!saving)closeM();render()});
var sessionRetry,sessionRetryDelay=5000;
async function restoreSession(){var owner=AUTH;if(location.protocol==="file:"){render();return}if(!AUTH){me=null;render();return}try{var role=await jget("roles/"+AUTH.uid,true);if(AUTH!==owner)return;sessionRetryDelay=5000;if(!role||(!["admin","doctor","sec","nurse","staff"].includes(role.r)))throw new Error("NOAUTH");me={u:role.u||"",role:role.r,br:role.br,scope:role.scope,permissions:role.permissions};if(me.role==="admin"){openAdmin();return}if(adminPage()){location.replace("index.html#staff");return}render()}catch(e){if(AUTH!==owner)return;if(e.status===401||e.status===403||/NOAUTH/.test(e.message)){logout();notify("انتهت جلسة الدخول. سجّل الدخول مجدداً.")}else{me=null;render();notify("تعذر التحقق من الجلسة مؤقتًا. سنعيد المحاولة دون حذف تسجيل دخولك.");clearTimeout(sessionRetry);sessionRetry=setTimeout(function(){if(AUTH===owner)return restoreSession()},sessionRetryDelay);sessionRetryDelay=Math.min(30000,sessionRetryDelay*2)}}}
me=null;
restoreSession();
/* Live updates and fallback polling are managed by clinic-enhancements.js. */

function bkItem(x,full){var st=ST[x.s]||ST.wait,q=esc(JSON.stringify(String(x.id))),h='<div class="item"><div class="n">'+esc(x.no)+'</div><div class="m"><b>'+esc(x.name)+'</b> <span class="badge '+st[1]+'">'+st[0]+'</span><small>'+esc(x.phone)+' · '+VT[x.v]+(full?' · '+esc(BR[x.b].name)+' · '+esc(x.date):'')+(x.nt&&can('notes.read')?' · '+esc(x.nt):'')+'</small></div><div class="acts">';if(can('bookings.status'))Object.keys(ST).forEach(function(s){if(s===x.s||s==='exam'&&S.bk.some(function(y){return y.id!==x.id&&y.b===x.b&&y.date===x.date&&y.s==='exam'}))return;h+='<button class="btn sm" onclick="setS('+q+','+esc(JSON.stringify(s))+')">'+ST[s][0]+'</button>'});if(can('bookings.edit'))h+='<button class="btn sm" onclick="editBk('+q+')">تعديل</button>';if(can('bookings.delete'))h+='<button class="btn sm r" onclick="delBk('+q+')">حذف</button>';return h+'</div></div>'}
function bkFields(x){var doc=can("bookings.edit")||(can("bookings.create")&&allBranches()),f=[{k:"name",l:"اسم المريض",v:x.name},{k:"phone",l:"رقم الموبايل",t:"tel",v:x.phone},{k:"v",l:"نوع الزيارة",t:"select",o:Object.keys(VT).filter(function(v){return v!=="emergency"||can("bookings.status")||x.v==="emergency"}).map(function(v){return [v,VT[v]]}),v:x.v},{k:"date",l:"تاريخ الحجز",t:"date",v:x.date}];
 if(doc){f.push({k:"b",l:"الفرع",t:"select",o:branchOptions(!x.id),v:x.b});if(x.id&&can("bookings.status"))f.push({k:"s",l:"الحالة",t:"select",o:Object.keys(ST).map(function(k){return[k,ST[k][0]]}),v:x.s})}
 if(can("notes.edit"))f.push({k:"nt",l:"ملاحظات",t:"area",v:x.nt});return f}
function newBk(type){if(!allBranches()&&me.br&&BR[me.br]?.enabled===false){notify("هذا الفرع متوقف عن استقبال حجوزات جديدة");return;}if(type==="emergency"){F.d=today();SD=today()}var x={name:"",phone:"",v:type||"exam",nt:"",b:allBranches()?(F.b!=="all"&&BR[F.b]?.enabled!==false&&BR[F.b]?F.b:((F.d||today())===today()?SESSIONS[today()+"_presence"]?.branch:null)||branchOptions(true)[0]?.[0]):me.br,date:type==="emergency"?today():allBranches()?(F.d||today()):SD};openForm("حجز جديد",bkFields(x),bkSave(x))}
function secretary(){var d=SD,L=S.bk.filter(function(x){return x.b===me.br&&x.date===d}).sort(function(a,b){return queueOrder(a,b)});
 var w=L.filter(function(x){return x.s==="wait"}).length,dn=L.filter(function(x){return x.s==="done"}).length;
 var h='<h2>'+ic("users",20)+'السكرتارية - '+esc(BR[me.br].name)+'</h2><div class="flt"><div><label for="staff-date">عرض حجوزات يوم</label><input id="staff-date" type="date" value="'+d+'" onchange="SD=this.value||today();render()"></div></div><div class="acts" style="margin-top:8px"><button class="btn sm x" onclick="SD=today();render()">اليوم</button></div>';
 h+='<div class="row" style="margin-top:14px"><div class="stat"><b>'+L.length+'</b><span>إجمالي اليوم المعروض</span></div><div class="stat"><b>'+w+'</b><span>في الانتظار</span></div><div class="stat"><b>'+dn+'</b><span>تم الكشف</span></div></div>';if(can('bookings.create'))h+='<button class="btn a" onclick="newBk()">'+ic("plus")+' حجز جديد</button>';
 if(can('bookings.create')&&can('bookings.status'))h+='<button class="btn r" onclick="newBk(\'emergency\')">حجز طوارئ - أولوية</button>';
 if(!L.length)h+='<p class="sub" style="margin-top:14px">لا توجد حجوزات في هذا اليوم.</p>';L.forEach(function(x){h+=bkItem(x,false)});return h}

async function loadPatients(force){if(PT&&!force&&Date.now()-PTt<60000)return;var owner=me,o=(await jget("patients",true))||{},m={};if(me!==owner)return;
 for(var k in o)if(/^01[0125]\d{8}$/.test(k)&&o[k]&&typeof o[k].n==="string")m[k]={n:o[k].n.slice(0,80),d:String(o[k].d||"").slice(0,10)};PT=m;PTt=Date.now()}
function cleanComplaints(o){var L=[];for(var k in (o||{})){var c=o[k];if(c&&ID.test(k)&&/^\d{4}-\d{2}-\d{2}$/.test(String(c.date))&&typeof c.text==="string")
 L.push({id:k,no:Number(c.no)||0,reason:String(c.reason||'').slice(0,2000),editedAt:c.editedAt,editedBy:c.editedBy,date:c.date,text:c.text.slice(0,2000),tx:String(c.tx||"").slice(0,1000),by:String(c.by||"").slice(0,30),at:String(c.at||"").slice(0,40)})}
 return L.sort(function(a,b){if(a.no&&b.no&&a.no!==b.no)return b.no-a.no;return a.date<b.date?1:a.date>b.date?-1:a.at<b.at?1:-1})}
async function loadCL(ph){CL=cleanComplaints(await jget("complaints/"+ph,true))}
function qList(){var q=digits(QS).trim().toLowerCase();if(!PT)return'<p class="sub" role="status">جارٍ تحميل قائمة المرضى…</p>';
 if(q.length<2)return'<p class="hint">اكتب حرفين أو رقمين على الأقل للبحث</p>';
 var L=Object.keys(PT).filter(function(k){return k.indexOf(q)>=0||PT[k].n.toLowerCase().indexOf(q)>=0}).sort(function(a,b){return PT[b].d<PT[a].d?-1:1}).slice(0,30);
 if(!L.length)return'<p class="sub">لا توجد حالة بهذا الاسم أو الرقم.</p>';var dr=can("notes.read");
 return L.map(function(k){return'<div class="item"><div class="m"><b>'+esc(PT[k].n)+'</b><small dir="ltr" style="text-align:right">'+k+'</small></div><button class="btn sm" data-a="'+(dr?"cf":"ns")+'" data-id="'+k+'">'+(dr?"ملف الحالة":"اختيار")+'</button></div>'}).join("")}
function qRes(){var e=document.getElementById("qres");if(e)e.innerHTML=qList()}
function cList(edit){if(!CL.length)return '<p class="sub">لا توجد شكاوى أو ملاحظات مسجلة.</p>';return '<div class="complaints-scroll"><table class="complaints-table"><thead><tr><th>رقم الشكوى</th><th>التاريخ ووقت التسجيل</th><th>السبب</th><th>الشكوى</th><th>العلاج الموصوف</th><th>سجلها / الإجراءات</th></tr></thead><tbody>'+CL.map(function(c){return '<tr><td>'+esc(c.no||'—')+'</td><td>'+esc(c.date)+'<br><small>'+esc(c.at?new Date(c.at).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}):'—')+'</small>'+(c.editedAt?'<br><small>تعديل: '+esc(new Date(c.editedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}))+'</small>':'')+'</td><td>'+esc(c.reason||'—')+'</td><td>'+esc(c.text)+'</td><td>'+esc(c.tx||'—')+'</td><td>'+esc(c.by)+(edit?'<div class="acts"><button class="btn sm" data-a="ce" data-id="'+c.id+'" data-p="'+SEL+'">تعديل</button><button class="btn sm r" data-a="cd" data-id="'+c.id+'" data-p="'+SEL+'">حذف</button></div>':'')+'</td></tr>'}).join('')+'</tbody></table></div>';}
/* ---- nurse ---- */
function nurse(){var h='<h2>'+ic("users",20)+'الممرضة المساعدة</h2><label for="qs">ابحثي عن الحالة بالاسم أو رقم الهاتف</label><input id="qs" type="search" autocomplete="off" value="'+esc(QS)+'" oninput="QS=this.value;qRes()"><div id="qres">'+qList()+'</div>';
 var p=PT&&PT[SEL];if(p)h+='<div class="box" style="padding:14px"><h3>'+esc(p.n)+' <small dir="ltr">'+SEL+'</small></h3><button class="btn a" data-a="ca" data-id="'+SEL+'">'+ic("plus")+' إضافة شكوى / ملاحظة</button><h2>السجل السابق</h2>'+cList(false)+'</div>';return h}
async function pick(ph){SEL=ph;setStatus("جارٍ التحميل…","load");try{await loadCL(ph);setStatus("")}catch(e){setStatus(errMsg(e),"err",function(){pick(ph)})}draw()}
function cForm(ph,c){var isNew=!c;
 openForm(isNew?"إضافة شكوى / ملاحظة":"تعديل الشكوى",[{k:"date",l:"تاريخ الشكوى",t:"date",v:isNew?today():c.date},{k:"reason",l:"سبب الشكوى / سبب الزيارة",t:"area",v:isNew?"":c.reason||""},{k:"text",l:"الشكوى أو الملاحظة",t:"area",v:isNew?"":c.text},{k:"tx",l:"العلاج الذي حدده الدكتور وقتها",t:"area",v:isNew?"":c.tx}],function(o){
  if(!o.text||o.text.length>2000)return"اكتب الشكوى (حتى 2000 حرف)";if(o.tx.length>1000)return"العلاج طويل (حتى 1000 حرف)";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||o.date>today())return"اختر تاريخاً صحيحاً (لا يكون في المستقبل)";
  return guard(async function(){var id=isNew?newId():c.id,up={},rec={id:id,date:o.date,reason:o.reason,text:o.text,tx:o.tx,by:isNew?me.u:c.by,at:isNew?new Date().toISOString():c.at};
   up["complaints/"+ph+"/"+id]=rec;if(isNew)up["inbox/"+id]={p:ph,n:(PT&&PT[ph]?PT[ph].n:""),by:me.u,at:rec.at,d:o.date};
   await jpatch(up);await loadCL(ph);if(me.role==="doctor")setTimeout(function(){openCase(ph)},60)},isNew?"تم تسجيل الشكوى وإرسالها للدكتور":"تم حفظ التعديل")})}
/* ---- doctor: case file ---- */
async function openCase(ph){modalReturn=document.activeElement;var m=document.getElementById("modal");SEL=ph;M=null;
 m.innerHTML='<div class="ov" onclick="if(event.target===this)closeM()"><div class="mod" role="dialog" aria-modal="true" aria-label="ملف الحالة" tabindex="-1"><p class="hint" role="status">جارٍ التحميل…</p></div></div>';
 const requestedCaseBox=m.querySelector('.mod');document.body.classList.add("modal-open");document.getElementById("app").inert=true;document.querySelector(".hero").inert=true;var f;try{f=await jget("files/"+ph,true);await loadCL(ph);if(!PT)await loadPatients()}catch(e){closeM();setStatus(errMsg(e),"err");return}
 var p=PT&&PT[ph]?PT[ph]:{n:""},n=f&&typeof f.n==="string"?f.n.slice(0,5000):"",box=m.querySelector(".mod");if(!box||box!==requestedCaseBox||SEL!==ph)return;box.medicalSnapshot=f||{};box.dataset.medicalVersion=String(f?.rev||0);box.dataset.medicalPhone=ph;
 box.innerHTML='<h3>'+esc(p.n||"حالة")+' <small dir="ltr">'+ph+'</small></h3><label for="cn">ملاحظات الدكتور (تحاليل، سونار، علاج سابق، تذكير)</label><textarea id="cn" rows="6" maxlength="5000">'+esc(n)+'</textarea><div class="acts" style="margin-top:8px"><button class="btn sm" data-a="cs" data-id="'+ph+'">حفظ الملاحظات</button><button class="btn sm a" data-a="ca" data-id="'+ph+'">'+ic("plus",14)+' شكوى / ملاحظة</button><button class="btn sm x" onclick="closeM()">إغلاق</button></div><h2>شكاوى وملاحظات الممرضة</h2>'+cList(true);
 var t=box.querySelector("#cn");if(t)t.focus()}
function saveNotes(ph){var t=document.getElementById("cn");if(!t)return;if(t.value.length>5000){setStatus("الملاحظات طويلة جداً (حتى 5000 حرف)","err");return}
 guard(function(){var o={};o["files/"+ph]={n:t.value,t:new Date().toISOString()};return jpatch(o)},"تم حفظ ملاحظات الدكتور").then(function(r){if(r)setStatus(r,"err")})}
async function delC(ph,id){if(!confirm("حذف هذه الشكوى نهائياً؟"))return;
 var r=await guard(function(){var up={};up["complaints/"+ph+"/"+id]=null;up["inbox/"+id]=null;return jpatch(up)},"تم الحذف");if(r)setStatus(r,"err");openCase(ph)}
function cases(){var ks=Object.keys(INBOX).sort(function(a,b){return INBOX[b].at<INBOX[a].at?-1:1});
 var h='<h2>'+ic("bell",20)+'شكاوى جديدة من الممرضة ('+ks.length+')</h2>'+(ks.length?ks.map(function(k){var c=INBOX[k];return'<div class="item"><div class="m"><b>'+esc(c.n||c.p)+'</b><small>'+esc(c.by)+' · '+esc(c.d)+'</small></div><div class="acts"><button class="btn sm" data-a="ai" data-id="'+k+'" data-p="'+c.p+'">فتح الملف</button><button class="btn sm x" data-a="ar" data-id="'+k+'">تمت القراءة</button></div></div>'}).join(""):'<p class="sub">لا توجد شكاوى جديدة.</p>');
 return h+'<h2>'+ic("search",20)+'البحث عن حالة</h2><label for="qs">الاسم أو رقم الهاتف</label><input id="qs" type="search" autocomplete="off" value="'+esc(QS)+'" oninput="QS=this.value;qRes()"><div id="qres">'+qList()+'</div><p class="hint">الصوت يعمل بعد أول ضغطة على الصفحة.</p>'}

document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-a]");if(!b)return;var id=b.dataset.id,p=b.dataset.p;
 var m={cf:function(){openCase(id)},ns:function(){pick(id)},ca:function(){cForm(id,null)},ce:function(){var c=CL.filter(function(x){return x.id===id})[0];if(c)cForm(p,c)},cd:function(){delC(p,id)},cs:function(){saveNotes(id)},ai:function(){markRead(id);openCase(p)},ar:function(){markRead(id)}};
 if(m[b.dataset.a])m[b.dataset.a]()});

function updTitle(){var n=Object.keys(INBOX).length;document.title=(n?"("+n+") ":"")+TITLE0}
function unlockAudio(){try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!actx)actx=new AC();if(actx.state==="suspended")actx.resume()}catch(e){}}
document.addEventListener("click",unlockAudio);
function beep(){try{unlockAudio();if(!actx||actx.state!=="running")return;[880,1175].forEach(function(f,i){var o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime+i*.22;o.frequency.value=f;o.connect(g);g.connect(actx.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.start(t);o.stop(t+.22)})}catch(e){}}
function cleanInbox(k,x){if(!ID.test(k)||!x||typeof x!=="object"||!/^01[0125]\d{8}$/.test(String(x.p))||!/^\d{4}-\d{2}-\d{2}$/.test(String(x.d)))return null;return{p:x.p,n:String(x.n||"").slice(0,80),by:String(x.by||"").slice(0,30),at:String(x.at||"").slice(0,40),d:x.d}}
function noteNew(c){window.__lastNote=c.p;beep();setStatus("شكوى جديدة من الممرضة: "+(c.n||c.p),"ok")}
function refreshInboxView(){updTitle();if(staffView()&&me&&!busy()){var a=document.activeElement;if(!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))draw()}}
function applyInbox(path,data,isPatch){
 if(path==="/"){var next={};if(data&&typeof data==="object")for(var k in data){var c=cleanInbox(k,data[k]);if(c)next[k]=c}
  if(isPatch){Object.keys(next).forEach(function(k){if(!INBOX[k])noteNew(next[k])});Object.assign(INBOX,next)}
  else{if(gotFirst)Object.keys(next).forEach(function(k){if(!INBOX[k])noteNew(next[k])});INBOX=next;gotFirst=true}}
 else{var id=path.slice(1);if(id.indexOf("/")>=0)return;var c2=cleanInbox(id,data);if(c2){if(!INBOX[id]&&gotFirst)noteNew(c2);INBOX[id]=c2}else delete INBOX[id]}
 refreshInboxView()}

function reindex(){act(async function(){var all=(await jget("bookings",true))||{},m={};
 for(var d in all)for(var i in all[d]){var c=cleanBk(all[d][i]);if(c&&(!m[c.phone]||m[c.phone].d<c.date))m[c.phone]={n:c.name,d:c.date}}
 var ks=Object.keys(m);for(var p=0;p<ks.length;p+=200){var up={};ks.slice(p,p+200).forEach(function(k){up["patients/"+k]=m[k]});await jpatch(up)}PT=null},"تمت فهرسة المرضى")}
