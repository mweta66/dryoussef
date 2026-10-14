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
test('booking commits go through the protected gateway and refresh from the server',async()=>{const {context:c}=clinic();let payload,refreshed=false;c.gateway=async(action,input,auth)=>{assert.equal(action,'commit');assert.equal(auth,true);payload=input};c.refreshData=async()=>{refreshed=true};const puts=[{n:{id:'one'}}];await c.commit(puts,[]);assert.equal(payload.puts,puts);assert.ok(refreshed)});
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
test('frontend contains no retired backend endpoints or keys',()=>{assert.doesNotMatch(code,/identitytoolkit|securetoken|firebasedatabase|AIza/);assert.match(code,/supabaseUrl/)});
