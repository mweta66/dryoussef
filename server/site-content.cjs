const SECTION_KEYS=['header','contacts','about','branches','lookup','footer'];
function validate(value,layout={},fail){
 const rows=Array.isArray(value)?value:Object.values(value||{});if(rows.length>24)fail('الحد الأقصى 24 قسمًا');const sections={};
 for(const [order,x]of rows.entries()){
  if(!x||typeof x!=='object'||!/^[-_a-zA-Z0-9]{1,80}$/.test(x.id||'')||Object.hasOwn(sections,x.id)||['__proto__','constructor','prototype'].includes(x.id))fail('معرّف قسم غير صحيح أو مكرر');
  const item={id:x.id,order,visible:x.visible!==false};for(const [key,max]of [['title',120],['body',4000],['linkLabel',80]]){if(x[key]!==undefined&&(typeof x[key]!=='string'||x[key].length>max))fail('نص القسم طويل أو غير صحيح');item[key]=x[key]||'';}
  if(x.visible!==undefined&&typeof x.visible!=='boolean')fail('حالة إظهار القسم غير صحيحة');
  item.kind=x.kind||'text';if(!['text','notice','image'].includes(item.kind))fail('نوع القسم غير صحيح');
  item.link=x.link||'';if(typeof item.link!=='string'||item.link.length>1000)fail('رابط غير صحيح');if(item.link){let valid=/^tel:\+?\d{7,15}$/.test(item.link);try{const url=new URL(item.link);valid||=url.protocol==='https:'&&!url.username&&!url.password}catch{}if(!valid)fail('الرابط يجب أن يبدأ بـ https:// أو tel:');}
  item.image=x.image||'';if(item.image){const match=typeof item.image==='string'&&item.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);if(!match||match[2].length>267000)fail('صورة القسم يجب أن تكون PNG أو JPEG أو WebP حتى 200 كيلوبايت');let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))}catch{fail('محتوى الصورة غير صحيح')}const good=bytes.length>=12&&bytes.length<=200000&&(match[1]==='png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP');if(!good)fail('محتوى الصورة لا يطابق نوعها');}
  sections[item.id]=item;
 }
 if(!layout||typeof layout!=='object'||Array.isArray(layout)||Object.entries(layout).some(([k,v])=>!SECTION_KEYS.includes(k)||typeof v!=='boolean'))fail('إعدادات ظهور الأقسام غير صحيحة');
 if(JSON.stringify(sections).length>650000)fail('صور ومحتوى الأقسام أكبر من الحد المسموح');return {sections,layout:{...layout}};
}
module.exports={validate,SECTION_KEYS};
