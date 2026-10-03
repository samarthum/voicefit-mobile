const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,workout,byId}=require('./inline-save-harness.cjs');
test('saving keeps the review scrollable with measured footer allowance, not a compact-height sizing helper',async()=>{
 const h=await harness();try{await h.seed(workout());await h.setState('cc_saving');assert.deepEqual(h.modal().snapPoints,['92%']);const scroll=h.r.root.findAllByType('ScrollView').find(n=>n.props.enableFooterMarginAdjustment);assert.ok(scroll);assert.equal(scroll.props.showsVerticalScrollIndicator,false);assert.equal(byId(h.r,'cc-review-save').props.style.minHeight,52);assert.equal(h.r.root.findAllByType('Text').some(n=>n.props.allowFontScaling===false),false)}finally{await h.close()}
});
