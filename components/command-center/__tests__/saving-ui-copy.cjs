const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,meal,workout,byId,textOf,act}=require('./inline-save-harness.cjs');
test('saving action is generic while completed meal/workout feedback is kind-specific',async()=>{
 for(const [draft,label] of [[meal(),'Meal added'],[workout(),'Sets added']]){const h=await harness();try{await h.seed(draft);h.defer();await h.start(byId(h.r,'cc-review-save').props.onPress);assert.match(textOf(h.r),/Saving…/);await h.release({id:'ack'});await h.dismiss();assert.equal(byId(h.r,'cc-saved-toast').findByType('Text').props.children,label)}finally{await h.close()}}
});
