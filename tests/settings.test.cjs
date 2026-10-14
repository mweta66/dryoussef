const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('schedule validation accepts real 24-hour times',()=>{
 const source=fs.readFileSync('public/app.js','utf8');
 const expression=source.match(/&&\/(.*?)\/.test\(s.f\)/)[1];
 const regex=new RegExp(expression);
 assert.equal(regex.test('14:00'),true);
 assert.equal(regex.test('23:59'),true);
 for(const time of ['25:00','14:61','x14:00'])assert.equal(regex.test(time),false);
});
