const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,act}=require('./ingredient-modal-harness.cjs');
for(const caller of ['saved','overlay'])test(`${caller}: branded ingredient removal is cancel-safe and late confirm cannot change another review/route`,async()=>{
 const h=await harness({caller});try{
 const id=caller==='saved'?'meal-edit-ingredient-0':'cc-review-ingredient-0';
 await act(async()=>h.byId(id).props.onLongPress());
 const confirm=h.byId('app-prompt-action-1');assert.ok(confirm,'branded confirmation renders');
 const stale=confirm.props.onPress;const before=h.draft();
 await h.press('app-prompt-action-0');await act(async()=>stale());assert.deepEqual(h.draft(),before);
 await act(async()=>h.byId(id).props.onLongPress());const old=h.byId('app-prompt-action-1').props.onPress;
 await (caller==='saved'?h.switchRoute():h.leaveReview());await act(async()=>old());assert.deepEqual(h.draft(),before);
 }finally{await h.close()}
});
