const {renderPage,names}=require('../public/clinic-branch-pages.js');
const config=require('../public/clinic-public-config.json');
async function handler(req,res){
 const id=String(req.query?.branch||'');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!Object.hasOwn(names,id)){res.statusCode=404;res.setHeader('X-Robots-Tag','noindex,nofollow');return res.end(renderPage({},'unknown'));}
 try{const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify({action:'get',path:'settings'}),signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('Settings unavailable');const json=await response.json(),settings=json.data||{};const registry=settings.branches||settings.site?.branches||{},enabled=!!registry[id]&&registry[id].enabled!==false;res.statusCode=enabled?200:404;if(!enabled)res.setHeader('X-Robots-Tag','noindex,nofollow');return res.end(renderPage(settings,id));}
 catch{res.statusCode=503;res.setHeader('Retry-After','30');res.setHeader('X-Robots-Tag','noindex,nofollow');return res.end(renderPage({},id,{pending:true}));}
}
module.exports=handler;
