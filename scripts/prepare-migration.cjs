// Works on a user-supplied local export only. Does not connect to Firebase.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const core=require('../server/core.cjs');
const args=process.argv.slice(2);
if(args.length!==2)throw new Error('Usage: node scripts/prepare-migration.cjs INPUT.json OUTPUT.json');
const [input,output]=args.map(x=>path.resolve(x));
if(input===output||fs.existsSync(output))throw new Error('Output must be a new file; input is never overwritten.');
const state=JSON.parse(fs.readFileSync(input,'utf8'));state.sequences||={};
let count=0;
for(const [d,rows] of Object.entries(state.bookings||{})){
 core.date(d);const phones=new Set();
 for(const [key,x] of Object.entries(rows)){
  if(key!==x.id||d!==x.date)throw new Error('Booking key/date mismatch; review export first.');
  const normalized=core.booking(x);
  if(phones.has(normalized.phone))throw new Error('Duplicate phone on a clinic day; resolve before migration.');
  phones.add(normalized.phone);
  if(!Number.isInteger(x.no)||x.no<1)throw new Error('Invalid ticket number; review export first.');
  x.phone=normalized.phone;x.rev=Math.max(1,x.rev||0);
  delete x.lookupCode;
  const seq=d+'_'+x.b;state.sequences[seq]=Math.max(state.sequences[seq]||0,x.no);count++;
 }
}
core.rebuild(state);fs.writeFileSync(output,JSON.stringify(state,null,2));
console.log('Prepared '+count+' bookings in a new local file. No network requests; input unchanged.');
