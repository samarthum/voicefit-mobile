const {test}=require('node:test');
const assert=require('node:assert/strict');
const {screen,act}=require('./workout-screen-fixture.cjs');
for(const platform of ['ios','android']) {
 for(const exit of ['unmount','route','cancel','dismiss','replace']) test(`${platform} Finish prompt invalidates ${exit} without consuming a new prompt`,async()=>{
  const s=await screen(undefined,platform);let closed=false;try{
   await s.edit('one',{weightKg:'85'});await s.finish();const old=s.prompt();const save=old[2].find(b=>b.text==='Save & Finish').onPress;
   if(exit==='unmount'){await s.close();closed=true;}
   if(exit==='route')await s.switchRoute('different-session');
   if(exit==='cancel')await act(async()=>old[2][0].onPress?.());
   if(exit==='dismiss')await act(async()=>old[3]?.onDismiss?.());
   if(['cancel','dismiss','replace'].includes(exit)){
    await s.finish();const current=s.prompt();
    await act(async()=>{old[2][0].onPress?.();old[3]?.onDismiss?.();await save();});
    assert.equal(s.requests.length,0,'obsolete prompt must not write');
    await act(async()=>current[2].find(b=>b.text==='Save & Finish').onPress());
    assert.equal(s.requests.length,2,'obsolete cancellation must not consume current prompt');
   }else{await act(async()=>save());assert.equal(s.requests.length,0);}
  }finally{if(!closed)await s.close();}
 });
 test(`${platform} consumes double choice synchronously and saves latest draft`,async()=>{
  const s=await screen(undefined,platform);let release;try{
   await s.edit('one',{weightKg:'85'});await s.finish();await s.edit('one',{weightKg:'87.5'});
   s.response(async(url,body)=>{if(url.endsWith('/one'))await new Promise(r=>release=r);return url.includes('/workout-sets/')?{...s.data().sets[0],...body}:{...s.data(),...body};});
   const buttons=s.prompt()[2];const save=buttons[2].onPress;let pending;
   await act(async()=>{pending=save();save();buttons[1].onPress();});
   assert.equal(s.requests.length,1);assert.equal(s.requests[0].body.weightKg,87.5);
   await act(async()=>{release();await pending;});await act(async()=>save());assert.equal(s.requests.length,2);
  }finally{release?.();await s.close();}
 });
}
for(const platform of ['ios','android','web'])for(const exit of ['route','unmount'])test(`${platform} stops further Finish writes when ${exit} occurs during row acknowledgement`,async()=>{
 const s=await screen(undefined,platform);let release,closed=false,pending;try{
  await s.edit('one',{weightKg:'85'});await s.edit('two',{reps:'9'});await s.finish();
  s.response(async(url,body)=>{if(url.endsWith('/one'))await new Promise(r=>release=r);return {...s.data().sets[0],...body};});
  const save=platform==='web'?s.button('Save & Finish').props.onPress:s.prompt()[2][2].onPress;
  await act(async()=>{pending=save();});assert.equal(s.requests.length,1);
  if(exit==='unmount'){await s.close();closed=true;}else await s.switchRoute('different-session');
  await act(async()=>{release();await pending;});assert.equal(s.requests.length,1,'already-issued row may commit; no further old-context writes');
 }finally{release?.();if(!closed)await s.close();}
});

for(const choice of ['Save & Finish','Discard & Finish'])test(`native ${choice} checks screen context after awaiting auth before issuing a write`,async()=>{
 let release;const s=await screen(undefined,'ios',{getToken:()=>new Promise(r=>release=r)});let pending,closed=false;try{
  await s.edit('one',{weightKg:'85'});await s.finish();const run=s.prompt()[2].find(b=>b.text===choice).onPress;
  await act(async()=>{pending=run();});assert.equal(s.requests.length,0);await s.close();closed=true;
  await act(async()=>{release('token');await pending;});assert.equal(s.requests.length,0);
 }finally{release?.('token');if(!closed)await s.close();}
});
