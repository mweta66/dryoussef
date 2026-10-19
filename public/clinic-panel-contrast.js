(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ClinicPanelContrast=factory();})(globalThis,function(){
 function mix(a,b,weight){return '#'+a.slice(1).match(/../g).map((v,i)=>Math.round(parseInt(v,16)*(1-weight)+parseInt(b.slice(1).match(/../g)[i],16)*weight).toString(16).padStart(2,'0')).join('');}
 function luminance(hex){const v=hex.slice(1).match(/../g).map(x=>{const n=parseInt(x,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2];}
 function ratio(a,b){const one=luminance(a),two=luminance(b);return (Math.max(one,two)+.05)/(Math.min(one,two)+.05);}
 function analyze({text,background,border,borderWidth=2,borderMix=.40},dark){
  const results=[{mode:'نهاري',text,background,border},{mode:'ليلي',text:mix(text,dark.text,.90),background:mix(background,dark.card,.94),border:mix(border,dark.card,borderMix)}];
  return results.map(x=>({...x,textRatio:ratio(x.text,x.background),borderRatio:ratio(x.border,x.background),warnings:[...(ratio(x.text,x.background)<4.5?['النص أقل من 4.5:1']:[]),...(borderWidth>0&&ratio(x.border,x.background)<3?['حدود البرواز أقل من 3:1']:[])]}));
 }
 return {ratio,analyze};
});
