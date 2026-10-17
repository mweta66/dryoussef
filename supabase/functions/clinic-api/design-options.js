const fail=(message)=>{const e=Error(message);e.status=400;throw e};
const COLOR_KEYS=['background','card','text','primary','accent','muted','line','headerBackground','headerText'];
function validate(d){const out={};if(d.themePreset!==undefined){if(!Number.isInteger(d.themePreset)||d.themePreset<0||d.themePreset>9)fail('ثيم غير صحيح');out.themePreset=d.themePreset;}if(d.defaultMode!==undefined){if(!['system','light','dark'].includes(d.defaultMode))fail('وضع غير صحيح');out.defaultMode=d.defaultMode;}
for(const [k,min,max]of [['headerHeight',80,420],['logoSize',40,180],['photoSize',40,160],['aboutFontSize',16,32]])if(d[k]!==undefined){if(!Number.isInteger(d[k])||d[k]<min||d[k]>max)fail('مقاس تصميم غير صحيح');out[k]=d[k];}
if(d.aboutAlign!==undefined){if(!['start','center','end'].includes(d.aboutAlign))fail('محاذاة غير صحيحة');out.aboutAlign=d.aboutAlign;}
if(d.palettes!==undefined){if(!d.palettes||typeof d.palettes!=='object')fail('ألوان غير صحيحة');out.palettes={};for(const mode of ['light','dark']){if(!d.palettes[mode])continue;out.palettes[mode]={};for(const k of COLOR_KEYS)if(d.palettes[mode][k]!==undefined){if(!/^#[0-9a-f]{6}$/i.test(d.palettes[mode][k]))fail('لون غير صحيح');out.palettes[mode][k]=d.palettes[mode][k];}}}return out;}
export {validate};
