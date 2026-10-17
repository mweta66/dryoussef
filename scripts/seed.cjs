const fs=require('node:fs'),path=require('node:path'),{randomBytes,scryptSync}=require('node:crypto');
const core=require('../server/core.cjs'),{makeDemo}=require('./demo-data.cjs');
if(process.argv.length>2)throw Error('Seed accepts no remote target. Local demo only.');
const dir=path.resolve(__dirname,'../.demo');if(fs.existsSync(path.join(dir,'state.json')))throw Error('Local data already exists. Use the administrator bulk-delete button or an explicitly reviewed reset procedure.');
const fixture=require('../fixtures/clinic-demo.json');if(fixture.synthetic!==true)throw Error('Only the synthetic fixture may be seeded');
const shift=Math.round((Date.parse(core.today()+'T12:00:00Z')-Date.parse(fixture.baseline+'T12:00:00Z'))/86400000);
function rebase(text){if(!/^\d{4}-\d{2}-\d{2}(?:$|T|_)/.test(text))return text;const d=new Date(text.slice(0,10)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+shift);return d.toISOString().slice(0,10)+text.slice(10);}
function copy(value){if(typeof value==='string')return rebase(value);if(Array.isArray(value))return value.map(copy);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[rebase(k),copy(v)]));return value;}
const {state,accounts}=makeDemo();Object.assign(state,copy(fixture.clinic));
const salt=randomBytes(16).toString('hex'),password=randomBytes(12).toString('base64url');accounts.push({uid:'demo_nurse',u:'nurse',password,salt,hash:scryptSync(password,salt,32).toString('hex')});state.roles.demo_nurse={r:'nurse',u:'nurse',scope:'all'};core.rebuild(state);
fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state),{flag:'wx',mode:0o600});fs.writeFileSync(path.join(dir,'accounts.json'),JSON.stringify(accounts),{flag:'wx',mode:0o600});
const samples=Object.values(state.bookings[core.today()]||{}).filter(x=>x.s==='wait').slice(0,8).map(x=>x.phone);
fs.writeFileSync(path.join(dir,'guide.txt'),'LOCAL DEMO ONLY\n'+accounts.map(x=>x.u+' / '+x.password).join('\n')+'\n\nToday tracking examples:\n'+samples.join('\n')+'\n',{flag:'wx',mode:0o600});console.log('Seeded 400 synthetic cases across four branches. Fresh local credentials: .demo/guide.txt. No network requests.');
