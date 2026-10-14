const fs=require('node:fs'),path=require('node:path');
if(process.argv.length>2)throw new Error('Reset accepts no remote target. Local demo only.');
for(const name of ['state.json','accounts.json','guide.txt']){
 const target=path.resolve(__dirname,'../.demo',name);
 if(fs.existsSync(target))fs.unlinkSync(target);
}
console.log('Only the three generated local demo files were removed.');
