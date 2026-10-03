const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderOverlay,textOf}=require('./saving-ui-harness.cjs');
test('saving copy uses the review kind, keeps unknown entries generic, and knows quick-add is a meal',async()=>{
  const s=await renderOverlay();
  try{
    for(const [state,review,kind] of [
      ['cc_saving',{kind:'meal'},'meal'],['cc_saving',{kind:'workout'},'workout'],
      ['cc_auto_saving',{kind:'workout'},'workout'],['cc_auto_saving',null,'entry'],
      ['cc_saving',null,'entry'],['cc_quick_add_saving',null,'meal'],
      ['cc_quick_add_saving',{kind:'workout'},'meal'],
    ]){
      await s.update({state,review});
      assert.match(textOf(s.r),new RegExp(`Saving your ${kind}…`),`${state} ${JSON.stringify(review)}`);
    }
    assert.deepEqual(s.dispatches,[]);
  }finally{await s.close()}
});
