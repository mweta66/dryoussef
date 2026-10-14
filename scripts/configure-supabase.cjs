const fs=require('node:fs'),path=require('node:path');
const [url,key]=process.argv.slice(2);
if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url||''))throw Error('A valid Supabase project URL is required');
if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key||''))throw Error('Use the public publishable key, never the server secret');
const config={provider:'supabase',supabaseUrl:url,publishableKey:key,endpoint:url+'/functions/v1/clinic-api',secureGateway:true,demo:false};
fs.writeFileSync(path.resolve(__dirname,'../public/config.js'),'window.CLINIC_CONFIG='+JSON.stringify(config)+';\n');
console.log('Public Supabase connection configured. No server secret written.');
