const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {scryptSync,timingSafeEqual,randomBytes}=require('node:crypto');
const {createService}=require('../server/service.cjs');
const root=path.resolve(__dirname,'../public'),demo=path.resolve(__dirname,'../.demo');
if(!fs.existsSync(path.join(demo,'state.json')))throw new Error('Run npm run demo:seed first.');
let queue=Promise.resolve();const sessions=new Map(),rates=new Map();
function limit(key,max=20){
 const now=Date.now();for(const [k,v] of rates)if(v.until<now)rates.delete(k);
 const v=rates.get(key)||{count:0,until:now+60000};v.count++;rates.set(key,v);
 if(v.count>max){const e=new Error('طلبات كثيرة. حاول بعد دقيقة.');e.status=429;throw e;}
}
const read=()=>JSON.parse(fs.readFileSync(path.join(demo,'state.json'),'utf8'));
const handle=createService({
 read:async()=>read(),
 mutate:fn=>{
  const run=queue.then(()=>{const next=fn(read());const temp=path.join(demo,'state.tmp');fs.writeFileSync(temp,JSON.stringify(next));fs.renameSync(temp,path.join(demo,'state.json'));});
  queue=run.catch(()=>{});return run;
 },
 limit:async(key,p)=>{limit('lookup-ip:'+key,300);limit('lookup-phone:'+key+':'+p,20)},
 createUser:async(u,p)=>{
  const file=path.join(demo,'accounts.json'),list=JSON.parse(fs.readFileSync(file,'utf8'));
  if(list.some(x=>x.u===u)){const e=new Error('اسم المستخدم موجود');e.status=409;throw e;}
  const uid=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
  list.push({uid,u,salt,hash:scryptSync(p,salt,32).toString('hex')});fs.writeFileSync(file,JSON.stringify(list));return uid;
 },
 updateUser:async(uid,password)=>{const file=path.join(demo,'accounts.json'),accounts=JSON.parse(fs.readFileSync(file,'utf8')),account=accounts.find(a=>a.uid===uid);if(!account)throw new Error('Account missing');account.salt=randomBytes(16).toString('hex');account.hash=scryptSync(password,account.salt,32).toString('hex');delete account.password;fs.writeFileSync(file,JSON.stringify(accounts));for(const [token,s] of sessions)if(s.uid===uid)sessions.delete(token);},
 updateCredentials:async(uid,{username,password})=>{const file=path.join(demo,'accounts.json'),accounts=JSON.parse(fs.readFileSync(file,'utf8')),account=accounts.find(a=>a.uid===uid);if(!account)throw Error('Account missing');if(accounts.some(a=>a.uid!==uid&&a.u===username))throw Error('Username already exists');account.u=username;if(password){account.salt=randomBytes(16).toString('hex');account.hash=scryptSync(password,account.salt,32).toString('hex');delete account.password}fs.writeFileSync(file,JSON.stringify(accounts));},
 revokeUserSessions:async uid=>{for(const [token,s]of sessions)if(s.uid===uid)sessions.delete(token)},
 deleteUser:async uid=>{const file=path.join(demo,'accounts.json');fs.writeFileSync(file,JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')).filter(x=>x.uid!==uid)));}
});
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>900000){const e=new Error('Payload too large');e.status=413;throw e;}}return JSON.parse(text);}
function session(uid){
 const token=randomBytes(32).toString('hex');sessions.set(token,{uid,exp:Date.now()+3600000});
 return {idToken:token,refreshToken:token,localId:uid,expiresIn:'3600'};
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 try{
  if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{service:'clinic-local'});
  if(url.pathname==='/config.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('window.CLINIC_CONFIG={secureGateway:true,endpoint:"/api/clinic",demo:true};');}
  if(url.pathname.startsWith('/api/')){
   if(req.method!=='POST')return json(res,405,{error:'POST required'});
   if(!String(req.headers['content-type']).startsWith('application/json'))return json(res,415,{error:'JSON required'});
   if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return json(res,403,{error:'Origin rejected'});
   const input=await body(req),token=String(req.headers.authorization||'').replace(/^Bearer /,''),active=sessions.get(token);
   if(url.pathname==='/api/auth'){
    limit('login:'+req.socket.remoteAddress,10);
    if(input.ep==='signInWithPassword'){
     const accounts=JSON.parse(fs.readFileSync(path.join(demo,'accounts.json'),'utf8')),u=String(input.body.email||'').split('@')[0],p=String(input.body.password||'');
     const account=accounts.find(x=>x.u===u);
     if(!account||!timingSafeEqual(scryptSync(p,account.salt,32),Buffer.from(account.hash,'hex')))return json(res,401,{error:'INVALID_LOGIN_CREDENTIALS'});
     return json(res,200,session(account.uid));
    }
    if(!active||active.exp<Date.now())return json(res,401,{error:'NOAUTH'});
    if(input.ep==='refresh')return json(res,200,session(active.uid));
    if(input.ep==='update'){
     const p=input.body.password;if(typeof p!=='string'||p.length<6)return json(res,400,{error:'WEAK_PASSWORD'});
     const file=path.join(demo,'accounts.json'),accounts=JSON.parse(fs.readFileSync(file,'utf8')),account=accounts.find(x=>x.uid===active.uid);
     account.salt=randomBytes(16).toString('hex');account.hash=scryptSync(p,account.salt,32).toString('hex');delete account.password;fs.writeFileSync(file,JSON.stringify(accounts));
     return json(res,200,session(active.uid));
    }
    return json(res,400,{error:'Unsupported action'});
   }
   const publicAction=input.action==='lookupHistory'||input.action==='lookup'||input.action==='publicQueue'||input.action==='get'&&input.path==='settings';
   if(!publicAction&&(!active||active.exp<Date.now()))return json(res,401,{error:'NOAUTH'});
   return json(res,200,{data:await handle(input,active?.uid,req.socket.remoteAddress)});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'GET required'});
  const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const file=path.resolve(root,'.'+relative);
  if(!file.startsWith(root+path.sep)||relative.includes('..'))return json(res,403,{error:'Forbidden'});
  const exists=fs.existsSync(file)&&fs.statSync(file).isFile(),target=exists?file:path.join(root,'404.html');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.txt':'text/plain','.xml':'application/xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
  const size=fs.statSync(target).size,range=req.headers.range;
  let start=0,end=size-1,partial=false;
  if(exists&&range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}if(match[1]){start=Number(match[1]);end=match[2]?Math.min(size-1,Number(match[2])):size-1}else start=Math.max(0,size-Number(match[2]));if(start>=size||start>end){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}partial=true;}
  res.writeHead(exists?(partial?206:200):404,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Length':end-start+1,...(partial?{'Content-Range':'bytes '+start+'-'+end+'/'+size}:{})});
  if(req.method==='HEAD')return res.end();fs.createReadStream(target,{start,end}).pipe(res);
 }catch(e){return json(res,e.status||500,{error:e.status?e.message:'تعذر تنفيذ العملية'});}
});
server.listen(Number(process.env.CLINIC_DEMO_PORT||4173),'127.0.0.1',()=>console.log('Local demo: http://127.0.0.1:'+server.address().port+' — credentials in .demo/guide.txt'));
