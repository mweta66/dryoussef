import * as core from './core.js';
import * as perms from './permissions.js';
async function exportImage(adapter,input,uid){const s=await adapter.read();perms.requirePermission(core.role(s,uid),'data.export');const phone=core.phone(input.phone),item=s.attachments?.[phone]?.[input.id];if(!item)core.fail('الصورة غير موجودة',404);const result=adapter.readAttachmentBytes?await adapter.readAttachmentBytes(item.key,item.mime):await adapter.readAttachment(item.key,item.mime);if(typeof result.data!=='string')core.fail('تعذر تنزيل أصل الصورة للنسخة الاحتياطية',503);return {sourceId:item.id,phone,name:item.name,mime:item.mime,category:item.category||'report',reportDate:item.reportDate||item.createdAt.slice(0,10),data:result.data};}
export {exportImage};
