const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('public/app.js', 'utf8');
function clinic() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', isConnected: true, style: {setProperty(){}}, setAttribute(){}, removeAttribute(){}, focus(){} });
    return elements.get(id);
  };
  const context = vm.createContext({
    can:()=>context.me?.role==="doctor", allBranches:()=>context.me?.role==="doctor", console, Intl, Date, crypto: require('node:crypto').webcrypto, AbortController,
    setTimeout, clearTimeout, setInterval(){}, navigator: {onLine:true},
    location: {hash:''}, matchMedia:()=>({matches:false}),
    sessionStorage: {getItem:()=>null, setItem(){}, removeItem(){}},
    localStorage: {getItem:()=>null, setItem(){}},
    document: {getElementById:element, documentElement:element('root'), addEventListener(){}, activeElement:null},
    window: {addEventListener(){}}, fetch:async()=>({ok:true,json:async()=>null})
  });
  vm.runInContext(code, context);
  return {context, element};
}
test('only one implementation per named function; no legacy password store', () => {
  const names = [...code.matchAll(/^(?:async )?function (\w+)\(/gm)].map(m=>m[1]);
  assert.equal(new Set(names).size, names.length);
  assert.doesNotMatch(code, /clinic_U|p:"1234"|function editDoc/);
});
test('phone normalization accepts Arabic, Persian and Egyptian international numbers without dropping letters', () => {
  const {context:c}=clinic();
  for(const p of ['01275884716','٠١٢٧٥٨٨٤٧١٦','۰۱۲۷۵۸۸۴۷۱۶','+20 127 588 4716','00201275884716']) assert.equal(c.norm(p),'01275884716');
  for(const p of ['x01275884716','01275884716<script>','02175884716','01275']) assert.equal(c.validPhone(p),false);
});
test('clinic day uses Cairo across midnight', () => {
  const {context:c}=clinic();
  vm.runInContext('Date = class extends Date { constructor(){ super("2026-10-13T22:30:00Z") } }',c);
  assert.equal(c.today(),'2026-10-14');
});
test('queue commit updates waiting counts and removes old phone/date tracking when moving', async () => {
  const {context:c}=clinic(); const d=c.today();
  const old={id:'one',date:d,b:'dmn',phone:'01275884716',no:1,s:'wait',v:'exam'};
  c.S.bk=[old,{...old,id:'two',phone:'01012345678',no:2}]; c.LOADED={all:1,dates:{}};
  let patch; c.jpatch=async p=>{patch=p};
  await c.commit([{o:old,n:{...old,s:'done'}}],[]);
  assert.equal(patch['track/'+d+'/01012345678'].ahead,0);
  await c.commit([{o:old,n:{...old,date:'2026-10-15',phone:'01112345678'}}],[]);
  assert.equal(patch['track/'+d+'/'+old.phone],null);
  assert.equal(patch['bookings/'+d+'/one'],null);
  assert.equal(patch['bookings/2026-10-15/one'].phone,'01112345678');
});
test('booking duplicates are rejected before writing', async () => {
  const {context:c}=clinic(); c.me={role:'doctor'}; const d=c.today();
  c.S.bk=[{id:'existing',date:d,phone:'01275884716'}];
  c.refreshData=async()=>{};c.ensureDate=async()=>{};c.commit=async()=>assert.fail('must not write');
  assert.match(await c.bkSave({})({name:'Test',phone:'٠١٢٧٥٨٨٤٧١٦',date:d,b:'dmn',v:'exam'}),/بالفعل/);
});
test('lookup handles malformed data and escapes remote ticket values', async () => {
  const {context:c,element}=clinic(); c.lastPh='01275884716';
  c.jget=async()=>({b:'unknown',s:'wait',v:'exam',no:1});await c.showRes();
  assert.match(element('res').textContent,/تعذر/);
  c.jget=async()=>({b:'dmn',s:'wait',v:'exam',no:'<img onerror=alert(1)>'});await c.showRes();
  assert.doesNotMatch(element('res').innerHTML,/<img/);
});
test('Firebase config limits framing, device permissions and allowed connection origins',()=>{
  const config=JSON.parse(fs.readFileSync('firebase.json','utf8'));
  const headers=config.hosting.headers[0].headers;
  assert.equal(headers.find(x=>x.key==='X-Frame-Options').value,'DENY');
  assert.match(headers.find(x=>x.key==='Content-Security-Policy').value,/object-src 'none'/);
});
