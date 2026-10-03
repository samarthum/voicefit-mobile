const {test}=require('node:test'),assert=require('node:assert/strict');const {screen,act}=require('./branded-screen-harness.cjs');
for(const caller of ['meals','saved'])test(`${caller}: rejected confirmation consumes old callback and presents a fresh same-record retry`,async()=>{
 const h=await screen(caller);try{
 h.response(async()=>{throw Error('Offline')});await(caller==='saved'?h.press('Delete meal'):act(async()=>h.byId('meals-delete-meal-one').props.onPress({stopPropagation(){}})));
 const old=h.byId('app-prompt-action-1').props.onPress;await act(async()=>old());assert.equal(h.requests.length,1);await act(async()=>old());assert.equal(h.requests.length,1,'old rejected callback must be consumed');
 h.response(async()=>({deleted:true}));await act(async()=>h.byId('app-prompt-action-1').props.onPress());assert.equal(h.requests.length,2);
 }finally{await h.close()}
});
for(const exit of ['backdrop','requestClose','replacement','route','unmount'])test(`saved: ${exit} consumes actual delete callback`,async()=>{
 const h=await screen('saved');let closed=false;try{
 const openDelete=h.button('Delete meal').props.onPress;
 await act(async()=>openDelete());const old=h.byId('app-prompt-action-1').props.onPress;
 if(exit==='backdrop')await act(async()=>h.byId('app-prompt-backdrop').props.onPress());
 if(exit==='requestClose')await act(async()=>h.r.root.findAllByType('Modal').find(m=>m.props.accessibilityLabel==='Delete meal?').props.onRequestClose());
 if(exit==='replacement')await act(async()=>openDelete());
 if(exit==='route')await h.update({id:'new-meal'});
 if(exit==='unmount'){await h.close();closed=true;}
 await act(async()=>old());assert.equal(h.requests.length,0);
 }finally{if(!closed)await h.close()}
});
