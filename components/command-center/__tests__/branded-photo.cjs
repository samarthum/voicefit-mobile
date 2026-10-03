const {test}=require('node:test');const assert=require('node:assert/strict');
const {harness,act,byId,textOf}=require('./inline-save-harness.cjs');
test('photo action renders two inline sources without asking OS permission; back keeps typed draft and consumes stale choices',async()=>{
 const h=await harness();try{
 await h.dispatch({type:'open'});await h.dispatch({type:'text.change',text:'my lunch draft'});
 const p=await h.start(()=>h.controller().dispatch({type:'photo.menu.open'}));
 assert.match(textOf(h.r),/Add a meal photo/);assert.match(textOf(h.r),/Take photo/);assert.match(textOf(h.r),/Choose from library/);
 const stale=byId(h.r,'cc-photo-source-library').props.onPress;
 await act(async()=>byId(h.r,'cc-photo-source-back').props.onPress());await p.pending;
 assert.equal(h.snapshot().input.text,'my lunch draft');assert.match(textOf(h.r),/Log anything/);
 await act(async()=>stale());assert.equal(h.snapshot().input.selectedMealPhoto,null);
 }finally{await h.close()}
});
for(const exit of ['close','open','record','route','unmount'])test(`photo chooser ${exit} settles and a late source cannot issue permission/picker`,async()=>{
 const mediaEvents=[],h=await harness({mediaEvents});let closed=false;try{
 await h.dispatch({type:'open'});const p=await h.start(()=>h.controller().dispatch({type:'photo.menu.open'}));const stale=byId(h.r,'cc-photo-source-library').props.onPress;
 if(exit==='unmount'){await h.close();closed=true}else await act(async()=>exit==='route'?h.publicApi().setScreenContext({screen:'workout',sessionId:'another'}):exit==='close'?h.publicApi().close():exit==='open'?h.publicApi().open():h.publicApi().record());
 let settled=false;p.pending.then(()=>settled=true);await act(async()=>{});assert.equal(settled,true,'cancel resolves source promise without another source tap');
 // Closing retains the old sheet body during its dismissal animation. The
 // controller must be collapsed and the retained source callback inert.
 // Compare booleans, not ReactTestInstance trees (cyclic failure formatting).
 if(!closed && exit==='close')assert.equal(h.snapshot().state,'cc_collapsed');
 else if(!closed)assert.equal(!!byId(h.r,'cc-photo-source-library'),false);
 await act(async()=>stale());assert.deepEqual(mediaEvents,[]);
 }finally{if(!closed)await h.close()}
});
for(const mode of ['camera','library'])test(`photo ${mode}: duplicate chooser and source taps issue exactly one permission/picker`,async()=>{
 const mediaEvents=[],h=await harness({mediaEvents});try{
 await h.dispatch({type:'open'});const p=await h.start(()=>h.controller().dispatch({type:'photo.menu.open'}));const choose=byId(h.r,`cc-photo-source-${mode}`).props.onPress;
 await act(async()=>{h.controller().dispatch({type:'photo.menu.open'});choose();choose()});await p.pending;
 assert.deepEqual(mediaEvents,[`${mode}-permission`,`${mode}-picker`]);assert.equal(h.snapshot().state,'cc_photo_context');assert.ok(h.snapshot().input.selectedMealPhoto);
 }finally{await h.close()}
});
