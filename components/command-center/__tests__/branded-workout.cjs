const {test}=require('node:test'),assert=require('node:assert/strict');
const {screen,act}=require('../../workout/__tests__/workout-screen-fixture.cjs');
const button=(h,label)=>h.r.root.findAllByType('Pressable').find(n=>n.props.accessibilityLabel===label);
const header=(h,label)=>h.r.root.findByType('Screen').props.options.headerRight().props.children.find(e=>e?.props.accessibilityLabel===label).props.onPress();
for(const os of ['android','web'])test(`${os}: session menu/confirmation consume Cancel, replacement, route-change and unmount callbacks`,async()=>{
 const h=await screen(undefined,os);try{
 await act(async()=>header(h,'Session options'));assert.ok(button(h,'Rename'),'branded menu');const oldDelete=button(h,'Delete session').props.onPress;
 await h.choose('Cancel');await act(async()=>oldDelete());assert.equal(h.requests.length,0);assert.equal(button(h,'Delete session'),undefined);
 await act(async()=>header(h,'Session options'));await h.choose('Delete session');const confirm=button(h,'Delete session').props.onPress;await h.switchRoute('second-session');await act(async()=>confirm());assert.equal(h.requests.length,0);
 await act(async()=>header(h,'Session options'));const stale=button(h,'Rename').props.onPress;await h.close();await act(async()=>stale());assert.equal(h.requests.length,0);
 }finally{await h.close()}
});
for(const os of ['android','web'])test(`${os}: exercise menu confirms one DELETE for each existing set, never on backdrop`,async()=>{
 const h=await screen(undefined,os);try{
 await act(async()=>h.card().props.onExerciseMenu('Bench Press'));assert.ok(button(h,'Delete exercise'));await h.choose('Delete exercise');const stale=button(h,'Delete exercise').props.onPress;
 const modal=h.r.root.findAllByType('Modal').find(m=>m.props.accessibilityLabel?.startsWith('Delete'));await act(async()=>modal.props.onRequestClose());await act(async()=>stale());assert.equal(h.requests.length,0);
 await act(async()=>h.card().props.onExerciseMenu('Bench Press'));await h.choose('Delete exercise');const accept=button(h,'Delete exercise').props.onPress;await act(async()=>{accept();accept()});assert.equal(h.requests.length,2);assert.deepEqual(h.requests.map(r=>r.url).sort(),['/api/workout-sets/one','/api/workout-sets/two']);
 }finally{await h.close()}
});
for(const os of ['android','web'])for(const choice of ['Cancel','Save & Finish','Discard & Finish'])test(`${os}: branded Finish ${choice} preserves actual draft ordering`,async()=>{
 const h=await screen(undefined,os);try{
 await h.edit('one',{weightKg:'90'});await h.finish();assert.ok(button(h,choice),'branded Finish');const old=button(h,choice).props.onPress;await h.choose(choice);await act(async()=>old());
 assert.equal(h.requests.length,choice==='Cancel'?0:choice==='Save & Finish'?2:1);
 if(choice==='Save & Finish')assert.deepEqual(h.requests.map(r=>r.url),['/api/workout-sets/one','/api/workout-sessions/test-session']);
 assert.equal(h.alerts.length,0);
 }finally{await h.close()}
});
