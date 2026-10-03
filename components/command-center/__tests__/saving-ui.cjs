// Intentionally replaces the archived dedicated compact-sheet contract.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,meal,byId,textOf}=require('./inline-save-harness.cjs');
test('pending review uses its existing small busy action, not a dedicated status panel',async()=>{
 const h=await harness();try{await h.seed(meal());h.defer();await h.start(byId(h.r,'cc-review-save').props.onPress);
 assert.equal(byId(h.r,'cc-saving-status'),undefined);assert.match(textOf(h.r),/Rice/);assert.match(textOf(h.r),/Saving…/);
 assert.equal(byId(h.r,'cc-review-save').findByType('ActivityIndicator').props.size,'small');assert.deepEqual(h.modal().snapPoints,['92%']);
 }finally{await h.close()}
});
test('all saving states retain review and footer, including inline error restoration',async()=>{
 const h=await harness();try{await h.seed(meal());for(const state of ['cc_saving','cc_auto_saving','cc_quick_add_saving']){await h.setState(state);assert.deepEqual(h.modal().snapPoints,['92%']);assert.ok(h.modal().footerComponent({}));assert.ok(byId(h.r,'cc-review-save'));assert.equal(h.modal().enablePanDownToClose,false);assert.equal(h.modal().backdropComponent({}).props.pressBehavior,'none');}assert.deepEqual(h.events,['present']);
 }finally{await h.close()}
});
