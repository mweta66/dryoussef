(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ClinicListOrder=factory();})(globalThis,function(){
 function text(value){return String(value??'').replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)>=1776?c.charCodeAt(0)-1776:c.charCodeAt(0)-1632)).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[\u064b-\u065f\u0640]/g,'').toLowerCase().trim();}
 function compareTickets(a,b){return (Number(a.no)||0)-(Number(b.no)||0)||String(a.id).localeCompare(String(b.id),'ar',{numeric:true});}
 function directory(patients,query='',index=0,size=30){const q=text(query),keys=Object.keys(patients||{}).filter(p=>text(p).includes(q)||text(patients[p]?.n).includes(q)).sort((a,b)=>String(patients[a]?.n||'').localeCompare(String(patients[b]?.n||''),'ar',{sensitivity:'base',numeric:true})||a.localeCompare(b));const total=keys.length,pages=Math.max(1,Math.ceil(total/size)),page=Math.min(pages-1,Math.max(0,Math.floor(Number(index)||0))),start=page*size;return {phones:keys.slice(start,start+size),total,pages,page,start};}
 return {compareTickets,directory,text};
});
