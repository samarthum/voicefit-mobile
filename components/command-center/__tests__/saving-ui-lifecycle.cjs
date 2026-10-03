const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderOverlay,act}=require('./saving-ui-harness.cjs');
test('acknowledged save dismisses at the compact height and waits for dismissal before the existing saved toast',async()=>{
  const s=await renderOverlay();
  try{
    await s.update({state:'cc_saving',review:{kind:'meal'}});
    const savingSnap=s.modal().snapPoints;
    await s.update({state:'cc_saved'});
    assert.deepEqual(s.modal().snapPoints,savingSnap,'Do not expand the saving panel while dismissing it');
    assert.equal(s.r.root.findAll(n=>n.type==='SavedToastState').length,0);
    assert.deepEqual(s.events,['mount','present','dismiss']);
    await act(async()=>s.modal().onDismiss());
    assert.equal(s.r.root.findAll(n=>n.type==='SavedToastState').length,1);
    assert.deepEqual(s.dispatches,[]);
    await s.update({state:'cc_expanded_empty',review:null});
    assert.deepEqual(s.modal().snapPoints,['92%']);
    assert.equal(s.modal().enablePanDownToClose,true);
    assert.equal(s.modal().backdropComponent({}).props.pressBehavior,'close');
    await act(async()=>s.modal().onDismiss());
    assert.deepEqual(s.dispatches,[{type:'close'}]);
  }finally{await s.close()}
});
