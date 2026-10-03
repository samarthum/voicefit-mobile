const {test}=require('node:test'),assert=require('node:assert/strict');const {screen,act}=require('./branded-screen-harness.cjs');
for(const os of ['android','web'])test(`${os}: Clear conversation Cancel and late action are inert; confirm clears chat only once`,async()=>{
 const h=await screen('coach',os);try{
 const open=()=>h.r.root.findByType('CoachHeader').props.onClearConversationPress();await act(async()=>open());assert.ok(h.byId('app-prompt-action-1'));const old=h.byId('app-prompt-action-1').props.onPress;await h.press('Cancel');await act(async()=>old());assert.equal(h.requests.length,0);
 await act(async()=>open());const confirm=h.byId('app-prompt-action-1').props.onPress;await act(async()=>{confirm();confirm()});assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'/api/coach/clear');assert.equal(h.requests[0].method,'POST');assert.equal(h.requests[0].body,'{}');assert.equal(h.alerts.length,0);
 }finally{await h.close()}
});
test('Coach prompt invalidates when reply begins, account changes, or component unmounts',async()=>{
 const h=await screen('coach');try{
 const open=()=>h.r.root.findByType('CoachHeader').props.onClearConversationPress();await act(async()=>open());const stale=h.byId('app-prompt-action-1').props.onPress;await h.update({status:'streaming'});await act(async()=>stale());assert.equal(h.requests.length,0);
 await act(async()=>open());assert.ok(h.byId('app-prompt-action-0'));assert.equal(h.byId('app-prompt-action-1'),undefined);
 }finally{await h.close()}
});
for(const os of ['android','web'])test(`${os}: Sign out confirmation consumes cancel/account switch/unmount and one authorized action`,async()=>{
 const h=await screen('settings',os);try{
 await h.press('Sign Out');assert.ok(h.byId('app-prompt-action-1'));const old=h.byId('app-prompt-action-1').props.onPress;await h.press('Cancel');await act(async()=>old());assert.equal(h.events.filter(e=>e==='signOut').length,0);
 await h.press('Sign Out');const stale=h.byId('app-prompt-action-1').props.onPress;await h.update({userId:'second-user'});await act(async()=>stale());assert.equal(h.events.filter(e=>e==='signOut').length,0);
 await h.press('Sign Out');const confirm=h.byId('app-prompt-action-1').props.onPress;await act(async()=>{confirm();confirm()});assert.equal(h.events.filter(e=>e==='signOut').length,1);assert.equal(h.events.filter(e=>e==='clearCache').length,1);assert.equal(h.alerts.length,0);
 }finally{await h.close()}
});
