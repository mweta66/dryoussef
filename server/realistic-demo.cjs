// Synthetic clinical examples use the same schema and screens as newly entered records.
const {egyptianName,spouse}=require('./demo-names.cjs');
const {clinicalProfile}=require('./demo-profiles.cjs');
function realisticDemo(original){const s=structuredClone(original),phones=Object.keys(s.patients||{}).filter(p=>/^010000\d{5}$/.test(p)).sort();for(const [i,p]of phones.entries()){
 const name=egyptianName(i),{profile,bookingNote,file}=clinicalProfile(i);
 s.patients[p].n=name;for(const [k,v]of Object.entries(spouse(p)))if(s.patients[p][k]===undefined)s.patients[p][k]=v;
 for(const rows of Object.values(s.bookings||{}))for(const x of Object.values(rows))if(x.phone===p){x.name=name;x.nt=bookingNote;}
 const old=s.files?.[p];if(old)s.files[p]={...old,...file,rev:old.rev||1};
 let no=0;for(const c of Object.values(s.complaints?.[p]||{})){c.no=++no;c.reason=profile.reason;c.text=profile.text;c.tx=profile.treatment;c.by='nurse';}
 s.complaintSequences||={};s.complaintSequences[p]=Math.max(s.complaintSequences[p]||0,no);
 for(const n of Object.values(s.inbox||{}))if(n.p===p){n.n=name;n.by='nurse';}
 }return s;}
module.exports={realisticDemo,egyptianName};
