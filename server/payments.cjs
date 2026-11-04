const core=require('./core.cjs');
const fields=['enabled','walletEnabled','instapayEnabled','walletNumber','instapayUrl','message','items'];
function price(value){
 if(typeof value!=='string')core.fail('أدخل سعر البند بالأرقام');
 const s=value.trim().replace(/[٠-٩۰-۹]/g,d=>String(d.charCodeAt(0)>1775?d.charCodeAt(0)-1776:d.charCodeAt(0)-1632)).replace(/[٫,]/g,'.');
 if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(s))core.fail('السعر رقم موجب أو صفر، بحد أقصى منزلتين عشريتين');
 const [whole,fraction='']=s.split('.');return String(Number(whole))+'.'+fraction.padEnd(2,'0');
}
function items(value){
 if(value===undefined)return [];if(!Array.isArray(value)||value.length>20)core.fail('يمكن إضافة ٢٠ بند دفع كحد أقصى');const ids=new Set();
 return value.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['id','label','amount','enabled'].includes(k)))core.fail('بيانات بند الدفع غير صحيحة');
  if(typeof row.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(row.id)||ids.has(row.id))core.fail('معرف بند الدفع غير صحيح أو مكرر');ids.add(row.id);
  if(typeof row.label!=='string'||!row.label.trim()||row.label.length>80||/[\u0000-\u001f]/.test(row.label))core.fail('اكتب اسم بند الدفع حتى ٨٠ حرفًا');if(typeof row.enabled!=='boolean')core.fail('راجع إظهار بند الدفع');
  const amount=!row.enabled&&row.amount===''?'':price(row.amount);return {id:row.id,label:row.label.trim(),amount,enabled:row.enabled};
 });
}
function authorize(state,uid){if(!['admin','doctor'].includes(core.role(state,uid).r))core.fail('إعداد وسائل الدفع متاح للطبيب والأدمن فقط',403);}
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields.includes(k)))core.fail('بيانات وسائل الدفع غير صحيحة');
 const out={};for(const k of fields.slice(0,3)){if(value[k]!==undefined&&typeof value[k]!=='boolean')core.fail('راجع تفعيل وسائل الدفع');out[k]=value[k]===true;}
 for(const k of fields.slice(3,5))if(value[k]!==undefined&&typeof value[k]!=='string')core.fail('رقم المحفظة أو رابط الدفع غير صحيح');
 if(value.message!==undefined&&(typeof value.message!=='string'||value.message.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.message)))core.fail('رسالة الدفع نص لا يزيد عن ٢٠٠٠ حرف');out.message=(value.message||'').trim();
 out.walletNumber=core.phone(value.walletNumber||'');if(out.walletNumber&&!/^01[0125]\d{8}$/.test(out.walletNumber))core.fail('أدخل رقم محفظة مصريًا صحيحًا من ١١ رقمًا');
 out.instapayUrl=(value.instapayUrl||'').trim();if(out.instapayUrl){let u;try{u=new URL(out.instapayUrl)}catch{core.fail('أدخل رابط إنستا باي كاملًا يبدأ بـ https://');}if(out.instapayUrl.length>2048||/[\s\u0000-\u001f\u007f]/.test(out.instapayUrl)||u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))core.fail('أدخل رابط دفع آمنًا يبدأ بـ https://');out.instapayUrl=u.href;}
 if(out.walletEnabled&&!out.walletNumber)core.fail('أدخل رقم المحفظة قبل تفعيلها');if(out.instapayEnabled&&!out.instapayUrl)core.fail('أدخل رابط إنستا باي قبل تفعيله');
 if(out.enabled&&!out.walletEnabled&&!out.instapayEnabled)core.fail('فعّل وسيلة دفع واحدة على الأقل أو أخفِ قسم الدفع');out.items=items(value.items);return out;
}
function guard(before,next,uid){if(JSON.stringify(before.settings?.payments)===JSON.stringify(next.settings?.payments)&&before.settings?.paymentsRev===next.settings?.paymentsRev)return next;authorize(before,uid);next.settings||={};next.settings.payments=normalize(next.settings.payments||{});next.settings.paymentsRev=(before.settings?.paymentsRev||0)+1;return next;}
async function save(adapter,input,uid){let saved;await adapter.mutate(original=>{authorize(original,uid);if(!Number.isSafeInteger(input.revision)||input.revision!==(original.settings?.paymentsRev||0))core.fail('تغيّرت بيانات الدفع؛ حدّث الصفحة وافتح الإعدادات من جديد',409);const incoming=input.config;const config=normalize(incoming&&typeof incoming==='object'&&!Array.isArray(incoming)&&!Object.hasOwn(incoming,'items')?{...incoming,items:original.settings?.payments?.items||[]}:incoming),s=structuredClone(original);s.settings||={};s.settings.payments=config;s.settings.paymentsRev=(original.settings?.paymentsRev||0)+1;saved={payments:config,revision:s.settings.paymentsRev};return s});return {ok:true,...saved};}
module.exports={normalize,guard,save};
