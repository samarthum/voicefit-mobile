const {test}=require('node:test'),assert=require('node:assert/strict');
const {screen,act}=require('./branded-screen-harness.cjs');
for(const caller of ['meals','saved'])for(const platform of ['android','web'])test(`${caller}/${platform}: real meal delete shows branded prompt, Cancel consumes stale action, exactly one confirmed DELETE`,async()=>{
 const h=await screen(caller,platform);try{
 const open=async()=>caller==='saved'?h.press('Delete meal'):act(async()=>h.byId('meals-delete-meal-one').props.onPress({stopPropagation(){}}));
 await open();assert.ok(h.byId('app-prompt-action-1'),'branded delete');const stale=h.byId('app-prompt-action-1').props.onPress;
 await h.press('Cancel');await act(async()=>stale());assert.equal(h.requests.length,0);
 await open();const confirm=h.byId('app-prompt-action-1').props.onPress;await act(async()=>{confirm();confirm()});assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'/api/meals/meal-one');assert.equal(h.requests[0].method,'DELETE');assert.equal(h.alerts.length,0);
 }finally{await h.close()}
});
for(const caller of ['meals','saved'])test(`${caller}: failed delete retains same-record retry without doubled request`,async()=>{
 const h=await screen(caller);try{
 h.response(async()=>{throw Error('Offline')});
 await (caller==='saved'?h.press('Delete meal'):act(async()=>h.byId('meals-delete-meal-one').props.onPress({stopPropagation(){}})));
 await h.press('Delete meal');assert.equal(h.requests.length,1);assert.ok(h.byId('app-prompt-action-1'));
 h.response(async()=>({deleted:true}));await h.press('Delete meal');assert.equal(h.requests.length,2);
 }finally{await h.close()}
});
test('saved meal route change consumes open Delete and Discard callbacks',async()=>{
 const h=await screen('saved');try{
 await h.press('Delete meal');const stale=h.byId('app-prompt-action-1').props.onPress;await h.update({id:'meal-two'});await act(async()=>stale());assert.equal(h.requests.length,0);
 const summary=h.r.root.findByType(h.load('@/components/meal-edit/MealSummaryCard').MealSummaryCard);await act(async()=>summary.props.onSelectMealType('dinner'));const done=h.r.root.findByType('Screen').props.options.headerRight();await act(async()=>done.props.onPress());assert.ok(h.byId('app-prompt-action-1'));const discard=h.byId('app-prompt-action-1').props.onPress;await h.update({id:'meal-three'});await act(async()=>discard());assert.equal(h.events.filter(e=>e==='back').length,0);
 }finally{await h.close()}
});
