const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,meal,byId,act}=require('./inline-save-harness.cjs');
test('ACK retains review detent/footer until dismissal then exposes the logging-bar snackbar and supports reentry',async()=>{
 const h=await harness();try{await h.seed(meal());await act(async()=>byId(h.r,'cc-review-save').props.onPress());assert.deepEqual(h.modal().snapPoints,['92%']);assert.ok(h.modal().footerComponent({}));assert.equal(byId(h.r,'cc-saved-toast'),undefined);await h.dismiss();assert.ok(byId(h.r,'cc-saved-toast'));assert.equal(h.modal().footerComponent({}),null);await h.dispatch({type:'open'});assert.equal(byId(h.r,'cc-saved-toast'),undefined);assert.equal(h.modal().enablePanDownToClose,true);assert.equal(h.modal().backdropComponent({}).props.pressBehavior,'close');await h.dismiss();assert.equal(h.snapshot().state,'cc_collapsed');}finally{await h.close()}
});
