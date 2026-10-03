const {test}=require('node:test');
const assert=require('node:assert/strict');
const {screen,makeSet,act}=require('./workout-screen-fixture.cjs');
test('standalone lost ACK retains exact UUID/payload, blocks new add and Finish, retries original once',async()=>{
 const s=await screen();try{
  let calls=0;s.response(async(_url,body)=>{if(++calls===1)throw new Error('committed but response lost');return makeSet('canonical-created',body);});
  await s.add().catch(()=>{});assert.ok(s.requests[0].body.requestId,'actual POST must have UUID');assert.match(s.requests[0].body.requestId,/^[a-f0-9-]{36}$/);
  assert.equal(s.data().sets.length,2,'unknown optimistic row rolled back');
  await s.add();await s.finish();assert.equal(s.requests.length,1,'unknown original blocks distinct add and Finish');
  assert.match(s.text(),/Retry original/);assert.match(s.text(),/memory|screen/i);
  await s.choose('Retry original');assert.deepEqual(s.requests[1].body,s.requests[0].body);
  assert.equal(s.data().sets.length,3);assert.equal(s.data().sets[2].id,'canonical-created');
  await s.add();assert.notEqual(s.requests[2].body.requestId,s.requests[0].body.requestId);
 }finally{await s.close();}
});

test('rapid Add Set taps serialize before the first render and preserve optimistic input under actual ID',async()=>{
 const s=await screen();let release;try{
  s.response(async(_url,body)=>{await new Promise(r=>release=r);return makeSet('canonical-created',body);});
  const add=s.card().props.onAddSet,card=s.card().props.card;let pending;
  await act(async()=>{pending=add(card);add(card);add({...card,name:'Squat'});});
  assert.equal(s.requests.length,1);assert.equal(s.data().sets.filter(row=>row.id.startsWith('temp-')).length,1);
  const temp=s.data().sets.find(row=>row.id.startsWith('temp-')).id;await s.edit(temp,{reps:'12'});
  await act(async()=>{release();await pending;});assert.equal(s.data().sets.length,3);assert.equal(s.card().props.drafts['canonical-created'].reps,'12');
 }finally{release?.();await s.close();}
});
test('acknowledged create survives refresh failure and Retry original reconciles without POST',async()=>{
 let fail=true;const s=await screen(undefined,'web',{invalidate:async()=>{if(fail)throw new Error('refresh failed');}});try{
  s.response(async(_url,body)=>makeSet('canonical-created',body));await s.add();assert.equal(s.requests.length,1);
  assert.match(s.text(),/Set saved/);assert.equal(s.data().sets.length,3);
  fail=false;await s.choose('Retry original');assert.equal(s.requests.length,1);assert.equal(s.data().sets.length,3);
  assert.equal(s.button('Retry original'),undefined);
 }finally{await s.close();}
});
test('invalid canonical create ACK retains original UUID through retry',async()=>{
 const s=await screen();try{
  s.response(async()=>({id:'not-a-row'}));await s.add();assert.equal(s.data().sets.length,2);assert.ok(s.button('Retry original'));
  s.response(async(_url,body)=>makeSet('canonical-created',body));await s.choose('Retry original');
  assert.deepEqual(s.requests[1].body,s.requests[0].body);assert.equal(s.data().sets.at(-1).id,'canonical-created');
 }finally{await s.close();}
});
test('uncertain original never becomes a new route payload and stale Retry cannot issue it',async()=>{
 const s=await screen();try{
  s.response(async()=>{throw new Error('lost ACK');});await s.add();const retry=s.button('Retry original').props.onPress;
  await s.switchRoute('different-session');await act(async()=>retry());assert.equal(s.requests.length,1);assert.equal(s.button('Retry original'),undefined);
  s.response(async(_url,body)=>makeSet('new-session-created',body));await s.add();assert.equal(s.requests[1].body.sessionId,'different-session');assert.notEqual(s.requests[1].body.requestId,s.requests[0].body.requestId);
  await s.switchRoute('test-session');assert.ok(s.button('Retry original'));s.response(async(_url,body)=>makeSet('original-created',body));await s.choose('Retry original');assert.deepEqual(s.requests[2].body,s.requests[0].body);
 }finally{await s.close();}
});
test('retry of unknown original does not append another optimistic row after refetch finds the committed row',async()=>{
 const s=await screen();let release;try{
  s.response(async()=>{throw new Error('lost ACK');});await s.add();
  const canonical=makeSet('canonical-created',s.requests[0].body);s.data().sets.push(canonical);
  s.response(async()=>{await new Promise(r=>release=r);return canonical;});let pending;
  await act(async()=>{pending=s.button('Retry original').props.onPress();});
  assert.equal(s.data().sets.length,3,'retry must not add an extra temporary row beside refetched canonical row');
  await act(async()=>{release();await pending;});assert.equal(s.data().sets.length,3);
 }finally{release?.();await s.close();}
});

test('obsolete Add Set callback cannot create against its old route after switching',async()=>{
 const s=await screen();try{
  const add=s.card().props.onAddSet,card=s.card().props.card;await s.switchRoute('different-session');
  s.response(async(_url,body)=>makeSet('created',body));await act(async()=>add(card));
  assert.equal(s.requests.length,0,'obsolete handler must not allocate/send a new old-session attempt');
 }finally{await s.close();}
});
