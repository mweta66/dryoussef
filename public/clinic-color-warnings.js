function panelContrastReport(kind,config){
 const dark=clinicDarkPalette({...clinicPalette(SITE.design?.themePreset||0,'dark'),...SITE.design?.palettes?.dark});
 return ClinicPanelContrast.analyze(kind==='about'?{text:config.design.aboutTextColor,background:config.design.aboutBackground,border:config.design.aboutBorderColor,borderWidth:config.design.aboutBorderWidth}:{text:config.noticeTextColor,background:config.noticeBackground,border:config.noticeBorderColor,borderWidth:config.noticeBorderWidth,borderMix:.30},dark);
}
function showPanelContrast(id,anchor,results){
 if(!anchor)return;let node=document.getElementById(id);if(!node){node=document.createElement('p');node.id=id;anchor.after(node);}const warnings=results.some(x=>x.warnings.length);node.className=warnings?'contrast-warning':'contrast-pass';node.setAttribute('role',warnings?'alert':'status');node.textContent=results.map(x=>x.mode+': تباين النص '+x.textRatio.toFixed(2)+':1، البرواز '+x.borderRatio.toFixed(2)+':1'+(x.warnings.length?' — '+x.warnings.join('، '):' — واضح')).join(' | ');
}
function confirmPanelContrast(kind,config){const warnings=panelContrastReport(kind,config).flatMap(x=>x.warnings.map(w=>x.mode+' — '+w));return !warnings.length||confirm('قد يصعب قراءة البرواز بهذه الألوان:\n'+warnings.join('\n')+'\n\nهل تريد حفظ الألوان رغم ذلك؟');}
var contrastAboutPreview=renderAboutPreview;renderAboutPreview=function(){contrastAboutPreview();try{showPanelContrast('about-contrast-status',document.querySelector('.about-editor-preview'),panelContrastReport('about',collectClinicAbout()));}catch{}};
var contrastAboutSave=saveClinicAbout;saveClinicAbout=async function(){try{if(!confirmPanelContrast('about',collectClinicAbout()))return;}catch{return contrastAboutSave();}return contrastAboutSave();};
var contrastQueuePreview=renderQueuePreview;renderQueuePreview=function(){contrastQueuePreview();try{showPanelContrast('notice-contrast-status',document.getElementById('queue_notice_preview')?.parentElement,panelContrastReport('notice',collectQueueAppearance()));}catch{}};
var contrastQueueSave=saveQueueAppearance;saveQueueAppearance=async function(){try{if(me?.role==='admin'&&!confirmPanelContrast('notice',collectQueueAppearance()))return;}catch{return contrastQueueSave();}return contrastQueueSave();};
