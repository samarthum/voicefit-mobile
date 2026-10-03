const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path');
const {screen,makeSet}=require('./workout-screen-fixture.cjs');
test('actual screen lost-ACK retry replays actual backend POST receipt: one row/event/receipt',async()=>{
 const child=spawn(process.env.WORKOUT_ROUTE_BUN || 'bun',[path.join(__dirname,'workout-add-route-fixture.js')],{stdio:['pipe','pipe','pipe']});
 let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);const queue=[];
 const lines=createInterface({input:child.stdout});lines.on('line',line=>queue.shift()?.resolve(JSON.parse(line)));
 const call=message=>new Promise((resolve,reject)=>{queue.push({resolve,reject});child.stdin.write(JSON.stringify(message)+'\n');});
 child.on('exit',code=>{for(const waiter of queue.splice(0))waiter.reject(new Error(`route fixture exited ${code}: ${stderr}`));});
 const sessionId='c1234567890123456789012345';
 const s=await screen([makeSet('one',{sessionId}),makeSet('two',{sessionId})],'web',{sessionId});
 try{
  let drop=true;const statuses=[],ids=[];
  s.response(async(url,body)=>{
   assert.equal(url,'/api/workout-sets');const reply=await call({body});statuses.push(reply.status);assert.equal(reply.status,201,JSON.stringify(reply));ids.push(reply.data.id);
   if(drop){drop=false;throw new Error('Commit confirmed in fixture; first ACK lost at client boundary');}
   return reply.data;
  });
  await s.add();assert.equal(s.requests.length,1);await s.add();await s.finish();assert.equal(s.requests.length,1);
  await s.choose('Retry original');assert.deepEqual(s.requests[1].body,s.requests[0].body);
  const stats=await call({stats:true});assert.equal(stats.rows.length,1);assert.equal(stats.events.length,1);assert.equal(stats.receipts.length,1);
  assert.deepEqual(statuses,[201,201]);assert.equal(ids[0],ids[1]);assert.equal(s.data().sets.at(-1).id,ids[0]);assert.equal(s.button('Retry original'),undefined);
  console.log('ACTUAL_SCREEN_ROUTE_REPLAY',JSON.stringify({statuses,ids,rows:stats.rows.length,events:stats.events.length,receipts:stats.receipts.length,requestId:s.requests[0].body.requestId}));
 }finally{await s.close();lines.close();child.stdin.end();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
});
