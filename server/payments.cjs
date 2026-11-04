const core=require('./core.cjs');
const fields=['enabled','walletEnabled','instapayEnabled','walletNumber','instapayUrl','message'];
function authorize(state,uid){if(!['admin','doctor'].includes(core.role(state,uid).r))core.fail('إعداد وسائل الدفع متاح للطبيب والأدمن فقط',403);}
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields.includes(k)))core.fail('بيانات وسائل الدفع غير صحيحة');
 const out={};for(const k of fields.slice(0,3)){if(value[k]!==undefined&&typeof value[k]!=='boolean')core.fail('راجع تفعيل وسائل الدفع');out[k]=value[k]===true;}
 for(const k of fields.slice(3,5))if(value[k]!==undefined&&typeof value[k]!=='string')core.fail('رقم المحفظة أو رابط الدفع غير صحيح');
 if(value.message!==undefined&&(typeof value.message!=='string'||value.message.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.message)))core.fail('رسالة الدفع نص لا يزيد عن ٢٠٠٠ حرف');out.message=(value.message||'').trim();
 out.walletNumber=core.phone(value.walletNumber||'');if(out.walletNumber&&!/^01[0125]\d{8}$/.test(out.walletNumber))core.fail('أدخل رقم محفظة مصريًا صحيحًا من ١١ رقمًا');
 out.instapayUrl=(value.instapayUrl||'').trim();if(out.instapayUrl){let u;try{u=new URL(out.instapayUrl)}catch{core.fail('أدخل رابط إنستا باي كاملًا يبدأ بـ https://');}if(out.instapayUrl.length>2048||/[\s\u0000-\u001f\u007f]/.test(out.instapayUrl)||u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))core.fail('أدخل رابط دفع آمنًا يبدأ بـ https://');out.instapayUrl=u.href;}
 if(out.walletEnabled&&!out.walletNumber)core.fail('أدخل رقم المحفظة قبل تفعيلها');if(out.instapayEnabled&&!out.instapayUrl)core.fail('أدخل رابط إنستا باي قبل تفعيله');
 if(out.enabled&&!out.walletEnabled&&!out.instapayEnabled)core.fail('فعّل وسيلة دفع واحدة على الأقل أو أخفِ قسم الدفع');return out;
}
function guard(before,next,uid){if(JSON.stringify(before.settings?.payments)===JSON.stringify(next.settings?.payments)&&before.settings?.paymentsRev===next.settings?.paymentsRev)return next;authorize(before,uid);next.settings||={};next.settings.payments=normalize(next.settings.payments||{});next.settings.paymentsRev=(before.settings?.paymentsRev||0)+1;return next;}
async function save(adapter,input,uid){await adapter.mutate(original=>{authorize(original,uid);if(!Number.isSafeInteger(input.revision)||input.revision!==(original.settings?.paymentsRev||0))core.fail('تغيّرت بيانات الدفع؛ حدّث الصفحة وافتح الإعدادات من جديد',409);const config=normalize(input.config),s=structuredClone(original);s.settings||={};s.settings.payments=config;s.settings.paymentsRev=(original.settings?.paymentsRev||0)+1;return s});return {ok:true};}
module.exports={normalize,guard,save};
